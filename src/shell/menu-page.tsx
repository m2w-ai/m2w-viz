import { Link } from 'react-router-dom'
import { BRAND } from '../brand'

// The card-grid page behind both the home menu and the presentations hub. The
// two differ only in what they list, so the layout lives here once.

export type MenuCard = {
  to: string
  eyebrow: string
  title: string
  description: string
  /** Small right-aligned note beside the eyebrow, e.g. "12 slides". */
  meta?: string
  /** Muted line under the title, e.g. a venue. */
  detail?: string
  /** Tailwind gradient stops for the card's corner glow. */
  accent: string
  /** Tailwind shadow class. */
  glow: string
}

export function MenuPage({
  section,
  eyebrow,
  heading,
  blurb,
  cards,
  cta = 'Open',
  backToMenu = false,
}: {
  /** Shown beside the logo: "<brand> · <section>". */
  section: string
  eyebrow: string
  heading: string
  blurb: string
  cards: readonly MenuCard[]
  cta?: string
  /** Sub-pages link back to `/`; the home menu links out to the site instead. */
  backToMenu?: boolean
}) {
  const logo = (
    <img src={BRAND.logoColor} alt={BRAND.name} className="h-9 w-auto select-none" draggable={false} />
  )
  return (
    <div className="grid-bg relative flex min-h-screen flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_20%_0%,rgba(168,85,247,0.18),transparent_60%),radial-gradient(900px_500px_at_90%_100%,rgba(56,189,248,0.10),transparent_60%)]" />

      <header className="relative flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          {backToMenu ? (
            <Link to="/" aria-label="Back to menu" className="shrink-0">
              {logo}
            </Link>
          ) : (
            logo
          )}
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-wide text-neutral-100">
              {BRAND.name} · {section}
            </span>
            <span className="text-[11px] tracking-[0.2em] text-neutral-500 uppercase">
              {BRAND.domain}
            </span>
          </div>
        </div>
        {backToMenu ? (
          <Link
            to="/"
            className="rounded-full border border-white/10 px-3 py-1 text-[11px] tracking-[0.18em] text-neutral-400 uppercase transition hover:border-white/25 hover:text-neutral-200"
          >
            ← Menu
          </Link>
        ) : (
          <a
            href={BRAND.url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] tracking-[0.2em] text-neutral-500 uppercase hover:text-neutral-300"
          >
            ↗ {BRAND.domain}
          </a>
        )}
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-8 pb-16">
        <div className="mb-12 max-w-3xl text-center">
          <div className="mb-3 text-[11px] font-semibold tracking-[0.32em] text-fuchsia-300 uppercase">
            {eyebrow}
          </div>
          <h1 className="font-display text-balance text-4xl font-bold text-neutral-50 sm:text-5xl">
            {heading}
          </h1>
          <p className="mt-4 text-sm text-neutral-400 sm:text-base">{blurb}</p>
        </div>

        <div className="grid w-full max-w-6xl gap-5 sm:grid-cols-2">
          {cards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className={
                'group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.04] ' +
                card.glow
              }
            >
              <div
                className={
                  'pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br opacity-40 blur-3xl transition group-hover:opacity-70 ' +
                  card.accent
                }
              />
              <div className="relative">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[10px] font-semibold tracking-[0.28em] text-neutral-400 uppercase">
                    {card.eyebrow}
                  </div>
                  {card.meta && (
                    <div className="text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
                      {card.meta}
                    </div>
                  )}
                </div>
                <div className="font-display text-2xl font-semibold text-neutral-50">
                  {card.title}
                </div>
                {card.detail && (
                  <div className="mt-1 text-[12px] tracking-wide text-neutral-500">{card.detail}</div>
                )}
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">{card.description}</p>
                <div className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-neutral-300 transition group-hover:gap-3 group-hover:text-white">
                  {cta}
                  <span aria-hidden>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {BRAND.notice && (
        <footer className="relative px-8 pb-6 text-center text-[11px] tracking-[0.2em] text-neutral-600 uppercase">
          {BRAND.notice}
        </footer>
      )}
    </div>
  )
}
