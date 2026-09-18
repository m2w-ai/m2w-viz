import { type FunnelLink, type FunnelNode, type Scenario, type StageId } from './model'

export interface LaidOutNode extends FunnelNode {
  x: number
  y: number
  width: number
  height: number
  inboundTotal: number
  outboundTotal: number
}

export interface LaidOutLink extends FunnelLink {
  sourceNode: LaidOutNode
  targetNode: LaidOutNode
  /** Y position (px) where the ribbon attaches on the source's right edge. */
  sourceY: number
  /** Y position (px) where the ribbon attaches on the target's left edge. */
  targetY: number
  /** Ribbon thickness in px. */
  thickness: number
  path: string
}

export interface Layout {
  width: number
  height: number
  nodeWidth: number
  stageGap: number
  nodes: LaidOutNode[]
  links: LaidOutLink[]
  stageX: Record<StageId, number>
}

interface LayoutOptions {
  /** Scenario whose nodes/links/stages drive the layout. */
  scenario: Scenario
  width: number
  height: number
  /** Vertical padding inside the SVG. */
  paddingY?: number
  /** Horizontal padding inside the SVG. */
  paddingX?: number
  /** Node bar width in px. */
  nodeWidth?: number
  /** Min gap between sibling nodes inside a stage. */
  nodeGap?: number
  /** Pixels per unit of `value`. Computed automatically if not provided. */
  valueScale?: number
}

/**
 * Compute a Sankey-style layout for the funnel.
 *
 * Strategy:
 *  1. Determine a uniform value→px scale so the tallest stage fits.
 *  2. Stack nodes within each stage, ordered by id (stable across renders).
 *  3. For each node, compute attach points for inbound / outbound ribbons,
 *     proportional to each link's `value`.
 *  4. Render each ribbon as a cubic Bezier between the two attach points.
 */
export function computeLayout(opts: LayoutOptions): Layout {
  const {
    scenario,
    width,
    height,
    paddingY = 56,
    paddingX = 140,
    nodeWidth = 18,
    nodeGap = 14,
  } = opts
  const { nodes: NODES, links: LINKS, stages: STAGES, valueExponent = 1 } = scenario

  // "Display value" is what drives pixel heights. With exponent === 1 this is
  // strict linear (true Sankey, absolute ratios preserved). With 0 < exponent < 1
  // we compress the spread between very-small and very-large nodes so both
  // remain readable in the same view. Numeric labels in the UI always show
  // the raw `value`; only the bar/ribbon geometry is compressed.
  const displayValue = (v: number) => Math.pow(Math.max(v, 0), valueExponent)

  // 1. Scale: largest stage by total displayValue determines pixel scale.
  const usableHeight = height - paddingY * 2
  const stageTotals = STAGES.map((s) =>
    NODES.filter((n) => n.stage === s.id).reduce((a, n) => a + displayValue(n.value), 0),
  )
  const maxStageTotal = Math.max(...stageTotals)
  const maxStageIdx = stageTotals.indexOf(maxStageTotal)
  const totalGapForMaxStage =
    (NODES.filter((n) => n.stage === STAGES[maxStageIdx].id).length - 1) * nodeGap
  const valueScale =
    opts.valueScale ?? (usableHeight - totalGapForMaxStage) / Math.max(maxStageTotal, 1)

  // 2. X positions for each stage column.
  const usableWidth = width - paddingX * 2
  const stageGap = (usableWidth - STAGES.length * nodeWidth) / (STAGES.length - 1)
  const stageX: Record<StageId, number> = {} as Record<StageId, number>
  STAGES.forEach((s, i) => {
    stageX[s.id] = paddingX + i * (nodeWidth + stageGap)
  })

  // 3. Y positions: stack each stage's nodes, centered vertically.
  const laidOut: LaidOutNode[] = []
  for (const stage of STAGES) {
    const stageNodes = NODES.filter((n) => n.stage === stage.id)
    const totalH =
      stageNodes.reduce((a, n) => a + displayValue(n.value) * valueScale, 0) +
      Math.max(0, stageNodes.length - 1) * nodeGap
    let y = paddingY + (usableHeight - totalH) / 2
    for (const node of stageNodes) {
      const h = Math.max(displayValue(node.value) * valueScale, 8)
      const inboundTotal = LINKS.filter((l) => l.target === node.id).reduce(
        (a, l) => a + l.value,
        0,
      )
      const outboundTotal = LINKS.filter((l) => l.source === node.id).reduce(
        (a, l) => a + l.value,
        0,
      )
      laidOut.push({
        ...node,
        x: stageX[node.stage],
        y,
        width: nodeWidth,
        height: h,
        inboundTotal,
        outboundTotal,
      })
      y += h + nodeGap
    }
  }

  // 4. Links: compute attach offsets along each node's left/right edge.
  //
  // Two-pass ordering to keep ribbons from crossing within either node:
  //   a) Inbound order per target = sort by source-node y (top-source on top).
  //      This fixes each link's target-side attach Y.
  //   b) Outbound order per source = sort by the link's target-side attach Y.
  //      That way outbound ribbons fan out in the same vertical sequence
  //      they land in — no S-curves where a single ribbon dives below another.
  const byId = new Map(laidOut.map((n) => [n.id, n]))

  // (a) inbound order per target node
  const inboundOrder = new Map<string, FunnelLink[]>()
  for (const node of laidOut) {
    const inb = LINKS.filter((l) => l.target === node.id).sort((a, b) => {
      const sA = byId.get(a.source)!
      const sB = byId.get(b.source)!
      return sA.y - sB.y
    })
    inboundOrder.set(node.id, inb)
  }

  // Pre-compute each link's target attach Y (center on the target's left edge).
  const targetAttachY = new Map<FunnelLink, number>()
  for (const node of laidOut) {
    const inb = inboundOrder.get(node.id)!
    let offset = 0
    for (const link of inb) {
      const share = link.value / Math.max(node.inboundTotal, 1)
      const thickness = share * node.height
      targetAttachY.set(link, node.y + offset + thickness / 2)
      offset += thickness
    }
  }

  // (b) outbound order per source node, by computed target attach Y.
  const outboundOrder = new Map<string, FunnelLink[]>()
  for (const node of laidOut) {
    const out = LINKS.filter((l) => l.source === node.id).sort((a, b) => {
      return (targetAttachY.get(a) ?? 0) - (targetAttachY.get(b) ?? 0)
    })
    outboundOrder.set(node.id, out)
  }

  // Walk every link in (sourceY, outbound-order) so ribbons render top→bottom.
  const orderedLinks: FunnelLink[] = []
  for (const node of [...laidOut].sort((a, b) => a.y - b.y)) {
    const out = outboundOrder.get(node.id) ?? []
    for (const link of out) orderedLinks.push(link)
  }

  const links: LaidOutLink[] = []
  for (const link of orderedLinks) {
    const s = byId.get(link.source)!
    const t = byId.get(link.target)!

    const sShare = link.value / Math.max(s.outboundTotal, 1)
    const sThickness = sShare * s.height
    const tShare = link.value / Math.max(t.inboundTotal, 1)
    const tThickness = tShare * t.height

    // Source attach Y: walk outboundOrder for this source up to this link.
    const outList = outboundOrder.get(s.id)!
    const sIdx = outList.indexOf(link)
    let sOffset = 0
    for (let i = 0; i < sIdx; i++) {
      const prev = outList[i]
      sOffset += (prev.value / Math.max(s.outboundTotal, 1)) * s.height
    }
    const sCenter = s.y + sOffset + sThickness / 2

    const tCenter = targetAttachY.get(link)!

    const x0 = s.x + s.width
    const x1 = t.x
    const cx = (x0 + x1) / 2
    const path = `M ${x0} ${sCenter} C ${cx} ${sCenter}, ${cx} ${tCenter}, ${x1} ${tCenter}`

    links.push({
      ...link,
      sourceNode: s,
      targetNode: t,
      sourceY: sCenter,
      targetY: tCenter,
      thickness: Math.max((sThickness + tThickness) / 2, 1.5),
      path,
    })
  }

  return {
    width,
    height,
    nodeWidth,
    stageGap,
    nodes: laidOut,
    links,
    stageX,
  }
}

