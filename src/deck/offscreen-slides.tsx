import { forwardRef, type ComponentType } from 'react'
import { SlidePositionProvider } from './slide-position'
import { OffscreenSlideContext } from './offscreen-slide-context'

type OffscreenSlidesProps = {
  /** Slides to render. Every caller passes its own deck. */
  slides: readonly ComponentType[]
  /** Wrap each slide in a position provider so page numbers appear in the PDF. */
  numbered?: boolean
}

/**
 * Renders every slide in a hidden offscreen container at native resolution
 * (1920x1080) so html-to-image can capture them. Spectacle only mounts one
 * slide at a time, so the deck on screen cannot be captured directly.
 */
export const OffscreenSlides = forwardRef<HTMLDivElement, OffscreenSlidesProps>(
  function OffscreenSlides({ slides, numbered = false }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          width: 1920,
          height: 1080 * slides.length,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        {slides.map((SlideComponent, i) => {
          const slide = (
            <OffscreenSlideContext>
              <SlideComponent />
            </OffscreenSlideContext>
          )
          return (
            <div key={i} data-slide-index={i} style={{ width: 1920, height: 1080, overflow: 'hidden' }}>
              {numbered ? (
                <SlidePositionProvider page={i + 1} pageCount={slides.length}>
                  {slide}
                </SlidePositionProvider>
              ) : (
                slide
              )}
            </div>
          )
        })}
      </div>
    )
  },
)
