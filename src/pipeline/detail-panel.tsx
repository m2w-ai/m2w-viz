import {
  artifactById,
  calloutsFor,
  edgesFor,
  nodeById,
  nodesInStage,
  pipelineStatusMeta,
  stageById,
  type PipelineArtifact,
  type PipelineCallout,
  type PipelineDataset,
  type PipelineNode,
  type PipelineStage,
  type WalkStep,
} from './model'

export function DetailPanel({
  dataset,
  selectedId,
  walkIndex,
  onSelect,
  onWalk,
}: {
  dataset: PipelineDataset
  selectedId: string | null
  walkIndex: number
  onSelect: (id: string | null) => void
  onWalk: (index: number) => void
}) {
  const node = selectedId ? nodeById(dataset, selectedId) : undefined
  const stage = selectedId ? stageById(dataset, selectedId) : undefined
  const artifact = selectedId ? artifactById(dataset, selectedId) : undefined
  const step = dataset.walk[walkIndex]

  return (
    <div className="flex h-full flex-col gap-4 rounded-[2px] border border-white/10 bg-black/40 p-5 backdrop-blur">
      {step && (
        <WalkControls walk={dataset.walk} index={walkIndex} step={step} onWalk={onWalk} />
      )}

      {node ? (
        <NodeDetail dataset={dataset} node={node} onSelect={onSelect} />
      ) : stage ? (
        <StageDetail dataset={dataset} stage={stage} />
      ) : artifact ? (
        <ArtifactDetail dataset={dataset} artifact={artifact} />
      ) : (
        <EmptyHint dataset={dataset} />
      )}
    </div>
  )
}

function WalkControls({
  walk: WALK,
  index,
  step,
  onWalk,
}: {
  walk: readonly WalkStep[]
  index: number
  step: WalkStep
  onWalk: (index: number) => void
}) {
  return (
    <div className="border-b border-white/5 pb-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold tracking-[0.28em] text-neutral-500 uppercase">
          Walk the pipeline
        </div>
        <div className="font-mono text-[10px] text-neutral-600">
          {String(index + 1).padStart(2, '0')} / {String(WALK.length).padStart(2, '0')}
        </div>
      </div>
      <h2 className="font-display mt-2 text-lg leading-snug font-semibold text-neutral-50">
        {step.title}
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">{step.body}</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onWalk(Math.max(0, index - 1))}
          disabled={index === 0}
          className="rounded-[2px] border border-white/10 px-2.5 py-1 text-[11px] text-neutral-300 transition hover:border-white/20 hover:text-white disabled:opacity-30"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={() => onWalk(Math.min(WALK.length - 1, index + 1))}
          disabled={index === WALK.length - 1}
          className="rounded-[2px] border border-white/10 px-2.5 py-1 text-[11px] text-neutral-300 transition hover:border-white/20 hover:text-white disabled:opacity-30"
        >
          Next →
        </button>
        <div className="ml-auto flex gap-1">
          {WALK.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={s.title}
              onClick={() => onWalk(i)}
              className={
                'h-1.5 w-3 rounded-full transition ' +
                (i === index ? 'bg-cyan-300' : 'bg-white/15 hover:bg-white/30')
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function NodeDetail({
  dataset,
  node,
  onSelect,
}: {
  dataset: PipelineDataset
  node: PipelineNode
  onSelect: (id: string | null) => void
}) {
  const status = pipelineStatusMeta(dataset, node.status)
  const { incoming, outgoing } = edgesFor(dataset, node.id)
  const stage = stageById(dataset, node.stage)

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.28em] text-neutral-500 uppercase">
            {stage?.index} · {stage?.title}
          </div>
          <h3 className="font-display mt-1 text-xl font-semibold text-neutral-50">
            {node.name}
          </h3>
        </div>
        <span
          className={`shrink-0 rounded-[2px] border px-2 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase ${status.color} ${status.bg} ${status.border}`}
        >
          {status.label}
        </span>
      </div>
      <div>
        <div className="mb-1.5 text-[10px] font-semibold tracking-[0.28em] text-neutral-500 uppercase">
          Purpose
        </div>
        <p className="text-sm leading-relaxed text-neutral-100">{node.purpose}</p>
      </div>
      <p className="text-sm leading-relaxed text-neutral-400">{node.summary}</p>
      {node.produces.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-semibold tracking-[0.28em] text-neutral-500 uppercase">
            Produces
          </div>
          <div className="flex flex-wrap gap-1.5">
            {node.produces.map((p) => (
              <span
                key={p}
                className="rounded-[2px] border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-neutral-300"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
      {node.tag && (
        <div className="rounded-[2px] border border-fuchsia-400/20 bg-fuchsia-400/[0.06] px-3 py-2">
          <div className="text-[10px] font-semibold tracking-[0.22em] text-fuchsia-300/80 uppercase">
            {dataset.tagLabel ?? 'Tag'}
          </div>
          <div className="mt-1 font-mono text-[12px] text-fuchsia-100">
            {node.tag}
          </div>
        </div>
      )}
      <EdgeNav dataset={dataset} title="Feeds" edges={outgoing} direction="out" onSelect={onSelect} />
      <EdgeNav dataset={dataset} title="Fed by" edges={incoming} direction="in" onSelect={onSelect} />
      <Callouts callouts={calloutsFor(dataset, node.id, node.stage)} />
    </div>
  )
}

function StageDetail({ dataset, stage }: { dataset: PipelineDataset; stage: PipelineStage }) {
  const nodes = nodesInStage(dataset, stage.id)
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto">
      <div>
        <div className="text-[10px] font-semibold tracking-[0.28em] text-neutral-500 uppercase">
          Panel {stage.index}
        </div>
        <h3 className="font-display mt-1 text-xl font-semibold text-neutral-50">
          {stage.title}
        </h3>
      </div>
      <p className="text-sm leading-relaxed text-neutral-300">{stage.thesis}</p>
      <div>
        <div className="mb-2 text-[10px] font-semibold tracking-[0.28em] text-neutral-500 uppercase">
          Component purpose
        </div>
        <ul className="flex flex-col gap-2.5">
          {nodes.map((n) => (
            <li key={n.id} className="rounded-[2px] border border-white/10 bg-white/[0.02] px-3 py-2">
              <div className="text-[13px] font-medium text-neutral-100">{n.name}</div>
              <p className="mt-0.5 text-[12px] leading-snug text-neutral-400">{n.purpose}</p>
            </li>
          ))}
        </ul>
      </div>
      <Callouts callouts={calloutsFor(dataset, stage.id)} />
    </div>
  )
}

function ArtifactDetail({
  dataset,
  artifact,
}: {
  dataset: PipelineDataset
  artifact: PipelineArtifact
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <div className="text-[10px] font-semibold tracking-[0.28em] text-neutral-500 uppercase">
          {artifact.role}
        </div>
        <h3 className="font-display mt-1 text-xl font-semibold text-neutral-50">
          {artifact.name}
        </h3>
      </div>
      <p className="text-sm leading-relaxed text-neutral-300">{artifact.summary}</p>
      <Callouts callouts={calloutsFor(dataset, artifact.id)} />
      <div className="mt-auto grid gap-2">
        {dataset.artifacts.map((a) => (
          <div
            key={a.id}
            className={
              'rounded-[2px] border px-3 py-2 ' +
              (a.id === artifact.id
                ? 'border-cyan-300/30 bg-cyan-400/[0.06]'
                : 'border-white/10 bg-white/[0.02]')
            }
          >
            <div className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
              {a.role}
            </div>
            <div className="text-[13px] text-neutral-200">{a.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyHint({ dataset }: { dataset: PipelineDataset }) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-neutral-400">
        {dataset.emptyHint ?? 'Click a panel or a chip to see what it does and what it feeds.'}
      </p>
      <ul className="flex flex-col gap-1.5 text-[12px] text-neutral-500">
        {dataset.stages.map((s) => (
          <li key={s.id} className="flex gap-2">
            <span className="font-mono text-neutral-600">{s.index}</span>
            <span>{s.title}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Callouts({ callouts }: { callouts: readonly PipelineCallout[] }) {
  return (
    <>
      {callouts.map((c) => (
        <div
          key={c.heading}
          className="rounded-[2px] border border-amber-300/25 bg-amber-400/[0.06] px-3 py-3"
        >
          <div className="text-[10px] font-semibold tracking-[0.22em] text-amber-200/80 uppercase">
            {c.heading}
          </div>
          {c.meta && <div className="mt-1.5 font-mono text-[11px] text-amber-100/90">{c.meta}</div>}
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-200">{c.body}</p>
          {c.result && <div className="mt-2 font-mono text-[11px] text-neutral-400">→ {c.result}</div>}
        </div>
      ))}
    </>
  )
}

function EdgeNav({
  dataset,
  title,
  edges,
  direction,
  onSelect,
}: {
  dataset: PipelineDataset
  title: string
  edges: readonly { from: string; to: string; label?: string }[]
  direction: 'in' | 'out'
  onSelect: (id: string | null) => void
}) {
  if (edges.length === 0) return null
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold tracking-[0.28em] text-neutral-500 uppercase">
        {title} · {edges.length}
      </div>
      <ul className="flex flex-col gap-1.5">
        {edges.map((e) => {
          const otherId = direction === 'out' ? e.to : e.from
          const other = nodeById(dataset, otherId)
          if (!other) return null
          return (
            <li key={`${e.from}-${e.to}`}>
              <button
                type="button"
                onClick={() => onSelect(other.id)}
                className="flex w-full items-center gap-2 rounded-[2px] border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-left transition hover:border-white/15"
              >
                <span className="text-[12px] text-neutral-300">
                  {direction === 'out' ? '→' : '←'} {other.name}
                </span>
                {e.label && (
                  <span className="ml-auto font-mono text-[10px] text-neutral-500">
                    {e.label}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
