import { EXPORT_LAYER_ATTR } from './export-layer'

const SVG_NS = 'http://www.w3.org/2000/svg'

export type VectorPicture = {
  dataUrl: string
  /** Slide px. */
  x: number
  y: number
  w: number
  h: number
}

const SVG_PAINT = [
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'opacity',
  'filter',
  'color',
] as const

export function isSvgDataUrl(dataUrl: string): boolean {
  return dataUrl.includes('image/svg+xml')
}

/** pptxgenjs will accept this; anything else becomes a 0-byte picture and the import fails. */
export function isPngDataUrl(dataUrl: string): boolean {
  return dataUrl.startsWith('data:image/png;base64,') && dataUrl.length > 'data:image/png;base64,'.length
}

/**
 * Draw an SVG picture to a PNG. PowerPoint and Google Slides often refuse a
 * PPTX that contains an `asvg:svgBlip`, so vectors are captured as SVG then
 * flattened here before pptxgenjs sees them.
 */
export async function rasterizeIfSvg(
  dataUrl: string,
  width: number,
  height: number,
  pixelRatio: number,
): Promise<string> {
  if (!isSvgDataUrl(dataUrl)) return dataUrl
  const img = new Image()
  img.src = dataUrl
  if (typeof img.decode === 'function') await img.decode()
  else {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not decode SVG'))
    })
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * pixelRatio))
  canvas.height = Math.max(1, Math.round(height * pixelRatio))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

export function isSvgHref(src: string): boolean {
  if (src.startsWith('data:image/svg+xml')) return true
  const path = src.split(/[?#]/, 1)[0] ?? src
  return /\.svg$/i.test(path)
}

export function isSvgImage(el: Element): el is HTMLImageElement {
  return el.tagName.toLowerCase() === 'img' && isSvgHref((el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src)
}

export function hasSvgText(el: Element): boolean {
  return !!el.querySelector('text, tspan, textPath')
}

/** An SVG node we can serialise as a real vector picture, not a foreignObject wrap. */
export function isSvgNode(el: Element): el is SVGElement {
  if (el.namespaceURI === SVG_NS) return true
  const tag = el.tagName.toLowerCase().replace(/^.*:/, '')
  if (tag === 'svg') return true
  return el.closest('svg') !== null && tag !== 'img'
}

/** Path/shape layers stay vector. Pills and labels with `<text>` stay raster so the web font survives. */
export function canExportAsSvg(el: Element): el is SVGElement {
  return isSvgNode(el) && !hasSvgText(el)
}

/**
 * Root SVGs and `<img src="*.svg">` that are not themselves a layer. Charts
 * that mix paths with `<text>` stay in the raster background; their tagged
 * layers are photographed in place rather than rebuilt as cropped SVGs.
 */
export function collectStaticVectorElements(slideEl: Element): Array<SVGSVGElement | HTMLImageElement> {
  const out: Array<SVGSVGElement | HTMLImageElement> = []

  for (const img of slideEl.querySelectorAll('img')) {
    if (!isSvgImage(img)) continue
    if (img.closest(`[${EXPORT_LAYER_ATTR}]`)) continue
    out.push(img)
  }

  for (const svg of slideEl.querySelectorAll('svg')) {
    if (svg.parentElement?.closest('svg')) continue
    if (svg.hasAttribute(EXPORT_LAYER_ATTR)) continue
    if (svg.closest(`[${EXPORT_LAYER_ATTR}]`)) continue
    if (svg.querySelector(`[${EXPORT_LAYER_ATTR}]`)) continue
    if (hasSvgText(svg)) continue
    out.push(svg as SVGSVGElement)
  }

  return out
}

export function elementIndexPath(from: Element, ancestor: Element): number[] {
  const path: number[] = []
  let node: Element | null = from
  while (node && node !== ancestor) {
    const parent: Element | null = node.parentElement
    if (!parent) break
    path.unshift([...parent.children].indexOf(node))
    node = parent
  }
  return path
}

export function followIndexPath(root: Element, path: readonly number[]): Element | null {
  let node: Element = root
  for (const i of path) {
    const next = node.children[i]
    if (!next) return null
    node = next
  }
  return node
}

/** Drop every node that is not `keep`, an ancestor of it, a descendant, or a `defs`. */
export function pruneSvgToSubtree(root: Element, keep: Element): void {
  const kept = new Set<Element>([root])
  let node: Element | null = keep
  while (node) {
    kept.add(node)
    if (node === root) break
    node = node.parentElement
  }
  keep.querySelectorAll('*').forEach((el) => kept.add(el))
  root.querySelectorAll('defs').forEach((defs) => {
    kept.add(defs)
    defs.querySelectorAll('*').forEach((el) => kept.add(el))
  })

  for (const el of [...root.querySelectorAll('*')].reverse()) {
    if (kept.has(el) || el.closest('defs')) continue
    el.remove()
  }
}

export function viewBoxFromRects(
  rootBox: { x: number; y: number; w: number; h: number },
  elBox: { x: number; y: number; w: number; h: number },
  viewBox: { x: number; y: number; w: number; h: number },
  padPx: number,
): { x: number; y: number; w: number; h: number } {
  if (rootBox.w === 0 || rootBox.h === 0) return viewBox
  const sx = viewBox.w / rootBox.w
  const sy = viewBox.h / rootBox.h
  return {
    x: viewBox.x + (elBox.x - rootBox.x) * sx - padPx * sx,
    y: viewBox.y + (elBox.y - rootBox.y) * sy - padPx * sy,
    w: elBox.w * sx + padPx * 2 * sx,
    h: elBox.h * sy + padPx * 2 * sy,
  }
}

/**
 * pptxgenjs only accepts `data:` URLs with a `base64,` header, and it writes
 * the payload with `{ base64: true }`. A charset/URI-encoded SVG is therefore
 * stored as garbage and PowerPoint / Google Slides refuse to import the file.
 */
export function svgMarkupToDataUrl(markup: string): string {
  const trimmed = markup
    .replace(/^\uFEFF/, '')
    .replace(/^<\?xml[^?]*\?>\s*/i, '')
    .trim()
  return `data:image/svg+xml;base64,${utf8ToBase64(trimmed)}`
}

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function applyRootOpacity(markup: string, opacity: number): string {
  if (opacity >= 0.999) return markup
  return markup.replace(/<svg\b/i, `<svg opacity="${opacity}"`)
}

/** pptxgenjs's SVG→PNG preview treats a missing width/height as 0×0 and aborts the write. */
export function ensureSvgSize(markup: string, width: number, height: number): string {
  const hasWidth = /<svg\b[^>]*\bwidth=/i.test(markup)
  const hasHeight = /<svg\b[^>]*\bheight=/i.test(markup)
  if (hasWidth && hasHeight) return markup
  const attrs =
    (!hasWidth ? ` width="${Math.max(1, Math.round(width))}"` : '') +
    (!hasHeight ? ` height="${Math.max(1, Math.round(height))}"` : '')
  return markup.replace(/<svg\b/i, `<svg${attrs}`)
}

export function effectiveOpacity(el: Element, stop: Element): number {
  let opacity = 1
  let node: Element | null = el
  while (node && node !== stop) {
    opacity *= Number(getComputedStyle(node).opacity) || 1
    node = node.parentElement
  }
  return opacity
}

export type SvgCache = Map<string, Promise<string>>

export async function serializeSvgLayer(
  el: SVGElement,
  slideEl: HTMLElement,
  cache: SvgCache = new Map(),
): Promise<VectorPicture | null> {
  const root = (isSvgRoot(el) ? el : el.ownerSVGElement) ?? closestSvg(el)
  if (!root) return null

  const elBox = clientBox(el)
  if (elBox.w < 0.5 || elBox.h < 0.5) return null

  const clone = root.cloneNode(true) as SVGSVGElement
  // Copy paint while the trees still match. After a prune the leftover
  // children line up with the wrong source siblings and steal their fill.
  copyComputedPaint(root, clone)
  if (el !== root) {
    const kept = followIndexPath(clone, elementIndexPath(el, root))
    if (!kept) return null
    pruneSvgToSubtree(clone, kept)
  }

  const pad = filterBleed(el)
  const vb = svgViewBox(root)
  const cropped = viewBoxFromRects(clientBox(root), elBox, vb, pad)
  clone.setAttribute('viewBox', `${cropped.x} ${cropped.y} ${cropped.w} ${cropped.h}`)
  clone.setAttribute('width', String(elBox.w + pad * 2))
  clone.setAttribute('height', String(elBox.h + pad * 2))
  clone.removeAttribute('style')
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', SVG_NS)

  await inlineSvgImages(clone, cache)

  const slide = clientBox(slideEl)
  return {
    dataUrl: svgElementToDataUrl(clone),
    x: elBox.x - slide.x - pad,
    y: elBox.y - slide.y - pad,
    w: elBox.w + pad * 2,
    h: elBox.h + pad * 2,
  }
}

export async function serializeSvgImage(
  img: HTMLImageElement,
  slideEl: HTMLElement,
  cache: SvgCache = new Map(),
): Promise<VectorPicture | null> {
  const src = img.currentSrc || img.src
  if (!src) return null
  const box = clientBox(img)
  if (box.w < 0.5 || box.h < 0.5) return null
  const slide = clientBox(slideEl)
  let markup = dataUrlToMarkup(await cached(cache, src, () => fetchSvgMarkup(src)))
  markup = applyRootOpacity(markup, effectiveOpacity(img, slideEl))
  markup = ensureSvgSize(markup, box.w, box.h)
  return {
    dataUrl: svgMarkupToDataUrl(markup),
    x: box.x - slide.x,
    y: box.y - slide.y,
    w: box.w,
    h: box.h,
  }
}

function isSvgRoot(el: Element): el is SVGSVGElement {
  return el.tagName.toLowerCase().replace(/^.*:/, '') === 'svg'
}

function closestSvg(el: Element): SVGSVGElement | null {
  const svg = el.closest('svg')
  return svg as SVGSVGElement | null
}

function clientBox(el: Element): { x: number; y: number; w: number; h: number } {
  const rect = el.getBoundingClientRect()
  return { x: rect.left, y: rect.top, w: rect.width, h: rect.height }
}

function svgViewBox(svg: SVGSVGElement): { x: number; y: number; w: number; h: number } {
  const vb = svg.viewBox?.baseVal
  if (vb && vb.width > 0 && vb.height > 0) return { x: vb.x, y: vb.y, w: vb.width, h: vb.height }
  const w = Number.parseFloat(svg.getAttribute('width') ?? '') || svg.clientWidth || 1
  const h = Number.parseFloat(svg.getAttribute('height') ?? '') || svg.clientHeight || 1
  return { x: 0, y: 0, w, h }
}

function filterBleed(el: Element): number {
  if (el.getAttribute('filter') || el.querySelector('[filter]')) return 24
  return 2
}

function copyComputedPaint(source: Element, clone: Element) {
  if (typeof getComputedStyle !== 'function') return
  const style = getComputedStyle(source)
  for (const prop of SVG_PAINT) {
    // Leave `url(#id)` presentation attributes alone. Computed style flattens
    // a gradient to one colour and a filter to a matrix the clone cannot use.
    const attr = source.getAttribute(prop)
    if (attr?.includes('url(')) continue
    const value = style.getPropertyValue(prop)
    if (!value || value.includes('url(')) continue
    ;(clone as unknown as HTMLElement).style?.setProperty?.(prop, value)
  }
  const srcKids = source.children
  const cloneKids = clone.children
  for (let i = 0; i < srcKids.length && i < cloneKids.length; i++) {
    copyComputedPaint(srcKids[i]!, cloneKids[i]!)
  }
}

function svgElementToDataUrl(svg: SVGElement): string {
  return svgMarkupToDataUrl(new XMLSerializer().serializeToString(svg))
}

async function inlineSvgImages(svg: SVGElement, cache: SvgCache): Promise<void> {
  const images = [...svg.querySelectorAll('image')]
  await Promise.all(
    images.map(async (image) => {
      const href = image.getAttribute('href') || image.getAttribute('xlink:href')
      if (!href || href.startsWith('data:')) return
      try {
        const markup = await cached(cache, href, () => fetchSvgMarkup(href))
        image.setAttribute('href', markup.startsWith('data:') ? markup : svgMarkupToDataUrl(markup))
        image.removeAttribute('xlink:href')
      } catch {
        // Leave the original href; PowerPoint may still resolve a same-origin miss as a hole.
      }
    }),
  )
}

async function fetchSvgMarkup(src: string): Promise<string> {
  if (src.startsWith('data:image/svg+xml')) return src
  const response = await fetch(src)
  if (!response.ok) throw new Error(`Could not load ${src} (${response.status})`)
  return response.text()
}

function dataUrlToMarkup(value: string): string {
  if (!value.startsWith('data:')) return value
  const comma = value.indexOf(',')
  const meta = value.slice(0, comma)
  const body = value.slice(comma + 1)
  if (meta.includes(';base64')) {
    const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  }
  return decodeURIComponent(body)
}

function cached(cache: SvgCache, key: string, load: () => Promise<string>): Promise<string> {
  let pending = cache.get(key)
  if (!pending) {
    pending = load()
    cache.set(key, pending)
  }
  return pending
}
