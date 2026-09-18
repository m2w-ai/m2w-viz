import { describe, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { collectLayerElements, exportLayerAttrs, parseLayerSpec, readSlideNotes } from '../export-layer'

function documentOf(html: string) {
  const window = new Window()
  window.document.body.innerHTML = html
  return window.document
}

describe('exportLayerAttrs', () => {
  test('writes kind, delay, duration, and trigger', () => {
    expect(exportLayerAttrs({ kind: 'rise', delay: 200, duration: 800, trigger: 'auto', y: 34 })).toEqual({
      'data-export-layer': 'rise',
      'data-export-delay': '200',
      'data-export-duration': '800',
      'data-export-trigger': 'auto',
      'data-export-y': '34',
    })
  })

  test('only writes the optional fields that are set', () => {
    const attrs = exportLayerAttrs({
      kind: 'appear',
      delay: 0,
      duration: 500,
      trigger: 'click',
      step: 2,
      exitOnNextClick: true,
    })
    expect(attrs['data-export-step']).toBe('2')
    expect(attrs['data-export-exit']).toBe('next-click')
    expect(attrs['data-export-x']).toBeUndefined()
    expect(attrs['data-export-from']).toBeUndefined()
    expect(exportLayerAttrs({ kind: 'pop', delay: 0, duration: 700, trigger: 'auto', from: 0.9 })['data-export-from']).toBe('0.9')
  })

  test('writes timed exits and loops', () => {
    const frame = exportLayerAttrs({ kind: 'frame', delay: 550, duration: 1, trigger: 'auto', exitAfterMs: 637 })
    expect(frame['data-export-exit-after']).toBe('637')
    const bubble = exportLayerAttrs({
      kind: 'appear',
      delay: 0,
      duration: 500,
      trigger: 'click',
      loop: { dy: -14, periodMs: 4500 },
    })
    expect(bubble['data-export-loop-dy']).toBe('-14')
    expect(bubble['data-export-loop-ms']).toBe('4500')
  })
})

describe('parseLayerSpec', () => {
  test('round-trips every attribute', () => {
    const document = documentOf(
      `<div data-export-layer="slide-in" data-export-delay="120" data-export-duration="640" data-export-trigger="click" data-export-step="3" data-export-exit="next-click" data-export-x="-40"></div>`,
    )
    expect(parseLayerSpec(document.body.firstElementChild!)).toEqual({
      kind: 'slide-in',
      delay: 120,
      duration: 640,
      trigger: 'click',
      step: 3,
      exitOnNextClick: true,
      x: -40,
      y: undefined,
      from: undefined,
    })
  })

  test('defaults missing fields', () => {
    const document = documentOf(`<div data-export-layer="wipe"></div>`)
    const parsed = parseLayerSpec(document.body.firstElementChild!)
    expect(parsed.kind).toBe('wipe')
    expect(parsed.delay).toBe(0)
    expect(parsed.duration).toBe(700)
    expect(parsed.trigger).toBe('auto')
    expect(parsed.step).toBeUndefined()
    expect(parsed.exitOnNextClick).toBeUndefined()
    expect(parsed.exitAfterMs).toBeUndefined()
    expect(parsed.loop).toBeUndefined()
  })

  test('reads timed exits and loops back', () => {
    const document = documentOf(
      `<div data-export-layer="appear" data-export-exit-after="637" data-export-loop-dy="-14" data-export-loop-ms="4500"></div>`,
    )
    const parsed = parseLayerSpec(document.body.firstElementChild!)
    expect(parsed.exitAfterMs).toBe(637)
    expect(parsed.loop).toEqual({ dy: -14, periodMs: 4500 })
  })
})

describe('collectLayerElements', () => {
  test('keeps outermost motion nodes and drops nested CountUp', () => {
    const document = documentOf(`
      <div data-slide-index="0">
        <div id="rise" data-export-layer="rise">
          <span id="count" data-export-layer="count-up">88</span>
        </div>
        <div id="pop" data-export-layer="pop"></div>
      </div>
    `)
    const layers = collectLayerElements(document.body.firstElementChild!)
    expect(layers.map((el) => el.id)).toEqual(['rise', 'pop'])
  })

  test('also lifts nested Appear so click reveals stay their own layer', () => {
    const document = documentOf(`
      <div data-slide-index="0">
        <div id="rise" data-export-layer="rise">
          <div id="ask" data-export-layer="appear"></div>
        </div>
      </div>
    `)
    const layers = collectLayerElements(document.body.firstElementChild!)
    expect(layers.map((el) => el.id)).toEqual(['rise', 'ask'])
  })

  test('collects SVG groups as layers too', () => {
    const document = documentOf(`
      <div data-slide-index="0">
        <svg><g id="line" data-export-layer="wipe" data-export-trigger="click" data-export-step="1"></g></svg>
      </div>
    `)
    const layers = collectLayerElements(document.body.firstElementChild!)
    expect(layers.map((el) => el.id)).toEqual(['line'])
    expect(parseLayerSpec(layers[0]!).step).toBe(1)
  })

  test('lifts counter frames out of the Rise that wraps them, in order', () => {
    const document = documentOf(`
      <div data-slide-index="0">
        <div id="rise" data-export-layer="rise">
          <span data-export-layer="count-up">
            <span id="f0" data-export-layer="frame"></span>
            <span id="f1" data-export-layer="frame"></span>
          </span>
        </div>
      </div>
    `)
    const layers = collectLayerElements(document.body.firstElementChild!)
    expect(layers.map((el) => el.id)).toEqual(['rise', 'f0', 'f1'])
  })

  test('returns nothing when the slide has no tagged layers', () => {
    const document = documentOf(`<div data-slide-index="0"><p>static</p></div>`)
    expect(collectLayerElements(document.body.firstElementChild!)).toEqual([])
  })
})

describe('readSlideNotes', () => {
  test('joins note blocks with blank lines and collapses whitespace', () => {
    const document = documentOf(`
      <div data-slide-index="0">
        <div hidden data-slide-notes>
          <p>State of play since
             January.</p>
          <p>Four paying.</p>
        </div>
      </div>
    `)
    expect(readSlideNotes(document.body.firstElementChild!)).toBe('State of play since January.\n\nFour paying.')
  })

  test('falls back to bare text and to empty when there is no node', () => {
    const withText = documentOf(`<div data-slide-index="0"><div data-slide-notes>  Just text  </div></div>`)
    expect(readSlideNotes(withText.body.firstElementChild!)).toBe('Just text')
    const none = documentOf(`<div data-slide-index="0"></div>`)
    expect(readSlideNotes(none.body.firstElementChild!)).toBe('')
  })
})
