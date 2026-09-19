import { useCallback, useEffect, useState } from 'react'
import { ToolHeader } from '../shell/tool-header'
import { DetailPanel } from './detail-panel'
import { PipelineSpread } from './flow'
import { pipelineStatusMeta, type PipelineDataset } from './model'

// The pipeline tool: stage panels, an artifact strip, and a detail panel that
// carries a guided walk (← → steps through it). It renders whatever
// `PipelineDataset` it is handed.
export function PipelineApp({ dataset }: { dataset: PipelineDataset }) {
  const { walk } = dataset
  const [selectedId, setSelectedId] = useState<string | null>(walk[0]?.focus.id ?? null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [walkIndex, setWalkIndex] = useState(0)

  const onWalk = useCallback(
    (index: number) => {
      const step = walk[index]
      if (!step) return
      setWalkIndex(index)
      setSelectedId(step.focus.id)
      setHoveredId(null)
    },
    [walk],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        onWalk(Math.min(walk.length - 1, walkIndex + 1))
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onWalk(Math.max(0, walkIndex - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onWalk, walk.length, walkIndex])

  return (
    <div className="grid-bg flex min-h-screen flex-col">
      <ToolHeader title={dataset.title} subtitle={dataset.subtitle}>
        <StatusLegend dataset={dataset} />
      </ToolHeader>

      <div className="border-b border-white/5 bg-black/20 px-6 py-3">
        <ArtifactStrip dataset={dataset} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      <main className="flex flex-1 flex-col gap-5 px-6 py-5 lg:flex-row">
        <section className="relative min-h-[820px] flex-1 overflow-hidden rounded-[2px] border border-white/10 bg-black/30">
          <PipelineSpread
            dataset={dataset}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
            onHover={setHoveredId}
          />
          <div className="pointer-events-none absolute right-4 bottom-3 left-4 flex items-center justify-between text-[11px] text-neutral-500">
            <span>← → walks the story · click a panel or chip</span>
            {dataset.footnote && <span>{dataset.footnote}</span>}
          </div>
        </section>

        <section className="w-full shrink-0 lg:w-[360px] xl:w-[400px]">
          <DetailPanel
            dataset={dataset}
            selectedId={selectedId}
            walkIndex={walkIndex}
            onSelect={setSelectedId}
            onWalk={onWalk}
          />
        </section>
      </main>
    </div>
  )
}

function ArtifactStrip({
  dataset,
  selectedId,
  onSelect,
}: {
  dataset: PipelineDataset
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      {dataset.artifacts.map((a, i) => {
        const on = selectedId === a.id
        return (
          <div key={a.id} className="flex min-w-0 flex-1 items-stretch gap-2">
            {i > 0 && (
              <div
                aria-hidden
                className="hidden w-6 shrink-0 items-center justify-center text-neutral-600 sm:flex"
              >
                →
              </div>
            )}
            <button
              type="button"
              onClick={() => onSelect(on ? null : a.id)}
              className={
                'flex min-w-0 flex-1 flex-col rounded-[2px] border px-3 py-2 text-left transition ' +
                (on
                  ? 'border-cyan-300/40 bg-cyan-400/[0.08]'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20')
              }
            >
              <div className="text-[10px] font-semibold tracking-[0.22em] text-neutral-500 uppercase">
                {a.role}
              </div>
              <div className="truncate text-[13px] font-medium text-neutral-100">{a.name}</div>
            </button>
          </div>
        )
      })}
    </div>
  )
}

function StatusLegend({ dataset }: { dataset: PipelineDataset }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Object.keys(dataset.statuses).map((key) => {
        const meta = pipelineStatusMeta(dataset, key)
        return (
          <span
            key={key}
            className={`rounded-[2px] border px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase ${meta.color} ${meta.bg} ${meta.border}`}
          >
            {meta.label}
          </span>
        )
      })}
    </div>
  )
}
