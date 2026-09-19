import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BRAND } from '../brand'

// Top bar shared by the full-page tools (funnel, graph, pipeline): logo back
// to the menu, the tool's name and one-line gloss, and a slot on the right for
// whatever that tool wants up there — KPI pills, a legend, filters.
export function ToolHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 bg-black/40 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <Link to="/" aria-label="Back to menu" className="shrink-0">
          <img
            src={BRAND.logoColor}
            alt={BRAND.name}
            className="h-9 w-auto select-none"
            draggable={false}
          />
        </Link>
        <div>
          <div className="text-sm font-semibold tracking-wide text-neutral-100">
            {BRAND.name} · {title}
          </div>
          {subtitle && <div className="text-xs text-neutral-500">{subtitle}</div>}
        </div>
        <Link
          to="/"
          className="ml-3 hidden rounded-full border border-white/10 px-3 py-1 text-[11px] tracking-[0.18em] text-neutral-400 uppercase transition hover:border-white/25 hover:text-neutral-200 sm:inline-flex"
        >
          ← Menu
        </Link>
      </div>
      {children}
    </header>
  )
}
