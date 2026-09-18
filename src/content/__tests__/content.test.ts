import { describe, expect, test } from 'bun:test'
import { validateScenario, type Scenario } from '../../funnel/model'
import { validateGraph } from '../../graph/model'
import { validatePipeline } from '../../pipeline/model'
import { defineDecks, deckPath, findDeck } from '../../presentations/registry'
import { SAMPLE_FUNNEL } from '../funnel'
import { SAMPLE_GRAPH } from '../graph'
import { SAMPLE_PIPELINE } from '../pipeline'

// The tools dereference ids without guards, so a typo in a dataset would
// surface as a crash inside a layout. These keep whatever lives in `content/`
// referentially sound — they are meant to keep passing after the samples are
// replaced with real data.

describe('funnel dataset', () => {
  test('every scenario is referentially sound', () => {
    for (const scenario of SAMPLE_FUNNEL.scenarios) {
      expect(validateScenario(scenario)).toEqual([])
    }
  })

  test('the default scenario exists', () => {
    const ids = SAMPLE_FUNNEL.scenarios.map((s) => s.id)
    expect(ids).toContain(SAMPLE_FUNNEL.defaultScenarioId ?? ids[0])
  })

  test('validation reports a dangling link', () => {
    const base = SAMPLE_FUNNEL.scenarios[0]
    const broken: Scenario = {
      ...base,
      links: [...base.links, { source: 'nope', target: base.nodes[0].id, value: 1 }],
    }
    expect(validateScenario(broken)).toEqual(['link source "nope" is not a node'])
  })
})

describe('graph dataset', () => {
  test('is referentially sound', () => {
    expect(validateGraph(SAMPLE_GRAPH)).toEqual([])
  })

  test('validation reports an undeclared edge kind', () => {
    const [first] = SAMPLE_GRAPH.edges
    const problems = validateGraph({ ...SAMPLE_GRAPH, edges: [{ ...first, kind: 'mystery' }] })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('undeclared kind "mystery"')
  })
})

describe('pipeline dataset', () => {
  test('is referentially sound', () => {
    expect(validatePipeline(SAMPLE_PIPELINE)).toEqual([])
  })

  test('validation reports a walk step that focuses nothing', () => {
    const problems = validatePipeline({
      ...SAMPLE_PIPELINE,
      walk: [{ id: 'x', title: '', body: '', focus: { kind: 'stage', id: 'ghost' } }],
    })
    expect(problems).toEqual(['walk step "x" focuses unknown stage "ghost"'])
  })
})

describe('deck registry', () => {
  const Slide = () => null
  const deck = { slug: 'a', eyebrow: '', title: '', description: '', venue: '', slides: [Slide] }

  test('rejects duplicate slugs', () => {
    expect(() => defineDecks([deck, deck])).toThrow('Duplicate deck slug: a')
  })

  test('rejects an empty deck', () => {
    expect(() => defineDecks([{ ...deck, slides: [] }])).toThrow('has no slides')
  })

  test('routes by slug', () => {
    expect(deckPath(deck)).toBe('/presentations/a')
    expect(findDeck([deck], 'a')).toBe(deck)
    expect(findDeck([deck], 'b')).toBeUndefined()
  })
})
