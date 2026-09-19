import type { ReactNode } from 'react'
import { BRAND } from '../brand'

// Re-usable slide primitives. Centralising these keeps every slide on-brand
// and lets us tweak the entire deck from one place.

export type StatCardProps = {
  value: ReactNode
  label: ReactNode
  tone?: 'violet' | 'rose' | 'amber' | 'emerald' | 'sky'
}

const TONE_TEXT: Record<NonNullable<StatCardProps['tone']>, string> = {
  violet: 'text-violet-300',
  rose: 'text-rose-400',
  amber: 'text-amber-300',
  emerald: 'text-emerald-300',
  sky: 'text-sky-300',
}

export function StatCard({ value, label, tone = 'violet' }: StatCardProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] px-10 py-14 text-center backdrop-blur">
      <div
        className={
          'font-display text-[88px] leading-none font-bold tracking-tight ' +
          TONE_TEXT[tone]
        }
      >
        {value}
      </div>
      <div className="mt-6 max-w-[16ch] text-[25px] leading-snug text-neutral-400">
        {label}
      </div>
    </div>
  )
}

export type FeatureCardProps = {
  icon: ReactNode
  title: ReactNode
  body: ReactNode
  pill?: ReactNode
}

export function FeatureCard({ icon, title, body, pill }: FeatureCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-8 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.04]">
      <div className="text-[34px] leading-none" aria-hidden>
        {icon}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display text-[28px] font-semibold text-neutral-50">
          {title}
        </h3>
        {pill}
      </div>
      <p className="text-[24px] leading-relaxed text-neutral-400">{body}</p>
    </div>
  )
}

export function ComingSoonPill({ children = 'COMING SOON' }: { children?: ReactNode }) {
  return (
    <span className="rounded-md border border-fuchsia-400/30 bg-fuchsia-400/10 px-2 py-0.5 text-[20px] font-semibold tracking-[0.18em] text-fuchsia-300 uppercase">
      {children}
    </span>
  )
}

export function GlowQuote({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto inline-flex max-w-[80%] items-center justify-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/[0.06] px-6 py-4 text-center text-[26px] font-medium text-fuchsia-200 italic shadow-[0_0_60px_-20px_rgba(217,70,239,0.5)]">
      {children}
    </div>
  )
}

export function Logo() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_10px_40px_-10px_rgba(168,85,247,0.7)]">
        <img
          src={BRAND.logoOnDark}
          alt={BRAND.name}
          className="h-10 w-auto select-none"
          draggable={false}
        />
      </div>
      <div className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-violet-400 bg-clip-text text-[20px] font-semibold tracking-[0.4em] text-transparent uppercase">
        {BRAND.domain}
      </div>
    </div>
  )
}
