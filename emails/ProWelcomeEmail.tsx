import {
  Body, Container, Head, Heading, Html,
  Link, Preview, Section, Text, Hr,
} from '@react-email/components'

interface Props {
  name?: string | null
  plan?: 'monthly' | 'annual'
}

export default function ProWelcomeEmail({ name, plan = 'monthly' }: Props) {
  const firstName = name?.split(' ')[0] ?? 'there'

  return (
    <Html>
      <Head />
      <Preview>Your insic Pro subscription is active</Preview>
      <Body style={{ backgroundColor: '#F8FAFC', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>

          {/* Header */}
          <Section style={{ backgroundColor: '#0F2A5E', padding: '32px 40px' }}>
            <Heading style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>
              insic
            </Heading>
            <Text style={{ color: '#93C5FD', fontSize: '12px', margin: '4px 0 0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Pro · Active
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: '36px 40px' }}>
            <Heading style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              You&apos;re now on insic Pro, {firstName} 🎉
            </Heading>
            <Text style={{ fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: '0 0 24px' }}>
              Your {plan === 'annual' ? 'annual' : 'monthly'} Pro subscription is active. Unlimited stock analysis, no caps — starting now.
            </Text>

            <Link
              href="https://insic.app/analyze"
              style={{
                display: 'inline-block',
                backgroundColor: '#2563EB',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                padding: '14px 28px',
                borderRadius: '10px',
                textDecoration: 'none',
                marginBottom: '32px',
              }}
            >
              Start analyzing →
            </Link>

            <Hr style={{ borderColor: '#E2E8F0', margin: '0 0 24px' }} />

            <Text style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pro includes
            </Text>
            {[
              'Unlimited stock analyses — no monthly cap',
              'Unlimited saved analyses and watchlist',
              'Full DCF model + 5 valuation methods',
              'Bear / Base / Bull fair value scenarios',
              'Financial health scores (Piotroski, Altman, Beneish)',
              'Priority access to new features',
            ].map(item => (
              <Text key={item} style={{ fontSize: '14px', color: '#475569', margin: '0 0 6px', paddingLeft: '16px' }}>
                ✓ {item}
              </Text>
            ))}

            <Hr style={{ borderColor: '#E2E8F0', margin: '24px 0' }} />

            <Text style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.5', margin: 0 }}>
              To manage your subscription, visit your{' '}
              <Link href="https://insic.app/settings" style={{ color: '#2563EB' }}>account settings</Link>.
              You can cancel anytime — your access remains until the end of the billing period.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={{ backgroundColor: '#F8FAFC', padding: '20px 40px', borderTop: '1px solid #E2E8F0' }}>
            <Text style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: '1.5' }}>
              Questions? Reply to this email or reach us at{' '}
              <Link href="mailto:team@insic.app" style={{ color: '#2563EB' }}>team@insic.app</Link>.
              {' '}·{' '}
              <Link href="https://insic.app/terms" style={{ color: '#94A3B8' }}>Terms</Link>
              {' '}·{' '}
              <Link href="https://insic.app/privacy" style={{ color: '#94A3B8' }}>Privacy</Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}
