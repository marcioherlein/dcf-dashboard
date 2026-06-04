import LandingNavbar from '@/components/landing/LandingNavbar'
import LandingHero from '@/components/landing/LandingHero'
import ReverseDCFSection from '@/components/landing/ReverseDCFSection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import ProductDeepDiveSection from '@/components/landing/ProductDeepDiveSection'
import TransparencySection from '@/components/landing/TransparencySection'
import TestimonialsSection from '@/components/landing/TestimonialsSection'
import PricingSection from '@/components/landing/PricingSection'
import FinalCTASection from '@/components/landing/FinalCTASection'
import LandingFooter from '@/components/landing/LandingFooter'

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F8F7F2' }}>
      <LandingNavbar />
      <main>
        <LandingHero />
        <ReverseDCFSection />
        <HowItWorksSection />
        <ProductDeepDiveSection />
        <TransparencySection />
        <TestimonialsSection />
        <PricingSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  )
}
