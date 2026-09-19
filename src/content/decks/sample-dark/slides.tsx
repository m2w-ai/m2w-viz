import { ClickReveal } from '../../../deck/click-reveal'
import { CountUp, GrowBar, Pop, Rise, SlideIn } from '../../../deck/motion'
import { ComingSoonPill, FeatureCard, GlowQuote, Logo, StatCard } from '../../../deck/primitives'
import { SlideFrame } from '../../../deck/slide-frame'

// Sample deck on the dark canvas. Every number and sentence here is a
// placeholder: the point is to show each piece of the kit in use — the frame,
// the primitives, entry motion, a click reveal — and to give the exporters
// something to capture. Copy the folder, replace the slides.

function TitleSlide() {
  return (
    <SlideFrame align="center" background="edge-glow">
      <div className="flex flex-col items-center gap-10 text-center">
        <Pop>
          <Logo />
        </Pop>
        <Rise delay={200}>
          <h1 className="font-display text-[110px] leading-none font-bold tracking-tight text-neutral-50">
            Deck title
          </h1>
        </Rise>
        <Rise delay={450}>
          <p className="text-[32px] text-neutral-400">One line that says what the talk is about.</p>
        </Rise>
      </div>
    </SlideFrame>
  )
}

function StatsSlide() {
  return (
    <SlideFrame eyebrow="StatCard" title="Three numbers, one row" subtitle="Placeholder figures.">
      <div className="grid grid-cols-3 gap-8">
        <Rise>
          <StatCard value={<CountUp to={128} />} label="First metric" tone="violet" />
        </Rise>
        <Rise delay={150}>
          <StatCard value={<CountUp to={42} suffix="%" />} label="Second metric" tone="emerald" />
        </Rise>
        <Rise delay={300}>
          <StatCard value={<CountUp to={7} suffix="×" />} label="Third metric" tone="sky" />
        </Rise>
      </div>
    </SlideFrame>
  )
}

function FeaturesSlide() {
  return (
    <SlideFrame eyebrow="FeatureCard" title="What it does" footer>
      <div className="grid grid-cols-3 gap-8">
        <SlideIn>
          <FeatureCard icon="◆" title="First thing" body="A sentence describing the first capability." />
        </SlideIn>
        <SlideIn delay={150}>
          <FeatureCard icon="▲" title="Second thing" body="A sentence describing the second capability." />
        </SlideIn>
        <SlideIn delay={300}>
          <FeatureCard
            icon="●"
            title="Third thing"
            body="A sentence describing what comes next."
            pill={<ComingSoonPill />}
          />
        </SlideIn>
      </div>
    </SlideFrame>
  )
}

const BARS = [
  { label: 'Alpha', width: '82%' },
  { label: 'Beta', width: '56%' },
  { label: 'Gamma', width: '31%' },
]

function BarsSlide() {
  return (
    <SlideFrame eyebrow="GrowBar · ClickReveal" title="Bars grow in; the quote waits for a click">
      <div className="flex flex-col gap-6">
        {BARS.map((bar, i) => (
          <div key={bar.label} className="flex items-center gap-6">
            <div className="w-40 text-right text-[26px] text-neutral-400">{bar.label}</div>
            <div className="h-10 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
              <GrowBar
                width={bar.width}
                delay={i * 180}
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-14 flex justify-center">
        <ClickReveal>
          <GlowQuote>The line the presenter wants to land on a beat of its own.</GlowQuote>
        </ClickReveal>
      </div>
    </SlideFrame>
  )
}

function ClosingSlide() {
  return (
    <SlideFrame align="center" background="soft" footer>
      <div className="flex flex-col items-center gap-8 text-center">
        <Logo />
        <h2 className="font-display text-[84px] font-bold tracking-tight text-neutral-50">Thank you</h2>
      </div>
    </SlideFrame>
  )
}

export const SAMPLE_DARK_SLIDES = [
  TitleSlide,
  StatsSlide,
  FeaturesSlide,
  BarsSlide,
  ClosingSlide,
] as const
