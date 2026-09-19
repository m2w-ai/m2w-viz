import pptxgen from 'pptxgenjs'
import { applyAnimationsToPptx, type PptxTransition, type SlidePlan } from './pptx-animations'
import {
  captureSlideLayers,
  freezeAnimations,
  PIXEL_RATIO,
  prepareFontEmbedCSS,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type CapturedSlide,
  type CapturedVideo,
} from './capture-slide'
import { isJpegDataUrl, resolveImageFormat, resolveVideoFormat, type ExportOptions } from './export-options'
import { encodeDataUrl } from './image-encode'
import type { ExportProgress } from './pdf-export'
import { BRAND } from '../brand'
import { readSlideNotes } from './export-layer'
import { isPngDataUrl, rasterizeIfSvg } from './svg-capture'
import { encodeVideo, type EncodedVideo, type VideoCache } from './video-encode'

// PowerPoint's own 16:9 canvas, in EMU, so that 1920 slide px map exactly onto
// a 1080p screen rather than 305 EMU short of it.
const EMU_PER_INCH = 914400
const SLIDE_WIDTH_IN = 12192000 / EMU_PER_INCH
const SLIDE_HEIGHT_IN = 6858000 / EMU_PER_INCH
const PX_TO_IN = SLIDE_WIDTH_IN / SLIDE_WIDTH

export type PptxExportOptions = {
  /** Slide-to-slide transition, matching the deck's Spectacle transition. */
  transition?: PptxTransition
  images?: ExportOptions['images']
  videos?: ExportOptions['videos']
  quality?: ExportOptions['quality']
}

export async function exportDeckToPptx(
  container: HTMLElement,
  onProgress: (progress: ExportProgress) => void,
  fileName = 'deck.pptx',
  { transition = 'fade', images = 'same', videos = 'same', quality }: PptxExportOptions = {},
): Promise<void> {
  const slides = container.querySelectorAll<HTMLElement>('[data-slide-index]')
  const total = slides.length
  if (total === 0) throw new Error('No slides found in container')

  const stillFormat = resolveImageFormat(images, 'PPTX')
  const videoFormat = resolveVideoFormat(videos, 'PPTX')

  onProgress({ current: 0, total, status: 'Embedding fonts…' })
  const fontEmbedCSS = await prepareFontEmbedCSS(container)

  const pptx = new pptxgen()
  pptx.defineLayout({ name: 'LAYOUT_DECK', width: SLIDE_WIDTH_IN, height: SLIDE_HEIGHT_IN })
  pptx.layout = 'LAYOUT_DECK'
  pptx.author = BRAND.author
  pptx.title = fileName.replace(/\.pptx$/i, '')

  // Only the animation plan is kept between slides. The captured image data
  // URLs — by far the heaviest thing here — are handed straight to pptxgenjs
  // and then dropped, so peak memory is one slide's pixels, not the deck's.
  const plans: SlidePlan[] = []
  const thaw = freezeAnimations(container)
  const videoCache: VideoCache = new Map()
  let videoOrdinal = 0
  const videoTotal = container.querySelectorAll('video').length

  try {
    for (let i = 0; i < total; i++) {
      const label = `slide ${i + 1} of ${total}`
      onProgress({ current: i, total, status: `Rendering ${label}…` })
      const slideCapture = await captureSlideLayers(slides[i]!, {
        fontEmbedCSS,
        onLayer: (j, n) =>
          onProgress({ current: i, total, status: `Rendering ${label} · layer ${j + 1} of ${n}…` }),
      })
      const encodedVideos: EncodedVideo[] = []
      for (const video of slideCapture.videos) {
        videoOrdinal += 1
        onProgress({
          current: i,
          total,
          status:
            videoFormat === 'mp4'
              ? `Embedding video on ${label}…`
              : `Encoding video ${videoOrdinal} of ${videoTotal}…`,
        })
        encodedVideos.push(await encodeVideo(video.src, videoFormat, video.posterDataUrl, videoCache))
      }
      await addCapturedSlide(pptx, slideCapture, readSlideNotes(slides[i]!), stillFormat, encodedVideos, quality)
      plans.push(planForSlide(slideCapture, encodedVideos))
    }
  } finally {
    thaw()
  }

  onProgress({ current: total, total, status: 'Adding animations…' })

  const raw = await pptx.write({ outputType: 'arraybuffer' })
  const animated = await applyAnimationsToPptx(await toArrayBuffer(raw), plans, transition)

  onProgress({ current: total, total, status: 'Saving PPTX…' })
  downloadBuffer(animated, fileName)
}

function planForSlide(slide: CapturedSlide, encodedVideos: readonly EncodedVideo[]): SlidePlan {
  return {
    layers: slide.layers.map((layer) => layer.spec),
    staticCount: slide.vectors.length,
    videos: slide.videos.flatMap((video, i) =>
      encodedVideos[i]?.kind === 'mp4'
        ? [
            {
              layerIndex: video.layerIndex,
              durationMs: video.durationMs,
              cornerRatio: video.radius / Math.max(1, Math.min(video.w, video.h)),
            },
          ]
        : [],
    ),
  }
}

async function addCapturedSlide(
  pptx: pptxgen,
  captured: CapturedSlide,
  notes: string,
  stillFormat: 'png' | 'jpeg' | 'webp',
  encodedVideos: readonly EncodedVideo[],
  quality?: number,
) {
  const slide = pptx.addSlide()
  if (notes) slide.addNotes(notes)
  await addPicture(slide, captured.backgroundDataUrl, 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT, stillFormat, quality)

  // Static vectors sit above the raster background and below animated layers so
  // picture ids still line up: [bg, ...vectors, ...layers], then media last.
  for (const picture of captured.vectors) {
    await addPicture(slide, picture.dataUrl, picture.x, picture.y, picture.w, picture.h, stillFormat, quality)
  }

  for (const layer of captured.layers) {
    await addPicture(slide, layer.dataUrl, layer.x, layer.y, layer.w, layer.h, stillFormat, quality)
  }

  // Media / GIF / poster sit last so picture ids for animated layers stay stable.
  for (let i = 0; i < captured.videos.length; i++) {
    const video = captured.videos[i]!
    const encoded = encodedVideos[i]
    if (!encoded) continue
    addVideoOrPicture(slide, video, encoded)
  }
}

function addVideoOrPicture(
  slide: ReturnType<pptxgen['addSlide']>,
  video: CapturedVideo,
  encoded: EncodedVideo,
) {
  const box = {
    x: video.x * PX_TO_IN,
    y: video.y * PX_TO_IN,
    w: Math.max(0.01, video.w * PX_TO_IN),
    h: Math.max(0.01, video.h * PX_TO_IN),
  }
  if (encoded.kind === 'mp4') {
    slide.addMedia({
      type: 'video',
      data: encoded.dataUrl,
      cover: video.posterDataUrl,
      extn: 'mp4',
      ...box,
    })
    return
  }
  slide.addImage({ data: encoded.dataUrl, ...box })
}

/** Flatten any leftover SVG so the package never contains an `asvg:svgBlip`. */
async function addPicture(
  slide: ReturnType<pptxgen['addSlide']>,
  dataUrl: string,
  x: number,
  y: number,
  w: number,
  h: number,
  stillFormat: 'png' | 'jpeg' | 'webp',
  quality?: number,
) {
  const png = await rasterizeIfSvg(dataUrl, w, h, PIXEL_RATIO)
  const raster =
    stillFormat === 'jpeg'
      ? await encodeDataUrl(png, 'jpeg')
      : stillFormat === 'png'
        ? await encodeDataUrl(png, 'png', quality)
        : png
  if (!isPngDataUrl(raster) && !isJpegDataUrl(raster)) {
    throw new Error('Export produced a non-raster picture; refusing to write a broken PPTX')
  }
  slide.addImage({
    data: raster,
    x: x * PX_TO_IN,
    y: y * PX_TO_IN,
    w: Math.max(0.01, w * PX_TO_IN),
    h: Math.max(0.01, h * PX_TO_IN),
  })
}

async function toArrayBuffer(raw: string | ArrayBuffer | Blob | Uint8Array): Promise<ArrayBuffer> {
  if (raw instanceof ArrayBuffer) return raw
  if (raw instanceof Uint8Array) {
    return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
  }
  if (typeof Blob !== 'undefined' && raw instanceof Blob) return raw.arrayBuffer()
  throw new Error('Unexpected PPTX write output')
}

function downloadBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
