import type { ComponentType } from 'react'

// A deck is described once, here, and everything else is derived from it: the
// hub card, the route, the page count, the export file name and the presenter
// chrome. Adding a talk is a slide folder plus one `DeckDefinition` in
// `content/decks.ts` — no route to wire, no per-deck shell to copy.

export type DeckDefinition = {
  /** URL segment (`/presentations/<slug>`) and export file name. Unique. */
  slug: string
  eyebrow: string
  title: string
  description: string
  /** Where the talk is given; shown under the title on the hub card. */
  venue: string
  /**
   * Ordered slides. The single source of truth for deck order: the live deck
   * and the offscreen exporter both read it, so page numbers, the footer
   * counter and the exported file cannot drift apart.
   */
  slides: readonly ComponentType[]
  /** Canvas the slides are drawn for. `light` pairs with `LightFrame`. */
  canvas?: 'dark' | 'light'
  /**
   * Slide-to-slide motion. `push` slides the next one in, `fade` cross-fades,
   * `none` replaces it outright — right for a sequence of diagrams, where each
   * picture should replace the last rather than travel over it.
   */
  transition?: 'push' | 'fade' | 'none'
  /** Tailwind gradient stops for the hub card's glow. */
  accent?: string
  /** Tailwind shadow class for the hub card. */
  glow?: string
}

export const DEFAULT_ACCENT = 'from-fuchsia-400/90 via-violet-400/80 to-sky-400/70'
export const DEFAULT_GLOW = 'shadow-[0_30px_120px_-40px_rgba(168,85,247,0.45)]'

export function deckPath(deck: Pick<DeckDefinition, 'slug'>): string {
  return `/presentations/${deck.slug}`
}

export function findDeck(
  decks: readonly DeckDefinition[],
  slug: string | undefined,
): DeckDefinition | undefined {
  return decks.find((deck) => deck.slug === slug)
}

/** Throws on a duplicate slug — two decks on one route is a silent bug otherwise. */
export function defineDecks(decks: readonly DeckDefinition[]): readonly DeckDefinition[] {
  const seen = new Set<string>()
  for (const deck of decks) {
    if (seen.has(deck.slug)) throw new Error(`Duplicate deck slug: ${deck.slug}`)
    if (deck.slides.length === 0) throw new Error(`Deck "${deck.slug}" has no slides`)
    seen.add(deck.slug)
  }
  return decks
}
