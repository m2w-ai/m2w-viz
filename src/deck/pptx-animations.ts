import JSZip from 'jszip'
import { SLIDE_HEIGHT, SLIDE_WIDTH, type ExportLayerSpec, type ExportLoop } from './export-layer'

// PowerPoint plays whatever behaviours the timing tree describes; presetID /
// presetClass / presetSubtype are only the label the Animation Pane shows. So
// every primitive below is written as the behaviours that reproduce the CSS.
//
// The label is chosen for the OTHER viewers. Keynote and Google Slides ignore
// the behaviours and rebuild the effect from the preset alone, so a subtle
// 82%→100% pop labelled "Zoom" becomes a zoom from nothing there. Every fading
// entrance is therefore labelled "Fade": PowerPoint still plays the real
// motion, and a preset-only importer degrades to a plain fade rather than to
// something more dramatic than the deck ever did.

export type PptxTransition = 'fade' | 'push'

/**
 * PowerPoint plays the deck's CSS timings noticeably slower than a browser
 * does — its ramps are gentler and every effect carries a little latency — so
 * every delay and duration in the export runs at this fraction of the CSS
 * value. Ambient loops keep their own tempo.
 */
export const PPTX_TEMPO = 0.8

const paced = (ms: number) => Math.round(ms * PPTX_TEMPO)

/** A native video object on the slide, positioned by the exporter. */
export type VideoPlan = {
  /** Index into the slide's layers of the layer the video sits inside, or -1. */
  layerIndex: number
  durationMs?: number
  /** Corner radius as a fraction of the shorter side, 0 for square corners. */
  cornerRatio?: number
}

export type SlidePlan = {
  layers: readonly ExportLayerSpec[]
  videos?: readonly VideoPlan[]
  /** Still SVG pictures sitting between the background and the animated layers. */
  staticCount?: number
}

/** Animated layer picture ids: skip the background and any static SVG overlays. */
export function layerPictureIds(
  pictureIds: readonly number[],
  staticCount: number,
  layerCount: number,
): number[] {
  const start = 1 + staticCount
  return pictureIds.slice(start, start + layerCount)
}

export type PptxEntrance = {
  presetId: number
  presetSubtype: number
  fade: boolean
  /** Start offset as a fraction of slide width / height; the layer travels home from there. */
  move?: { dx: number; dy: number }
  /** Start scale, 1 = full size. */
  scaleFrom?: number
  wipe: boolean
  /** Ease out over the whole duration, like the shared CSS curve. */
  decel: boolean
  delayMs: number
  durationMs: number
}

export type TimedAnimation = {
  spid: number
  entrance: PptxEntrance
  /** 0 plays when the slide appears; n >= 1 is the nth click. */
  step: number
  /** Fades out on this click. */
  exitAtStep?: number
  /** Cuts out this many ms into its own group. */
  exitAfterMs?: number
  /** Bobs forever once it has arrived. */
  loop?: ExportLoop
  /** A video: start playing once the entrance is done. */
  media?: { durationMs?: number }
}

const APPEAR = 1
const FADE = 10
const WIPE = 22
/** PowerPoint's own label for a hand-drawn motion path. */
const CUSTOM_PATH = 0

export function mapLayerToEntrance(spec: ExportLayerSpec): PptxEntrance {
  const base = {
    presetId: FADE,
    presetSubtype: 0,
    fade: true,
    wipe: false,
    decel: true,
    delayMs: spec.delay,
    durationMs: spec.duration,
  }

  switch (spec.kind) {
    case 'frame':
      return { ...base, fade: false, decel: false, presetId: APPEAR }
    case 'rise': {
      const dy = (spec.y ?? 34) / SLIDE_HEIGHT
      return dy === 0 ? base : { ...base, move: { dx: 0, dy } }
    }
    case 'pop':
      return { ...base, scaleFrom: spec.from ?? 0.82 }
    case 'slide-in': {
      const dx = (spec.x ?? 60) / SLIDE_WIDTH
      return dx === 0 ? base : { ...base, move: { dx, dy: 0 } }
    }
    case 'wipe':
    case 'grow-bar':
      return { ...base, fade: false, wipe: true, presetId: WIPE, presetSubtype: 8 }
    case 'count-up':
      return base
    case 'appear':
      return { ...base, decel: false }
  }
}

/**
 * Which click each layer belongs to. Auto layers are step 0. Click layers
 * take their explicit step, or the next free one in document order.
 */
export function assignSteps(specs: readonly ExportLayerSpec[]): number[] {
  let cursor = 0
  return specs.map((spec) => {
    if (spec.trigger !== 'click') return 0
    const step = spec.step ?? cursor + 1
    cursor = Math.max(cursor, step)
    return step
  })
}

export function toTimedAnimations(
  specs: readonly ExportLayerSpec[],
  spids: readonly number[],
): TimedAnimation[] {
  return planAnimations({ layers: specs }, spids, [])
}

/**
 * Every animation on a slide: one per layer picture, plus one per video.
 * Videos with no click wrapper autoplay with the slide — no fade. A Fade on a
 * PowerPoint media object is the poster image fading in, which is what you
 * see when a viewer cannot play the file. A video whose `layerIndex` points
 * at a click layer fades in and plays on that click.
 */
export function planAnimations(
  plan: SlidePlan,
  layerSpids: readonly number[],
  mediaSpids: readonly number[],
): TimedAnimation[] {
  const steps = assignSteps(plan.layers)
  const out: TimedAnimation[] = []

  plan.layers.forEach((spec, i) => {
    const spid = layerSpids[i]
    if (spid === undefined) return
    const entrance = mapLayerToEntrance(spec)
    out.push({
      spid,
      entrance: { ...entrance, delayMs: paced(entrance.delayMs), durationMs: paced(entrance.durationMs) },
      step: steps[i]!,
      exitAtStep: spec.exitOnNextClick ? steps[i]! + 1 : undefined,
      exitAfterMs: spec.exitAfterMs === undefined ? undefined : paced(spec.exitAfterMs),
      loop: spec.loop,
    })
  })

  plan.videos?.forEach((video, i) => {
    const spid = mediaSpids[i]
    if (spid === undefined) return
    const wrapper = video.layerIndex >= 0 ? plan.layers[video.layerIndex] : undefined
    if (wrapper) {
      const entrance = mapLayerToEntrance({ ...wrapper, kind: 'appear' })
      out.push({
        spid,
        entrance: { ...entrance, delayMs: paced(entrance.delayMs), durationMs: paced(entrance.durationMs) },
        step: steps[video.layerIndex]!,
        media: { durationMs: video.durationMs },
      })
      return
    }
    out.push({
      spid,
      entrance: {
        presetId: APPEAR,
        presetSubtype: 0,
        fade: false,
        wipe: false,
        decel: false,
        delayMs: 0,
        durationMs: 0,
      },
      step: 0,
      media: { durationMs: video.durationMs },
    })
  })

  return out
}

const PIC_BLOCK = /<p:pic\b[\s\S]*?<\/p:pic>/g
const MEDIA_MARK = '<a:videoFile'

function pictureId(block: string): number | undefined {
  const match = block.match(/<p:cNvPr\b[^>]*\sid="(\d+)"/)
  return match ? Number(match[1]) : undefined
}

/** Ids of the still pictures on a slide, in document order. Media pictures are skipped. */
export function listPictureIds(slideXml: string): number[] {
  const ids: number[] = []
  for (const block of slideXml.matchAll(PIC_BLOCK)) {
    if (block[0].includes(MEDIA_MARK)) continue
    const id = pictureId(block[0])
    if (id !== undefined) ids.push(id)
  }
  return ids
}

/** Ids of the video objects on a slide, in document order. */
export function listMediaIds(slideXml: string): number[] {
  const ids: number[] = []
  for (const block of slideXml.matchAll(PIC_BLOCK)) {
    if (!block[0].includes(MEDIA_MARK)) continue
    const id = pictureId(block[0])
    if (id !== undefined) ids.push(id)
  }
  return ids
}

/**
 * Round the corners of the video objects to match the CSS clip around them.
 * pptxgenjs writes every media picture as a plain rectangle.
 */
export function roundMediaCorners(slideXml: string, ratios: readonly (number | undefined)[]): string {
  let index = 0
  return slideXml.replace(PIC_BLOCK, (block) => {
    if (!block.includes(MEDIA_MARK)) return block
    const ratio = ratios[index++]
    if (!ratio || ratio <= 0) return block
    const adj = Math.round(Math.min(ratio, 0.5) * 100000)
    return block.replace(
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
      `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${adj}"/></a:avLst></a:prstGeom>`,
    )
  })
}

export function buildTransitionXml(kind: PptxTransition): string {
  const inner = kind === 'push' ? '<p:push dir="l"/>' : '<p:fade/>'
  return `<p:transition spd="fast">${inner}</p:transition>`
}

/**
 * Transition and timing live between clrMapOvr and the end of the slide, in
 * that order. Any earlier copies are replaced.
 */
export function injectSlideExtras(slideXml: string, transitionXml: string, timingXml: string): string {
  const stripped = slideXml
    .replace(/<p:transition\b[^>]*\/>/, '')
    .replace(/<p:transition\b[\s\S]*?<\/p:transition>/, '')
    .replace(/<p:timing>[\s\S]*?<\/p:timing>/, '')
  const extras = transitionXml + timingXml
  if (stripped.includes('</p:clrMapOvr>')) {
    return stripped.replace('</p:clrMapOvr>', `</p:clrMapOvr>${extras}`)
  }
  if (stripped.includes('</p:cSld>')) {
    return stripped.replace('</p:cSld>', `</p:cSld>${extras}`)
  }
  if (!stripped.includes('</p:sld>')) throw new Error('Slide XML is missing </p:sld>')
  return stripped.replace('</p:sld>', `${extras}</p:sld>`)
}

export function buildTimingXml(anims: readonly TimedAnimation[]): string {
  if (anims.length === 0) return ''

  const steps = new Set<number>()
  for (const anim of anims) {
    steps.add(anim.step)
    if (anim.exitAtStep !== undefined) steps.add(anim.exitAtStep)
  }

  let nextId = 1
  const id = () => nextId++
  const rootId = id()
  const seqId = id()

  const groups = [...steps]
    .sort((a, b) => a - b)
    .map((step) => buildStepGroup(step, anims, seqId, id))
    .join('')

  // Each video also needs a media node beside the main sequence; the
  // playFrom command inside the sequence is what actually starts it.
  const mediaNodes = anims
    .filter((a) => a.media)
    .map((a) => mediaNodeXml(a.spid, id))
    .join('')

  return (
    `<p:timing>` +
    `<p:tnLst>` +
    `<p:par>` +
    `<p:cTn id="${rootId}" dur="indefinite" restart="never" nodeType="tmRoot">` +
    `<p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek">` +
    `<p:cTn id="${seqId}" dur="indefinite" nodeType="mainSeq">` +
    `<p:childTnLst>${groups}</p:childTnLst>` +
    `</p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
    `</p:seq>` +
    mediaNodes +
    `</p:childTnLst>` +
    `</p:cTn>` +
    `</p:par>` +
    `</p:tnLst>` +
    `</p:timing>`
  )
}

/**
 * The media node PowerPoint keeps for every video it plays, written the way
 * PowerPoint writes one whose Playback start is "Automatically": it waits for
 * the play command below, loops like the deck's <video loop>, and stops when
 * the presenter moves on.
 */
function mediaNodeXml(spid: number, id: () => number): string {
  return (
    `<p:video>` +
    `<p:cMediaNode vol="0" mute="1">` +
    `<p:cTn id="${id()}" repeatCount="indefinite" fill="hold" display="0">` +
    `<p:stCondLst><p:cond delay="indefinite"/></p:stCondLst>` +
    `<p:endCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:endCondLst>` +
    `</p:cTn>` +
    target(spid) +
    `</p:cMediaNode>` +
    `</p:video>`
  )
}

/**
 * "Play from the start" as soon as the slide begins. Muted autoplay is the
 * setting PowerPoint actually honours; a click-gated play leaves a poster.
 */
function mediaPlayXml(anim: TimedAnimation, nodeType: string, id: () => number): string {
  const ctnId = id()
  const { entrance } = anim
  const dur = anim.media?.durationMs !== undefined ? ` dur="${anim.media.durationMs}"` : ''
  const playNodeType = nodeType === 'clickEffect' ? nodeType : 'afterEffect'
  return (
    `<p:par>` +
    `<p:cTn id="${ctnId}" presetID="${APPEAR}" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="${playNodeType}">` +
    `<p:stCondLst><p:cond delay="${entrance.delayMs + entrance.durationMs}"/></p:stCondLst>` +
    `<p:childTnLst>` +
    `<p:cmd type="call" cmd="playFrom(0.0)">` +
    `<p:cBhvr><p:cTn id="${id()}"${dur} fill="hold"/>${target(anim.spid)}</p:cBhvr>` +
    `</p:cmd>` +
    `</p:childTnLst>` +
    `</p:cTn>` +
    `</p:par>`
  )
}

/**
 * One click group. Step 0 carries PowerPoint's "start with the slide" idiom:
 * an indefinite start plus an onBegin condition bound to the main sequence.
 * Later steps wait for a click. The first effect in a click group is the
 * clickEffect; everything else in the group runs with it.
 *
 * PowerPoint always makes the earliest-starting effect the click effect, so a
 * group's entrances are ordered by delay (document order breaking ties): the
 * click effect fires at the click, and every delayed effect follows it as
 * "with previous", which is the only arrangement PowerPoint itself writes.
 */
function buildStepGroup(
  step: number,
  anims: readonly TimedAnimation[],
  seqId: number,
  id: () => number,
): string {
  const groupId = id()
  const innerId = id()
  const start =
    step === 0
      ? `<p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="${seqId}"/></p:cond>`
      : `<p:cond delay="indefinite"/>`

  let first = step !== 0
  const nodeType = () => {
    const type = first ? 'clickEffect' : 'withEffect'
    first = false
    return type
  }

  const own = anims
    .filter((a) => a.step === step)
    .sort((a, b) => a.entrance.delayMs - b.entrance.delayMs)
  const effects = [
    ...own.filter(hasVisualEntrance).map((a) => entranceXml(a, nodeType(), id)),
    ...anims.filter((a) => a.exitAtStep === step).map((a) => exitXml(a, nodeType(), id)),
    ...own.filter((a) => a.exitAfterMs !== undefined).map((a) => cutOutXml(a, nodeType(), id)),
    ...own.filter((a) => a.loop).map((a) => loopXml(a, nodeType(), id)),
    ...own.filter((a) => a.media).map((a) => mediaPlayXml(a, nodeType(), id)),
  ].join('')

  return (
    `<p:par>` +
    `<p:cTn id="${groupId}" fill="hold">` +
    `<p:stCondLst>${start}</p:stCondLst>` +
    `<p:childTnLst>` +
    `<p:par>` +
    `<p:cTn id="${innerId}" fill="hold">` +
    `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
    `<p:childTnLst>${effects}</p:childTnLst>` +
    `</p:cTn>` +
    `</p:par>` +
    `</p:childTnLst>` +
    `</p:cTn>` +
    `</p:par>`
  )
}

function hasVisualEntrance(anim: TimedAnimation): boolean {
  const { entrance } = anim
  return (
    entrance.fade ||
    entrance.wipe ||
    entrance.move !== undefined ||
    entrance.scaleFrom !== undefined ||
    entrance.durationMs > 0
  )
}

function entranceXml(anim: TimedAnimation, nodeType: string, id: () => number): string {
  const { entrance, spid } = anim
  const ctnId = id()
  const behaviours = [
    setVisibility(spid, 'visible', 0, id),
    entrance.fade ? animEffect(spid, 'in', 'fade', entrance.durationMs, id) : '',
    entrance.wipe ? animEffect(spid, 'in', 'wipe(left)', entrance.durationMs, id) : '',
    entrance.move ? moveXml(spid, entrance.durationMs, entrance.move, id) : '',
    entrance.scaleFrom !== undefined ? scaleXml(spid, entrance.durationMs, entrance.scaleFrom, id) : '',
  ].join('')

  const decel = entrance.decel ? ' decel="100000"' : ''

  return (
    `<p:par>` +
    `<p:cTn id="${ctnId}" presetID="${entrance.presetId}" presetClass="entr" presetSubtype="${entrance.presetSubtype}"${decel} fill="hold" nodeType="${nodeType}">` +
    `<p:stCondLst><p:cond delay="${entrance.delayMs}"/></p:stCondLst>` +
    `<p:childTnLst>${behaviours}</p:childTnLst>` +
    `</p:cTn>` +
    `</p:par>`
  )
}

/** Fade out, then hide — PowerPoint's own Fade exit, so the swap reads as one. */
function exitXml(anim: TimedAnimation, nodeType: string, id: () => number): string {
  const { spid } = anim
  const duration = anim.entrance.durationMs
  const ctnId = id()
  const behaviours =
    animEffect(spid, 'out', 'fade', duration, id) +
    setVisibility(spid, 'hidden', Math.max(0, duration - 1), id)

  return (
    `<p:par>` +
    `<p:cTn id="${ctnId}" presetID="${FADE}" presetClass="exit" presetSubtype="0" fill="hold" nodeType="${nodeType}">` +
    `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
    `<p:childTnLst>${behaviours}</p:childTnLst>` +
    `</p:cTn>` +
    `</p:par>`
  )
}

/** Hide at a moment — PowerPoint's Disappear — for the flipbook's used-up frames. */
function cutOutXml(anim: TimedAnimation, nodeType: string, id: () => number): string {
  const ctnId = id()
  return (
    `<p:par>` +
    `<p:cTn id="${ctnId}" presetID="${APPEAR}" presetClass="exit" presetSubtype="0" fill="hold" nodeType="${nodeType}">` +
    `<p:stCondLst><p:cond delay="${anim.exitAfterMs}"/></p:stCondLst>` +
    `<p:childTnLst>${setVisibility(anim.spid, 'hidden', 0, id)}</p:childTnLst>` +
    `</p:cTn>` +
    `</p:par>`
  )
}

/**
 * An endless bob: a two-point motion path, auto-reversed, repeated until the
 * slide ends, eased at both ends. Starts once the entrance has finished.
 */
function loopXml(anim: TimedAnimation, nodeType: string, id: () => number): string {
  const { spid, entrance } = anim
  const loop = anim.loop!
  const ctnId = id()
  const half = Math.max(1, Math.round(loop.periodMs / 2))
  const path = `M 0 0 L 0 ${formatPathNumber(loop.dy / SLIDE_HEIGHT)} `
  return (
    `<p:par>` +
    `<p:cTn id="${ctnId}" presetID="${CUSTOM_PATH}" presetClass="path" presetSubtype="0" repeatCount="indefinite" autoRev="1" accel="50000" decel="50000" fill="hold" nodeType="${nodeType}">` +
    `<p:stCondLst><p:cond delay="${entrance.delayMs + entrance.durationMs}"/></p:stCondLst>` +
    `<p:childTnLst>` +
    `<p:animMotion origin="layout" path="${path}" pathEditMode="relative" ptsTypes="AA">` +
    `<p:cBhvr>` +
    `<p:cTn id="${id()}" dur="${half}" fill="hold"/>` +
    target(spid) +
    `<p:attrNameLst><p:attrName>ppt_x</p:attrName><p:attrName>ppt_y</p:attrName></p:attrNameLst>` +
    `</p:cBhvr>` +
    `</p:animMotion>` +
    `</p:childTnLst>` +
    `</p:cTn>` +
    `</p:par>`
  )
}

/** Path coordinates are slide fractions; `-0.013`, not `-.013`, in PowerPoint's own files. */
export function formatPathNumber(fraction: number): string {
  return fraction.toFixed(5).replace(/0+$/, '').replace(/\.$/, '.0')
}

function target(spid: number): string {
  return `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>`
}

function setVisibility(spid: number, value: 'visible' | 'hidden', delayMs: number, id: () => number) {
  return (
    `<p:set>` +
    `<p:cBhvr>` +
    `<p:cTn id="${id()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="${delayMs}"/></p:stCondLst></p:cTn>` +
    target(spid) +
    `<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>` +
    `</p:cBhvr>` +
    `<p:to><p:strVal val="${value}"/></p:to>` +
    `</p:set>`
  )
}

function animEffect(
  spid: number,
  transition: 'in' | 'out',
  filter: string,
  durationMs: number,
  id: () => number,
) {
  return (
    `<p:animEffect transition="${transition}" filter="${filter}">` +
    `<p:cBhvr><p:cTn id="${id()}" dur="${durationMs}"/>${target(spid)}</p:cBhvr>` +
    `</p:animEffect>`
  )
}

/** `+.0315` — PowerPoint's own formulas drop the leading zero. */
export function formatOffset(fraction: number): string {
  const sign = fraction < 0 ? '-' : '+'
  const digits = Math.abs(fraction).toFixed(4).replace(/^0\./, '.').replace(/0+$/, '')
  // toFixed(4) of a sub-0.00005 offset collapses to `.` after trim — `#ppt_x+.` is not a formula.
  if (digits === '' || digits === '.') return `${sign}0`
  return `${sign}${digits}`
}

function moveXml(
  spid: number,
  durationMs: number,
  move: { dx: number; dy: number },
  id: () => number,
): string {
  const fromX = move.dx === 0 ? '#ppt_x' : `#ppt_x${formatOffset(move.dx)}`
  const fromY = move.dy === 0 ? '#ppt_y' : `#ppt_y${formatOffset(move.dy)}`
  return (
    numAnim(spid, durationMs, 'ppt_x', fromX, '#ppt_x', id) +
    numAnim(spid, durationMs, 'ppt_y', fromY, '#ppt_y', id)
  )
}

function numAnim(
  spid: number,
  durationMs: number,
  attr: string,
  from: string,
  to: string,
  id: () => number,
): string {
  return (
    `<p:anim calcmode="lin" valueType="num">` +
    `<p:cBhvr additive="base">` +
    `<p:cTn id="${id()}" dur="${durationMs}" fill="hold"/>` +
    target(spid) +
    `<p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst>` +
    `</p:cBhvr>` +
    `<p:tavLst>` +
    `<p:tav tm="0"><p:val><p:strVal val="${from}"/></p:val></p:tav>` +
    `<p:tav tm="100000"><p:val><p:strVal val="${to}"/></p:val></p:tav>` +
    `</p:tavLst>` +
    `</p:anim>`
  )
}

/** Scale about the centre, in thousandths of a percent — the Grow/Shrink behaviour. */
function scaleXml(spid: number, durationMs: number, from: number, id: () => number): string {
  const start = Math.round(from * 100000)
  return (
    `<p:animScale>` +
    `<p:cBhvr><p:cTn id="${id()}" dur="${durationMs}" fill="hold"/>${target(spid)}</p:cBhvr>` +
    `<p:from x="${start}" y="${start}"/>` +
    `<p:to x="100000" y="100000"/>` +
    `</p:animScale>`
  )
}

/**
 * Rewrite every slide inside the finished .pptx: add the deck's transition,
 * and for slides with layers, a timing tree targeting the layer pictures. The
 * first picture on each slide is the background and is never animated.
 */
export async function applyAnimationsToPptx(
  buffer: ArrayBuffer,
  slides: readonly (SlidePlan | readonly ExportLayerSpec[])[],
  transition: PptxTransition,
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer)
  const transitionXml = buildTransitionXml(transition)

  for (let i = 0; i < slides.length; i++) {
    const path = `ppt/slides/slide${i + 1}.xml`
    const xml = await zip.file(path)?.async('string')
    if (!xml) throw new Error(`Missing ${path}`)

    const entry = slides[i]
    const plan: SlidePlan = Array.isArray(entry) ? { layers: entry } : (entry as SlidePlan)
    const ids = listPictureIds(xml)
    const layerIds = layerPictureIds(ids, plan.staticCount ?? 0, plan.layers.length)
    const mediaIds = listMediaIds(xml)
    const anims = planAnimations(plan, layerIds, mediaIds)
    const rounded = roundMediaCorners(xml, (plan.videos ?? []).map((v) => v.cornerRatio))
    zip.file(path, sanitizeSlideXml(injectSlideExtras(rounded, transitionXml, buildTimingXml(anims))))
  }

  await stripSvgFromPackage(zip)
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}

/**
 * pptxgenjs writes two importer-breaking constructs we can strip without
 * changing how the slide looks: an `asvg:svgBlip` (even next to a PNG preview)
 * and an empty `r:id=""` on every video's media hyperlink.
 */
export function sanitizeSlideXml(xml: string): string {
  return xml
    .replace(
      /<a:extLst>\s*<a:ext uri="\{96DAC541-7B7A-43D3-8B79-37D633B846F1\}">[\s\S]*?<\/a:ext>\s*<\/a:extLst>/g,
      '',
    )
    .replace(/<a:hlinkClick r:id="" action="ppaction:\/\/media"\/>/g, '<a:hlinkClick action="ppaction://media"/>')
}

async function stripSvgFromPackage(zip: JSZip): Promise<void> {
  const svgFiles = Object.keys(zip.files).filter((name) => name.endsWith('.svg'))
  for (const name of svgFiles) zip.remove(name)

  const relPaths = Object.keys(zip.files).filter((name) => name.endsWith('.xml.rels'))
  await Promise.all(
    relPaths.map(async (path) => {
      const xml = await zip.file(path)?.async('string')
      if (!xml || !xml.includes('.svg')) return
      zip.file(path, xml.replace(/<Relationship\b[^>]*Target="[^"]*\.svg"[^>]*\/>/g, ''))
    }),
  )

  const typesPath = '[Content_Types].xml'
  const types = await zip.file(typesPath)?.async('string')
  if (types?.includes('Extension="svg"')) {
    zip.file(typesPath, types.replace(/<Default Extension="svg"[^>]*\/>/g, ''))
  }
}
