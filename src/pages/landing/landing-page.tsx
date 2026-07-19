import { LandingHeader } from '@/components/landing/landing-header'
import { HeroSection } from '@/components/landing/hero-section'
import { DashboardPreview } from '@/components/landing/dashboard-preview'
import { FeaturesSection } from '@/components/landing/features-section'
import { BenefitsSection } from '@/components/landing/benefits-section'
import { HowItWorks } from '@/components/landing/how-it-works'
import { PricingSection } from '@/components/landing/pricing-section'
import { TestimonialsSection } from '@/components/landing/testimonials-section'
import { MetricsSection } from '@/components/landing/metrics-section'
import { FAQSection } from '@/components/landing/faq-section'
import { FinalCTA } from '@/components/landing/final-cta'
import { LandingFooter } from '@/components/landing/landing-footer'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <HeroSection />
      <DashboardPreview />
      <FeaturesSection />
      <BenefitsSection />
      <HowItWorks />
      <PricingSection />
      <TestimonialsSection />
      <MetricsSection />
      <FAQSection />
      <FinalCTA />
      <LandingFooter />
    </div>
  )
}
