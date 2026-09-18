import { clampExportQuality, dataUrlKind, type RasterFormat } from './export-options'

export const JPEG_QUALITY = 0.92

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function bytesToDataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${toBase64(bytes)}`
}

export function mimeForRaster(format: RasterFormat): string {
  if (format === 'jpeg') return 'image/jpeg'
  if (format === 'webp') return 'image/webp'
  return 'image/png'
}

export function jsPdfImageFormat(format: RasterFormat): 'PNG' | 'JPEG' {
  return format === 'jpeg' ? 'JPEG' : 'PNG'
}

/** Encode a canvas to a data URL. JPEG/WebP use 0.92; PNG scales when quality < 1. */
export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: RasterFormat,
  quality?: number,
): Promise<string> {
  const q = clampExportQuality(quality)
  const source = format === 'png' && q < 1 ? scaleCanvas(canvas, q) : canvas
  const mime = mimeForRaster(format)
  const encoderQuality = format === 'png' ? undefined : JPEG_QUALITY
  if (typeof source.toBlob === 'function') {
    const blob = await new Promise<Blob | null>((resolve) => source.toBlob(resolve, mime, encoderQuality))
    if (blob && (format !== 'webp' || blob.type === 'image/webp')) {
      return blobToDataUrl(blob)
    }
  }
  const fallback = source.toDataURL(mime, encoderQuality)
  if (format === 'webp' && !fallback.startsWith('data:image/webp')) {
    return source.toDataURL('image/png')
  }
  return fallback
}

/** Re-encode a data URL, or return it unchanged when it is already the target. */
export async function encodeDataUrl(
  dataUrl: string,
  format: RasterFormat,
  quality?: number,
): Promise<string> {
  const q = clampExportQuality(quality)
  if (dataUrlKind(dataUrl) === format && (format !== 'png' || q >= 1)) return dataUrl
  const canvas = await drawDataUrl(dataUrl)
  return encodeCanvas(canvas, format, q)
}

function scaleCanvas(source: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return source
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return bytesToDataUrl(blob.type || 'application/octet-stream', bytes)
}

async function drawDataUrl(dataUrl: string): Promise<HTMLCanvasElement> {
  const image = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(image, 0, 0)
  return canvas
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not decode image for export'))
    image.src = src
  })
}
