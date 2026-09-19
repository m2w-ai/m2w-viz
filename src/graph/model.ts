// Graph model: an open node-and-edge map. Every node is a thing, every edge a
// connection between two of them. No layering, no columns — the renderer uses
// a force-directed layout, so the map is free-form.
//
// The vocabulary is the dataset's: which statuses a node can have and which
// kinds of edge exist are declared alongside the data (`statuses`, `edgeKinds`)
// rather than fixed here, so the same tool draws a product map, a service
// topology or an org chart.

export type GraphNode = {
  id: string
  name: string
  /** Key into the dataset's `statuses`. */
  status: string
  /** Optional dated note, shown as `► <deadline>`. */
  deadline?: string
  summary: string
  /** Bullet points shown in the detail panel. */
  features: readonly string[]
}

export type GraphEdge = {
  from: string
  to: string
  /** Key into the dataset's `edgeKinds`. */
  kind: string
  label?: string
}

export type EdgeKindMeta = { label: string; stroke: string; dash?: string }

export type StatusMeta = {
  label: string
  /** Hex, for the SVG chip (Tailwind classes do not reach inside it). */
  hex: string
  /** Tailwind classes for the HTML badge in the detail panel. */
  color: string
  bg: string
  border: string
}

export type GraphDataset = {
  title: string
  subtitle?: string
  /** Singular / plural noun for a node: "Product" / "products". */
  nodeNoun?: { one: string; many: string }
  nodes: readonly GraphNode[]
  edges: readonly GraphEdge[]
  /** Legend order follows key order. */
  edgeKinds: Readonly<Record<string, EdgeKindMeta>>
  statuses: Readonly<Record<string, StatusMeta>>
}

export const DEFAULT_EDGE_KINDS: Record<string, EdgeKindMeta> = {
  'user-flow': { label: 'User flow', stroke: '#a78bfa' },
  content: { label: 'Content', stroke: '#38bdf8' },
  signal: { label: 'Signal / feedback', stroke: '#34d399' },
  gate: { label: 'Gating', stroke: '#fbbf24', dash: '6 5' },
}

export const DEFAULT_STATUSES: Record<string, StatusMeta> = {
  live: {
    label: 'Live',
    hex: '#6ee7b7',
    color: 'text-emerald-300',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/30',
  },
  beta: {
    label: 'Beta',
    hex: '#7dd3fc',
    color: 'text-sky-300',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/30',
  },
  milestone: {
    label: 'Milestone',
    hex: '#f0abfc',
    color: 'text-fuchsia-300',
    bg: 'bg-fuchsia-400/10',
    border: 'border-fuchsia-400/30',
  },
  planned: {
    label: 'Planned',
    hex: '#a3a3a3',
    color: 'text-neutral-400',
    bg: 'bg-white/[0.04]',
    border: 'border-white/10',
  },
}

const UNKNOWN_STATUS: StatusMeta = {
  label: 'Unknown',
  hex: '#a3a3a3',
  color: 'text-neutral-400',
  bg: 'bg-white/[0.04]',
  border: 'border-white/10',
}

const UNKNOWN_EDGE_KIND: EdgeKindMeta = { label: 'Other', stroke: '#a3a3a3' }

/** Never throws: a status the dataset forgot to declare renders as "Unknown". */
export function statusMeta(dataset: GraphDataset, status: string): StatusMeta {
  return dataset.statuses[status] ?? { ...UNKNOWN_STATUS, label: status }
}

export function edgeKindMeta(dataset: GraphDataset, kind: string): EdgeKindMeta {
  return dataset.edgeKinds[kind] ?? UNKNOWN_EDGE_KIND
}

export function graphNodeById(dataset: GraphDataset, id: string): GraphNode | undefined {
  return dataset.nodes.find((n) => n.id === id)
}

export function edgesFor(
  dataset: GraphDataset,
  id: string,
): { incoming: readonly GraphEdge[]; outgoing: readonly GraphEdge[] } {
  return {
    incoming: dataset.edges.filter((e) => e.to === id),
    outgoing: dataset.edges.filter((e) => e.from === id),
  }
}

/** Dangling references in a dataset. Empty means sound. */
export function validateGraph(dataset: GraphDataset): string[] {
  const problems: string[] = []
  const ids = new Set<string>()
  for (const node of dataset.nodes) {
    if (ids.has(node.id)) problems.push(`duplicate node id "${node.id}"`)
    ids.add(node.id)
    if (!(node.status in dataset.statuses)) {
      problems.push(`node "${node.id}" has undeclared status "${node.status}"`)
    }
  }
  for (const edge of dataset.edges) {
    if (!ids.has(edge.from)) problems.push(`edge source "${edge.from}" is not a node`)
    if (!ids.has(edge.to)) problems.push(`edge target "${edge.to}" is not a node`)
    if (!(edge.kind in dataset.edgeKinds)) {
      problems.push(`edge ${edge.from}→${edge.to} has undeclared kind "${edge.kind}"`)
    }
  }
  return problems
}
