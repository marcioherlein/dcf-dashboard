import { Body, Container, Head, Html, Link, Preview, Section, Text, Hr } from '@react-email/components'

interface Props {
  name?: string | null
  verifyUrl: string
}

export default function VerificationEmail({ name, verifyUrl }: Props) {
  const firstName = name?.split(' ')[0] ?? 'there'

  return (
    <Html>
      <Head />
      <Preview>Confirm your insic email address to get started</Preview>
      <Body style={{ backgroundColor: '#F8FAFC', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>

          <Section style={{ backgroundColor: '#111111', padding: '32px 40px' }}>
            <Text style={{ color: '#ffffff', fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>insic</Text>
            <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: '11px', margin: '3px 0 0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Confirm your email
            </Text>
          </Section>

          <Section style={{ padding: '36px 40px' }}>
            <Text style={{ fontSize: '20px', fontWeight: 700, color: '#111111', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              Welcome, {firstName} — one step left.
            </Text>
            <Text style={{ fontSize: '15px', color: '#4B4B4B', lineHeight: '1.65', margin: '0 0 28px' }}>
              Click the button below to confirm your email address and activate your insic account.
            </Text>

            <Link
              href={verifyUrl}
              style={{
                display: 'inline-block',
                backgroundColor: '#5F790B',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 700,
                padding: '14px 32px',
                borderRadius: '10px',
                textDecoration: 'none',
                marginBottom: '28px',
              }}
            >
              Verify email address →
            </Link>

            <Hr style={{ borderColor: '#E2E8F0', margin: '0 0 20px' }} />

            <Text style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.5', margin: 0 }}>
              This link expires in <strong>24 hours</strong>. If you didn&apos;t create an insic account, you can safely ignore this email.
            </Text>
          </Section>

          <Section style={{ backgroundColor: '#F8FAFC', padding: '16px 40px', borderTop: '1px solid #E2E8F0' }}>
            <Text style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
              insic · team@insic.app ·{' '}
              <Link href="https://insic.app" style={{ color: '#94A3B8' }}>insic.app</Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}
