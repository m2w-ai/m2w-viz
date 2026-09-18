// Funnel model: a staged Sankey. A dataset is one or more `Scenario`s, each a
// self-contained graph — nodes sit in a stage (column), links carry volume
// between nodes in adjacent stages. Nothing here knows what the stages mean;
// the ids, titles and KPIs all come from the dataset.
//
// Convention: every node's outgoing links sum to (≈) its `value`; the visual
// gap between columns is the drop-off.

export type StageId = string
export type ScenarioId = string

export interface FunnelNode {
  id: string
  stage: StageId
  label: string
  sublabel?: string
  /** Volume represented by this node (users, events, currency — your unit). */
  value: number
  /** Optional accent color (hex). */
  color?: string
  /** Optional one-line description for the side panel. */
  description?: string
}

export interface FunnelLink {
  source: string
  target: string
  value: number
  /** Optional flow label (e.g. conversion rate annotation). */
  note?: string
}

export interface Stage {
  id: StageId
  title: string
  caption: string
}

/** A headline number in the top bar: the summed `value` of the named nodes. */
export interface ScenarioKpi {
  label: string
  /** Sum these nodes… */
  nodeIds?: readonly string[]
  /** …or every node in this stage. */
  stage?: StageId
  accent?: 'emerald' | 'rose' | 'violet'
}

export interface Scenario {
  id: ScenarioId
  label: string
  badge: string
  description: string
  /** Columns, left to right. */
  stages: Stage[]
  nodes: FunnelNode[]
  links: FunnelLink[]
  /** Headline pills in the top bar. */
  kpis?: readonly ScenarioKpi[]
  /**
   * Sizing exponent used by the layout to compress the spread between
   * the largest and smallest nodes. `1` = strict linear (true Sankey,
   * preserves absolute ratios). Values < 1 compress the spread —
   * `0.75`–`0.8` is the sweet spot for graphs with both very small (~10s)
   * and very large (~1000s) nodes. Numeric labels still show the real
   * values; only the visual heights are compressed. Default `1`.
   */
  valueExponent?: number
  /**
   * Minimum canvas height in px. Raise it for a scenario whose densest column
   * stacks many small bars: each node needs ~50px of label headroom on top of
   * its bar. Default 580.
   */
  minHeight?: number
}

/** What the funnel app renders: a set of scenarios and which one opens first. */
export interface FunnelDataset {
  title: string
  subtitle?: string
  /** Shown beside the KPI pills, e.g. "per month · illustrative". */
  unitNote?: string
  scenarios: readonly Scenario[]
  defaultScenarioId?: ScenarioId
}

export function nodeById(scenario: Scenario, id: string): FunnelNode | undefined {
  return scenario.nodes.find((n) => n.id === id)
}

export function linksFrom(scenario: Scenario, id: string): FunnelLink[] {
  return scenario.links.filter((l) => l.source === id)
}

export function linksTo(scenario: Scenario, id: string): FunnelLink[] {
  return scenario.links.filter((l) => l.target === id)
}

export function nodesInStage(scenario: Scenario, stage: StageId): FunnelNode[] {
  return scenario.nodes.filter((n) => n.stage === stage)
}

export function kpiValue(scenario: Scenario, kpi: ScenarioKpi): number {
  const ids = new Set(kpi.nodeIds ?? [])
  return scenario.nodes
    .filter((n) => ids.has(n.id) || (kpi.stage !== undefined && n.stage === kpi.stage))
    .reduce((total, n) => total + n.value, 0)
}

/**
 * Checks the references a dataset makes to itself. Layout dereferences link
 * endpoints without a guard, so a typo in an id would otherwise surface as a
 * crash deep inside it. Returns the problems found; empty means sound.
 */
export function validateScenario(scenario: Scenario): string[] {
  const problems: string[] = []
  const stageIds = new Set(scenario.stages.map((s) => s.id))
  const nodeIds = new Set<string>()
  if (scenario.stages.length < 2) problems.push('needs at least two stages')
  for (const node of scenario.nodes) {
    if (nodeIds.has(node.id)) problems.push(`duplicate node id "${node.id}"`)
    nodeIds.add(node.id)
    if (!stageIds.has(node.stage)) problems.push(`node "${node.id}" is in unknown stage "${node.stage}"`)
  }
  for (const link of scenario.links) {
    if (!nodeIds.has(link.source)) problems.push(`link source "${link.source}" is not a node`)
    if (!nodeIds.has(link.target)) problems.push(`link target "${link.target}" is not a node`)
  }
  for (const kpi of scenario.kpis ?? []) {
    for (const id of kpi.nodeIds ?? []) {
      if (!nodeIds.has(id)) problems.push(`KPI "${kpi.label}" names unknown node "${id}"`)
    }
    if (kpi.stage !== undefined && !stageIds.has(kpi.stage)) {
      problems.push(`KPI "${kpi.label}" names unknown stage "${kpi.stage}"`)
    }
  }
  return problems
}
