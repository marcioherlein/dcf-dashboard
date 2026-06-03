import { createClient } from '@supabase/supabase-js'
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { Resend } from 'resend'
import WelcomeEmail from '@/emails/WelcomeEmail'

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

async function sendWelcomeEmail(email: string, name: string | null | undefined) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[auth] RESEND_API_KEY is not set — skipping welcome email')
    return
  }
  console.log('[auth] sending welcome email to', email)
  const resend = new Resend(process.env.RESEND_API_KEY)
  const result = await resend.emails.send({
    from: 'insic <team@insic.app>',
    to: email,
    subject: 'Welcome to insic — your first stock analysis awaits',
    react: WelcomeEmail({ name: name ?? null }),
  })
  console.log('[auth] welcome email result:', JSON.stringify(result))
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user.email) {
        try {
          const sb = serviceClient()

          // Check if this user already exists
          const { data: existing } = await sb
            .from('users')
            .select('id')
            .eq('email', user.email)
            .maybeSingle()

          const isNew = !existing

          await sb.from('users').upsert(
            {
              email: user.email,
              name: user.name ?? null,
              avatar_url: user.image ?? null,
              last_seen: new Date().toISOString(),
            },
            { onConflict: 'email' },
          )

          if (isNew) {
            // Fire and forget — never block login
            sendWelcomeEmail(user.email, user.name).catch((err) => {
              console.error('[auth] welcome email failed:', err?.message ?? err)
            })
          }
        } catch {
          // Never block login if email capture fails
        }
      }
      return true
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
}
