import {
  DEFAULT_EXPORT_OPTIONS,
  clampExportQuality,
  type ExportFileFormat,
  type ExportOptions,
  type ImageFormat,
  type VideoFormat,
} from './export-options'
import type { CapturedSlide } from './capture-slide'

export const EXPORT_OPTIONS_STORAGE_KEY = 'm2w-viz.export-options'

const MAX_CAPTURES = 48

export type SlideImageCapture = { dataUrl: string; canvas: HTMLCanvasElement }

const imageCache = new Map<string, Promise<SlideImageCapture>>()
const layerCache = new Map<string, Promise<CapturedSlide>>()

/** Stable per slide + markup so a rewrite misses and recaptures. */
export function slideCacheKey(slideEl: HTMLElement, kind: 'image' | 'layers'): string {
  const index = slideEl.getAttribute('data-slide-index') ?? '?'
  const html = slideEl.innerHTML
  return `${kind}:${index}:${html.length}:${fnv1a(html)}`
}

export async function cachedSlideImage(
  slideEl: HTMLElement,
  load: () => Promise<SlideImageCapture>,
): Promise<SlideImageCapture> {
  return cached(imageCache, slideCacheKey(slideEl, 'image'), load)
}

export async function cachedSlideLayers(
  slideEl: HTMLElement,
  load: () => Promise<CapturedSlide>,
): Promise<CapturedSlide> {
  return cached(layerCache, slideCacheKey(slideEl, 'layers'), load)
}

export function clearExportCache(): void {
  imageCache.clear()
  layerCache.clear()
}

export function parseStoredExportOptions(raw: unknown): ExportOptions {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_EXPORT_OPTIONS }
  const value = raw as Partial<ExportOptions>
  return {
    file: isFile(value.file) ? value.file : DEFAULT_EXPORT_OPTIONS.file,
    images: isImage(value.images) ? value.images : DEFAULT_EXPORT_OPTIONS.images,
    videos: isVideo(value.videos) ? value.videos : DEFAULT_EXPORT_OPTIONS.videos,
    quality: clampExportQuality(value.quality),
  }
}

export function readStoredExportOptions(): ExportOptions {
  try {
    const raw = localStorage.getItem(EXPORT_OPTIONS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_EXPORT_OPTIONS }
    return parseStoredExportOptions(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_EXPORT_OPTIONS }
  }
}

export function writeStoredExportOptions(options: ExportOptions): void {
  try {
    localStorage.setItem(
      EXPORT_OPTIONS_STORAGE_KEY,
      JSON.stringify({
        file: options.file,
        images: options.images,
        videos: options.videos,
        quality: clampExportQuality(options.quality),
      }),
    )
  } catch {
    // Private mode / quota — export still runs.
  }
}

async function cached<T>(
  map: Map<string, Promise<T>>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const hit = map.get(key)
  if (hit) return hit
  const pending = load().catch((error: unknown) => {
    map.delete(key)
    throw error
  })
  remember(map, key, pending)
  return pending
}

function remember<T>(map: Map<string, Promise<T>>, key: string, value: Promise<T>): void {
  if (map.has(key)) map.delete(key)
  map.set(key, value)
  while (map.size > MAX_CAPTURES) {
    const oldest = map.keys().next().value
    if (oldest == null || oldest === key) break
    map.delete(oldest)
  }
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

function isFile(value: unknown): value is ExportFileFormat {
  return value === 'PDF' || value === 'PPTX' || value === 'ZIP'
}

function isImage(value: unknown): value is ImageFormat {
  return value === 'same' || value === 'png' || value === 'jpeg' || value === 'webp'
}

function isVideo(value: unknown): value is VideoFormat {
  return value === 'same' || value === 'gif' || value === 'webp' || value === 'apng'
}
