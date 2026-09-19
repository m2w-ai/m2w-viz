import { useCallback, useEffect, useMemo, useState } from 'react'
import { ToolHeader } from '../shell/tool-header'
import { Graph } from './graph'
import { DetailPanel } from './detail-panel'
import type { GraphDataset } from './model'

// The graph tool: a force-directed map, an edge-kind legend that doubles as a
// filter, and a detail panel. It renders whatever `GraphDataset` it is handed.
export function GraphApp({ dataset }: { dataset: GraphDataset }) {
  const allKinds = useMemo(() => Object.keys(dataset.edgeKinds), [dataset])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [enabledKinds, setEnabledKinds] = useState<ReadonlySet<string>>(() => new Set(allKinds))

  const toggleKind = useCallback((kind: string) => {
    setEnabledKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const many = dataset.nodeNoun?.many ?? 'nodes'

  return (
    <div className="grid-bg flex min-h-screen flex-col">
      <ToolHeader title={dataset.title} subtitle={dataset.subtitle}>
        <Legend dataset={dataset} kinds={allKinds} enabledKinds={enabledKinds} onToggle={toggleKind} />
      </ToolHeader>

      <main className="flex flex-1 flex-col gap-5 px-6 py-5 lg:flex-row">
        <section className="relative flex-1 overflow-auto rounded-2xl border border-white/5 bg-black/30 p-4">
          <Graph
            dataset={dataset}
            selectedId={selectedId}
            hoveredId={hoveredId}
            edgeFilter={enabledKinds}
            onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
            onHover={setHoveredId}
          />
          <div className="pointer-events-none absolute right-4 bottom-3 left-4 flex items-center justify-between text-[11px] text-neutral-500">
            <span>click one of the {many} to drill in · hover to preview</span>
            <span>edges flow source → target</span>
          </div>
        </section>

        <section className="w-full shrink-0 lg:w-[360px] xl:w-[400px]">
          <DetailPanel dataset={dataset} selectedId={selectedId} onSelect={setSelectedId} />
        </section>
      </main>
    </div>
  )
}

function Legend({
  dataset,
  kinds,
  enabledKinds,
  onToggle,
}: {
  dataset: GraphDataset
  kinds: readonly string[]
  enabledKinds: ReadonlySet<string>
  onToggle: (k: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {kinds.map((kind) => {
        const meta = dataset.edgeKinds[kind]
        const on = enabledKinds.has(kind)
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onToggle(kind)}
            className={
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] transition ' +
              (on
                ? 'border-white/15 bg-white/[0.04] text-neutral-200'
                : 'border-white/5 bg-white/[0.01] text-neutral-600 hover:text-neutral-400')
            }
            aria-pressed={on}
          >
            <span
              aria-hidden
              className="inline-block h-2.5 w-5 rounded-full"
              style={{
                background: on ? meta.stroke : 'transparent',
                border: `1px solid ${meta.stroke}`,
                opacity: on ? 1 : 0.4,
              }}
            />
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}
