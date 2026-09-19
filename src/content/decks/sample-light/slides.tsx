import {
  Arrow,
  Chip,
  DiagramCaption,
  DiagramNode,
  LoopBack,
  Takeaway,
} from '../../../presentations/diagram'
import { LightFrame } from '../../../presentations/light-frame'

// Sample deck on the light canvas, built from the diagram kit. Placeholder
// content throughout — it exists to show the vocabulary (nodes, arrows, chips,
// a loop-back, a takeaway band) and how a diagram-first talk is laid out.

function TitleSlide() {
  return (
    <LightFrame align="center" eyebrow="Sample talk" title="A talk that is drawn, not bulleted">
      <p className="text-center text-[24px] text-neutral-600">Speaker · Venue · Date</p>
    </LightFrame>
  )
}

function FlowSlide() {
  return (
    <LightFrame eyebrow="DiagramNode · Arrow" title="A process, left to right">
      <div className="flex items-center justify-center gap-4">
        <DiagramNode title="Input" caption="Where it starts" tone="sky" />
        <Arrow />
        <DiagramNode title="Process" caption="What happens to it" tone="violet" tag="core" />
        <Arrow label="then" />
        <DiagramNode title="Output" caption="What comes out" tone="emerald" />
        <Arrow dashed />
        <DiagramNode title="Later" caption="Not built yet" tone="slate" dashed />
      </div>
      <DiagramCaption>Dashed means planned. One line under a figure, not a column.</DiagramCaption>
      <Takeaway>Every content slide ends on the one thing to remember.</Takeaway>
    </LightFrame>
  )
}

function LoopSlide() {
  return (
    <LightFrame eyebrow="LoopBack · Chip" title="A loop, and what shortens it">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center justify-center gap-4">
          <DiagramNode title="Change" tone="amber" />
          <Arrow />
          <DiagramNode title="Measure" tone="rose" />
          <Arrow />
          <DiagramNode title="Decide" tone="fuchsia" />
        </div>
        <LoopBack label="and round again" tone="violet" />
        <div className="flex flex-wrap justify-center gap-2">
          <Chip tone="emerald">faster</Chip>
          <Chip tone="sky">cheaper</Chip>
          <Chip tone="violet">repeatable</Chip>
        </div>
      </div>
      <Takeaway tone="emerald">The loop is the product; the chips are what you tune.</Takeaway>
    </LightFrame>
  )
}

function ClosingSlide() {
  return <LightFrame align="center" eyebrow="Questions" title="Thank you" />
}

export const SAMPLE_LIGHT_SLIDES = [TitleSlide, FlowSlide, LoopSlide, ClosingSlide] as const
