import { getFontEmbedCSS, toCanvas } from 'html-to-image'
import {
  collectLayerElements,
  parseLayerSpec,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type ExportLayerSpec,
  type LayerElement,
} from './export-layer'
import {
  collectStaticVectorElements,
  isSvgImage,
  serializeSvgImage,
  serializeSvgLayer,
  type SvgCache,
  type VectorPicture,
} from './svg-capture'
import { cachedSlideImage, cachedSlideLayers } from './export-cache'

export { SLIDE_HEIGHT, SLIDE_WIDTH }

/**
 * 2× supersample: a 3840×2160 capture of a 1080p slide, crisp on any projector
 * while keeping the lossless PNGs a third smaller than a 3× capture — the
 * difference between a ~140 MB deck and a ~65 MB one.
 */
export const PIXEL_RATIO = 2
/** Slide px kept around the painted pixels so anti-aliased edges are not shaved. */
const LAYER_BLEED = 2

export type CapturedLayer = VectorPicture & {
  spec: ExportLayerSpec
}

export type CapturedVideo = {
  src: string
  /** Slide px. */
  x: number
  y: number
  w: number
  h: number
  /** Corner radius in slide px, from the ancestor that clips it; 0 when square. */
  radius: number
  /** The frame the deck shows before playback, as a PNG data URL. */
  posterDataUrl: string
  durationMs?: number
  /** Index into `layers` of the layer the video sits inside, or -1 for none. */
  layerIndex: number
}

export type CapturedSlide = {
  backgroundDataUrl: string
  backgroundColor: string
  /** Logos, QR codes, diagrams — SVG pictures that sit on the background and never animate. */
  vectors: VectorPicture[]
  layers: CapturedLayer[]
  videos: CapturedVideo[]
}

export type CaptureOptions = {
  /** From `prepareFontEmbedCSS`; skips re-fetching every font on every render. */
  fontEmbedCSS?: string
  onLayer?: (index: number, total: number) => void
}

/** Font CSS is identical for every slide of a deck; resolve it once per export. */
export function prepareFontEmbedCSS(container: HTMLElement): Promise<string> {
  return getFontEmbedCSS(container)
}

const FREEZE_ATTR = 'data-export-freeze'

/**
 * Park every CSS animation under `root` on its final keyframe until the
 * returned disposer runs.
 *
 * html-to-image copies each element's computed style — animation shorthand
 * included — into a clone it rasterises, and the clone also carries any
 * `<style>` that declares the keyframes. So a `.5s` slam that has long since
 * finished on the page starts over at 0% in the clone and is photographed
 * invisible. A huge negative delay puts the animation past its end; a single
 * iteration and `both` fill make that end the resting pose; and pausing keeps
 * it there. Those computed values are what the clone inherits.
 */
export function freezeAnimations(root: HTMLElement): () => void {
  root.setAttribute(FREEZE_ATTR, '')
  const style = document.createElement('style')
  style.textContent =
    `[${FREEZE_ATTR}] *, [${FREEZE_ATTR}] *::before, [${FREEZE_ATTR}] *::after {` +
    ` animation-delay: -1000s !important;` +
    ` animation-iteration-count: 1 !important;` +
    ` animation-fill-mode: both !important;` +
    ` animation-play-state: paused !important;` +
    ` }`
  document.head.appendChild(style)
  return () => {
    style.remove()
    root.removeAttribute(FREEZE_ATTR)
  }
}

export function readSlideBackground(slideEl: HTMLElement): string {
  let node: HTMLElement | null = slideEl
  while (node) {
    const bg = getComputedStyle(node).backgroundColor
    if (bg && bg !== 'transparent' && !bg.endsWith(', 0)') && bg !== 'rgba(0, 0, 0, 0)') {
      return bg
    }
    node = node.parentElement
  }
  return '#050505'
}

function renderSlide(
  slideEl: HTMLElement,
  options: { backgroundColor?: string; fontEmbedCSS?: string },
): Promise<HTMLCanvasElement> {
  return toCanvas(slideEl, {
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    pixelRatio: PIXEL_RATIO,
    backgroundColor: options.backgroundColor,
    fontEmbedCSS: options.fontEmbedCSS,
  })
}

/** One finished frame, for the PDF and ZIP. Lossless: a canvas JPEG smears coloured text. */
export async function captureSlideImage(
  slideEl: HTMLElement,
  fontEmbedCSS?: string,
): Promise<{ dataUrl: string; canvas: HTMLCanvasElement }> {
  return cachedSlideImage(slideEl, async () => {
    const canvas = await renderSlide(slideEl, {
      backgroundColor: readSlideBackground(slideEl),
      fontEmbedCSS,
    })
    return { dataUrl: canvas.toDataURL('image/png'), canvas }
  })
}

/** Unique `<video>` sources in a deck, with a poster of the current frame. */
export function listContainerVideos(container: HTMLElement): { src: string; posterDataUrl: string }[] {
  const seen = new Set<string>()
  const out: { src: string; posterDataUrl: string }[] = []
  for (const video of container.querySelectorAll('video')) {
    const src = video.currentSrc || video.src
    if (!src || seen.has(src)) continue
    seen.add(src)
    out.push({ src, posterDataUrl: videoPoster(video) })
  }
  return out
}

/**
 * The slide as a background plus one transparent picture per animated layer.
 *
 * Every layer is rendered IN PLACE: the whole slide is drawn with everything
 * hidden except that one node, then cropped to the pixels it actually painted.
 * Rendering a node in isolation loses its layout — absolutely positioned
 * stamps, transforms, glows that bleed past the box — and PowerPoint would
 * show it in the wrong place or clipped. Visibility keeps layout and is
 * inherited, so a hidden slide with one `visible` subtree paints exactly that
 * subtree where it belongs.
 */
export async function captureSlideLayers(
  slideEl: HTMLElement,
  { fontEmbedCSS, onLayer }: CaptureOptions = {},
): Promise<CapturedSlide> {
  return cachedSlideLayers(slideEl, () => captureSlideLayersFresh(slideEl, { fontEmbedCSS, onLayer }))
}

async function captureSlideLayersFresh(
  slideEl: HTMLElement,
  { fontEmbedCSS, onLayer }: CaptureOptions = {},
): Promise<CapturedSlide> {
  const backgroundColor = readSlideBackground(slideEl)
  const layers = collectLayerElements(slideEl)
  const videos = [...slideEl.querySelectorAll('video')]
  const wrapperOf = (video: HTMLVideoElement) => layers.find((layer) => layer.contains(video))
  // Auto-wrapped videos stay in the background (frame + hole) and play with
  // the slide. Click-wrapped ones are a motion layer so the frame arrives on
  // that click and the media object can share it.
  const autoWrappers = new Set(
    videos
      .map(wrapperOf)
      .filter((el): el is LayerElement => el != null && parseLayerSpec(el).trigger !== 'click'),
  )
  const motionLayers = layers.filter((el) => !autoWrappers.has(el))
  const staticVectors = collectStaticVectorElements(slideEl)
  const svgCache: SvgCache = new Map()
  const savedSlide = slideEl.style.visibility
  const savedLayers = layers.map((el) => el.style.visibility)
  const savedVideos = videos.map((el) => ({ visibility: el.style.visibility, opacity: el.style.opacity }))
  const savedVectors = staticVectors.map((el) => el.style.visibility)

  try {
    // Serialise vectors while they are still visible so bounding boxes and
    // computed paint match what the slide actually shows.
    const vectors: VectorPicture[] = []
    const hiddenStatic: Element[] = []
    for (const el of staticVectors) {
      const picture = isSvgImage(el)
        ? await serializeSvgImage(el, slideEl, svgCache)
        : await serializeSvgLayer(el, slideEl, svgCache)
      if (!picture) continue
      vectors.push(picture)
      hiddenStatic.push(el)
    }

    const captured: { layer: CapturedLayer; el: LayerElement }[] = []

    // Videos become real media objects. An auto wrapper stays in the
    // background (frame and shadow, hole where the file sits). A click
    // wrapper is captured as its own layer so the frame arrives on that click.
    // Lifted SVGs leave the same kind of hole so they are not baked into the PNG.
    //
    // Animated layers stay on the in-place raster path even when they are SVG
    // nodes. Serialising a cropped subtree then flattening it to PNG loses the
    // gradient/filter/dashoffset the browser already painted, and shapes came out as the wrong sibling's
    // paint.
    for (const el of videos) {
      el.style.visibility = 'hidden'
      el.style.opacity = '0'
    }
    for (const el of motionLayers) el.style.visibility = 'hidden'
    for (const el of hiddenStatic) (el as HTMLElement).style.visibility = 'hidden'
    const background = await renderSlide(slideEl, { backgroundColor, fontEmbedCSS })

    for (const el of autoWrappers) el.style.visibility = 'hidden'

    for (let i = 0; i < motionLayers.length; i++) {
      onLayer?.(i, motionLayers.length)
      const el = motionLayers[i]!
      isolateLayer(slideEl, motionLayers, el)
      const canvas = await renderSlide(slideEl, { fontEmbedCSS })
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 2D context unavailable')
      const painted = paintedBounds(
        ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width,
        canvas.height,
      )
      if (!painted) continue

      const crop = cropRect(painted, LAYER_BLEED * PIXEL_RATIO, canvas.width, canvas.height, PIXEL_RATIO)
      captured.push({
        el,
        layer: {
          spec: parseLayerSpec(el),
          dataUrl: cropCanvas(canvas, crop).toDataURL('image/png'),
          x: crop.x / PIXEL_RATIO,
          y: crop.y / PIXEL_RATIO,
          w: crop.w / PIXEL_RATIO,
          h: crop.h / PIXEL_RATIO,
        },
      })
    }

    const slideRect = slideEl.getBoundingClientRect()
    return {
      // Lossless, like the layers. A canvas JPEG always chroma-subsamples,
      // which smears the edges of coloured text and blocks up the dark
      // gradients — and on decks with no motion the whole slide is this image.
      backgroundDataUrl: background.toDataURL('image/png'),
      backgroundColor,
      vectors,
      layers: captured.map((c) => c.layer),
      videos: videos.map((video) => {
        const wrapper = wrapperOf(video)
        const clickGated = wrapper != null && parseLayerSpec(wrapper).trigger === 'click'
        return describeVideo(
          video,
          slideRect,
          slideEl,
          clickGated ? captured.findIndex((c) => c.el === wrapper) : -1,
        )
      }),
    }
  } finally {
    slideEl.style.visibility = savedSlide
    layers.forEach((el, i) => {
      el.style.visibility = savedLayers[i] ?? ''
    })
    videos.forEach((el, i) => {
      el.style.visibility = savedVideos[i]?.visibility ?? ''
      el.style.opacity = savedVideos[i]?.opacity ?? ''
    })
    staticVectors.forEach((el, i) => {
      el.style.visibility = savedVectors[i] ?? ''
    })
  }
}

function describeVideo(
  video: HTMLVideoElement,
  slideRect: DOMRect,
  slideEl: HTMLElement,
  layerIndex: number,
): CapturedVideo {
  const rect = video.getBoundingClientRect()
  return {
    src: video.currentSrc || video.src,
    x: Math.round(rect.left - slideRect.left),
    y: Math.round(rect.top - slideRect.top),
    w: Math.round(rect.width),
    h: Math.round(rect.height),
    radius: clipRadius(video, slideEl),
    posterDataUrl: videoPoster(video),
    durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined,
    layerIndex,
  }
}

/** The corner radius the nearest clipping ancestor applies to the video, in px. */
function clipRadius(video: HTMLElement, slideEl: HTMLElement): number {
  let node = video.parentElement
  while (node && node !== slideEl) {
    const style = getComputedStyle(node)
    if (style.overflow === 'hidden' || style.overflow === 'clip') {
      const radius = parseFloat(style.borderTopLeftRadius) || 0
      const border = parseFloat(style.borderTopWidth) || 0
      return Math.max(0, radius - border)
    }
    node = node.parentElement
  }
  return 0
}

/** The current frame, or a black frame if the video has not decoded yet. */
function videoPoster(video: HTMLVideoElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 16
  canvas.height = video.videoHeight || 9
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    } catch {
      // Cross-origin or decode failure: the black frame stands in.
    }
  }
  return canvas.toDataURL('image/png')
}

/**
 * Hide the slide, then re-show one layer. Nested click reveals stay hidden so
 * they are not baked into their parent's picture; a reveal nested inside a
 * hidden parent still shows because an explicit `visible` beats inheritance.
 */
function isolateLayer(slideEl: HTMLElement, all: LayerElement[], target: LayerElement) {
  slideEl.style.visibility = 'hidden'
  for (const el of all) el.style.visibility = 'hidden'
  target.style.visibility = 'visible'
}

export type PixelRect = { x: number; y: number; w: number; h: number }

/** Tight box around every pixel with any alpha, or null when nothing painted. */
export function paintedBounds(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): PixelRect | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    const row = y * width * 4
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/**
 * Grow a box by `bleed` on every side without leaving the canvas, snapped
 * outward to a `grid` of device pixels. The canvas is rendered at 2x, so a
 * crop starting on an odd pixel would land on a half pixel of the slide and
 * PowerPoint would have to resample it — every text edge softened — at
 * exactly the 1080p output where it should be pixel-for-pixel.
 */
export function cropRect(
  box: PixelRect,
  bleed: number,
  width: number,
  height: number,
  grid = 1,
): PixelRect {
  const down = (v: number) => Math.floor(v / grid) * grid
  const up = (v: number) => Math.ceil(v / grid) * grid
  const x = Math.max(0, down(box.x - bleed))
  const y = Math.max(0, down(box.y - bleed))
  const right = Math.min(down(width), up(box.x + box.w + bleed))
  const bottom = Math.min(down(height), up(box.y + box.h + bleed))
  return { x, y, w: right - x, h: bottom - y }
}

function cropCanvas(source: HTMLCanvasElement, rect: PixelRect): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = rect.w
  out.height = rect.h
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)
  return out
}
