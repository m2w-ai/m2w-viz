import type { MenuCard } from '../shell/menu-page'

// The home menu. One card per top-level surface; the routes themselves live in
// main.tsx.
export const HOME_CARDS: readonly MenuCard[] = [
  {
    to: '/presentations',
    eyebrow: 'Presentations',
    title: 'Talk Decks',
    description:
      'Full-screen decks built for the room. Pick a talk, present it, or export it as PDF, PowerPoint or a ZIP of slide images.',
    accent: 'from-fuchsia-400/90 via-sky-400/80 to-emerald-300/70',
    glow: 'shadow-[0_30px_120px_-40px_rgba(217,70,239,0.45)]',
  },
  {
    to: '/funnel',
    eyebrow: 'Visualizer',
    title: 'Funnel Sankey',
    description:
      'Interactive staged Sankey. Click a node to focus its sub-flow; switch between scenarios.',
    accent: 'from-rose-400/90 via-orange-300/80 to-amber-300/70',
    glow: 'shadow-[0_30px_120px_-40px_rgba(244,63,94,0.45)]',
  },
  {
    to: '/graph',
    eyebrow: 'Map',
    title: 'Graph',
    description:
      'A force-directed map of things and how they connect. Click a node to focus its neighbours; filter by edge kind.',
    accent: 'from-sky-400/90 via-emerald-300/80 to-violet-400/70',
    glow: 'shadow-[0_30px_120px_-40px_rgba(56,189,248,0.45)]',
  },
  {
    to: '/pipeline',
    eyebrow: 'Walkthrough',
    title: 'Pipeline',
    description:
      'A staged pipeline with a guided walk: stages, the components inside them, and the artifacts they hand on.',
    accent: 'from-amber-300/90 via-cyan-300/80 to-fuchsia-400/70',
    glow: 'shadow-[0_30px_120px_-40px_rgba(103,232,249,0.40)]',
  },
]
