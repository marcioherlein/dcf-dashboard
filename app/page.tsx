import LandingNavbar from '@/components/landing/LandingNavbar'
import LandingHero from '@/components/landing/LandingHero'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import LiveVerdictStrip from '@/components/landing/LiveVerdictStrip'
import ReverseDCFSection from '@/components/landing/ReverseDCFSection'
import ConvictionScoreSection from '@/components/landing/ConvictionScoreSection'
import TestimonialsSection from '@/components/landing/TestimonialsSection'
import TransparencySection from '@/components/landing/TransparencySection'
import PricingSection from '@/components/landing/PricingSection'
import FinalCTASection from '@/components/landing/FinalCTASection'
import LandingFooter from '@/components/landing/LandingFooter'

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-white">
      <LandingNavbar />
      <main>
        {/* 1. Dark anchor — hero */}
        <LandingHero />
        {/* 2. White — mental model */}
        <HowItWorksSection />
        {/* 3. Off-white — live model verdicts */}
        <LiveVerdictStrip />
        {/* 4. White — reverse DCF real data examples */}
        <ReverseDCFSection />
        {/* 5. Off-white — Conviction Score differentiator */}
        <ConvictionScoreSection />
        {/* 6. White — social proof */}
        <TestimonialsSection />
        {/* 7. Off-white — transparency / no black boxes */}
        <TransparencySection />
        {/* 8. White — pricing */}
        <PricingSection />
        {/* 9. Dark anchor — final CTA closes the page */}
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  )
}
