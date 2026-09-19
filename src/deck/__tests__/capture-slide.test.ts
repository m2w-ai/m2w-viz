import { afterEach, describe, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { cropRect, paintedBounds, readSlideBackground } from '../capture-slide'

function windowWithComputedStyle() {
  const window = new Window()
  ;(globalThis as { getComputedStyle: typeof window.getComputedStyle }).getComputedStyle =
    window.getComputedStyle.bind(window)
  return window
}

afterEach(() => {
  delete (globalThis as { getComputedStyle?: unknown }).getComputedStyle
})

describe('readSlideBackground', () => {
  test('uses the slide’s own opaque background', () => {
    const window = windowWithComputedStyle()
    const slide = window.document.createElement('div')
    slide.style.backgroundColor = 'rgb(222, 210, 246)'
    window.document.body.appendChild(slide)
    expect(readSlideBackground(slide as unknown as HTMLElement)).toBe('rgb(222, 210, 246)')
  })

  test('walks up to a parent when the slide itself is transparent', () => {
    const window = windowWithComputedStyle()
    const parent = window.document.createElement('div')
    parent.style.backgroundColor = 'rgb(5, 5, 5)'
    const slide = window.document.createElement('div')
    slide.style.backgroundColor = 'transparent'
    parent.appendChild(slide)
    window.document.body.appendChild(parent)
    expect(readSlideBackground(slide as unknown as HTMLElement)).toBe('rgb(5, 5, 5)')
  })

  test('falls back to the dark deck color', () => {
    const window = windowWithComputedStyle()
    const slide = window.document.createElement('div')
    window.document.body.appendChild(slide)
    expect(readSlideBackground(slide as unknown as HTMLElement)).toBe('#050505')
  })
})

/** RGBA buffer with alpha 255 at the listed pixels. */
function pixels(width: number, height: number, painted: [number, number][]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (const [x, y] of painted) data[(y * width + x) * 4 + 3] = 255
  return data
}

describe('paintedBounds', () => {
  test('finds the tight box around painted pixels', () => {
    const data = pixels(10, 8, [
      [2, 1],
      [7, 1],
      [4, 6],
    ])
    expect(paintedBounds(data, 10, 8)).toEqual({ x: 2, y: 1, w: 6, h: 6 })
  })

  test('a single pixel is a 1×1 box', () => {
    expect(paintedBounds(pixels(4, 4, [[3, 0]]), 4, 4)).toEqual({ x: 3, y: 0, w: 1, h: 1 })
  })

  test('returns null when nothing painted, so the layer is skipped', () => {
    expect(paintedBounds(pixels(6, 6, []), 6, 6)).toBeNull()
  })

  test('ignores fully transparent colour', () => {
    const data = new Uint8ClampedArray(4 * 4)
    data[0] = 255
    data[1] = 255
    data[2] = 255
    expect(paintedBounds(data, 2, 2)).toBeNull()
  })
})

describe('cropRect', () => {
  test('adds bleed on every side', () => {
    expect(cropRect({ x: 10, y: 10, w: 5, h: 5 }, 4, 100, 100)).toEqual({ x: 6, y: 6, w: 13, h: 13 })
  })

  test('never leaves the canvas', () => {
    expect(cropRect({ x: 1, y: 0, w: 5, h: 5 }, 4, 8, 8)).toEqual({ x: 0, y: 0, w: 8, h: 8 })
  })

  test('snaps outward to the device-pixel grid so slide positions are whole pixels', () => {
    const crop = cropRect({ x: 11, y: 7, w: 5, h: 6 }, 0, 100, 100, 2)
    expect(crop).toEqual({ x: 10, y: 6, w: 6, h: 8 })
    expect(crop.x % 2).toBe(0)
    expect((crop.x + crop.w) % 2).toBe(0)
  })

  test('grid snapping still respects the canvas edge', () => {
    expect(cropRect({ x: 96, y: 95, w: 3, h: 4 }, 0, 99, 99, 2)).toEqual({ x: 96, y: 94, w: 2, h: 4 })
  })
})
