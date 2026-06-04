import { NextResponse } from 'next/server'
import { lemonSqueezySetup, createCheckout } from '@lemonsqueezy/lemonsqueezy.js'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const APP_URL = process.env.NEXTAUTH_URL ?? 'https://insic.app'

export async function POST() {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  const userName  = session?.user?.name ?? undefined
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  lemonSqueezySetup({ apiKey: process.env.LEMONSQUEEZY_API_KEY! })

  const { data, error } = await createCheckout(
    process.env.LEMONSQUEEZY_STORE_ID!,
    process.env.LEMONSQUEEZY_VARIANT_ID!,
    {
      productOptions: {
        redirectUrl:  `${APP_URL}/analyze?upgraded=true`,
        receiptThankYouNote: 'Welcome to insic Pro — unlimited stock analysis is now unlocked.',
      },
      checkoutData: {
        email: userEmail,
        name:  userName,
        custom: { user_email: userEmail },
      },
    },
  )

  if (error || !data) {
    console.error('[lemonsqueezy/checkout] error:', error)
    return NextResponse.json({ error: error?.message ?? 'Checkout creation failed' }, { status: 500 })
  }

  const url = data.data?.attributes?.url
  if (!url) {
    console.error('[lemonsqueezy/checkout] no url in response:', data)
    return NextResponse.json({ error: 'No checkout URL returned' }, { status: 500 })
  }

  return NextResponse.json({ url })
}
