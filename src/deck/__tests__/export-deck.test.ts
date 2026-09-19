import { describe, expect, test } from 'bun:test'
import JSZip from 'jszip'
import pptxgen from 'pptxgenjs'
import { Window } from 'happy-dom'
import { exportDeckToPdf } from '../pdf-export'
import { exportDeckToPptx } from '../pptx-export'
import { exportDeckToZip } from '../zip-export'
import { DEFAULT_EXPORT_OPTIONS } from '../export-options'
import { applyAnimationsToPptx, listPictureIds } from '../pptx-animations'
import type { ExportLayerSpec } from '../export-layer'

function emptyContainer() {
  return new Window().document.createElement('div') as unknown as HTMLElement
}

describe('exportDeckToPdf / exportDeckToPptx', () => {
  test('PDF throws when the offscreen tree has no slides', async () => {
    await expect(exportDeckToPdf(emptyContainer(), () => {})).rejects.toThrow(
      'No slides found in container',
    )
  })

  test('PPTX throws when the offscreen tree has no slides', async () => {
    await expect(exportDeckToPptx(emptyContainer(), () => {})).rejects.toThrow(
      'No slides found in container',
    )
  })

  test('ZIP throws when the offscreen tree has no slides', async () => {
    await expect(exportDeckToZip(emptyContainer(), () => {})).rejects.toThrow(
      'No slides found in container',
    )
  })

  test('default same options keep PDF and PPTX on the empty-container path', async () => {
    const empty = emptyContainer()
    await expect(
      exportDeckToPdf(empty, () => {}, 'out.pdf', DEFAULT_EXPORT_OPTIONS),
    ).rejects.toThrow('No slides found in container')
    await expect(
      exportDeckToPptx(empty, () => {}, 'out.pptx', DEFAULT_EXPORT_OPTIONS),
    ).rejects.toThrow('No slides found in container')
  })
})

// A 1×1 transparent PNG; pptxgenjs only needs a well-formed data URL.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('real pptxgenjs output', () => {
  test('layer pictures follow the background and the injected slide parses as XML', async () => {
    const pptx = new pptxgen()
    pptx.defineLayout({ name: 'L', width: 13.333, height: 7.5 })
    pptx.layout = 'L'
    const slide = pptx.addSlide()
    slide.addImage({ data: PNG, x: 0, y: 0, w: 13.333, h: 7.5 })
    slide.addImage({ data: PNG, x: 1, y: 1, w: 2, h: 1 })
    slide.addImage({ data: PNG, x: 4, y: 1, w: 2, h: 1 })
    pptx.addSlide().addImage({ data: PNG, x: 0, y: 0, w: 13.333, h: 7.5 })

    const raw = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
    const before = await JSZip.loadAsync(raw)
    expect(listPictureIds(await before.file('ppt/slides/slide1.xml')!.async('string'))).toEqual([2, 3, 4])

    const specs: ExportLayerSpec[][] = [
      [
        { kind: 'rise', delay: 150, duration: 800, trigger: 'auto', y: 30 },
        { kind: 'appear', delay: 0, duration: 500, trigger: 'click' },
      ],
      [],
    ]
    const out = await JSZip.loadAsync(await applyAnimationsToPptx(raw, specs, 'push'))
    const first = await out.file('ppt/slides/slide1.xml')!.async('string')
    const second = await out.file('ppt/slides/slide2.xml')!.async('string')

    for (const xml of [first, second]) {
      const doc = new Window().DOMParser
      const parsed = new doc().parseFromString(xml, 'text/xml')
      expect(parsed.getElementsByTagName('parsererror')).toHaveLength(0)
    }

    expect(first).toContain('</p:clrMapOvr><p:transition spd="fast"><p:push dir="l"/></p:transition><p:timing>')
    expect(first).toContain('spid="3"')
    expect(first).toContain('spid="4"')
    expect(first.includes('spid="2"')).toBe(false)
    expect(first).toContain('nodeType="clickEffect"')
    expect(second).toContain('<p:push dir="l"/>')
    expect(second.includes('<p:timing>')).toBe(false)
  })

  test('a PNG-only slide has no svg media — importers reject asvg:svgBlip', async () => {
    const pptx = new pptxgen()
    pptx.addSlide().addImage({ data: PNG, x: 0, y: 0, w: 13.333, h: 7.5 })
    const zip = await JSZip.loadAsync((await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer)
    const names = Object.keys(zip.files)
    expect(names.some((name) => name.endsWith('.svg'))).toBe(false)
    const slide = await zip.file('ppt/slides/slide1.xml')!.async('string')
    expect(slide.includes('svgBlip')).toBe(false)
  })

  test('rewriting a video slide strips leftover SVG and empty media r:ids', async () => {
    const pptx = new pptxgen()
    const slide = pptx.addSlide()
    slide.addImage({ data: PNG, x: 0, y: 0, w: 13.333, h: 7.5 })
    slide.addMedia({
      type: 'video',
      data: 'video/mp4;base64,AAAA',
      extn: 'mp4',
      cover: PNG,
      x: 1,
      y: 1,
      w: 4,
      h: 2,
    })

    const raw = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
    const before = await JSZip.loadAsync(raw)
    const beforeXml = await before.file('ppt/slides/slide1.xml')!.async('string')
    expect(beforeXml).toContain('r:id=""')
    expect(before.file('[Content_Types].xml')!.async('string')).resolves.toContain('Extension="svg"')

    const out = await JSZip.loadAsync(
      await applyAnimationsToPptx(raw, [{ layers: [], videos: [{ layerIndex: -1 }] }], 'fade'),
    )
    const xml = await out.file('ppt/slides/slide1.xml')!.async('string')
    const types = await out.file('[Content_Types].xml')!.async('string')
    const names = Object.keys(out.files)

    const parsed = new (new Window().DOMParser)().parseFromString(xml, 'text/xml')
    expect(parsed.getElementsByTagName('parsererror')).toHaveLength(0)
    expect(xml.includes('svgBlip')).toBe(false)
    expect(xml.includes('r:id=""')).toBe(false)
    expect(xml).toContain('<a:videoFile')
    expect(xml).toContain('<a:hlinkClick action="ppaction://media"/>')
    expect(names.some((name) => name.endsWith('.svg'))).toBe(false)
    expect(names.some((name) => name.endsWith('.mp4'))).toBe(true)
    expect(types.includes('Extension="svg"')).toBe(false)
    expect(types).toContain('Extension="mp4"')
  })
})
