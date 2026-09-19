import { useMemo } from 'react'
import { Deck, Slide } from 'spectacle'
import { Link } from 'react-router-dom'
import { exportBaseName } from '../brand'
import { DECK_THEME } from '../deck/deck-theme'
import { ExportModal } from '../deck/export-modal'
import { OffscreenSlides } from '../deck/offscreen-slides'
import type { PptxExportOptions } from '../deck/pptx-export'
import { SlidePositionProvider } from '../deck/slide-position'
import { usePresenterControls } from '../deck/use-presenter-controls'
import { LIGHT_BG } from './light-frame'
import type { DeckDefinition } from './registry'

// The one shell every deck runs in. Give it a `DeckDefinition` and it renders
// the slides at 1920×1080 with Spectacle's keyboard nav, presenter mode (P) and
// overview (O), plus the presenter chrome every deck wants: a way back,
// fullscreen (F) and export (E). The offscreen copy of the deck the exporters
// capture is mounted here too, so a deck is exportable by existing.

const DARK_BG = '#050505'

const PUSH = {
  from: { opacity: 0, transform: 'translateX(2%)' },
  enter: { opacity: 1, transform: 'translateX(0%)' },
  leave: { opacity: 0, transform: 'translateX(-2%)' },
}

const FADE = {
  from: { opacity: 0 },
  enter: { opacity: 1 },
  leave: { opacity: 0 },
}

const PILL = {
  dark: 'border-white/15 bg-black/60 text-neutral-300 hover:border-white/30 hover:text-white',
  light: 'border-black/15 bg-white/60 text-neutral-600 hover:border-black/30 hover:text-neutral-900',
}

export function PresentationDeck({
  deck,
  backTo = '/presentations',
  backLabel = 'Presentations',
}: {
  deck: DeckDefinition
  backTo?: string
  backLabel?: string
}) {
  const { slides, slug, canvas = 'dark', transition = 'push' } = deck
  const background = canvas === 'light' ? LIGHT_BG : DARK_BG

  // PowerPoint has no "none"; a fade is the closest thing to a plain cut.
  const pptxOptions = useMemo<PptxExportOptions>(
    () => ({ transition: transition === 'push' ? 'push' : 'fade' }),
    [transition],
  )
  const {
    offscreenRef,
    progress,
    error,
    format,
    isFullscreen,
    toggleFullscreen,
    chooserOpen,
    openExport,
    runExport,
    closeModal,
  } = usePresenterControls(exportBaseName(slug), pptxOptions)

  const pill =
    'pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase backdrop-blur transition ' +
    PILL[canvas]

  // `useAnimations` is Spectacle's own switch for cutting between slides; it
  // is missing from the published prop types, hence the cast.
  const deckProps =
    transition === 'none'
      ? ({ useAnimations: false } as object)
      : { transition: transition === 'fade' ? FADE : PUSH }

  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      style={{ backgroundColor: background }}
    >
      {/* Presenter chrome — top-right so it never collides with the frame's own
          top-left branding, and gone in fullscreen. Sits above the deck without
          swallowing Spectacle's keyboard navigation. */}
      {!isFullscreen && (
        <div className="pointer-events-none absolute top-4 right-4 z-50 flex items-center gap-2">
          <Link to={backTo} className={pill}>
            <span aria-hidden>←</span> {backLabel}
          </Link>
          <button type="button" onClick={toggleFullscreen} title="Fullscreen (F)" className={pill}>
            Present
          </button>
          <button type="button" onClick={openExport} title="Export (E)" className={pill}>
            Export
          </button>
        </div>
      )}

      <Deck theme={DECK_THEME} {...deckProps}>
        {slides.map((SlideBody, index) => (
          <Slide key={index} id={`${slug}-${index + 1}`} backgroundColor={background} padding={0}>
            <SlidePositionProvider page={index + 1} pageCount={slides.length}>
              <SlideBody />
            </SlidePositionProvider>
          </Slide>
        ))}
      </Deck>

      <OffscreenSlides ref={offscreenRef} slides={slides} numbered />
      <ExportModal
        open={chooserOpen}
        progress={progress}
        error={error}
        format={format}
        onClose={closeModal}
        onExport={runExport}
      />
    </div>
  )
}
