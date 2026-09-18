import {
  DEFAULT_EXPORT_OPTIONS,
  fileExtensionFor,
  type ExportOptions,
} from './export-options'
import { exportDeckToPdf, type ExportProgress } from './pdf-export'
import { exportDeckToPptx, type PptxExportOptions } from './pptx-export'
import { exportDeckToZip } from './zip-export'

export async function runDeckExport(
  container: HTMLElement,
  onProgress: (progress: ExportProgress) => void,
  baseName: string,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS,
  pptxOptions: PptxExportOptions = {},
): Promise<void> {
  const fileName = `${baseName}.${fileExtensionFor(options.file)}`
  const media = { images: options.images, videos: options.videos, quality: options.quality }
  if (options.file === 'PDF') {
    await exportDeckToPdf(container, onProgress, fileName, media)
    return
  }
  if (options.file === 'ZIP') {
    await exportDeckToZip(container, onProgress, fileName, media)
    return
  }
  await exportDeckToPptx(container, onProgress, fileName, { ...pptxOptions, ...media })
}
