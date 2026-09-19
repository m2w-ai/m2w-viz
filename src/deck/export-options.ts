export type ExportFileFormat = 'PDF' | 'PPTX' | 'ZIP'
export type ImageFormat = 'same' | 'png' | 'jpeg' | 'webp'
export type VideoFormat = 'same' | 'gif' | 'webp' | 'apng'

export type ExportOptions = {
  file: ExportFileFormat
  images: ImageFormat
  videos: VideoFormat
  /** 0.5–1. PNG scale; JPEG/WebP encoder quality. 1 is today's capture. */
  quality: number
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  file: 'PPTX',
  images: 'same',
  videos: 'same',
  quality: 1,
}

export const MIN_EXPORT_QUALITY = 0.5

/** Clamp the chooser gauge onto the range encode actually uses. */
export function clampExportQuality(quality: number | undefined): number {
  if (quality == null || Number.isNaN(quality)) return 1
  return Math.min(1, Math.max(MIN_EXPORT_QUALITY, quality))
}

/** Same and PNG are the PNG path — that's when the quality gauge shows. */
export function showsPngQuality(images: ImageFormat): boolean {
  return images === 'same' || images === 'png'
}

export type RasterFormat = 'png' | 'jpeg' | 'webp'

/** What the file can actually hold after container fallbacks. `same` is PNG. */
export function resolveImageFormat(images: ImageFormat, file: ExportFileFormat): RasterFormat {
  const requested: RasterFormat = images === 'same' ? 'png' : images
  if (file === 'PDF' && requested === 'webp') return 'jpeg'
  if (file === 'PPTX' && requested === 'webp') return 'png'
  return requested
}

export type ResolvedVideoFormat = 'mp4' | 'gif' | 'webp' | 'apng' | 'still'

/**
 * `same` is the original MP4. PDF is never animated. Office plays MP4 and
 * looping GIF; WebP/APNG become a still poster there.
 */
export function resolveVideoFormat(videos: VideoFormat, file: ExportFileFormat): ResolvedVideoFormat {
  if (file === 'PDF') return 'still'
  const requested: Exclude<ResolvedVideoFormat, 'still'> = videos === 'same' ? 'mp4' : videos
  if (file === 'PPTX' && (requested === 'webp' || requested === 'apng')) return 'still'
  return requested
}

export function imageExtension(format: RasterFormat): 'png' | 'jpg' | 'webp' {
  return format === 'jpeg' ? 'jpg' : format
}

export function videoExtension(format: ResolvedVideoFormat): string {
  if (format === 'still') return 'png'
  if (format === 'apng') return 'png'
  return format
}

export function canSubmitExport(options: Partial<ExportOptions>): options is ExportOptions {
  return options.file === 'PDF' || options.file === 'PPTX' || options.file === 'ZIP'
}

export function dataUrlKind(dataUrl: string): RasterFormat | null {
  if (dataUrl.startsWith('data:image/png')) return 'png'
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'jpeg'
  if (dataUrl.startsWith('data:image/webp')) return 'webp'
  return null
}

export function isJpegDataUrl(dataUrl: string): boolean {
  return (
    (dataUrl.startsWith('data:image/jpeg;base64,') || dataUrl.startsWith('data:image/jpg;base64,')) &&
    dataUrl.length > 'data:image/jpeg;base64,'.length
  )
}

export function isWebpDataUrl(dataUrl: string): boolean {
  return dataUrl.startsWith('data:image/webp;base64,') && dataUrl.length > 'data:image/webp;base64,'.length
}

export function isGifDataUrl(dataUrl: string): boolean {
  return dataUrl.startsWith('data:image/gif;base64,') && dataUrl.length > 'data:image/gif;base64,'.length
}

export function fileExtensionFor(file: ExportFileFormat): 'pdf' | 'pptx' | 'zip' {
  if (file === 'PDF') return 'pdf'
  if (file === 'PPTX') return 'pptx'
  return 'zip'
}
