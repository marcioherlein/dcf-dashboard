import LandingNavbar from '@/components/landing/LandingNavbar'
import LandingHero from '@/components/landing/LandingHero'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import MarketTeaserSection from '@/components/landing/MarketTeaserSection'
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
        {/* Dark anchor — black hero opens the page */}
        <LandingHero />
        {/* White — how-it-works first so Jordan gets the mental model before the data demo */}
        <HowItWorksSection />
        {/* Off-white — data demonstration */}
        <MarketTeaserSection />
        {/* White — testimonials break the off-white run */}
        <TestimonialsSection />
        {/* Off-white structural sections — true alternation */}
        <TransparencySection />
        <PricingSection />
        {/* Dark anchor — black FinalCTA closes the page */}
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  )
}
