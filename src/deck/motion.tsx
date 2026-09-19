import { useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { SlideContext } from 'spectacle'
import { exportLayerAttrs, type ExportLayerSpec } from './export-layer'
import { StaticMotion, useIsStaticCapture } from './static-capture'

export { StaticMotion, useIsStaticCapture }

// Entry-animation kit for decks that are spoken over.
//
// A stage deck is spoken over, not clicked through: the presenter lands on a
// slide and the picture assembles itself while they talk. So instead of
// Spectacle's click-gated <Appear>, everything here keys off "has this slide
// just become active" and staggers on a delay. One arrow press per slide.
//
// Spectacle's <Appear> (or ClickReveal) is still there for the rare beat the
// presenter wants to hold; a step then means "a pause was wanted here".
//
// Three states, not two, because the same components are rendered twice: once
// live inside a <Slide>, and once in the hidden offscreen container the PDF
// exporter screenshots. A component that waits for an entry animation in that
// second tree is captured blank. The capture path therefore has to be told to
// render the finished state with no transition at all — see StaticMotion.

export type EntryPhase =
  /** Rendered outside a live deck (PDF capture) or with reduced motion: final state, no transition. */
  | 'static'
  /** The slide is on screen: animate to the final state. */
  | 'in'
  /** The slide is not on screen: sit in the pre-animation state. */
  | 'out'

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return reduced
}

/**
 * Where this subtree is in its entry animation. Safe to call anywhere — a slide
 * rendered with no Spectacle context at all reports `static` rather than
 * throwing, because Spectacle creates SlideContext with a null default. The
 * capture tree (see `StaticMotion` in src/deck/static-capture) always reports
 * `static`, whatever its SlideContext says.
 */
export function useEntryPhase(): EntryPhase {
  const slide = useContext(SlideContext) as unknown as { isSlideActive?: boolean } | null
  const isSlideActive = slide?.isSlideActive
  const isStaticCapture = useIsStaticCapture()
  const reduced = usePrefersReducedMotion()
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (isSlideActive !== true) {
      setEntered(false)
      return
    }
    // Let the browser paint the pre-animation state for one frame, otherwise
    // the element mounts already in its final state and the transition is a
    // no-op. Two frames because React can batch the state update into the
    // first one.
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [isSlideActive])

  if (isStaticCapture || isSlideActive === undefined || reduced) return 'static'
  return entered ? 'in' : 'out'
}

type MotionProps = {
  children?: ReactNode
  /** Milliseconds to wait before this element starts, measured from slide entry. */
  delay?: number
  duration?: number
  className?: string
  style?: CSSProperties
  /**
   * In the exported PPTX, the click that brings this in (1-based). Live, a
   * Stepper decides when it mounts; this only tells the export the same thing.
   */
  step?: number
}

/** The export tag for a motion primitive: on slide entry, or on `step`. */
function layerAttrs(
  kind: ExportLayerSpec['kind'],
  { delay = 0, duration = 700, step }: MotionProps,
  extra: Partial<ExportLayerSpec> = {},
) {
  return exportLayerAttrs({
    kind,
    delay,
    duration,
    trigger: step === undefined ? 'auto' : 'click',
    step,
    ...extra,
  })
}

function motionStyle(
  phase: EntryPhase,
  hiddenTransform: string,
  { delay = 0, duration = 700, style }: MotionProps,
): CSSProperties {
  const hidden = phase === 'out'
  return {
    opacity: hidden ? 0 : 1,
    transform: hidden ? hiddenTransform : 'none',
    transition:
      phase === 'static'
        ? undefined
        : `opacity ${duration}ms ${EASE} ${delay}ms, transform ${duration}ms ${EASE} ${delay}ms`,
    willChange: phase === 'static' ? undefined : 'opacity, transform',
    ...style,
  }
}

/** Fade up from below — the workhorse. */
export function Rise({ y = 34, ...props }: MotionProps & { y?: number }) {
  const phase = useEntryPhase()
  return (
    <div
      className={props.className}
      style={motionStyle(phase, `translate3d(0, ${y}px, 0)`, props)}
      {...layerAttrs('rise', props, { y })}
    >
      {props.children}
    </div>
  )
}

/** Scale up from slightly small — for numbers and logos that should land. */
export function Pop({ from = 0.82, ...props }: MotionProps & { from?: number }) {
  const phase = useEntryPhase()
  return (
    <div
      className={props.className}
      style={motionStyle(phase, `scale(${from})`, props)}
      {...layerAttrs('pop', props, { from })}
    >
      {props.children}
    </div>
  )
}

/** Slide in horizontally. Negative `x` enters from the left. */
export function SlideIn({ x = 60, ...props }: MotionProps & { x?: number }) {
  const phase = useEntryPhase()
  return (
    <div
      className={props.className}
      style={motionStyle(phase, `translate3d(${x}px, 0, 0)`, props)}
      {...layerAttrs('slide-in', props, { x })}
    >
      {props.children}
    </div>
  )
}

/**
 * Wipe a headline in from the left behind a moving edge.
 *
 * The vertical insets are NEGATIVE on purpose. clip-path clips to the element's
 * box, and these headlines run at 92-184px with a line-height below 1, so the
 * descender of a `g` or `y` hangs below that box and was being sliced off flat.
 * Opening the clip rectangle 80px above and below covers the descender at every
 * size in this deck while leaving the horizontal wipe — the only edge that
 * animates — exactly where it was.
 */
const WIPE_BLEED = 80

export function Wipe({ delay = 0, duration = 900, className, style, children, step }: MotionProps) {
  const phase = useEntryPhase()
  const hidden = phase === 'out'
  return (
    <div
      className={className}
      style={{
        clipPath: hidden
          ? `inset(-${WIPE_BLEED}px 100% -${WIPE_BLEED}px 0)`
          : `inset(-${WIPE_BLEED}px 0% -${WIPE_BLEED}px 0)`,
        opacity: hidden ? 0.001 : 1,
        transition:
          phase === 'static'
            ? undefined
            : `clip-path ${duration}ms ${EASE} ${delay}ms, opacity 200ms linear ${delay}ms`,
        ...style,
      }}
      {...layerAttrs('wipe', { delay, duration, step })}
    >
      {children}
    </div>
  )
}

/** Grow a rule/bar to `width` (any CSS length) once the slide lands. */
export function GrowBar({
  width = '100%',
  delay = 0,
  duration = 1000,
  className,
  style,
  children,
  step,
}: MotionProps & { width?: string }) {
  const phase = useEntryPhase()
  return (
    <div
      className={className}
      style={{
        width: phase === 'out' ? 0 : width,
        transition: phase === 'static' ? undefined : `width ${duration}ms ${EASE} ${delay}ms`,
        ...style,
      }}
      {...layerAttrs('grow-bar', { delay, duration, step })}
    >
      {children}
    </div>
  )
}

/** How many stills a counter becomes in the PPTX. ~50ms a tick over 1.4s. */
const COUNT_FRAMES = 28

/** The same ease-out the live counter runs, so both land at the same beats. */
const countAt = (to: number, t: number) => to * (1 - Math.pow(1 - t, 3))

/**
 * A number that ticks up to its value when the slide lands.
 *
 * In the capture tree it renders the final value AND a stack of hidden stills,
 * one per tick, tagged as `frame` layers that appear and disappear in turn.
 * PowerPoint has no counter, but two dozen pictures swapping over 1.4 seconds
 * read as one — and a still capture (the PDF) sees only the last, so it never
 * catches the number mid-count.
 */
export function CountUp({
  to,
  decimals = 0,
  prefix = '',
  suffix = '',
  delay = 200,
  duration = 1200,
  className,
  style,
}: {
  to: number
  decimals?: number
  prefix?: string
  suffix?: string
  delay?: number
  duration?: number
  className?: string
  style?: CSSProperties
}) {
  const phase = useEntryPhase()
  const [value, setValue] = useState(phase === 'static' ? to : 0)
  const frame = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (phase === 'static') {
      setValue(to)
      return
    }
    if (phase === 'out') {
      setValue(0)
      return
    }

    const run = () => {
      const started = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / duration)
        // Same ease-out curve as the transitions, so counters and fades feel
        // like one movement rather than two.
        setValue(countAt(to, t))
        if (t < 1) frame.current = requestAnimationFrame(tick)
      }
      frame.current = requestAnimationFrame(tick)
    }

    timer.current = setTimeout(run, delay)
    return () => {
      clearTimeout(timer.current)
      cancelAnimationFrame(frame.current)
    }
  }, [phase, to, delay, duration])

  const format = (n: number) =>
    prefix +
    n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
    suffix

  if (phase !== 'static') {
    return (
      <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
        {format(value)}
      </span>
    )
  }

  // Frame k shows from its own tick until the next one; the last one stays.
  const tickAt = (k: number) => Math.round(delay + (duration * k) / COUNT_FRAMES)
  const last = COUNT_FRAMES
  // BigNumber paints its digits as a gradient clipped to the text of a wrapper
  // span. A frame photographed on its own has that wrapper hidden, so it must
  // carry its own copy of the gradient — inherited down through this span.
  const ownGradient: CSSProperties = {
    background: 'inherit',
    backgroundClip: 'inherit',
    WebkitBackgroundClip: 'inherit',
  }
  return (
    <span
      className={className}
      style={{
        fontVariantNumeric: 'tabular-nums',
        position: 'relative',
        display: 'inline-block',
        ...ownGradient,
        ...style,
      }}
    >
      {/* Reserves the final width so the stack has a box to sit in. */}
      <span aria-hidden style={{ visibility: 'hidden' }}>
        {format(to)}
      </span>
      {Array.from({ length: COUNT_FRAMES + 1 }, (_, k) => (
        <span
          key={k}
          aria-hidden={k !== last}
          style={{
            position: 'absolute',
            inset: 0,
            textAlign: 'center',
            visibility: k === last ? 'visible' : 'hidden',
            ...ownGradient,
          }}
          {...exportLayerAttrs({
            kind: 'frame',
            delay: tickAt(k),
            duration: 1,
            trigger: 'auto',
            exitAfterMs: k === last ? undefined : tickAt(k + 1),
          })}
        >
          {format(countAt(to, k / COUNT_FRAMES))}
        </span>
      ))}
    </span>
  )
}
