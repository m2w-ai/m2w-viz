import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_EXPORT_OPTIONS,
  canSubmitExport,
  clampExportQuality,
  imageExtension,
  resolveImageFormat,
  resolveVideoFormat,
  showsPngQuality,
} from '../export-options'
import { encodeDataUrl, jsPdfImageFormat } from '../image-encode'

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('resolveImageFormat', () => {
  test('same is PNG for every container', () => {
    expect(resolveImageFormat('same', 'PDF')).toBe('png')
    expect(resolveImageFormat('same', 'PPTX')).toBe('png')
    expect(resolveImageFormat('same', 'ZIP')).toBe('png')
  })

  test('PDF cannot hold WebP, so stills become JPEG', () => {
    expect(resolveImageFormat('webp', 'PDF')).toBe('jpeg')
    expect(jsPdfImageFormat(resolveImageFormat('webp', 'PDF'))).toBe('JPEG')
  })

  test('PPTX cannot hold WebP, so stills become PNG', () => {
    expect(resolveImageFormat('webp', 'PPTX')).toBe('png')
  })

  test('ZIP honours PNG, JPEG, and WebP', () => {
    expect(resolveImageFormat('png', 'ZIP')).toBe('png')
    expect(resolveImageFormat('jpeg', 'ZIP')).toBe('jpeg')
    expect(resolveImageFormat('webp', 'ZIP')).toBe('webp')
    expect(imageExtension(resolveImageFormat('jpeg', 'ZIP'))).toBe('jpg')
  })
})

describe('resolveVideoFormat', () => {
  test('same is MP4 except on PDF, which is never animated', () => {
    expect(resolveVideoFormat('same', 'PPTX')).toBe('mp4')
    expect(resolveVideoFormat('same', 'ZIP')).toBe('mp4')
    expect(resolveVideoFormat('same', 'PDF')).toBe('still')
  })

  test('PDF always uses a still poster', () => {
    expect(resolveVideoFormat('gif', 'PDF')).toBe('still')
    expect(resolveVideoFormat('webp', 'PDF')).toBe('still')
    expect(resolveVideoFormat('apng', 'PDF')).toBe('still')
  })

  test('PPTX plays MP4 and GIF; WebP and APNG become a still', () => {
    expect(resolveVideoFormat('gif', 'PPTX')).toBe('gif')
    expect(resolveVideoFormat('webp', 'PPTX')).toBe('still')
    expect(resolveVideoFormat('apng', 'PPTX')).toBe('still')
  })

  test('ZIP keeps GIF, WebP still, and APNG', () => {
    expect(resolveVideoFormat('gif', 'ZIP')).toBe('gif')
    expect(resolveVideoFormat('webp', 'ZIP')).toBe('webp')
    expect(resolveVideoFormat('apng', 'ZIP')).toBe('apng')
  })
})

describe('canSubmitExport', () => {
  test('Export is disabled until a file format is selected', () => {
    expect(canSubmitExport({ images: 'same', videos: 'same' })).toBe(false)
    expect(canSubmitExport({ file: undefined, images: 'same', videos: 'same' })).toBe(false)
  })

  test('default file format is filled, so Export is enabled', () => {
    expect(DEFAULT_EXPORT_OPTIONS.file).toBe('PPTX')
    expect(canSubmitExport(DEFAULT_EXPORT_OPTIONS)).toBe(true)
  })
})

describe('PNG quality gauge', () => {
  test('shows for Same and PNG, not JPEG or WebP', () => {
    expect(showsPngQuality('same')).toBe(true)
    expect(showsPngQuality('png')).toBe(true)
    expect(showsPngQuality('jpeg')).toBe(false)
    expect(showsPngQuality('webp')).toBe(false)
  })

  test('default quality is full capture, and the gauge clamps to 50–100%', () => {
    expect(DEFAULT_EXPORT_OPTIONS.quality).toBe(1)
    expect(clampExportQuality(undefined)).toBe(1)
    expect(clampExportQuality(0.2)).toBe(0.5)
    expect(clampExportQuality(1.4)).toBe(1)
    expect(clampExportQuality(0.75)).toBe(0.75)
  })
})

describe('encodeDataUrl', () => {
  test('leaves a PNG data URL alone when the target is PNG — same as today', async () => {
    expect(await encodeDataUrl(PNG, 'png')).toBe(PNG)
  })
})
