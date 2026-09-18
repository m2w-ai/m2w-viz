import { describe, expect, test } from 'bun:test'
import JSZip from 'jszip'
import {
  applyAnimationsToPptx,
  assignSteps,
  buildTimingXml,
  buildTransitionXml,
  formatOffset,
  formatPathNumber,
  injectSlideExtras,
  layerPictureIds,
  listMediaIds,
  listPictureIds,
  sanitizeSlideXml,
  mapLayerToEntrance,
  planAnimations,
  PPTX_TEMPO,
  roundMediaCorners,
  toTimedAnimations,
  type TimedAnimation,
} from '../pptx-animations'
import type { ExportLayerSpec } from '../export-layer'

function spec(partial: Partial<ExportLayerSpec> & Pick<ExportLayerSpec, 'kind'>): ExportLayerSpec {
  return { delay: 0, duration: 700, trigger: 'auto', ...partial }
}

function timed(
  partial: Partial<ExportLayerSpec> & Pick<ExportLayerSpec, 'kind'>,
  spid: number,
  step = 0,
  exitAtStep?: number,
): TimedAnimation {
  return { spid, entrance: mapLayerToEntrance(spec(partial)), step, exitAtStep }
}

describe('mapLayerToEntrance', () => {
  test('Rise floats up by its own offset with a fade, not a fly-in from off screen', () => {
    const entrance = mapLayerToEntrance(spec({ kind: 'rise', y: 34, delay: 200, duration: 800 }))
    expect(entrance.fade).toBe(true)
    expect(entrance.move).toEqual({ dx: 0, dy: 34 / 1080 })
    expect(entrance.decel).toBe(true)
    expect(entrance.delayMs).toBe(200)
    expect(entrance.durationMs).toBe(800)
  })

  test('Rise with y=0 is a plain fade', () => {
    const entrance = mapLayerToEntrance(spec({ kind: 'rise', y: 0 }))
    expect(entrance.presetId).toBe(10)
    expect(entrance.move).toBeUndefined()
  })

  test('Pop zooms from its own starting scale', () => {
    const entrance = mapLayerToEntrance(spec({ kind: 'pop', from: 0.9 }))
    expect(entrance.scaleFrom).toBe(0.9)
    expect(entrance.fade).toBe(true)
  })

  test('every fading entrance is labelled Fade so preset-only viewers degrade gently', () => {
    for (const kind of ['rise', 'pop', 'slide-in', 'count-up', 'appear'] as const) {
      expect(mapLayerToEntrance(spec({ kind })).presetId).toBe(10)
    }
  })

  test('SlideIn travels only its offset, in its own direction', () => {
    const left = mapLayerToEntrance(spec({ kind: 'slide-in', x: -60 }))
    const right = mapLayerToEntrance(spec({ kind: 'slide-in', x: 60 }))
    expect(left.move).toEqual({ dx: -60 / 1920, dy: 0 })
    expect(right.move).toEqual({ dx: 60 / 1920, dy: 0 })
  })

  test('Wipe and GrowBar wipe from the left without a fade', () => {
    for (const kind of ['wipe', 'grow-bar'] as const) {
      const entrance = mapLayerToEntrance(spec({ kind }))
      expect(entrance.wipe).toBe(true)
      expect(entrance.fade).toBe(false)
      expect(entrance.presetId).toBe(22)
    }
  })

  test('CountUp eases in; Appear is a linear fade', () => {
    expect(mapLayerToEntrance(spec({ kind: 'count-up' })).decel).toBe(true)
    const appear = mapLayerToEntrance(spec({ kind: 'appear', trigger: 'click' }))
    expect(appear.presetId).toBe(10)
    expect(appear.decel).toBe(false)
  })

  test('a flipbook frame is a hard cut: no fade, no motion', () => {
    const frame = mapLayerToEntrance(spec({ kind: 'frame', duration: 1 }))
    expect(frame.presetId).toBe(1)
    expect(frame.fade).toBe(false)
    expect(frame.wipe).toBe(false)
    expect(frame.move).toBeUndefined()
    expect(frame.scaleFrom).toBeUndefined()
  })
})

describe('assignSteps', () => {
  test('auto layers are step 0 and plain click reveals count up in order', () => {
    expect(
      assignSteps([
        spec({ kind: 'rise' }),
        spec({ kind: 'appear', trigger: 'click' }),
        spec({ kind: 'pop' }),
        spec({ kind: 'appear', trigger: 'click' }),
      ]),
    ).toEqual([0, 1, 0, 2])
  })

  test('explicit steps group layers onto one click and set the cursor', () => {
    expect(
      assignSteps([
        spec({ kind: 'appear', trigger: 'click', step: 2 }),
        spec({ kind: 'wipe', trigger: 'click', step: 1 }),
        spec({ kind: 'appear', trigger: 'click', step: 1 }),
        spec({ kind: 'appear', trigger: 'click' }),
      ]),
    ).toEqual([2, 1, 1, 3])
  })
})

describe('toTimedAnimations', () => {
  test('runs every delay and duration at the PPTX tempo', () => {
    expect(PPTX_TEMPO).toBe(0.8)
    const [anim] = toTimedAnimations([spec({ kind: 'rise', delay: 200, duration: 800 })], [3])
    expect(anim!.entrance.delayMs).toBe(160)
    expect(anim!.entrance.durationMs).toBe(640)
  })

  test('pairs specs with picture ids and schedules exits on the next click', () => {
    const anims = toTimedAnimations(
      [
        spec({ kind: 'rise' }),
        spec({ kind: 'appear', trigger: 'click', step: 1, exitOnNextClick: true }),
        spec({ kind: 'appear', trigger: 'click', step: 2 }),
      ],
      [3, 4, 5],
    )
    expect(anims.map((a) => [a.spid, a.step, a.exitAtStep])).toEqual([
      [3, 0, undefined],
      [4, 1, 2],
      [5, 2, undefined],
    ])
  })

  test('drops layers that have no picture', () => {
    expect(toTimedAnimations([spec({ kind: 'rise' }), spec({ kind: 'pop' })], [3])).toHaveLength(1)
  })

  test('carries timed exits (at tempo) and loops (as they are) through', () => {
    const [frame, bubble] = toTimedAnimations(
      [
        spec({ kind: 'frame', delay: 550, duration: 1, exitAfterMs: 637 }),
        spec({ kind: 'appear', trigger: 'click', loop: { dy: -14, periodMs: 4500 } }),
      ],
      [3, 4],
    )
    expect(frame!.entrance.delayMs).toBe(440)
    expect(frame!.exitAfterMs).toBe(510)
    expect(bubble!.loop).toEqual({ dy: -14, periodMs: 4500 })
  })
})

describe('formatOffset', () => {
  test('writes PowerPoint-style fractions', () => {
    expect(formatOffset(34 / 1080)).toBe('+.0315')
    expect(formatOffset(-60 / 1920)).toBe('-.0313')
    expect(formatOffset(0.1)).toBe('+.1')
    expect(formatOffset(0.00001)).toBe('+0')
  })
})

describe('buildTimingXml', () => {
  const rise = timed({ kind: 'rise', y: 34, delay: 200, duration: 800 }, 3)
  const pop = timed({ kind: 'pop', from: 0.82, delay: 500, duration: 600 }, 4)
  const click1 = timed({ kind: 'appear', trigger: 'click', duration: 500 }, 5, 1)
  const click2 = timed({ kind: 'appear', trigger: 'click', duration: 500 }, 6, 2)

  test('returns empty string when there is nothing to animate', () => {
    expect(buildTimingXml([])).toBe('')
  })

  test('auto layers start with the slide via the onBegin idiom, with their own delays', () => {
    const xml = buildTimingXml([rise, pop])
    expect(xml).toContain('nodeType="mainSeq"')
    expect(xml).toContain('<p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>')
    expect(xml).toContain('<p:stCondLst><p:cond delay="200"/></p:stCondLst>')
    expect(xml).toContain('<p:stCondLst><p:cond delay="500"/></p:stCondLst>')
    expect(xml.includes('clickEffect')).toBe(false)
  })

  test('delay never appears as a cTn attribute', () => {
    const xml = buildTimingXml([rise, click1])
    expect(/<p:cTn\b[^>]*\sdelay=/.test(xml)).toBe(false)
  })

  test('click groups wait for a click; the first effect is the clickEffect', () => {
    const xml = buildTimingXml([rise, click1, click2])
    const groups = xml.split('<p:stCondLst><p:cond delay="indefinite"/></p:stCondLst>')
    expect(groups).toHaveLength(3)
    expect(xml.match(/nodeType="clickEffect"/g)).toHaveLength(2)
    expect(xml.indexOf('spid="3"')).toBeLessThan(xml.indexOf('spid="5"'))
    expect(xml.indexOf('spid="5"')).toBeLessThan(xml.indexOf('spid="6"'))
  })

  test('several layers on one click share a group; only the first is the clickEffect', () => {
    const xml = buildTimingXml([click1, { ...click2, step: 1 }])
    expect(xml.match(/nodeType="clickEffect"/g)).toHaveLength(1)
    expect(xml.match(/nodeType="withEffect"/g)).toHaveLength(1)
    expect(xml.match(/<p:cond delay="indefinite"\/>/g)).toHaveLength(1)
  })

  test('the earliest-starting effect in a click group is the click effect', () => {
    const delayed = timed({ kind: 'appear', trigger: 'click', delay: 200, duration: 900 }, 4, 2)
    const immediate = timed({ kind: 'wipe', trigger: 'click', delay: 0, duration: 1100 }, 5, 2)
    const later = timed({ kind: 'appear', trigger: 'click', delay: 500, duration: 400 }, 8, 2)
    const xml = buildTimingXml([delayed, immediate, later])
    const clickEffect = xml.match(/<p:cTn id="\d+"[^>]*nodeType="clickEffect">[\s\S]*?<\/p:par>/)![0]
    expect(clickEffect).toContain('spid="5"')
    expect(clickEffect).toContain('<p:cond delay="0"/>')
    expect(xml.indexOf('spid="5"')).toBeLessThan(xml.indexOf('spid="4"'))
    expect(xml.indexOf('spid="4"')).toBeLessThan(xml.indexOf('spid="8"'))
    expect(xml.match(/nodeType="withEffect"/g)).toHaveLength(2)
  })

  test('a swap exits the old layer on the click that brings the new one', () => {
    const xml = buildTimingXml([{ ...click1, exitAtStep: 2 }, click2])
    const secondGroup = xml.slice(xml.lastIndexOf('<p:cond delay="indefinite"/>'))
    expect(secondGroup).toContain('presetClass="entr"')
    expect(secondGroup).toContain('presetClass="exit"')
    expect(secondGroup).toContain('transition="out" filter="fade"')
    expect(secondGroup).toContain('<p:strVal val="hidden"/>')
    expect(secondGroup).toContain('spid="5"')
    expect(secondGroup.indexOf('spid="6"')).toBeLessThan(secondGroup.indexOf('presetClass="exit"'))
  })

  test('Rise writes a small vertical float plus fade, eased out', () => {
    const xml = buildTimingXml([rise])
    expect(xml).toContain('decel="100000"')
    expect(xml).toContain('filter="fade"')
    expect(xml).toContain('<p:strVal val="#ppt_y+.0315"/>')
    expect(xml).toContain('<p:strVal val="#ppt_y"/>')
    expect(xml.includes('1+#ppt_h/2')).toBe(false)
  })

  test('Pop scales about centre from its start scale', () => {
    const xml = buildTimingXml([pop])
    expect(xml).toContain('<p:animScale>')
    expect(xml).toContain('<p:from x="82000" y="82000"/>')
    expect(xml).toContain('<p:to x="100000" y="100000"/>')
    expect(xml).toContain('dur="600"')
  })

  test('Wipe uses the wipe filter and no fade', () => {
    const xml = buildTimingXml([timed({ kind: 'wipe', duration: 900 }, 7)])
    expect(xml).toContain('filter="wipe(left)"')
    expect(xml.includes('filter="fade"')).toBe(false)
  })

  test('flipbook frames cut in on their tick and cut out on the next', () => {
    const frames = [0, 1, 2].map((k) =>
      timed({ kind: 'frame', delay: 550 + k * 87, duration: 1, exitAfterMs: k < 2 ? 550 + (k + 1) * 87 : undefined }, 10 + k),
    )
    frames.forEach((f, k) => {
      f.exitAfterMs = k < 2 ? 550 + (k + 1) * 87 : undefined
    })
    const xml = buildTimingXml(frames)
    expect(xml.match(/presetID="1" presetClass="entr"/g)).toHaveLength(3)
    expect(xml.match(/presetID="1" presetClass="exit"/g)).toHaveLength(2)
    expect(xml).toContain('<p:cond delay="550"/>')
    expect(xml).toContain('<p:cond delay="637"/>')
    expect(xml).toContain('<p:cond delay="724"/>')
    const lastExit = xml.lastIndexOf('presetClass="exit"')
    expect(xml.slice(lastExit)).toContain('spid="11"')
    expect(xml.slice(lastExit).includes('spid="12"')).toBe(false)
    expect(xml.includes('filter="fade"')).toBe(false)
  })

  test('a loop bobs forever along a two-point path once the entrance is done', () => {
    const bubble: TimedAnimation = {
      ...timed({ kind: 'appear', trigger: 'click', duration: 500 }, 8, 1),
      loop: { dy: -14, periodMs: 4500 },
    }
    const xml = buildTimingXml([bubble])
    expect(xml).toContain('presetClass="path"')
    expect(xml).toContain('repeatCount="indefinite"')
    expect(xml).toContain('autoRev="1"')
    expect(xml).toContain('<p:animMotion origin="layout" path="M 0 0 L 0 -0.01296 " pathEditMode="relative" ptsTypes="AA">')
    expect(xml).toContain('dur="2250"')
    const loopStart = xml.indexOf('presetClass="path"')
    expect(xml.slice(loopStart)).toContain('<p:cond delay="500"/>')
    expect(xml.match(/nodeType="clickEffect"/g)).toHaveLength(1)
  })

  test('a video fades in, then plays, and gets a media node beside the sequence', () => {
    const video: TimedAnimation = {
      spid: 9,
      entrance: { ...mapLayerToEntrance(spec({ kind: 'appear', delay: 300, duration: 800 })) },
      step: 0,
      media: { durationMs: 12000 },
    }
    const xml = buildTimingXml([video])
    expect(xml).toContain('presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect"')
    expect(xml).toContain('<p:cmd type="call" cmd="playFrom(0.0)">')
    expect(xml).toContain('<p:cond delay="1100"/>')
    expect(xml).toContain('dur="12000"')
    expect(xml).toContain('</p:seq><p:video><p:cMediaNode vol="0" mute="1">')
    expect(xml).toContain('repeatCount="indefinite"')
    expect(xml).toContain('<p:endCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:endCondLst>')
    expect(xml.match(/spid="9"/g)!.length).toBeGreaterThanOrEqual(4)
  })

  test('a video that is the only thing on its click still plays in click sequence', () => {
    const video: TimedAnimation = {
      spid: 9,
      entrance: mapLayerToEntrance(spec({ kind: 'appear', trigger: 'click', duration: 500 })),
      step: 1,
      media: {},
    }
    const xml = buildTimingXml([video])
    // The fade is the click effect; the play command follows it automatically.
    expect(xml.match(/nodeType="clickEffect"/g)).toHaveLength(1)
    expect(xml).toContain('presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect"')
  })

  test('every timing node id is unique', () => {
    const xml = buildTimingXml([rise, pop, { ...click1, exitAtStep: 2 }, click2])
    const ids = [...xml.matchAll(/<p:cTn id="(\d+)"/g)].map((m) => m[1])
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('layerPictureIds', () => {
  test('skips the background and any static SVG overlays', () => {
    expect(layerPictureIds([2, 3, 4, 5, 6], 0, 4)).toEqual([3, 4, 5, 6])
    expect(layerPictureIds([2, 3, 4, 5, 6], 2, 2)).toEqual([5, 6])
    expect(layerPictureIds([2, 3], 0, 0)).toEqual([])
  })
})

describe('planAnimations', () => {
  test('a video inside a click layer fades in and plays on that click', () => {
    const anims = planAnimations(
      {
        layers: [spec({ kind: 'rise' }), spec({ kind: 'pop', trigger: 'click', step: 1, delay: 0, duration: 800 })],
        videos: [{ layerIndex: 1, durationMs: 9000 }],
      },
      [3, 4],
      [7],
    )
    expect(anims).toHaveLength(3)
    const video = anims[2]!
    expect(video.spid).toBe(7)
    expect(video.step).toBe(1)
    expect(video.entrance.fade).toBe(true)
    expect(video.entrance.delayMs).toBe(0)
    expect(video.entrance.durationMs).toBe(640)
    expect(video.media).toEqual({ durationMs: 9000 })
    const xml = buildTimingXml(anims)
    expect(xml).toContain('playFrom(0.0)')
    expect(xml.match(/nodeType="clickEffect"/g)!.length).toBeGreaterThanOrEqual(1)
  })

  test('a video that lands with the slide has no entrance, just plays', () => {
    const [video] = planAnimations({ layers: [], videos: [{ layerIndex: -1 }] }, [], [5])
    expect(video!.step).toBe(0)
    expect(video!.entrance.fade).toBe(false)
    expect(video!.entrance.durationMs).toBe(0)
    expect(video!.media).toEqual({ durationMs: undefined })
    const xml = buildTimingXml([video!])
    expect(xml.includes('presetClass="entr"')).toBe(false)
    expect(xml.includes('filter="fade"')).toBe(false)
    expect(xml).toContain('playFrom(0.0)')
    expect(xml).toContain('mute="1"')
  })
})

describe('formatPathNumber', () => {
  test('keeps a leading zero and trims trailing zeros', () => {
    expect(formatPathNumber(-14 / 1080)).toBe('-0.01296')
    expect(formatPathNumber(0.5)).toBe('0.5')
    expect(formatPathNumber(0)).toBe('0.0')
  })
})

describe('buildTransitionXml', () => {
  test('fade and push', () => {
    expect(buildTransitionXml('fade')).toBe('<p:transition spd="fast"><p:fade/></p:transition>')
    expect(buildTransitionXml('push')).toBe('<p:transition spd="fast"><p:push dir="l"/></p:transition>')
  })
})

describe('listPictureIds and injectSlideExtras', () => {
  const slideXml =
    `<p:sld>` +
    `<p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr>` +
    `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Picture 1"/></p:nvPicPr></p:pic>` +
    `<p:pic><p:nvPicPr><p:cNvPr id="5" name="Picture 2"/></p:nvPicPr></p:pic>` +
    `</p:spTree></p:cSld>` +
    `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
    `</p:sld>`

  test('lists picture ids in document order, skipping the group', () => {
    expect(listPictureIds(slideXml)).toEqual([2, 5])
  })

  const mediaPic =
    `<p:pic><p:nvPicPr><p:cNvPr id="8" name="Media 0"/><p:nvPr><a:videoFile r:link="rId6"/></p:nvPr></p:nvPicPr>` +
    `<p:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
  const withMedia = slideXml.replace('</p:spTree>', `${mediaPic}</p:spTree>`)

  test('keeps stills and videos apart', () => {
    expect(listPictureIds(withMedia)).toEqual([2, 5])
    expect(listMediaIds(withMedia)).toEqual([8])
  })

  test('rounds video corners to the CSS clip, and leaves square ones alone', () => {
    const rounded = roundMediaCorners(withMedia, [24 / 777])
    expect(rounded).toContain('<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 3089"/></a:avLst></a:prstGeom>')
    expect(rounded.match(/prst="rect"/g)).toBeNull()
    expect(roundMediaCorners(withMedia, [0])).toBe(withMedia)
    expect(roundMediaCorners(withMedia, [undefined])).toBe(withMedia)
  })

  test('places transition then timing right after clrMapOvr', () => {
    const out = injectSlideExtras(slideXml, '<p:transition/>', '<p:timing/>')
    expect(out).toContain('</p:clrMapOvr><p:transition/><p:timing/></p:sld>')
  })

  test('replaces earlier transition and timing blocks', () => {
    const once = injectSlideExtras(slideXml, '<p:transition spd="fast"><p:fade/></p:transition>', '<p:timing>a</p:timing>')
    const twice = injectSlideExtras(once, '<p:transition/>', '<p:timing>b</p:timing>')
    expect(twice.match(/<p:transition/g)).toHaveLength(1)
    expect(twice.match(/<p:timing/g)).toHaveLength(1)
    expect(twice).toContain('<p:timing>b</p:timing>')
  })

  test('throws when the slide xml has no closing tag', () => {
    expect(() => injectSlideExtras('<p:sld>', '', '')).toThrow('Slide XML is missing </p:sld>')
  })
})

describe('sanitizeSlideXml', () => {
  test('drops asvg:svgBlip and the empty media r:id importers refuse', () => {
    const xml =
      `<p:pic><p:blipFill><a:blip r:embed="rId3">` +
      `<a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}">` +
      `<asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId4"/>` +
      `</a:ext></a:extLst></a:blip></p:blipFill></p:pic>` +
      `<p:cNvPr id="8"><a:hlinkClick r:id="" action="ppaction://media"/></p:cNvPr>`
    const out = sanitizeSlideXml(xml)
    expect(out.includes('svgBlip')).toBe(false)
    expect(out.includes('r:id=""')).toBe(false)
    expect(out).toContain('<a:blip r:embed="rId3"></a:blip>')
    expect(out).toContain('<a:hlinkClick action="ppaction://media"/>')
  })
})

describe('applyAnimationsToPptx', () => {
  const slideXml =
    `<p:sld>` +
    `<p:cSld><p:spTree>` +
    `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Background"/></p:nvPicPr></p:pic>` +
    `<p:pic><p:nvPicPr><p:cNvPr id="3" name="Layer 1"/></p:nvPicPr></p:pic>` +
    `</p:spTree></p:cSld>` +
    `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
    `</p:sld>`

  async function zipOf(slides: Record<string, string>) {
    const zip = new JSZip()
    for (const [path, xml] of Object.entries(slides)) zip.file(path, xml)
    return zip.generateAsync({ type: 'arraybuffer' })
  }

  test('animates the layer picture, never the background, and adds the transition', async () => {
    const out = await applyAnimationsToPptx(
      await zipOf({ 'ppt/slides/slide1.xml': slideXml }),
      [[spec({ kind: 'rise', delay: 150, duration: 800 })]],
      'fade',
    )
    const xml = await (await JSZip.loadAsync(out)).file('ppt/slides/slide1.xml')!.async('string')
    expect(xml).toContain('<p:transition spd="fast"><p:fade/></p:transition>')
    expect(xml).toContain('<p:timing>')
    expect(xml).toContain('spid="3"')
    expect(xml.includes('spid="2"')).toBe(false)
    // 150ms / 800ms in the CSS, at the PPTX tempo.
    expect(xml).toContain('<p:cond delay="120"/>')
    expect(xml).toContain('dur="640"')
  })

  test('a slide without layers still gets the transition and no timing', async () => {
    const out = await applyAnimationsToPptx(
      await zipOf({
        'ppt/slides/slide1.xml': slideXml,
        'ppt/slides/slide2.xml': `<p:sld><p:cSld/><p:clrMapOvr/></p:sld>`,
      }),
      [[spec({ kind: 'pop' })], []],
      'push',
    )
    const zip = await JSZip.loadAsync(out)
    const second = await zip.file('ppt/slides/slide2.xml')!.async('string')
    expect(second).toContain('<p:push dir="l"/>')
    expect(second.includes('<p:timing>')).toBe(false)
  })

  test('throws when a slide file is missing', async () => {
    await expect(
      applyAnimationsToPptx(await zipOf({ 'ppt/slides/slide2.xml': slideXml }), [[spec({ kind: 'rise' })]], 'fade'),
    ).rejects.toThrow('Missing ppt/slides/slide1.xml')
  })
})
