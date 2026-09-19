export const SLIDE_WIDTH = 1920
export const SLIDE_HEIGHT = 1080

export type ExportLayerKind =
  | 'rise'
  | 'pop'
  | 'slide-in'
  | 'wipe'
  | 'grow-bar'
  | 'count-up'
  | 'appear'
  /** One still of a flipbook: cuts in at `delay`, cuts out at `exitAfterMs`. */
  | 'frame'

export type ExportTrigger = 'auto' | 'click'

/** An endless bob after the entrance — an ambient CSS loop, in PowerPoint terms. */
export type ExportLoop = {
  /** Vertical travel in px; negative is up. */
  dy: number
  /** One full there-and-back, in ms. */
  periodMs: number
}

export type ExportLayerSpec = {
  kind: ExportLayerKind
  delay: number
  duration: number
  trigger: ExportTrigger
  /**
   * Explicit click index, 1-based. Click layers without one take the next
   * free step in document order, so plain reveals need nothing.
   */
  step?: number
  /** Fade this layer out when the following click fires — a swap, not a stack. */
  exitOnNextClick?: boolean
  /** Cut this layer out this many ms after its group starts. */
  exitAfterMs?: number
  loop?: ExportLoop
  /** SlideIn offset in px. Negative enters from the left. */
  x?: number
  /** Rise offset in px. */
  y?: number
  /** Pop starting scale, 1 = full size. */
  from?: number
}

export const EXPORT_LAYER_ATTR = 'data-export-layer'

/** Kinds that stay their own layer even when nested inside another. */
const LIFTED_KINDS: readonly ExportLayerKind[] = ['appear', 'frame']

export type ExportLayerAttrs = {
  'data-export-layer': ExportLayerKind
  'data-export-delay': string
  'data-export-duration': string
  'data-export-trigger': ExportTrigger
  'data-export-step'?: string
  'data-export-exit'?: string
  'data-export-exit-after'?: string
  'data-export-loop-dy'?: string
  'data-export-loop-ms'?: string
  'data-export-x'?: string
  'data-export-y'?: string
  'data-export-from'?: string
}

export function exportLayerAttrs(spec: ExportLayerSpec): ExportLayerAttrs {
  const attrs: ExportLayerAttrs = {
    'data-export-layer': spec.kind,
    'data-export-delay': String(spec.delay),
    'data-export-duration': String(spec.duration),
    'data-export-trigger': spec.trigger,
  }
  if (spec.step !== undefined) attrs['data-export-step'] = String(spec.step)
  if (spec.exitOnNextClick) attrs['data-export-exit'] = 'next-click'
  if (spec.exitAfterMs !== undefined) attrs['data-export-exit-after'] = String(spec.exitAfterMs)
  if (spec.loop) {
    attrs['data-export-loop-dy'] = String(spec.loop.dy)
    attrs['data-export-loop-ms'] = String(spec.loop.periodMs)
  }
  if (spec.x !== undefined) attrs['data-export-x'] = String(spec.x)
  if (spec.y !== undefined) attrs['data-export-y'] = String(spec.y)
  if (spec.from !== undefined) attrs['data-export-from'] = String(spec.from)
  return attrs
}

/** Anything with an inline style — the deck tags both HTML and SVG nodes. */
export type LayerElement = HTMLElement | SVGElement

function num(el: Element, name: string): number | undefined {
  const raw = el.getAttribute(name)
  return raw === null ? undefined : Number(raw)
}

export function parseLayerSpec(el: Element): ExportLayerSpec {
  const loopDy = num(el, 'data-export-loop-dy')
  const loopMs = num(el, 'data-export-loop-ms')
  return {
    kind: (el.getAttribute(EXPORT_LAYER_ATTR) ?? 'rise') as ExportLayerKind,
    delay: num(el, 'data-export-delay') ?? 0,
    duration: num(el, 'data-export-duration') ?? 700,
    trigger: (el.getAttribute('data-export-trigger') ?? 'auto') as ExportTrigger,
    step: num(el, 'data-export-step'),
    exitOnNextClick: el.getAttribute('data-export-exit') === 'next-click' || undefined,
    exitAfterMs: num(el, 'data-export-exit-after'),
    loop: loopDy !== undefined && loopMs !== undefined ? { dy: loopDy, periodMs: loopMs } : undefined,
    x: num(el, 'data-export-x'),
    y: num(el, 'data-export-y'),
    from: num(el, 'data-export-from'),
  }
}

const liftedSelector = LIFTED_KINDS.map((kind) => `[${EXPORT_LAYER_ATTR}="${kind}"]`).join(',')

/**
 * Outermost tagged nodes in document order, plus any lifted kinds nested
 * inside them: click reveals, which must wait for the presenter, and counter
 * frames, which must swap on their own clock. Everything else nested inside a
 * layer is part of that layer's picture.
 */
export function collectLayerElements(slideEl: Element): LayerElement[] {
  const all = [...slideEl.querySelectorAll<LayerElement>(`[${EXPORT_LAYER_ATTR}]`)]
  const outermost = all.filter((el) => !el.parentElement?.closest(`[${EXPORT_LAYER_ATTR}]`))
  const seen = new Set<Element>()
  const result: LayerElement[] = []

  const push = (el: LayerElement) => {
    if (seen.has(el)) return
    seen.add(el)
    result.push(el)
  }

  for (const el of outermost) {
    push(el)
    for (const nested of el.querySelectorAll<LayerElement>(liftedSelector)) push(nested)
  }

  return result
}

export const SLIDE_NOTES_SELECTOR = '[data-slide-notes]'

/** Speaker notes rendered into the slide's hidden notes node, or ''. */
export function readSlideNotes(slideEl: Element): string {
  const node = slideEl.querySelector(SLIDE_NOTES_SELECTOR)
  if (!node) return ''
  const blocks = [...node.children]
    .map((child) => child.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(Boolean)
  if (blocks.length > 0) return blocks.join('\n\n')
  return node.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}
