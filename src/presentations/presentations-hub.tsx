import { MenuPage, type MenuCard } from '../shell/menu-page'
import { DEFAULT_ACCENT, DEFAULT_GLOW, deckPath, type DeckDefinition } from './registry'

// Lists every registered deck. Cards are derived from the registry, so the
// slide count on a card is always the length of the deck it opens.
export function PresentationsHub({ decks }: { decks: readonly DeckDefinition[] }) {
  const cards: MenuCard[] = decks.map((deck) => ({
    to: deckPath(deck),
    eyebrow: deck.eyebrow,
    title: deck.title,
    description: deck.description,
    detail: deck.venue,
    meta: `${deck.slides.length} slides`,
    accent: deck.accent ?? DEFAULT_ACCENT,
    glow: deck.glow ?? DEFAULT_GLOW,
  }))
  return (
    <MenuPage
      backToMenu
      section="Presentations"
      eyebrow="Presentations"
      heading="Pick a talk"
      blurb="Arrow keys navigate · P for presenter mode · O for overview · F for fullscreen · E to export."
      cards={cards}
      cta="Open deck"
    />
  )
}
