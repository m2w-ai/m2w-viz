# m2w-viz

The presentation and visualization framework behind M2W's internal tools
surface: a deck runtime with PDF / PowerPoint / ZIP export, and three
data-driven visualizers. One Vite app, several routes.

This repository holds the **infrastructure only**. Everything under
`src/content/` is neutral sample material that exists to exercise the framework
— replace it with your own decks and datasets. No real decks, figures, media or
research live here.

| Route | What it is |
| --- | --- |
| `/` | Landing menu |
| `/presentations` | Hub listing every registered deck |
| `/presentations/<slug>` | A deck, in the shared presenter shell |
| `/funnel` | Staged Sankey funnel |
| `/graph` | Force-directed node map |
| `/pipeline` | Staged pipeline with a guided walk |

## Run

```bash
bun install
bun run dev        # → http://localhost:4173
bun run typecheck
bun test
bun run build
```

## Layout

```
src/
  brand.ts            name, logos, links, export prefix — the one place branding lives
  main.tsx            routes (decks are routed by slug from the registry)
  home.tsx            landing menu
  shell/              page chrome shared across surfaces (menu page, tool header)
  deck/               deck runtime: frame, primitives, motion, presenter controls, exporters
  presentations/      deck registry, presenter shell, hub, light frame, diagram kit
  funnel/             Sankey tool      (model.ts = types + validation)
  graph/              graph tool       (model.ts = types + validation)
  pipeline/           pipeline tool    (model.ts = types + validation)
  content/            ← yours: decks and datasets. Sample material by default.
```

The rule that keeps this maintainable: **framework folders never import from
`content/`**. Tools take their data as a prop; decks are handed to the shell as
a definition. `main.tsx` is the only place the two meet.

## Decks

A deck is a list of slide components plus some metadata:

```ts
// src/content/decks.ts
export const DECKS = defineDecks([
  {
    slug: 'my-talk',               // → /presentations/my-talk, exports as <prefix>-my-talk.pdf
    eyebrow: 'Conference',
    title: 'My talk',
    description: 'Shown on the hub card.',
    venue: 'Where · when',
    slides: MY_TALK_SLIDES,        // readonly ComponentType[]
    canvas: 'dark',                // or 'light' (pairs with LightFrame)
    transition: 'push',            // 'push' | 'fade' | 'none'
  },
])
```

Adding a talk is a slide folder under `src/content/decks/` plus one entry here.
The hub card, the route, the page count, the presenter chrome and the export
are all derived from it — there is no per-deck shell to copy and no route to
wire. `defineDecks` throws on a duplicate slug or an empty deck.

The `slides` array is the single source of truth for deck order: the live
Spectacle deck and the offscreen copy the exporters capture both read it, so
page numbers and exported files cannot drift apart.

In a deck: arrow keys navigate · **P** presenter mode · **O** overview ·
**F** fullscreen · **E** export.

### Building slides

- **Frames** — `deck/slide-frame.tsx` (`SlideFrame`, dark; `size="projector"`
  enlarges the header for a big room; `footer` turns on the brand footer) and
  `presentations/light-frame.tsx` (`LightFrame`, light). Both read the page
  number from `SlidePositionProvider`, which the shell supplies.
- **Primitives** — `deck/primitives.tsx`: `StatCard`, `FeatureCard`,
  `ComingSoonPill`, `GlowQuote`, `Logo`.
- **Diagram kit** — `presentations/diagram.tsx`: `DiagramNode`, `Arrow`, `Chip`,
  `LoopBack`, `DiagramCaption`, `Takeaway`, and the `Tone` palette.
- **Motion** — `deck/motion.tsx`: `Rise`, `Pop`, `SlideIn`, `Wipe`, `GrowBar`,
  `CountUp`. They key off "this slide just became active" rather than a click,
  honour `prefers-reduced-motion`, and render their finished state in the
  offscreen export tree (`StaticMotion`) so an export never photographs a fade.
- **Click reveals** — `deck/click-reveal.tsx`: `ClickReveal` wraps Spectacle's
  `Appear` and tags the layer so the PowerPoint export reveals it on the same
  click.

Slides are authored against a fixed 1920×1080 canvas. Three things worth
checking in a browser after an edit, because none shows up in a typecheck:
content must clear the footer rail, not just the canvas edge; a row that
overflows horizontally stretches its own container, so measure it against the
authored canvas; and `Wipe` clips to its element box with deliberately negative
vertical insets — remove them and descenders get sliced.

### Export

`deck/run-export.ts` dispatches to three writers, all fed by
`capture-slide.ts` (html-to-image over the offscreen deck):

- **PDF** (`pdf-export.ts`) — one page per slide.
- **PPTX** (`pptx-export.ts`, `pptx-animations.ts`) — slides are split into
  layers (`export-layer.ts`), so entry animations, click reveals, slide
  transitions, speaker notes (`[data-slide-notes]`) and embedded video survive
  as native PowerPoint objects.
- **ZIP** (`zip-export.ts`) — one image (or clip) per slide.

Image and video formats and quality are chosen in `export-modal.tsx`
(`export-options.ts`); choices persist via `export-cache.ts`. Inline SVG is
lifted and re-rasterised by `svg-capture.ts`; video is re-encoded by
`video-encode.ts`. The exporters are covered by `src/deck/__tests__/`.

## Visualizers

Each tool is `<Tool>App({ dataset })`, and each `model.ts` documents the
dataset shape and ships a validator:

| Tool | Dataset | Validator |
| --- | --- | --- |
| Funnel | `FunnelDataset` — scenarios of stages, nodes, links, KPI pills | `validateScenario` |
| Graph | `GraphDataset` — nodes, edges, and the dataset's own statuses / edge kinds | `validateGraph` |
| Pipeline | `PipelineDataset` — stages, components, edges, artifacts, a walk, callouts | `validatePipeline` |

The vocabulary belongs to the dataset: stage ids, statuses, edge kinds and KPI
definitions are declared alongside the data rather than baked into the tools,
so the same funnel draws a sales pipeline or a hiring funnel, and the same
graph draws a product map or a service topology.

The layouts dereference ids without guards, so
`src/content/__tests__/content.test.ts` runs every dataset in `content/` through
its validator. Keep that test when you swap the samples for real data — a typo
in an id then fails CI instead of crashing a layout.

To drive a tool from live data, build the dataset from a query result and pass
it to the same component; nothing else changes.

### Layout notes

`funnel/layout.ts` is a hand-rolled Sankey: pick a uniform value→px scale so
the tallest stage fits, stack nodes per stage centred vertically, attach each
ribbon proportionally to its source/target heights, connect with a cubic
Bézier. Inbound ribbons are ordered by source position and outbound by target
attach point, so ribbons do not cross inside a node. `valueExponent < 1`
compresses the spread when tiny and huge nodes share a column. It is
deterministic and resize-aware (`ResizeObserver`).

`graph/layout.ts` is a seeded force simulation (spring along edges, pairwise
repulsion, gentle centring), so the map is free-form but identical on every
load.

## Branding

`src/brand.ts` holds the name, logo paths, links, the confidentiality line and
the export file prefix. Frames, menus, tool headers and the PowerPoint metadata
all read from it; logo files live in `public/`.

## Stack

Vite · React 19 · TypeScript · React Router v7 · Tailwind CSS v4 ·
Spectacle 10 · html-to-image · jsPDF · pptxgenjs · JSZip · pure-SVG layouts (no
chart libraries) · Bun for install and tests.

## Deploy

Static SPA. `vercel.json` rewrites every path to `index.html` so deep links to
decks resolve.

Deployed as the `m2w-viz-framework` Vercel project (team `m2w`):
<https://m2w-viz-framework.vercel.app>. It is deliberately separate from the
`m2w-viz` project, which serves the internal version from the mono repo — do
not link this repository to that one. The project is not git-connected, so
deploy by hand:

```bash
vercel link --project m2w-viz-framework --scope m2w-ai
vercel deploy          # preview (behind Vercel SSO)
vercel deploy --prod   # production
```

Build settings are auto-detected (`bun install`, `bun run build`, output
`dist`). `.vercel/` is local link state and stays out of git.
