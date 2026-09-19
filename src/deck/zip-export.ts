import JSZip from 'jszip'
import {
  captureSlideImage,
  freezeAnimations,
  prepareFontEmbedCSS,
  listContainerVideos,
} from './capture-slide'
import {
  imageExtension,
  resolveImageFormat,
  resolveVideoFormat,
  type ExportOptions,
} from './export-options'
import { encodeCanvas } from './image-encode'
import type { ExportProgress } from './pdf-export'
import { encodeVideo, videoBaseName, type VideoCache } from './video-encode'

export async function exportDeckToZip(
  container: HTMLElement,
  onProgress: (progress: ExportProgress) => void,
  fileName = 'deck.zip',
  { images = 'same', videos = 'same', quality }: Partial<Pick<ExportOptions, 'images' | 'videos' | 'quality'>> = {},
): Promise<void> {
  const slides = container.querySelectorAll<HTMLElement>('[data-slide-index]')
  const total = slides.length
  if (total === 0) throw new Error('No slides found in container')

  const stillFormat = resolveImageFormat(images, 'ZIP')
  const videoFormat = resolveVideoFormat(videos, 'ZIP')
  const stillExt = imageExtension(stillFormat)

  onProgress({ current: 0, total, status: 'Preparing…' })
  const fontEmbedCSS = await prepareFontEmbedCSS(container)
  const zip = new JSZip()
  const cache: VideoCache = new Map()
  const usedNames = new Set<string>()

  const thaw = freezeAnimations(container)
  try {
    for (let i = 0; i < total; i++) {
      onProgress({ current: i, total, status: `Rendering slide ${i + 1} of ${total}…` })
      const { canvas } = await captureSlideImage(slides[i]!, fontEmbedCSS)
      const dataUrl = await encodeCanvas(canvas, stillFormat, quality)
      const index = String(i + 1).padStart(2, '0')
      zip.file(`slides/${index}.${stillExt}`, dataUrlToBytes(dataUrl))
    }

    const deckVideos = listContainerVideos(container)
    for (let i = 0; i < deckVideos.length; i++) {
      const video = deckVideos[i]!
      onProgress({
        current: total,
        total,
        status: `Encoding video ${i + 1} of ${deckVideos.length}…`,
      })
      const encoded = await encodeVideo(video.src, videoFormat, video.posterDataUrl, cache)
      const name = uniqueName(`${videoBaseName(video.src)}.${encoded.ext}`, usedNames)
      zip.file(`videos/${name}`, dataUrlToBytes(encoded.dataUrl))
    }
  } finally {
    thaw()
  }

  onProgress({ current: total, total, status: 'Saving ZIP…' })
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, fileName)
}

function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const stem = dot === -1 ? name : name.slice(0, dot)
  const ext = dot === -1 ? '' : name.slice(dot)
  let n = 2
  let next = `${stem}-${n}${ext}`
  while (used.has(next)) {
    n += 1
    next = `${stem}-${n}${ext}`
  }
  used.add(next)
  return next
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const encoded = comma === -1 ? dataUrl : dataUrl.slice(comma + 1)
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
