import { useState, type ReactNode } from 'react'
import { DeckContext, SlideContext } from 'spectacle'
import { StaticMotion } from './static-capture'

export const SLIDE_NOTES_ATTR = 'data-slide-notes'

// Spectacle's <Notes> reads two contexts and destructures both without a null
// guard, so rendering any slide containing Notes outside a <Deck> throws
// "Cannot destructure property 'notePortalNode' of null".
//
//   const { notePortalNode } = useContext(DeckContext)
//   const { isSlideActive }  = useContext(SlideContext)
//   if (!isSlideActive) return null
//   if (!notePortalNode) return null
//   return createPortal(children, notePortalNode)
//
// (spectacle 10.2.3, lib/index.js:2773-2781)
//
// The exporters have to render slides outside the Deck — Spectacle mounts one
// slide at a time, so the live deck cannot be captured. Providing both contexts
// satisfies the destructures. Each slide gets its own hidden portal node and
// `isSlideActive: true` once that node exists, so its speaker notes render into
// a `[data-slide-notes]` element the PPTX exporter can read back. `display:
// none` keeps them out of the picture; the PDF ignores them, which is correct —
// a handout is not the presenter's script.
//
// <Appear> reads the SAME two contexts but different fields, and also
// destructures without a null guard:
//
//   const { inPrintMode, inOverviewMode } = useContext(DeckContext)
//   const { activeStepIndex, activationThresholds } = useContext(SlideContext)
//
// Both sets must be present on the same providers — nesting a second pair does
// not work, the inner one shadows the outer. `inPrintMode: true` and
// `activationThresholds: null` make every Appear child render fully visible,
// which is what a static capture needs.
//
// `isSlideActive: true` is also what entry animations and the video slides key
// off, so the whole subtree is wrapped in StaticMotion: motion renders its
// finished state and videos do not start playing off screen.

export function OffscreenSlideContext({ children }: { children: ReactNode }) {
  const [notesNode, setNotesNode] = useState<HTMLDivElement | null>(null)

  return (
    <StaticMotion>
      <DeckContext.Provider
        value={{ notePortalNode: notesNode, inPrintMode: true, inOverviewMode: false } as never}
      >
        <SlideContext.Provider
          value={
            {
              isSlideActive: notesNode !== null,
              activeStepIndex: Infinity,
              activationThresholds: null,
              immediate: true,
            } as never
          }
        >
          {children}
          <div ref={setNotesNode} hidden {...{ [SLIDE_NOTES_ATTR]: '' }} />
        </SlideContext.Provider>
      </DeckContext.Provider>
    </StaticMotion>
  )
}
