import LandingNavbar from '@/components/landing/LandingNavbar'
import LandingHero from '@/components/landing/LandingHero'
import MarketTeaserSection from '@/components/landing/MarketTeaserSection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import TransparencySection from '@/components/landing/TransparencySection'
import TestimonialsSection from '@/components/landing/TestimonialsSection'
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
        {/* Off-white bridge between hero and white content sections */}
        <MarketTeaserSection />
        {/* White content sections */}
        <HowItWorksSection />
        <TestimonialsSection />
        {/* Off-white structural sections */}
        <TransparencySection />
        <PricingSection />
        {/* Dark anchor — black FinalCTA closes the page */}
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  )
}
