import { useEffect, useMemo, useRef, useState } from 'react'
import { nodeById, type Scenario, type StageId } from './model'
import { computeLayout, type LaidOutLink, type LaidOutNode } from './layout'

interface FunnelProps {
  scenario: Scenario
  selectedId: string | null
  onSelect: (id: string | null) => void
  hoveredId: string | null
  onHover: (id: string | null) => void
}

const MIN_W = 1480
const MIN_H = 580

export function Funnel({ scenario, selectedId, onSelect, hoveredId, onHover }: FunnelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // A dense scenario asks for more room via `minHeight` — see model.ts.
  const minH = scenario.minHeight ?? MIN_H
  const [size, setSize] = useState({ w: MIN_W, h: minH })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Always lay out at a min logical width so labels never collide. The
        // SVG `viewBox` lets the browser scale that logical canvas down to
        // the actual container — narrower screens just get smaller text.
        const w = Math.max(MIN_W, Math.floor(entry.contentRect.width))
        const h = Math.max(minH, Math.floor(entry.contentRect.height))
        setSize({ w, h })
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [minH])

  const layout = useMemo(
    () => computeLayout({ scenario, width: size.w, height: size.h }),
    [scenario, size.w, size.h],
  )

  // What's "lit up":
  //   - selection (click) → trace BOTH directions transitively (full drilldown).
  //   - hover only → full forward walk PLUS one step back, so you can see what
  //     the node flows TO *and* what's feeding it, without dragging the entire
  //     upstream ancestry into the highlight.
  const focusId = selectedId ?? hoveredId
  const direction: 'both' | 'forward-plus-one-back' = selectedId
    ? 'both'
    : 'forward-plus-one-back'
  const lit = useMemo(
    () => computeLit(scenario, focusId, direction),
    [scenario, focusId, direction],
  )

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full"
        onClick={() => onSelect(null)}
      >
        <defs>
          {layout.nodes.map((n) => (
            <linearGradient
              key={`grad-${n.id}`}
              id={`grad-${n.id}`}
              x1="0%"
              x2="0%"
              y1="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor={n.color ?? '#a3a3a3'} stopOpacity="0.95" />
              <stop offset="100%" stopColor={n.color ?? '#a3a3a3'} stopOpacity="0.55" />
            </linearGradient>
          ))}
          {layout.links.map((l) => (
            <linearGradient
              key={`lgrad-${l.source}-${l.target}`}
              id={`lgrad-${l.source}-${l.target}`}
              x1="0%"
              x2="100%"
              y1="0%"
              y2="0%"
            >
              <stop
                offset="0%"
                stopColor={l.sourceNode.color ?? '#a3a3a3'}
                stopOpacity="0.55"
              />
              <stop
                offset="100%"
                stopColor={l.targetNode.color ?? '#a3a3a3'}
                stopOpacity="0.55"
              />
            </linearGradient>
          ))}
        </defs>

        {/* Stage headers */}
        {scenario.stages.map((stage, i) => {
          const x = layout.stageX[stage.id]
          const total = scenario.nodes
            .filter((n) => n.stage === stage.id)
            .reduce((a, n) => a + n.value, 0)
          return (
            <g key={stage.id} transform={`translate(${x}, 14)`}>
              <text
                x={layout.nodeWidth / 2}
                y={0}
                textAnchor="middle"
                className="fill-neutral-400"
                style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}
              >
                {String(i + 1).padStart(2, '0')} · {stage.title}
              </text>
              <text
                x={layout.nodeWidth / 2}
                y={16}
                textAnchor="middle"
                className="fill-neutral-500"
                style={{ fontSize: 10 }}
              >
                {stage.caption} · {fmt(total)}
              </text>
            </g>
          )
        })}

        {/* Ribbons (links) — render below nodes. A link lights up *only* if
            the BFS in computeLit traversed it — touching a lit node is not
            enough, because a downstream node (e.g. Training data) is fed by
            many ribbons that aren't on the path from the focus. */}
        <g>
          {layout.links.map((l) => {
            const isLit = lit.linkKeys.has(`${l.source}->${l.target}`)
            const dimmed = focusId !== null && !isLit
            return (
              <Ribbon
                key={`${l.source}->${l.target}`}
                link={l}
                dimmed={dimmed}
                highlighted={focusId !== null && isLit}
              />
            )
          })}
        </g>

        {/* Nodes (bars + labels) — on top of ribbons */}
        <g>
          {layout.nodes.map((n) => {
            const isLit = lit.nodes.has(n.id)
            const dimmed = focusId !== null && !isLit
            const isSelected = selectedId === n.id
            const isHovered = hoveredId === n.id
            return (
              <NodeBar
                key={n.id}
                node={n}
                dimmed={dimmed}
                selected={isSelected}
                hovered={isHovered}
                labelSide={labelSideFor(n.stage)}
                showSublabel={true}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(n.id === selectedId ? null : n.id)
                }}
                onEnter={() => onHover(n.id)}
                onLeave={() => onHover(null)}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
}

function NodeBar({
  node,
  dimmed,
  selected,
  hovered,
  labelSide,
  showSublabel,
  onClick,
  onEnter,
  onLeave,
}: {
  node: LaidOutNode
  dimmed: boolean
  selected: boolean
  hovered: boolean
  /** Which side of the bar to render labels on. */
  labelSide: 'left' | 'right'
  /** Whether to show the sublabel (turned off in cramped columns). */
  showSublabel: boolean
  onClick: (e: React.MouseEvent) => void
  onEnter: () => void
  onLeave: () => void
}) {
  const opacity = dimmed ? 0.25 : 1
  const labelAnchor: 'start' | 'end' = labelSide === 'left' ? 'end' : 'start'
  const labelX = labelSide === 'left' ? node.x - 10 : node.x + node.width + 10
  return (
    <g
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ cursor: 'pointer', opacity, transition: 'opacity 180ms ease' }}
    >
      {/* glow halo when selected */}
      {(selected || hovered) && (
        <rect
          x={node.x - 4}
          y={node.y - 4}
          width={node.width + 8}
          height={node.height + 8}
          rx={6}
          fill={node.color ?? '#a3a3a3'}
          opacity={selected ? 0.18 : 0.1}
        />
      )}
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={3}
        fill={`url(#grad-${node.id})`}
        stroke={selected ? '#fff' : node.color ?? '#a3a3a3'}
        strokeWidth={selected ? 1.5 : 0.5}
        className={selected ? 'node-pulse' : undefined}
      />
      {/* Label group — anchored at the top of the bar so taller bars don't
          push their text out of the column's vertical band. */}
      <g transform={`translate(${labelX}, ${node.y + 14})`}>
        <text
          textAnchor={labelAnchor}
          className="fill-neutral-100"
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          {node.label}
        </text>
        {showSublabel && node.sublabel && (
          <text
            y={13}
            textAnchor={labelAnchor}
            className="fill-neutral-500"
            style={{ fontSize: 10 }}
          >
            {node.sublabel}
          </text>
        )}
        <text
          y={showSublabel && node.sublabel ? 28 : 14}
          textAnchor={labelAnchor}
          className="fill-neutral-300"
          style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
        >
          {fmt(node.value)}
        </text>
      </g>
    </g>
  )
}

function Ribbon({
  link,
  dimmed,
  highlighted,
}: {
  link: LaidOutLink
  dimmed: boolean
  highlighted: boolean
}) {
  const opacity = dimmed ? 0.06 : highlighted ? 0.65 : 0.32
  return (
    <g style={{ opacity, transition: 'opacity 220ms ease' }}>
      <path
        d={link.path}
        fill="none"
        stroke={`url(#lgrad-${link.source}-${link.target})`}
        strokeWidth={link.thickness}
        strokeLinecap="butt"
      />
      {highlighted && (
        <path
          d={link.path}
          fill="none"
          stroke="#fff"
          strokeOpacity={0.35}
          strokeWidth={Math.max(link.thickness * 0.45, 1.5)}
          strokeLinecap="butt"
          className="flow-anim"
        />
      )}
    </g>
  )
}

interface LitSet {
  nodes: Set<string>
  linkKeys: Set<string>
}

/**
 * Compute the set of nodes/links transitively reachable from `focusId`.
 *
 * - `'forward-plus-one-back'` — full downstream walk + the immediate
 *   predecessor edges (one step back). Used on hover so the user sees where
 *   the cohort flows TO *and* what's feeding it, without the rest of the
 *   upstream ancestry adding noise.
 * - `'both'` — full transitive walk in both directions. Used on click, when
 *   the side panel exposes inbound and outbound side-by-side.
 *
 * Empty sets mean "no focus" (everything renders normally).
 */
function computeLit(
  scenario: Scenario,
  focusId: string | null,
  direction: 'forward-plus-one-back' | 'both',
): LitSet {
  const nodes = new Set<string>()
  const linkKeys = new Set<string>()
  if (!focusId || !nodeById(scenario, focusId)) return { nodes, linkKeys }

  const links = scenario.links
  nodes.add(focusId)
  // Forward BFS (always run — downstream is the "where do they go" answer).
  const fwd = [focusId]
  while (fwd.length) {
    const cur = fwd.shift()!
    for (const l of links) {
      if (l.source === cur) {
        linkKeys.add(`${l.source}->${l.target}`)
        if (!nodes.has(l.target)) {
          nodes.add(l.target)
          fwd.push(l.target)
        }
      }
    }
  }
  // Backward walk: how deep depends on intent.
  //   - 'forward-plus-one-back' → only the direct predecessor edges (one step).
  //     The predecessor *nodes* are added so they don't dim out, but we do NOT
  //     recurse further upstream — the user is asking "what flows through this
  //     node?", not "trace this all the way to its sources".
  //   - 'both' → full transitive ancestry, same as forward but mirrored.
  if (direction === 'both') {
    const bwd = [focusId]
    while (bwd.length) {
      const cur = bwd.shift()!
      for (const l of links) {
        if (l.target === cur) {
          linkKeys.add(`${l.source}->${l.target}`)
          if (!nodes.has(l.source)) {
            nodes.add(l.source)
            bwd.push(l.source)
          }
        }
      }
    }
  } else {
    for (const l of links) {
      if (l.target === focusId) {
        linkKeys.add(`${l.source}->${l.target}`)
        nodes.add(l.source)
      }
    }
  }
  return { nodes, linkKeys }
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return n.toString()
}

/**
 * All labels go to the RIGHT of their bar (i.e. into the *next* column's
 * gap, except the last column which projects into the right-side canvas
 * padding). This guarantees adjacent columns never aim labels at each
 * other, which is the only way to avoid collisions when columns are
 * densely packed.
 */
function labelSideFor(_stage: StageId): 'left' | 'right' {
  return 'right'
}
