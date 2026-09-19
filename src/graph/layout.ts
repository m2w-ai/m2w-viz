import type { GraphEdge, GraphNode } from './model'

// Force-directed layout for an open node map. No columns, no layers.
//
// We run a simple physics simulation deterministically (seeded) so layout
// is stable across reloads — every node gets a position influenced by:
//
//   1. spring attraction along each edge (linked nodes pull together)
//   2. coulomb-style repulsion between every pair (nodes spread out)
//   3. gentle centring force (keeps the cluster on-screen)
//
// We run for a fixed iteration count, then translate the whole point cloud
// so its bounding box fits a generous viewport with padding.

export type NodeBox = {
  node: GraphNode
  x: number // top-left corner of the chip
  y: number
  width: number
  height: number
  cx: number // center (used by edge routing)
  cy: number
}

export type GraphLayout = {
  width: number
  height: number
  nodes: Record<string, NodeBox>
}

const NODE_W = 220
const NODE_H = 96
const PAD = 80

// Seeded PRNG so the layout is identical every reload.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

type Particle = {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  degree: number
}

export function computeLayout(
  NODES: readonly GraphNode[],
  EDGES: readonly GraphEdge[],
): GraphLayout {
  const rand = mulberry32(42)

  // Seed positions on a circle to give the simulation something coherent
  // to start from, instead of a random pile.
  const n = NODES.length
  const radius = 320
  const particles: Particle[] = NODES.map((p, i) => {
    const angle = (i / n) * Math.PI * 2 + rand() * 0.3
    return {
      id: p.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      degree: 0,
    }
  })

  const byId = new Map(particles.map((p) => [p.id, p]))

  // Count node degree (in + out) so we can give central nodes a slightly
  // heavier mass / stronger pull.
  for (const e of EDGES) {
    const a = byId.get(e.from)
    const b = byId.get(e.to)
    if (a) a.degree++
    if (b) b.degree++
  }

  const SPRING_K = 0.008 // edge attraction strength (softer = more spread)
  const SPRING_LEN = 380 // desired edge length
  const REPEL_K = 90000 // pairwise repulsion (higher = more spread)
  const CENTER_K = 0.0025 // pull toward (0,0)
  const DAMPING = 0.85
  const ITERATIONS = 800

  for (let step = 0; step < ITERATIONS; step++) {
    // Repulsion (every pair)
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i]
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist2 = Math.max(dx * dx + dy * dy, 25)
        const f = REPEL_K / dist2
        const dist = Math.sqrt(dist2)
        const fx = (dx / dist) * f
        const fy = (dy / dist) * f
        a.vx -= fx
        a.vy -= fy
        b.vx += fx
        b.vy += fy
      }
    }

    // Spring attraction along edges
    for (const e of EDGES) {
      const a = byId.get(e.from)
      const b = byId.get(e.to)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const stretch = dist - SPRING_LEN
      const f = SPRING_K * stretch
      const fx = (dx / dist) * f
      const fy = (dy / dist) * f
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }

    // Gentle pull toward the origin
    for (const p of particles) {
      p.vx -= p.x * CENTER_K
      p.vy -= p.y * CENTER_K
    }

    // Integrate + damp
    for (const p of particles) {
      p.vx *= DAMPING
      p.vy *= DAMPING
      p.x += p.vx
      p.y += p.vy
    }
  }

  // Translate so all chips fit in a positive box with PAD margin.
  const halfW = NODE_W / 2
  const halfH = NODE_H / 2
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of particles) {
    minX = Math.min(minX, p.x - halfW)
    minY = Math.min(minY, p.y - halfH)
    maxX = Math.max(maxX, p.x + halfW)
    maxY = Math.max(maxY, p.y + halfH)
  }
  const tx = PAD - minX
  const ty = PAD - minY
  const width = maxX - minX + PAD * 2
  const height = maxY - minY + PAD * 2

  const nodes: Record<string, NodeBox> = {}
  for (const p of particles) {
    const node = NODES.find((q) => q.id === p.id)!
    const cx = p.x + tx
    const cy = p.y + ty
    nodes[p.id] = {
      node,
      x: cx - halfW,
      y: cy - halfH,
      width: NODE_W,
      height: NODE_H,
      cx,
      cy,
    }
  }

  return { width, height, nodes }
}

/**
 * Curved path from one node to another. Attaches to the perimeter at the
 * angle pointing toward the target (so the line meets the edge of the chip
 * cleanly), and bows the curve outward perpendicular to the line so
 * bidirectional edges don't overlap.
 */
export function edgePath(from: NodeBox, to: NodeBox, bow = 24): string {
  // Vector from center to center
  const dx = to.cx - from.cx
  const dy = to.cy - from.cy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / dist
  const uy = dy / dist

  // Where the line crosses each rectangle perimeter. We approximate the
  // chip as an axis-aligned rect and find the exit point by clamping the
  // ray length to the rectangle's half-dimensions.
  const exit = (n: NodeBox, sx: number, sy: number) => {
    const halfW = n.width / 2
    const halfH = n.height / 2
    const tX = sx === 0 ? Infinity : halfW / Math.abs(sx)
    const tY = sy === 0 ? Infinity : halfH / Math.abs(sy)
    const t = Math.min(tX, tY)
    return { x: n.cx + sx * t, y: n.cy + sy * t }
  }

  const a = exit(from, ux, uy)
  const b = exit(to, -ux, -uy)

  // Perpendicular bow for a gentle curve
  const nx = -uy
  const ny = ux
  const mx = (a.x + b.x) / 2 + nx * bow
  const my = (a.y + b.y) / 2 + ny * bow

  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`
}
