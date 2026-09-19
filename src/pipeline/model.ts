// Pipeline model: a staged process you can walk through. Stages are the
// panels, nodes are the components inside a stage, edges say what feeds what,
// artifacts are the named things the pipeline hands on, and the walk is a
// guided tour that focuses one stage or artifact per step.
//
// Like the other tools, the vocabulary belongs to the dataset: stage ids,
// statuses and callouts are all declared alongside the data.

export type PipelineNode = {
  id: string
  /** Id of the stage this component sits in. */
  stage: string
  name: string
  /** Key into the dataset's `statuses`. */
  status: string
  /** One-line job: why this component exists in the pipeline. */
  purpose: string
  summary: string
  produces: readonly string[]
  /** Optional highlighted tag, labelled by `dataset.tagLabel`. */
  tag?: string
}

export type PipelineStage = {
  id: string
  /** Display index, e.g. "01". */
  index: string
  title: string
  caption: string
  thesis: string
}

export type PipelineArtifact = {
  id: string
  name: string
  role: string
  summary: string
}

export type WalkStep = {
  id: string
  title: string
  body: string
  focus: { kind: 'stage' | 'artifact'; id: string }
}

export type PipelineEdge = {
  from: string
  to: string
  label?: string
}

/** A worked example (or any aside) pinned under the stages, nodes or artifacts it illustrates. */
export type PipelineCallout = {
  /** Ids of the stages / nodes / artifacts whose detail view shows it. */
  attachTo: readonly string[]
  heading: string
  /** Monospace line above the body, e.g. the inputs of the example. */
  meta?: string
  body: string
  /** Monospace line below the body, e.g. where the result lands. */
  result?: string
}

export type PipelineStatusMeta = { label: string; color: string; bg: string; border: string }

export type PipelineDataset = {
  title: string
  subtitle?: string
  /** Bottom-right caption on the canvas. */
  footnote?: string
  /** Shown in the detail panel when nothing is selected. */
  emptyHint?: string
  /** Label for a node's `tag`. Default "Tag". */
  tagLabel?: string
  /** Laid out three to a row. */
  stages: readonly PipelineStage[]
  nodes: readonly PipelineNode[]
  edges: readonly PipelineEdge[]
  artifacts: readonly PipelineArtifact[]
  walk: readonly WalkStep[]
  callouts?: readonly PipelineCallout[]
  /** Legend order follows key order. */
  statuses: Readonly<Record<string, PipelineStatusMeta>>
}

export const DEFAULT_PIPELINE_STATUSES: Record<string, PipelineStatusMeta> = {
  live: {
    label: 'Live',
    color: 'text-emerald-300',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/30',
  },
  isolated: {
    label: 'Isolated',
    color: 'text-cyan-300',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/30',
  },
  planned: {
    label: 'Planned',
    color: 'text-amber-200',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/25',
  },
}

const UNKNOWN_STATUS: PipelineStatusMeta = {
  label: 'Unknown',
  color: 'text-neutral-400',
  bg: 'bg-white/[0.04]',
  border: 'border-white/10',
}

/** Never throws: an undeclared status renders under its own key. */
export function pipelineStatusMeta(dataset: PipelineDataset, status: string): PipelineStatusMeta {
  return dataset.statuses[status] ?? { ...UNKNOWN_STATUS, label: status }
}

export function stageById(dataset: PipelineDataset, id: string): PipelineStage | undefined {
  return dataset.stages.find((s) => s.id === id)
}

export function nodeById(dataset: PipelineDataset, id: string): PipelineNode | undefined {
  return dataset.nodes.find((n) => n.id === id)
}

export function artifactById(dataset: PipelineDataset, id: string): PipelineArtifact | undefined {
  return dataset.artifacts.find((a) => a.id === id)
}

export function nodesInStage(dataset: PipelineDataset, stageId: string): readonly PipelineNode[] {
  return dataset.nodes.filter((n) => n.stage === stageId)
}

export function calloutsFor(dataset: PipelineDataset, ...ids: string[]): readonly PipelineCallout[] {
  return (dataset.callouts ?? []).filter((c) => c.attachTo.some((id) => ids.includes(id)))
}

export function edgesFor(
  dataset: PipelineDataset,
  id: string,
): { incoming: readonly PipelineEdge[]; outgoing: readonly PipelineEdge[] } {
  return {
    incoming: dataset.edges.filter((e) => e.to === id),
    outgoing: dataset.edges.filter((e) => e.from === id),
  }
}

/** One-hop neighbors of a node, plus the node itself. */
export function litIds(dataset: PipelineDataset, focusId: string | null): ReadonlySet<string> | null {
  if (!focusId) return null
  const ids = new Set<string>([focusId])
  for (const e of dataset.edges) {
    if (e.from === focusId) ids.add(e.to)
    if (e.to === focusId) ids.add(e.from)
  }
  return ids
}

/** Dangling references in a dataset. Empty means sound. */
export function validatePipeline(dataset: PipelineDataset): string[] {
  const problems: string[] = []
  const stageIds = new Set(dataset.stages.map((s) => s.id))
  const artifactIds = new Set(dataset.artifacts.map((a) => a.id))
  const nodeIds = new Set<string>()
  if (dataset.walk.length === 0) problems.push('walk needs at least one step')
  for (const node of dataset.nodes) {
    if (nodeIds.has(node.id)) problems.push(`duplicate node id "${node.id}"`)
    nodeIds.add(node.id)
    if (!stageIds.has(node.stage)) problems.push(`node "${node.id}" is in unknown stage "${node.stage}"`)
    if (!(node.status in dataset.statuses)) {
      problems.push(`node "${node.id}" has undeclared status "${node.status}"`)
    }
  }
  for (const edge of dataset.edges) {
    if (!nodeIds.has(edge.from)) problems.push(`edge source "${edge.from}" is not a node`)
    if (!nodeIds.has(edge.to)) problems.push(`edge target "${edge.to}" is not a node`)
  }
  for (const step of dataset.walk) {
    const pool = step.focus.kind === 'stage' ? stageIds : artifactIds
    if (!pool.has(step.focus.id)) {
      problems.push(`walk step "${step.id}" focuses unknown ${step.focus.kind} "${step.focus.id}"`)
    }
  }
  const known = new Set([...stageIds, ...artifactIds, ...nodeIds])
  for (const callout of dataset.callouts ?? []) {
    for (const id of callout.attachTo) {
      if (!known.has(id)) problems.push(`callout "${callout.heading}" attaches to unknown id "${id}"`)
    }
  }
  return problems
}
