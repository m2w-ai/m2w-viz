import type { ReactNode } from 'react'

// Reusable diagram vocabulary for light-canvas decks (see light-frame.tsx):
// pastel flowchart boxes with thin coloured borders, dark text, and
// solid/dashed black arrows.
// Centralising the node / arrow / chip primitives keeps every diagram on-brand.

export type Tone =
  | 'violet'
  | 'rose'
  | 'amber'
  | 'emerald'
  | 'sky'
  | 'fuchsia'
  | 'cyan'
  | 'slate'

type ToneStyle = {
  border: string
  /** Accent text/dot colour; box titles stay dark for readability. */
  text: string
  bg: string
  dot: string
  /** Unused in the light theme; kept so slides can reference it harmlessly. */
  glow: string
}

// Pastel fills + a slightly darker border of the same hue, like the reference
// flowchart (green / blue / grey / amber boxes).
export const TONE: Record<Tone, ToneStyle> = {
  violet: { border: 'border-[#B7A3E4]', text: 'text-[#5b4aa0]', bg: 'bg-[#E1D5F6]', dot: 'bg-[#8B6FD0]', glow: '' },
  rose: { border: 'border-[#E2A0A0]', text: 'text-[#a85757]', bg: 'bg-[#F7D8D8]', dot: 'bg-[#D9736F]', glow: '' },
  amber: { border: 'border-[#E7B65E]', text: 'text-[#a9772a]', bg: 'bg-[#FCE7BE]', dot: 'bg-[#E0A03C]', glow: '' },
  emerald: { border: 'border-[#8FBB6E]', text: 'text-[#4f7a37]', bg: 'bg-[#CFE7BA]', dot: 'bg-[#5FA046]', glow: '' },
  sky: { border: 'border-[#93B6DA]', text: 'text-[#3f6ea0]', bg: 'bg-[#D8E6F3]', dot: 'bg-[#5B8FC7]', glow: '' },
  fuchsia: { border: 'border-[#D294CD]', text: 'text-[#9a4a92]', bg: 'bg-[#F3D8F1]', dot: 'bg-[#C05FB8]', glow: '' },
  cyan: { border: 'border-[#82C2C8]', text: 'text-[#3a8087]', bg: 'bg-[#D0EBED]', dot: 'bg-[#4FB0B8]', glow: '' },
  slate: { border: 'border-[#B4B4BC]', text: 'text-[#5a5a63]', bg: 'bg-[#DEDEE2]', dot: 'bg-[#8A8A93]', glow: '' },
}

export type NodeProps = {
  title: ReactNode
  caption?: ReactNode
  icon?: ReactNode
  tone?: Tone
  tag?: ReactNode
  /** Dashed border reads as "planned / not-yet-real". */
  dashed?: boolean
  className?: string
}

/** A labelled box — the atom of every flowchart here. */
export function DiagramNode({
  title,
  caption,
  icon,
  tone = 'slate',
  tag,
  dashed,
  className,
}: NodeProps) {
  const t = TONE[tone]
  return (
    <div
      className={
        'flex flex-col rounded-md border px-5 py-3.5 ' +
        (dashed ? 'border-dashed ' : '') +
        `${t.border} ${t.bg} ` +
        (className ?? '')
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="text-[24px] leading-none" aria-hidden>
              {icon}
            </span>
          )}
          <div className="font-display text-[21px] font-semibold text-neutral-800">
            {title}
          </div>
        </div>
        {tag}
      </div>
      {caption && (
        <div className="mt-1.5 text-[14.5px] leading-snug text-neutral-600">
          {caption}
        </div>
      )}
    </div>
  )
}

/**
 * A directional connector drawn as a thin black line + arrowhead — the
 * flowchart look from the reference. `dashed` renders a dashed line.
 */
export function Arrow({
  dir = 'right',
  label,
  dashed = false,
}: {
  dir?: 'right' | 'down'
  label?: ReactNode
  tone?: Tone
  dashed?: boolean
}) {
  const dash = dashed ? '4 4' : undefined
  if (dir === 'down') {
    return (
      <div className="flex shrink-0 flex-row items-center justify-center gap-2 py-1">
        <svg width="14" height="42" viewBox="0 0 14 42" fill="none" aria-hidden className="shrink-0">
          <path d="M7 1 V30" stroke="#333" strokeWidth="1.8" strokeDasharray={dash} />
          <path d="M2 28 L7 40 L12 28 Z" fill="#333" />
        </svg>
        {label && (
          <span className="text-[12px] font-medium tracking-wide text-neutral-600">
            {label}
          </span>
        )}
      </div>
    )
  }
  return (
    <div className="flex shrink-0 flex-col items-center justify-center px-1">
      {label && (
        <span className="mb-1 text-[12px] font-medium tracking-wide text-neutral-600">
          {label}
        </span>
      )}
      <svg width="52" height="14" viewBox="0 0 52 14" fill="none" aria-hidden className="shrink-0">
        <path d="M1 7 H40" stroke="#333" strokeWidth="1.8" strokeDasharray={dash} />
        <path d="M38 2 L50 7 L38 12 Z" fill="#333" />
      </svg>
    </div>
  )
}

/** Small status / metadata pill. */
export function Chip({
  children,
  tone = 'slate',
}: {
  children: ReactNode
  tone?: Tone
}) {
  const t = TONE[tone]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.12em] uppercase ${t.border} ${t.bg} ${t.text}`}
    >
      {children}
    </span>
  )
}

/** Dashed "return" pill that reads as a repeat/loop in a cycle diagram. */
export function LoopBack({
  label,
  tone = 'slate',
}: {
  label: ReactNode
  tone?: Tone
}) {
  const t = TONE[tone]
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-dashed px-4 py-1.5 text-[13px] font-medium ${t.border} ${t.bg} ${t.text}`}
    >
      <span aria-hidden className="text-[15px]">
        ↺
      </span>
      {label}
    </div>
  )
}

/** Section marker used above a diagram to name what it shows. */
export function DiagramCaption({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 text-center text-[13px] font-semibold tracking-[0.26em] text-neutral-500 uppercase">
      {children}
    </div>
  )
}

/**
 * The one thing to remember from a slide. Every content slide ends with one so
 * the audience always leaves with an explicit lesson, not just a diagram.
 */
export function Takeaway({
  children,
}: {
  children: ReactNode
  tone?: Tone
}) {
  return (
    <div className="mx-auto mt-10 flex max-w-[1120px] items-center gap-4 rounded-md border border-black/10 bg-white/55 px-6 py-3.5">
      <span className="shrink-0 text-[11px] font-semibold tracking-[0.26em] text-neutral-600 uppercase">
        ✦ Takeaway
      </span>
      <span className="h-4 w-px shrink-0 bg-black/15" />
      <span className="text-[16.5px] leading-snug text-neutral-800">
        {children}
      </span>
    </div>
  )
}
