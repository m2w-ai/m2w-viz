import { createContext, useContext, type ReactNode } from 'react'

const StaticCaptureContext = createContext(false)

/**
 * Marks a subtree as a still capture: every motion component inside renders
 * its finished state immediately, with no transition, and anything that would
 * start playing on an active slide (a video, a counter) stays put.
 *
 * The exporters render the deck a second time into a hidden container. That
 * tree is given a Spectacle SlideContext with `isSlideActive: true` so that
 * <Notes> mounts and speaker notes can be read back — which is exactly the
 * signal entry animations use to start. The capture path therefore says so
 * explicitly rather than letting components infer it.
 */
export function StaticMotion({ children }: { children: ReactNode }) {
  return <StaticCaptureContext.Provider value={true}>{children}</StaticCaptureContext.Provider>
}

/**
 * True inside the hidden tree the exporters screenshot.
 *
 * Needed by anything whose content depends on Spectacle's step index rather
 * than just on opacity. Offscreen there are no activation thresholds, so
 * `useSteps` reports step 0 — which for a multi-step reveal is the FIRST frame,
 * and a page showing the setup instead of the payoff is worse than useless.
 * A component that cares can ask, and render its final frame instead.
 */
export function useIsStaticCapture(): boolean {
  return useContext(StaticCaptureContext)
}
