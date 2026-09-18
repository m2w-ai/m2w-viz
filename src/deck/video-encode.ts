import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import UPNG from 'upng-js'
import type { ResolvedVideoFormat } from './export-options'
import { bytesToDataUrl, encodeDataUrl, toBase64 } from './image-encode'

const SAMPLE_FPS = 8

export type EncodedVideo = {
  kind: 'mp4' | 'gif' | 'image'
  dataUrl: string
  ext: string
  mime: string
}

export type VideoCache = Map<string, Promise<EncodedVideo>>

export function videoCacheKey(src: string, format: ResolvedVideoFormat): string {
  return `${format}:${src}`
}

export function videoBaseName(src: string): string {
  const last = decodeURIComponent(src.split('?')[0]?.split('/').pop() ?? 'video')
  return last.replace(/\.[^.]+$/, '') || 'video'
}

/** Original bytes as `video/mp4;base64,…` — the shape pptxgenjs addMedia expects. */
export async function fetchVideoDataUrl(src: string): Promise<string> {
  const response = await fetch(src)
  if (!response.ok) throw new Error(`Could not load video ${src} (${response.status})`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const ext = src.split('?')[0]?.split('.').pop()?.toLowerCase() || 'mp4'
  const mime = ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4'
  return `${mime};base64,${toBase64(bytes)}`
}

export async function encodeVideo(
  src: string,
  format: ResolvedVideoFormat,
  posterDataUrl: string,
  cache: VideoCache,
): Promise<EncodedVideo> {
  const key = videoCacheKey(src, format)
  let pending = cache.get(key)
  if (!pending) {
    pending = encodeVideoUncached(src, format, posterDataUrl)
    cache.set(key, pending)
  }
  return pending
}

async function encodeVideoUncached(
  src: string,
  format: ResolvedVideoFormat,
  posterDataUrl: string,
): Promise<EncodedVideo> {
  if (format === 'mp4') {
    return { kind: 'mp4', dataUrl: await fetchVideoDataUrl(src), ext: 'mp4', mime: 'video/mp4' }
  }
  if (format === 'still') {
    return stillFromPoster(posterDataUrl, 'png')
  }
  if (format === 'webp') {
    return stillFromPoster(posterDataUrl, 'webp')
  }
  const sampled = await sampleVideoFrames(src, posterDataUrl)
  if (format === 'gif') {
    const bytes = encodeGifFrames(sampled.frames, sampled.width, sampled.height, sampled.delayMs)
    return { kind: 'gif', dataUrl: bytesToDataUrl('image/gif', bytes), ext: 'gif', mime: 'image/gif' }
  }
  const bytes = encodeApngFrames(sampled.frames, sampled.width, sampled.height, sampled.delayMs)
  return { kind: 'image', dataUrl: bytesToDataUrl('image/png', bytes), ext: 'png', mime: 'image/png' }
}

async function stillFromPoster(posterDataUrl: string, format: 'png' | 'webp'): Promise<EncodedVideo> {
  const dataUrl = await encodeDataUrl(posterDataUrl, format)
  const mime = format === 'webp' ? 'image/webp' : 'image/png'
  return { kind: 'image', dataUrl, ext: format, mime }
}

export type SampledFrames = {
  frames: Uint8ClampedArray[]
  width: number
  height: number
  delayMs: number
}

/** Play the file offscreen and grab RGBA frames at ~8 fps. Falls back to the poster. */
export async function sampleVideoFrames(src: string, posterDataUrl: string): Promise<SampledFrames> {
  const delayMs = Math.round(1000 / SAMPLE_FPS)
  try {
    const video = await loadOffscreenVideo(src)
    const width = video.videoWidth || 16
    const height = video.videoHeight || 9
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')

    const frames: Uint8ClampedArray[] = []
    const count = duration > 0 ? Math.max(1, Math.round(duration * SAMPLE_FPS)) : 1
    for (let i = 0; i < count; i++) {
      if (duration > 0) {
        video.currentTime = Math.min(duration, i / SAMPLE_FPS)
        await waitForSeek(video)
      }
      ctx.drawImage(video, 0, 0, width, height)
      frames.push(ctx.getImageData(0, 0, width, height).data)
    }
    video.removeAttribute('src')
    video.load()
    if (frames.length === 0) return framesFromPoster(posterDataUrl, delayMs)
    return { frames, width, height, delayMs }
  } catch {
    return framesFromPoster(posterDataUrl, delayMs)
  }
}

export function encodeGifFrames(
  frames: readonly Uint8ClampedArray[],
  width: number,
  height: number,
  delayMs: number,
): Uint8Array {
  if (frames.length === 0) throw new Error('No frames to encode as GIF')
  const gif = GIFEncoder()
  frames.forEach((frame, i) => {
    const rgba = new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength)
    const palette = quantize(rgba, 256)
    const index = applyPalette(rgba, palette)
    gif.writeFrame(index, width, height, {
      palette,
      delay: delayMs,
      repeat: i === 0 ? 0 : undefined,
    })
  })
  gif.finish()
  return gif.bytes()
}

export function encodeApngFrames(
  frames: readonly Uint8ClampedArray[],
  width: number,
  height: number,
  delayMs: number,
): Uint8Array {
  if (frames.length === 0) throw new Error('No frames to encode as APNG')
  const bufs = frames.map((frame) => {
    const copy = new Uint8Array(frame.byteLength)
    copy.set(frame)
    return copy.buffer
  })
  const delays = frames.map(() => delayMs)
  return new Uint8Array(UPNG.encode(bufs, width, height, 0, delays))
}

async function framesFromPoster(posterDataUrl: string, delayMs: number): Promise<SampledFrames> {
  const { data, width, height } = await decodeImageData(posterDataUrl)
  return { frames: [data], width, height, delayMs }
}

function loadOffscreenVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.loop = false
    video.playsInline = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'
    const succeed = () => resolve(video)
    video.addEventListener('loadeddata', succeed, { once: true })
    video.addEventListener('error', () => reject(new Error(`Could not load video ${src}`)), { once: true })
    video.src = src
    video.load()
  })
}

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  if (video.seeking === false && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    video.addEventListener('seeked', () => resolve(), { once: true })
  })
}

async function decodeImageData(
  dataUrl: string,
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Could not decode poster'))
    el.src = dataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width || 16
  canvas.height = image.naturalHeight || image.height || 9
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(image, 0, 0)
  return {
    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width,
    height: canvas.height,
  }
}
