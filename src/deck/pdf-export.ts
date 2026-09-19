import { jsPDF } from 'jspdf'
import {
  captureSlideImage,
  freezeAnimations,
  prepareFontEmbedCSS,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
} from './capture-slide'
import { resolveImageFormat, type ExportOptions } from './export-options'
import { encodeCanvas, jsPdfImageFormat } from './image-encode'

export type ExportProgress = {
  current: number
  total: number
  status: string
}

export async function exportDeckToPdf(
  container: HTMLElement,
  onProgress: (progress: ExportProgress) => void,
  fileName = 'deck.pdf',
  { images = 'same', quality }: Partial<Pick<ExportOptions, 'images' | 'videos' | 'quality'>> = {},
): Promise<void> {
  const slides = container.querySelectorAll<HTMLElement>('[data-slide-index]')
  const total = slides.length

  if (total === 0) throw new Error('No slides found in container')

  const stillFormat = resolveImageFormat(images, 'PDF')
  const pdfFormat = jsPdfImageFormat(stillFormat)

  onProgress({ current: 0, total, status: 'Initializing PDF…' })
  const fontEmbedCSS = await prepareFontEmbedCSS(container)

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [SLIDE_WIDTH, SLIDE_HEIGHT],
    hotfixes: ['px_scaling'],
  })

  const thaw = freezeAnimations(container)
  try {
    for (let i = 0; i < total; i++) {
      onProgress({ current: i, total, status: `Rendering slide ${i + 1} of ${total}…` })

      const { canvas } = await captureSlideImage(slides[i]!, fontEmbedCSS)
      const dataUrl = await encodeCanvas(canvas, stillFormat, quality)

      if (i > 0) pdf.addPage([SLIDE_WIDTH, SLIDE_HEIGHT], 'landscape')
      pdf.addImage(dataUrl, pdfFormat, 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT)
    }
  } finally {
    thaw()
  }

  onProgress({ current: total, total, status: 'Saving PDF…' })

  pdf.save(fileName)
}
