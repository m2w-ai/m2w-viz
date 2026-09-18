import { defineDecks } from '../presentations/registry'
import { SAMPLE_DARK_SLIDES } from './decks/sample-dark/slides'
import { SAMPLE_LIGHT_SLIDES } from './decks/sample-light/slides'

// Every deck in the app. The hub, the routes and the exporters are all derived
// from this list — adding a talk is a slide folder under `decks/` plus an entry
// here.
export const DECKS = defineDecks([
  {
    slug: 'sample-dark',
    eyebrow: 'Sample',
    title: 'Dark canvas',
    description:
      'The dark frame with the stat, feature and quote primitives, entry motion and one click reveal. Press F to present, E to export.',
    venue: 'Template · replace me',
    slides: SAMPLE_DARK_SLIDES,
    transition: 'push',
    accent: 'from-violet-400/90 via-fuchsia-400/80 to-sky-400/70',
    glow: 'shadow-[0_30px_120px_-40px_rgba(139,92,246,0.45)]',
  },
  {
    slug: 'sample-light',
    eyebrow: 'Sample',
    title: 'Light canvas',
    description:
      'The light frame with the diagram kit: nodes, arrows, chips, a loop-back and a takeaway band. No transitions — each picture replaces the last.',
    venue: 'Template · replace me',
    slides: SAMPLE_LIGHT_SLIDES,
    canvas: 'light',
    transition: 'none',
    accent: 'from-sky-400/90 via-violet-400/80 to-fuchsia-400/70',
    glow: 'shadow-[0_30px_120px_-40px_rgba(56,189,248,0.42)]',
  },
])
