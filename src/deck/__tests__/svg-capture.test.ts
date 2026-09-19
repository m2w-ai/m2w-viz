import { describe, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import {
  applyRootOpacity,
  canExportAsSvg,
  ensureSvgSize,
  collectStaticVectorElements,
  elementIndexPath,
  followIndexPath,
  hasSvgText,
  isPngDataUrl,
  isSvgDataUrl,
  isSvgHref,
  rasterizeIfSvg,
  pruneSvgToSubtree,
  svgMarkupToDataUrl,
  viewBoxFromRects,
} from '../svg-capture'

function documentOf(html: string) {
  const window = new Window()
  window.document.body.innerHTML = html
  return window.document
}

describe('isSvgHref', () => {
  test('matches files, query strings, and data URLs', () => {
    expect(isSvgHref('/icon_white.svg')).toBe(true)
    expect(isSvgHref('/icon_white.svg?v=2')).toBe(true)
    expect(isSvgHref('data:image/svg+xml;utf8,<svg/>')).toBe(true)
    expect(isSvgHref('/photo.png')).toBe(false)
    expect(isSvgHref('/icon.svg.png')).toBe(false)
  })
})

describe('hasSvgText / canExportAsSvg', () => {
  test('path-only groups are vector; groups with labels stay raster', () => {
    const document = documentOf(`
      <div>
        <svg>
          <g id="line"><path d="M0 0 L10 0"/></g>
          <g id="pill"><rect/><text>14M</text></g>
        </svg>
        <div id="html">title</div>
      </div>
    `)
    expect(canExportAsSvg(document.getElementById('line')!)).toBe(true)
    expect(canExportAsSvg(document.getElementById('pill')!)).toBe(false)
    expect(canExportAsSvg(document.getElementById('html')!)).toBe(false)
    expect(hasSvgText(document.querySelector('svg')!)).toBe(true)
  })
})

describe('collectStaticVectorElements', () => {
  test('lifts decorative SVGs and svg images, skips charts with text, layers, and svgs that contain a layer', () => {
    const document = documentOf(`
      <div data-slide-index="0">
        <img id="logo" src="/icon_white.svg"/>
        <img id="photo" src="/still.png"/>
        <div data-export-layer="pop"><img id="inside" src="/icon_white.svg"/></div>
        <svg id="qr"><path d="M0 0h1v1h-1z"/></svg>
        <svg id="chart"><path d="M0 0"/><text>2016</text></svg>
        <svg id="layered" data-export-layer="wipe"><path d="M0 0"/></svg>
        <svg id="fan"><g data-export-layer="wipe"><path d="M0 0"/></g></svg>
      </div>
    `)
    const found = collectStaticVectorElements(document.body.firstElementChild!)
    expect(found.map((el) => el.id)).toEqual(['logo', 'qr'])
  })
})

describe('elementIndexPath / pruneSvgToSubtree', () => {
  test('keeps the target, its ancestors, and defs; drops sibling labels', () => {
    const document = documentOf(`
      <svg id="root">
        <defs><linearGradient id="g"/></defs>
        <g id="line"><path id="p"/></g>
        <text id="year">2016</text>
      </svg>
    `)
    const root = document.getElementById('root')!
    const line = document.getElementById('line')!
    expect(followIndexPath(root, elementIndexPath(line, root))?.id).toBe('line')

    pruneSvgToSubtree(root, line)
    expect(document.getElementById('g')).not.toBeNull()
    expect(document.getElementById('line')).not.toBeNull()
    expect(document.getElementById('p')).not.toBeNull()
    expect(document.getElementById('year')).toBeNull()
  })
})

describe('viewBoxFromRects', () => {
  test('maps a CSS-pixel crop back into the SVG viewBox, with pad', () => {
    expect(
      viewBoxFromRects({ x: 0, y: 0, w: 100, h: 50 }, { x: 10, y: 10, w: 30, h: 20 }, { x: 0, y: 0, w: 200, h: 100 }, 0),
    ).toEqual({ x: 20, y: 20, w: 60, h: 40 })
    expect(
      viewBoxFromRects({ x: 0, y: 0, w: 100, h: 100 }, { x: 10, y: 10, w: 10, h: 10 }, { x: 0, y: 0, w: 100, h: 100 }, 2),
    ).toEqual({ x: 8, y: 8, w: 14, h: 14 })
  })
})

describe('rasterizeIfSvg', () => {
  test('leaves a PNG data URL alone so the PPTX never has to host an SVG', async () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    expect(isSvgDataUrl(png)).toBe(false)
    expect(isPngDataUrl(png)).toBe(true)
    expect(isPngDataUrl('data:,')).toBe(false)
    expect(isSvgDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(true)
    expect(await rasterizeIfSvg(png, 10, 10, 3)).toBe(png)
  })
})

describe('svgMarkupToDataUrl / applyRootOpacity', () => {
  test('encodes markup as base64 so pptxgenjs will actually embed it', () => {
    const url = svgMarkupToDataUrl('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true)
    const body = url.slice(url.indexOf(',') + 1)
    const markup = new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0)))
    expect(markup).toContain('<svg')
    expect(markup.includes('<?xml')).toBe(false)
    expect(applyRootOpacity('<svg viewBox="0 0 1 1"/>', 0.45)).toBe('<svg opacity="0.45" viewBox="0 0 1 1"/>')
    expect(applyRootOpacity('<svg viewBox="0 0 1 1"/>', 1)).toBe('<svg viewBox="0 0 1 1"/>')
    expect(ensureSvgSize('<svg viewBox="0 0 1 1"/>', 12, 8)).toBe('<svg width="12" height="8" viewBox="0 0 1 1"/>')
    expect(ensureSvgSize('<svg width="4" viewBox="0 0 1 1"/>', 12, 8)).toBe('<svg height="8" width="4" viewBox="0 0 1 1"/>')
  })
})
