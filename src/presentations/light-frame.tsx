import type { ReactNode } from 'react'
import { BRAND } from '../brand'
import { useSlidePosition } from '../deck/slide-position'

// Light-canvas frame: soft purple canvas, dark text, a header (logo · company)
// and footer (confidentiality line / page number), a big left-aligned title,
// and a faint emblem bottom-right. The counterpart of deck/slide-frame.tsx,
// which stays dark; a deck picks one and the shell matches its chrome.

export const LIGHT_BG = '#DED2F6'

export type LightFrameProps = {
  eyebrow?: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
  /** Center everything (used by the hero / closing slides). */
  align?: 'top' | 'center'
  // Accepted for drop-in compatibility with SlideFrame; not used here.
  background?: string
  footnote?: ReactNode
}

export function LightFrame({
  eyebrow,
  title,
  subtitle,
  children,
  align = 'top',
}: LightFrameProps) {
  const position = useSlidePosition()
  const hasHeader = Boolean(eyebrow || title || subtitle)

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden px-[4.5%] text-neutral-800"
      style={{ backgroundColor: LIGHT_BG }}
    >
      {/* Faint decorative emblem, bottom-right  */}
      <img
        src={BRAND.logoColor}
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none absolute -right-6 bottom-[6%] h-[300px] w-auto select-none opacity-[0.16]"
      />

      {/* Header — logo + company, top-left (the back-to-
          menu affordance lives top-right, rendered by the deck shell.) */}
      <div className="absolute top-[3.5%] left-[4.5%] z-10 flex items-center gap-2.5">
        <img src={BRAND.logoColor} alt="" aria-hidden className="h-8 w-auto select-none" draggable={false} />
        <span className="font-mono text-[15px] font-bold tracking-wide text-neutral-700">
          {BRAND.legalName}
        </span>
      </div>

      {/* Footer */}
      <div className="absolute right-[4.5%] bottom-[3.5%] left-[4.5%] z-10 flex items-center justify-between">
        <span className="font-mono text-[13px] tracking-wide text-neutral-500">
          Confidential · {BRAND.legalName}
        </span>
        {position && (
          <span className="font-mono text-[13px] tabular-nums text-neutral-400">
            {position.page} / {position.pageCount}
          </span>
        )}
      </div>

      {/* Body */}
      <div
        className={
          'relative z-[1] mx-auto flex w-full max-w-[1620px] flex-1 flex-col ' +
          (align === 'center' ? 'justify-center py-[7%]' : 'justify-start pt-[11%] pb-[7%]')
        }
      >
        {hasHeader && (
          <header className={'mb-9 ' + (align === 'center' ? 'text-center' : 'text-left')}>
            {eyebrow && (
              <div className="mb-3 text-[14px] font-semibold tracking-[0.24em] text-[#7b5fd0] uppercase">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2 className="font-display text-[58px] leading-[1.05] font-semibold tracking-tight text-neutral-800">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-4 max-w-[80%] text-[21px] leading-snug text-neutral-600">
                {subtitle}
              </p>
            )}
          </header>
        )}
        {children}
      </div>
    </div>
  )
}
