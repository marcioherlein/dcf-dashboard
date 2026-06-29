'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useRouter } from 'next/navigation'

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!
const PLAN_ID = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID!

interface Props {
  userEmail: string | null | undefined
  onSignInRequired: () => void
}

export default function PayPalSubscribeButton({ userEmail, onSignInRequired }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renderedRef = useRef(false)
  const [sdkReady, setSdkReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function renderButton() {
    if (renderedRef.current) return
    if (!containerRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paypal = (window as any).paypal
    if (!paypal?.Buttons) return

    renderedRef.current = true
    containerRef.current.innerHTML = ''

    paypal.Buttons({
      style: {
        shape: 'rect',
        color: 'gold',
        layout: 'vertical',
        label: 'subscribe',
        height: 48,
      },
      createSubscription(_data: unknown, actions: { subscription: { create: (o: object) => Promise<string> } }) {
        if (!userEmail) {
          onSignInRequired()
          return Promise.reject('not signed in')
        }
        return actions.subscription.create({ plan_id: PLAN_ID })
      },
      async onApprove(data: { subscriptionID: string }) {
        try {
          const res = await fetch('/api/paypal/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: data.subscriptionID }),
          })
          const json = await res.json().catch(() => ({})) as { ok?: boolean; refreshSession?: boolean; error?: string; code?: string }
          if (res.ok && json.ok) {
            // Force NextAuth JWT re-issue so session.user.plan reflects 'pro' immediately.
            // Without this, the client-side session stays stale until the 24h rotation window.
            if (json.refreshSession) {
              try {
                const { getSession } = await import('next-auth/react')
                await getSession() // triggers JWT callback + cookie rewrite
              } catch {
                // Non-fatal — user will see Pro after next navigation
              }
            }
            router.push('/analyze?upgraded=true')
          } else {
            const msg = json.code === 'PAYPAL_STATUS_NOT_ACTIVE'
              ? 'Subscription is not active yet. Please wait a moment and try again.'
              : json.code === 'PAYPAL_EMAIL_MISMATCH'
                ? 'PayPal account email does not match your insic account. Please contact support.'
                : 'Activation failed — please contact support.'
            setError(msg)
          }
        } catch {
          setError('Network error — please contact support.')
        }
      },
      onError(err: unknown) {
        console.error('[PayPal] button error:', err)
        setError('Something went wrong with PayPal. Please try again.')
      },
      onCancel() {
        // User cancelled — no action needed
      },
    }).render(containerRef.current)
  }

  useEffect(() => {
    if (sdkReady) renderButton()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, userEmail])

  return (
    <div className="w-full">
      <Script
        src={`https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => setError('Failed to load PayPal. Please refresh.')}
      />
      <div ref={containerRef} className="min-h-[48px]" />
      {error && (
        <p className="mt-2 text-[12px] text-red-500 text-center">{error}</p>
      )}
    </div>
  )
}
