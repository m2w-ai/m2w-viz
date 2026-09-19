import {
  edgeKindMeta,
  edgesFor,
  graphNodeById,
  statusMeta,
  type GraphDataset,
} from './model'

export function DetailPanel({
  dataset,
  selectedId,
  onSelect,
}: {
  dataset: GraphDataset
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  if (!selectedId) return <EmptyState dataset={dataset} onSelect={onSelect} />

  const product = graphNodeById(dataset, selectedId)
  if (!product) return <EmptyState dataset={dataset} onSelect={onSelect} />

  const status = statusMeta(dataset, product.status)
  const { incoming, outgoing } = edgesFor(dataset, selectedId)

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.28em] text-neutral-500 uppercase">
            {dataset.nodeNoun?.one ?? 'Node'}
          </div>
          <h2 className="font-display mt-1 text-xl font-semibold text-neutral-50">
            {product.name}
          </h2>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase ${status.color} ${status.bg} ${status.border}`}
        >
          {status.label}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-neutral-300">
        {product.summary}
      </p>

      {product.deadline && (
        <div className="flex flex-wrap gap-2 text-[11px] text-neutral-400">
          <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono">
            ► {product.deadline}
          </span>
        </div>
      )}

      {product.features.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-semibold tracking-[0.28em] text-neutral-500 uppercase">
            Features
          </div>
          <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-neutral-300">
            {product.features.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-fuchsia-400" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-4 border-t border-white/5 pt-4">
        <EdgeList
          dataset={dataset}
          title="Inbound"
          edges={incoming.map((e) => ({
            label: e.label,
            kind: e.kind,
            otherId: e.from,
            direction: 'in' as const,
          }))}
          onSelect={onSelect}
        />
        <EdgeList
          dataset={dataset}
          title="Outbound"
          edges={outgoing.map((e) => ({
            label: e.label,
            kind: e.kind,
            otherId: e.to,
            direction: 'out' as const,
          }))}
          onSelect={onSelect}
        />
      </div>
    </div>
  )
}

function EmptyState({
  dataset,
  onSelect,
}: {
  dataset: GraphDataset
  onSelect: (id: string | null) => void
}) {
  const many = dataset.nodeNoun?.many ?? 'nodes'
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
      <div>
        <div className="text-[10px] font-semibold tracking-[0.28em] text-neutral-500 uppercase">
          Browse
        </div>
        <h2 className="font-display mt-1 text-xl font-semibold text-neutral-50">
          All {many}
        </h2>
        <p className="mt-2 text-[13px] text-neutral-400">
          Click a node in the graph or an entry below to drill in.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-1.5">
        {dataset.nodes.map((p) => {
          const status = statusMeta(dataset, p.status)
          return (
            <li key={p.id}>
              <button
                type="button"
                className="group flex w-full items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
                onClick={() => onSelect(p.id)}
              >
                <span className="text-[13px] font-medium text-neutral-200">
                  {p.name}
                </span>
                <span
                  className={`text-[9px] font-semibold tracking-[0.16em] uppercase ${status.color}`}
                >
                  {status.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function EdgeList({
  dataset,
  title,
  edges,
  onSelect,
}: {
  dataset: GraphDataset
  title: string
  edges: Array<{
    label?: string
    kind: string
    otherId: string
    direction: 'in' | 'out'
  }>
  onSelect: (id: string | null) => void
}) {
  if (edges.length === 0) return null
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold tracking-[0.28em] text-neutral-500 uppercase">
        {title} · {edges.length}
      </div>
      <ul className="flex flex-col gap-1.5">
        {edges.map((e, i) => {
          const other = graphNodeById(dataset, e.otherId)
          if (!other) return null
          const meta = edgeKindMeta(dataset, e.kind)
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onSelect(other.id)}
                className="group flex w-full items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
              >
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: meta.stroke }}
                />
                <span className="text-[13px] text-neutral-300 group-hover:text-neutral-100">
                  {e.direction === 'in' ? '← ' : '→ '}
                  {other.name}
                </span>
                {e.label && (
                  <span className="ml-auto text-[10px] text-neutral-500">
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
