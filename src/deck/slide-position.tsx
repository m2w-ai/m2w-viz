import { createContext, useContext, type ReactNode } from 'react'

// Slide position is ambient: the deck knows each slide's index, but the
// position is rendered by SlideFrame deep inside the slide. Threading a `page`
// prop through every slide component would mean touching every file and
// keeping the numbers hand-synced with the deck order. A context lets the deck
// stay the single source of truth for ordering.

type SlidePosition = { page: number; pageCount: number }

const SlidePositionContext = createContext<SlidePosition | null>(null)

export function SlidePositionProvider({
  page,
  pageCount,
  children,
}: SlidePosition & { children: ReactNode }) {
  return (
    <SlidePositionContext.Provider value={{ page, pageCount }}>{children}</SlidePositionContext.Provider>
  )
}

/** Null outside a provider, so SlideFrame renders no number rather than a wrong one. */
export function useSlidePosition() {
  return useContext(SlidePositionContext)
}
