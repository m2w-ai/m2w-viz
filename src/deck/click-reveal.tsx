import type { ReactNode } from 'react'
import { Appear } from 'spectacle'
import { exportLayerAttrs, type ExportLoop } from './export-layer'

type ClickRevealProps = {
  children: ReactNode
  /** Forwarded to Spectacle Appear so stacked reveals keep their order. */
  priority?: number
  /**
   * Which click shows this in the PPTX, 1-based. Leave unset for one reveal
   * per click in document order; set it to land several layers on one click.
   */
  step?: number
  /** Fade this out when the next click fires — swap it for what follows. */
  exitOnNextClick?: boolean
  /** Keep bobbing once revealed — the PPTX twin of an ambient CSS float. */
  loop?: ExportLoop
}

/**
 * Click-gated reveal that stays tagged for PPTX export.
 *
 * Offscreen capture already forces every Appear child visible (print mode),
 * so the wrapper keeps Appear in both trees. The wrapper itself has no box
 * (`display: contents`), so it changes nothing about layout; the PPTX writer
 * finds it by its data attributes, and visibility still inherits through it.
 */
export function ClickReveal({ children, priority, step, exitOnNextClick, loop }: ClickRevealProps) {
  return (
    <div
      style={{ display: 'contents' }}
      {...exportLayerAttrs({
        kind: 'appear',
        delay: 0,
        duration: 500,
        trigger: 'click',
        step,
        exitOnNextClick,
        loop,
      })}
    >
      <Appear priority={priority}>{children}</Appear>
    </div>
  )
}
