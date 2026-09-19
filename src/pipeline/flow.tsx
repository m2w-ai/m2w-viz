import { useId } from 'react'
import {
  litIds,
  nodesInStage,
  pipelineStatusMeta,
  type PipelineDataset,
  type PipelineStage,
  type PipelineStatusMeta,
} from './model'

export function PipelineSpread({
  dataset,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: {
  dataset: PipelineDataset
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
}) {
  const focusId = hoveredId ?? selectedId
  const lit = litIds(dataset, nodeFocus(dataset, focusId))
  const activeStage = stageFromFocus(dataset, focusId)

  return (
    <div className="relative h-full min-h-[760px] w-full p-5 sm:p-7">
      <RegistrationMarks />
      {/* The gutter path is drawn for two rows of three; with any other shape
          it would point at nothing, so it is left out. */}
      {dataset.stages.length > 3 && dataset.stages.length <= 6 && (
        <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden>
          <ReadingPath activeStage={activeStage} />
        </div>
      )}

      <div className="relative grid h-full grid-cols-1 gap-3 md:grid-cols-3 md:grid-rows-2 md:gap-4">
        {dataset.stages.map((stage) => (
          <StagePanel
            key={stage.id}
            dataset={dataset}
            stage={stage}
            selectedId={selectedId}
            focusId={focusId}
            lit={lit}
            isActiveStage={activeStage === stage.id}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  )
}

function StagePanel({
  dataset,
  stage,
  selectedId,
  focusId,
  lit,
  isActiveStage,
  onSelect,
  onHover,
}: {
  dataset: PipelineDataset
  stage: PipelineStage
  selectedId: string | null
  focusId: string | null
  lit: ReadonlySet<string> | null
  isActiveStage: boolean
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
}) {
  const nodes = nodesInStage(dataset, stage.id)
  const selectedHere = selectedId === stage.id

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(selectedHere ? null : stage.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(selectedHere ? null : stage.id)
        }
      }}
      onMouseEnter={() => onHover(stage.id)}
      onMouseLeave={() => onHover(null)}
      className={
        'group relative flex min-h-[320px] cursor-pointer flex-col overflow-hidden rounded-[2px] border text-left transition ' +
        (isActiveStage
          ? 'border-cyan-300/50 bg-cyan-400/[0.06] shadow-[inset_0_0_0_1px_rgba(103,232,249,0.12)]'
          : 'border-white/10 bg-black/25 hover:border-white/20 hover:bg-white/[0.03]')
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
        <div>
          <div className="font-mono text-[10px] tracking-[0.28em] text-neutral-500">
            {stage.index}
          </div>
          <div className="font-display text-lg font-semibold tracking-tight text-neutral-50">
            {stage.title}
          </div>
          <div className="mt-0.5 text-[11px] text-neutral-500">{stage.caption}</div>
        </div>
        <PanelCount mark={stage.index} />
      </div>

      <ul className="flex flex-1 flex-col gap-1.5 px-3 pb-3">
        {nodes.map((n) => {
          const dim = lit ? !lit.has(n.id) : false
          const focused = focusId === n.id
          const selected = selectedId === n.id
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(selected ? null : n.id)
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation()
                  onHover(n.id)
                }}
                onMouseLeave={() => onHover(stage.id)}
                className={
                  'flex w-full items-start justify-between gap-2 rounded-[2px] border px-2.5 py-2 text-left transition ' +
                  (selected
                    ? 'border-fuchsia-400/50 bg-fuchsia-400/10'
                    : focused
                      ? 'border-cyan-300/40 bg-cyan-400/10'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20') +
                  (dim ? ' opacity-30' : '')
                }
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium text-neutral-100">
                    {n.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-neutral-400">
                    {n.purpose}
                  </span>
                </span>
                <StatusDot meta={pipelineStatusMeta(dataset, n.status)} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function StatusDot({ meta }: { meta: PipelineStatusMeta }) {
  return (
    <span
      className={`shrink-0 rounded-[2px] border px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.16em] uppercase ${meta.color} ${meta.bg} ${meta.border}`}
    >
      {meta.label}
    </span>
  )
}

function PanelCount({ mark }: { mark: string }) {
  return (
    <span
      aria-hidden
      className="font-mono text-[11px] text-neutral-600 tabular-nums"
    >
      {mark}
    </span>
  )
}

function RegistrationMarks() {
  const cap = 'absolute h-3 w-3 border-white/25'
  return (
    <>
      <span className={`${cap} top-1 left-1 border-t border-l`} />
      <span className={`${cap} top-1 right-1 border-t border-r`} />
      <span className={`${cap} bottom-1 left-1 border-b border-l`} />
      <span className={`${cap} right-1 bottom-1 border-r border-b`} />
    </>
  )
}

/** Flow sits in the gutter between the two rows, with ticks into each panel. */
function ReadingPath({ activeStage }: { activeStage: string | null }) {
  const uid = useId().replace(/:/g, '')
  const xs = [166, 500, 834]
  const spineY = 320
  const topTick = 248
  const botTick = 392
  const lit = activeStage !== null

  const spine = `M ${xs[0]} ${spineY} L ${xs[2]} ${spineY}`
  const ticks = xs
    .map((x) => `M ${x} ${topTick} L ${x} ${botTick}`)
    .join(' ')

  return (
    <svg
      viewBox="0 0 1000 640"
      preserveAspectRatio="none"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id={`ink-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.7" />
          <stop offset="55%" stopColor="#f0abfc" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <path
        d={`${spine} ${ticks}`}
        fill="none"
        stroke={`url(#ink-${uid})`}
        strokeWidth={1.6}
        strokeDasharray="5 7"
        className="flow-anim"
        opacity={lit ? 0.9 : 0.4}
      />
    </svg>
  )
}

function nodeFocus(dataset: PipelineDataset, id: string | null): string | null {
  if (!id) return null
  if (dataset.nodes.some((n) => n.id === id)) return id
  return null
}

function stageFromFocus(dataset: PipelineDataset, id: string | null): string | null {
  if (!id) return null
  if (dataset.stages.some((s) => s.id === id)) return id
  return dataset.nodes.find((n) => n.id === id)?.stage ?? null
}

