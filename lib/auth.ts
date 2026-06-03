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
  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`)
  }
  console.log('[auth] welcome email sent, id:', result.data?.id)
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

          // Upsert first, then check if it was an insert (new user) via count
          const { data: existing } = await sb
            .from('users')
            .select('id')
            .eq('email', user.email)
            .maybeSingle()

          const isNew = !existing

          const { error: upsertError } = await sb.from('users').upsert(
            {
              email: user.email,
              name: user.name ?? null,
              avatar_url: user.image ?? null,
              last_seen: new Date().toISOString(),
            },
            { onConflict: 'email' },
          )

          if (upsertError) {
            console.error('[auth] upsert failed:', upsertError.message)
          }

          if (isNew) {
            try {
              await sendWelcomeEmail(user.email, user.name)
            } catch (err) {
              console.error('[auth] welcome email failed:', err instanceof Error ? err.message : err)
            }
          }
        } catch (err) {
          console.error('[auth] signIn callback error:', err)
          // Never block login
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
