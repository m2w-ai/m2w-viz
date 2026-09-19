import { useCallback, useEffect, useMemo, useState } from 'react'
import { Funnel } from './funnel'
import { DetailPanel, StageRibbon } from './panels'
import { ToolHeader } from '../shell/tool-header'
import {
  kpiValue,
  nodesInStage,
  type FunnelDataset,
  type Scenario,
  type ScenarioId,
} from './model'

// The funnel tool: scenario tabs, a stage ribbon, the Sankey and a detail
// panel. It renders whatever `FunnelDataset` it is handed — see model.ts.
export function FunnelApp({ dataset }: { dataset: FunnelDataset }) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>(
    dataset.defaultScenarioId ?? dataset.scenarios[0].id,
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const scenario = dataset.scenarios.find((s) => s.id === scenarioId) ?? dataset.scenarios[0]

  // Switching scenarios: drop any selection/hover (node ids don't necessarily
  // map across scenarios — and even when they do, the surrounding flows differ
  // enough that keeping the old focus is confusing).
  const switchScenario = useCallback((id: ScenarioId) => {
    setScenarioId(id)
    setSelectedId(null)
    setHoveredId(null)
  }, [])

  const onPickStage = useCallback(
    (stageId: string) => {
      const first = nodesInStage(scenario, stageId)[0]
      if (first) setSelectedId(first.id)
    },
    [scenario],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const kpis = useMemo(
    () => (scenario.kpis ?? []).map((kpi) => ({ kpi, value: kpiValue(scenario, kpi) })),
    [scenario],
  )

  return (
    <div className="grid-bg flex min-h-screen flex-col">
      <ToolHeader title={dataset.title} subtitle={dataset.subtitle}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
          {kpis.map(({ kpi, value }) => (
            <Pill
              key={kpi.label}
              label={kpi.label}
              value={value.toLocaleString('en-US')}
              accent={kpi.accent}
            />
          ))}
          {dataset.unitNote && (
            <span className="ml-2 hidden text-[11px] text-neutral-500 lg:inline">
              {dataset.unitNote}
            </span>
          )}
        </div>
      </ToolHeader>

      {/* Scenario tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-black/20 px-6 py-2.5">
        <ScenarioTabs
          scenarios={dataset.scenarios}
          activeId={scenario.id}
          onSelect={switchScenario}
        />
        <span className="ml-3 hidden truncate text-[11px] text-neutral-500 lg:inline">
          {scenario.description}
        </span>
      </div>

      {/* KPI row */}
      <div className="px-6 pt-5">
        <StageRibbon scenario={scenario} onPickStage={onPickStage} />
      </div>

      {/* Main: funnel + side panel. A dense scenario asks for more vertical
          room through `minHeight`, so stacked small bars keep label headroom. */}
      <main className="flex flex-1 flex-col gap-5 px-6 py-5 md:flex-row">
        <section
          className="relative flex-1 overflow-hidden rounded-2xl border border-white/5 bg-black/30"
          style={{ minHeight: Math.max(640, (scenario.minHeight ?? 0) * 0.8) }}
        >
          <Funnel
            scenario={scenario}
            selectedId={selectedId}
            onSelect={setSelectedId}
            hoveredId={hoveredId}
            onHover={setHoveredId}
          />
          <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-neutral-500">
            <span>cohorts flow left → right</span>
            <span>thicker ribbon = more volume</span>
          </div>
        </section>

        <section className="w-full shrink-0 md:w-[340px] xl:w-[360px]">
          <DetailPanel
            scenario={scenario}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>
      </main>
    </div>
  )
}

function ScenarioTabs({
  scenarios,
  activeId,
  onSelect,
}: {
  scenarios: readonly Scenario[]
  activeId: ScenarioId
  onSelect: (id: ScenarioId) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Scenario"
      className="inline-flex rounded-lg border border-white/10 bg-white/[0.02] p-1"
    >
      {scenarios.map((sc) => {
        const id = sc.id
        const isActive = id === activeId
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(id)}
            className={
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ' +
              (isActive
                ? 'bg-white/[0.08] text-neutral-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200')
            }
          >
            <span>{sc.label}</span>
            <span
              className={
                'rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] ' +
                (isActive
                  ? 'bg-rose-500/15 text-rose-200'
                  : 'bg-white/[0.04] text-neutral-500')
              }
            >
              {sc.badge}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Pill({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'emerald' | 'rose' | 'violet'
}) {
  const accentCls =
    accent === 'emerald'
      ? 'text-emerald-300'
      : accent === 'rose'
        ? 'text-rose-300'
        : accent === 'violet'
          ? 'text-violet-300'
          : 'text-neutral-100'
  return (
    <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
      <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </span>
      <span className={`font-mono text-xs ${accentCls}`}>{value}</span>
    </span>
  )
}
