import LandingNavbar from '@/components/landing/LandingNavbar'
import LandingHero from '@/components/landing/LandingHero'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import LiveVerdictStrip from '@/components/landing/LiveVerdictStrip'
import MarketTeaserSection from '@/components/landing/MarketTeaserSection'
import ReverseDCFSection from '@/components/landing/ReverseDCFSection'
import TestimonialsSection from '@/components/landing/TestimonialsSection'
import ToolSurfaceSection from '@/components/landing/ToolSurfaceSection'
import TransparencySection from '@/components/landing/TransparencySection'
import MethodologySection from '@/components/landing/MethodologySection'
import PricingSection from '@/components/landing/PricingSection'
import FinalCTASection from '@/components/landing/FinalCTASection'
import LandingFooter from '@/components/landing/LandingFooter'

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-white">
      <LandingNavbar />
      <main>
        {/* Dark anchor — black hero opens the page */}
        <LandingHero />
        {/* White — how-it-works first so Jordan gets the mental model before the data demo */}
        <HowItWorksSection />
        {/* Off-white — live model verdicts for SPY, QQQ, NVDA */}
        <LiveVerdictStrip />
        {/* Off-white — data demonstration */}
        <MarketTeaserSection />
        {/* Off-white — reverse DCF deepens data demo before social proof */}
        <ReverseDCFSection />
        {/* White — testimonials break the off-white run */}
        <TestimonialsSection />
        {/* White — tool surface overview */}
        <ToolSurfaceSection />
        {/* Off-white structural sections — true alternation */}
        <TransparencySection />
        {/* White — methodology transparency */}
        <MethodologySection />
        <PricingSection />
        {/* Dark anchor — black FinalCTA closes the page */}
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  )
}
