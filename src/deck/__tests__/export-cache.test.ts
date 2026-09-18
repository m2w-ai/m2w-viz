import { afterEach, describe, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import {
  cachedSlideImage,
  clearExportCache,
  parseStoredExportOptions,
  readStoredExportOptions,
  slideCacheKey,
  writeStoredExportOptions,
} from '../export-cache'
import { DEFAULT_EXPORT_OPTIONS } from '../export-options'

afterEach(() => {
  clearExportCache()
})

function slide(html: string, index = '0'): HTMLElement {
  const el = new Window().document.createElement('div')
  el.setAttribute('data-slide-index', index)
  el.innerHTML = html
  return el as unknown as HTMLElement
}

describe('slideCacheKey', () => {
  test('is stable for the same markup and changes when the slide changes', () => {
    const a = slide('<p>Hello</p>')
    const b = slide('<p>Hello</p>')
    const c = slide('<p>Hello!</p>')
    expect(slideCacheKey(a, 'image')).toBe(slideCacheKey(b, 'image'))
    expect(slideCacheKey(a, 'image')).not.toBe(slideCacheKey(c, 'image'))
    expect(slideCacheKey(a, 'image')).not.toBe(slideCacheKey(a, 'layers'))
  })
})

describe('cachedSlideImage', () => {
  test('loads once and reuses the capture while markup is unchanged', async () => {
    const el = slide('<h1>One</h1>')
    let loads = 0
    const load = async () => {
      loads += 1
      return { dataUrl: `data:image/png;base64,${loads}`, canvas: {} as HTMLCanvasElement }
    }
    const first = await cachedSlideImage(el, load)
    const second = await cachedSlideImage(el, load)
    expect(loads).toBe(1)
    expect(second).toBe(first)
  })

  test('recaptures after the slide markup changes', async () => {
    const el = slide('<h1>One</h1>')
    let loads = 0
    const load = async () => {
      loads += 1
      return { dataUrl: `png-${loads}`, canvas: {} as HTMLCanvasElement }
    }
    await cachedSlideImage(el, load)
    el.innerHTML = '<h1>Two</h1>'
    await cachedSlideImage(el, load)
    expect(loads).toBe(2)
  })

  test('does not keep a failed capture', async () => {
    const el = slide('<h1>Boom</h1>')
    let loads = 0
    await expect(
      cachedSlideImage(el, async () => {
        loads += 1
        throw new Error('render failed')
      }),
    ).rejects.toThrow('render failed')
    const ok = await cachedSlideImage(el, async () => {
      loads += 1
      return { dataUrl: 'png', canvas: {} as HTMLCanvasElement }
    })
    expect(loads).toBe(2)
    expect(ok.dataUrl).toBe('png')
  })
})

describe('parseStoredExportOptions', () => {
  test('fills defaults for junk and keeps a valid stored chooser', () => {
    expect(parseStoredExportOptions(null)).toEqual(DEFAULT_EXPORT_OPTIONS)
    expect(parseStoredExportOptions({ file: 'ZIP', images: 'png', videos: 'gif', quality: 0.7 })).toEqual({
      file: 'ZIP',
      images: 'png',
      videos: 'gif',
      quality: 0.7,
    })
    expect(parseStoredExportOptions({ file: 'EXE', quality: 0.1 })).toEqual({
      ...DEFAULT_EXPORT_OPTIONS,
      quality: 0.5,
    })
  })

  test('round-trips through localStorage', () => {
    const store = new Map<string, string>()
    const memory = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    }
    Object.assign(globalThis, { localStorage: memory })
    writeStoredExportOptions({ file: 'PDF', images: 'png', videos: 'gif', quality: 0.8 })
    expect(readStoredExportOptions()).toEqual({
      file: 'PDF',
      images: 'png',
      videos: 'gif',
      quality: 0.8,
    })
  })
})
