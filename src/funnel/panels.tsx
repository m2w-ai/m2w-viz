import {
  linksFrom,
  linksTo,
  nodeById,
  nodesInStage,
  type Scenario,
} from './model'

export function StageRibbon({
  scenario,
  onPickStage,
}: {
  scenario: Scenario
  onPickStage?: (stageId: string) => void
}) {
  const totals = scenario.stages.map((s) => ({
    stage: s,
    total: scenario.nodes
      .filter((n) => n.stage === s.id)
      .reduce((a, n) => a + n.value, 0),
  }))
  const top = totals[0].total
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${totals.length}, minmax(0, 1fr))` }}
    >
      {totals.map(({ stage, total }, i) => {
        const prev = i === 0 ? null : totals[i - 1].total
        const conv = prev ? Math.round((total / prev) * 100) : null
        const srcPct = Math.round((total / top) * 100)
        return (
          <button
            key={stage.id}
            onClick={() => onPickStage?.(stage.id)}
            className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-white/15 hover:bg-white/[0.04]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                {String(i + 1).padStart(2, '0')} · {stage.title}
              </span>
              {conv !== null && (
                <span
                  className={
                    'shrink-0 font-mono text-[10px] ' +
                    (conv >= 60
                      ? 'text-emerald-400'
                      : conv >= 30
                        ? 'text-amber-400'
                        : conv > 100
                          ? 'text-violet-400'
                          : 'text-rose-400')
                  }
                  title={conv > 100 ? 'multi-action: users do >1 action here' : 'pass-through %'}
                >
                  {conv}%
                </span>
              )}
            </div>
            <div className="mt-1 font-mono text-xl leading-none text-neutral-50">
              {fmtFull(total)}
            </div>
            <div className="mt-1 truncate text-[10px] text-neutral-500">
              {stage.caption}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400"
                style={{ width: `${srcPct}%` }}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function DetailPanel({
  scenario,
  selectedId,
  onSelect,
}: {
  scenario: Scenario
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  if (!selectedId) {
    return <OverviewPanel scenario={scenario} onSelect={onSelect} />
  }
  const node = nodeById(scenario, selectedId)
  if (!node) return null
  const inb = linksTo(scenario, node.id)
  const outb = linksFrom(scenario, node.id)
  const inboundTotal = inb.reduce((a, l) => a + l.value, 0)
  const outboundTotal = outb.reduce((a, l) => a + l.value, 0)

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">
            {stageTitleOf(scenario, node.stage)}
          </div>
          <h2 className="mt-1 text-xl font-semibold text-neutral-50">{node.label}</h2>
          {node.sublabel && (
            <div className="text-sm text-neutral-400">{node.sublabel}</div>
          )}
        </div>
        <button
          onClick={() => onSelect(null)}
          className="rounded-md border border-white/10 px-2 py-1 text-xs text-neutral-400 hover:bg-white/5"
        >
          esc
        </button>
      </header>

      {node.description && (
        <p className="text-sm leading-relaxed text-neutral-300">{node.description}</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Volume" value={fmtFull(node.value)} accent={node.color} />
        <Stat label="Inbound" value={fmtFull(inboundTotal)} />
        <Stat label="Outbound" value={fmtFull(outboundTotal)} />
      </div>

      {inb.length > 0 && (
        <FlowList
          scenario={scenario}
          title="Inbound from"
          links={inb.map((l) => ({ link: l, otherId: l.source }))}
        />
      )}
      {outb.length > 0 && (
        <FlowList
          scenario={scenario}
          title="Outbound to"
          links={outb.map((l) => ({ link: l, otherId: l.target }))}
        />
      )}
    </aside>
  )
}

function OverviewPanel({
  scenario,
  onSelect,
}: {
  scenario: Scenario
  onSelect: (id: string | null) => void
}) {
  const topConversions = scenario.stages.slice(0, -1).map((s, i) => {
    const next = scenario.stages[i + 1]
    const a = scenario.nodes
      .filter((n) => n.stage === s.id)
      .reduce((acc, n) => acc + n.value, 0)
    const b = scenario.nodes
      .filter((n) => n.stage === next.id)
      .reduce((acc, n) => acc + n.value, 0)
    return { from: s, to: next, a, b, rate: b / a }
  })

  // The last column is where the funnel pays out, whatever the dataset calls it.
  const lastStage = scenario.stages[scenario.stages.length - 1]
  const valueNodes = nodesInStage(scenario, lastStage.id).sort(
    (a, b) => b.value - a.value,
  )

  return (
    <aside className="flex h-full flex-col gap-5 overflow-y-auto rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-neutral-500">
          <span>Overview</span>
          <span className="rounded-sm border border-white/10 px-1.5 py-0.5 text-[9px] text-neutral-400">
            {scenario.badge}
          </span>
        </div>
        <h2 className="mt-1 text-xl font-semibold text-neutral-50">
          {scenario.label}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          {scenario.description}
        </p>
      </div>

      <section>
        <h3 className="mb-2 text-xs uppercase tracking-[0.18em] text-neutral-500">
          Stage conversions
        </h3>
        <ul className="space-y-2">
          {topConversions.map((c) => (
            <li
              key={c.from.id}
              className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
            >
              <div className="flex-1 truncate text-sm">
                <span className="text-neutral-300">{c.from.title}</span>
                <span className="mx-2 text-neutral-600">→</span>
                <span className="text-neutral-100">{c.to.title}</span>
              </div>
              <ConvBadge rate={c.rate} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-xs uppercase tracking-[0.18em] text-neutral-500">
          {lastStage.title}
        </h3>
        <ul className="space-y-2">
          {valueNodes.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => onSelect(n.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: n.color ?? '#a3a3a3' }}
                />
                <span className="flex-1 truncate text-sm text-neutral-200">
                  {n.label}
                </span>
                <span className="font-mono text-xs text-neutral-400">
                  {fmtFull(n.value)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-lg"
        style={{ color: accent ?? '#fafafa' }}
      >
        {value}
      </div>
    </div>
  )
}

function FlowList({
  scenario,
  title,
  links,
}: {
  scenario: Scenario
  title: string
  links: { link: { value: number; note?: string }; otherId: string }[]
}) {
  const total = links.reduce((a, l) => a + l.link.value, 0)
  return (
    <section>
      <h3 className="mb-2 text-xs uppercase tracking-[0.18em] text-neutral-500">
        {title}
      </h3>
      <ul className="space-y-1.5">
        {links
          .slice()
          .sort((a, b) => b.link.value - a.link.value)
          .map(({ link, otherId }) => {
            const other = nodeById(scenario, otherId)
            if (!other) return null
            const share = total > 0 ? link.value / total : 0
            return (
              <li
                key={otherId}
                className="relative overflow-hidden rounded-md border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${share * 100}%`,
                    background: `${other.color ?? '#a3a3a3'}1a`,
                  }}
                />
                <div className="relative flex items-center gap-2 text-sm">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: other.color ?? '#a3a3a3' }}
                  />
                  <span className="flex-1 truncate text-neutral-200">
                    {other.label}
                  </span>
                  <span className="font-mono text-xs text-neutral-300">
                    {fmtFull(link.value)}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-500">
                    {(share * 100).toFixed(0)}%
                  </span>
                </div>
              </li>
            )
          })}
      </ul>
    </section>
  )
}

function ConvBadge({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100)
  const cls =
    pct >= 60
      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
      : pct >= 30
        ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
        : 'text-rose-300 bg-rose-500/10 border-rose-500/20'
  return (
    <span
      className={`rounded-md border px-2 py-0.5 font-mono text-xs ${cls}`}
    >
      {pct}%
    </span>
  )
}

function stageTitleOf(scenario: Scenario, stageId: string) {
  return scenario.stages.find((s) => s.id === stageId)?.title ?? stageId
}

function fmtFull(n: number) {
  return n.toLocaleString('en-US')
}
