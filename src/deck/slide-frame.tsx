import type { ReactNode } from 'react'
import { BRAND } from '../brand'
import { useSlidePosition } from './slide-position'

// Shared chrome for every slide: full-bleed dark background with subtle
// radial gradients, optional eyebrow + title block, and a content slot. Every
// slide uses the same vocabulary (eyebrow → headline → supporting content), so
// it is hoisted into a single component.

export type SlideFrameProps = {
  eyebrow?: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
  footnote?: ReactNode
  /** When true, removes default vertical centering — useful for hero slides. */
  align?: 'center' | 'top'
  /** Tweak background gradients per slide if needed. */
  background?: 'default' | 'soft' | 'edge-glow'
  /**
   * Type scale. `default` suits a deck that is read; `projector` enlarges the
   * header block for a room where the back row is a long way from the screen.
   */
  size?: 'default' | 'projector'
  /** 1-based position, rendered bottom-right so the room can cite a slide. */
  page?: number
  /** Total slides, shown alongside `page`. */
  pageCount?: number
  /**
   * Brand footer (logo · site · social handle · n/total), read from
   * `brand.ts`. Off by default; without it the frame prints a bare page number.
   */
  footer?: boolean
}

const HEADER = {
  default: {
    wrap: 'mb-12',
    eyebrow: 'mb-5 text-[15px] tracking-[0.32em]',
    title: 'text-[64px]',
    subtitle: 'mt-6 text-[22px]',
  },
  projector: {
    wrap: 'mb-16',
    eyebrow: 'mb-7 text-[22px] tracking-[0.3em]',
    title: 'text-[92px]',
    subtitle: 'mt-8 text-[32px]',
  },
} as const

const BACKGROUNDS: Record<NonNullable<SlideFrameProps['background']>, string> =
  {
    default:
      'bg-[radial-gradient(1100px_600px_at_50%_-10%,rgba(168,85,247,0.10),transparent_60%),radial-gradient(900px_500px_at_50%_110%,rgba(99,102,241,0.08),transparent_60%)]',
    soft: 'bg-[radial-gradient(900px_500px_at_15%_10%,rgba(168,85,247,0.10),transparent_60%),radial-gradient(900px_500px_at_85%_90%,rgba(56,189,248,0.06),transparent_60%)]',
    'edge-glow':
      'bg-[radial-gradient(900px_500px_at_0%_20%,rgba(168,85,247,0.16),transparent_55%),radial-gradient(900px_500px_at_100%_80%,rgba(244,114,182,0.12),transparent_55%)]',
  }

export function SlideFrame({
  eyebrow,
  title,
  subtitle,
  children,
  footnote,
  align = 'center',
  background = 'default',
  size = 'default',
  page,
  pageCount,
  footer = false,
}: SlideFrameProps) {
  const header = HEADER[size]
  const chrome = size === 'projector'
  const position = useSlidePosition()
  const shownPage = page ?? position?.page
  const shownCount = pageCount ?? position?.pageCount
  return (
    <div
      className={
        'relative flex h-full w-full flex-col overflow-hidden bg-[#050505] px-[7%] text-neutral-100 ' +
        BACKGROUNDS[background]
      }
    >
      {/* Brand mark, top-left. Purely chrome — never competes with the title. */}
      <div className="pointer-events-none absolute top-[3.5%] left-[3.5%] z-10 flex items-center gap-3">
        <img
          src={BRAND.logoOnDark}
          alt=""
          aria-hidden
          className="h-8 w-auto opacity-70 select-none"
          draggable={false}
        />
        <span
          className={
            'font-semibold tracking-[0.34em] text-neutral-500 uppercase ' +
            (chrome ? 'text-[18px]' : 'text-[13px]')
          }
        >
          {BRAND.domain}
        </span>
      </div>

      {/* Bare page number, used when the full brand footer is off. */}
      {!footer && shownPage !== undefined && (
        <div
          className={
            'pointer-events-none absolute right-[3.5%] bottom-[3.5%] z-10 tabular-nums text-neutral-600 ' +
            (chrome ? 'text-[22px]' : 'text-[15px]')
          }
        >
          {shownPage}
          {shownCount !== undefined && <span className="text-neutral-700"> / {shownCount}</span>}
        </div>
      )}

      <div
        className={
          'mx-auto flex w-full max-w-[1500px] flex-1 flex-col ' +
          (align === 'center'
            ? 'justify-center pt-[5%] '
            : 'justify-start pt-[8%] ') +
          // The footer is pinned to the bottom edge, so reserve its height here
          // and content can never push it off the slide.
          (footer ? 'pb-[7.5%]' : 'pb-[5%]')
        }
      >
        {(eyebrow || title || subtitle) && (
          <header className={header.wrap + ' text-center'}>
            {eyebrow && (
              <div className={header.eyebrow + ' font-semibold text-fuchsia-300 uppercase'}>{eyebrow}</div>
            )}
            {title && (
              <h2
                className={
                  'font-display text-balance leading-[1.05] font-bold tracking-tight text-neutral-50 ' +
                  header.title
                }
              >
                {title}
              </h2>
            )}
            {subtitle && <p className={header.subtitle + ' leading-snug text-neutral-400'}>{subtitle}</p>}
          </header>
        )}
        {children}
        {footnote && (
          <div
            className={
              'mt-10 text-center tracking-wide text-neutral-500 ' + (chrome ? 'text-[20px]' : 'text-[14px]')
            }
          >
            {footnote}
          </div>
        )}
      </div>

      {footer && <DeckFooter page={shownPage} pageCount={shownCount} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Footer — pinned to the bottom edge of the slide, out of the
// content flow, so an over-tall slide can never push it off screen. Position
// comes from SlidePositionContext (the deck owns slide ordering), so the footer
// never has to be hand-synced with the deck array.
// ---------------------------------------------------------------------------

function DeckFooter({ page, pageCount }: { page?: number; pageCount?: number }) {
  return (
    <footer className="absolute inset-x-0 bottom-0 z-10 flex w-full items-center justify-center gap-8 py-4 text-[24px] text-neutral-500">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-gradient-to-br from-violet-500 to-fuchsia-500">
          <img
            src={BRAND.logoOnDark}
            alt={BRAND.name}
            className="h-4 w-auto select-none"
            draggable={false}
          />
        </div>
        <span className="font-medium text-neutral-400">{BRAND.name}</span>
      </div>
      <span className="text-neutral-600">·</span>
      <a
        href={BRAND.url}
        target="_blank"
        rel="noopener noreferrer"
        className="transition hover:text-neutral-300"
      >
        {BRAND.domain}
      </a>
      <span className="text-neutral-600">·</span>
      <a
        href={BRAND.social.url}
        target="_blank"
        rel="noopener noreferrer"
        className="transition hover:text-neutral-300"
      >
        {BRAND.social.handle}
      </a>
      {page !== undefined && (
        <>
          <span className="text-neutral-600">·</span>
          <span className="tabular-nums">
            {page}
            {pageCount !== undefined && `/${pageCount}`}
          </span>
        </>
      )}
    </footer>
  )
}
