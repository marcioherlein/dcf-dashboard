import { createClient } from '@supabase/supabase-js'
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
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
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const sb = serviceClient()
        const { data: user } = await sb
          .from('users')
          .select('id, email, name, avatar_url, password_hash, email_verified_at')
          .eq('email', credentials.email.toLowerCase().trim())
          .maybeSingle()

        if (!user || !user.password_hash) return null

        if (!user.email_verified_at) {
          throw new Error('EMAIL_NOT_VERIFIED')
        }

        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) return null

        await sb
          .from('users')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', user.id)

        return {
          id:    user.id,
          email: user.email,
          name:  user.name  ?? null,
          image: user.avatar_url ?? null,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Credentials users are created during registration — skip upsert
      if (account?.provider === 'credentials') return true

      // Google OAuth upsert
      if (user.email) {
        try {
          const sb = serviceClient()

          const { data: existing } = await sb
            .from('users')
            .select('id')
            .eq('email', user.email)
            .maybeSingle()

          const isNew = !existing

          const { error: upsertError } = await sb.from('users').upsert(
            {
              email:      user.email,
              name:       user.name  ?? null,
              avatar_url: user.image ?? null,
              last_seen:  new Date().toISOString(),
              auth_method: 'google',
              ...(isNew ? { terms_accepted_at: new Date().toISOString(), email_verified_at: new Date().toISOString() } : {}),
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
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user?.email) {
        try {
          const sb = serviceClient()
          const { data } = await sb
            .from('users')
            .select('plan')
            .eq('email', user.email)
            .maybeSingle()
          token.plan = data?.plan ?? 'free'
        } catch {
          token.plan = 'free'
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string; plan?: string }).id   = token.sub
        ;(session.user as { id?: string; plan?: string }).plan = (token.plan as string | undefined) ?? 'free'
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/sign-in',
  },
  session: {
    strategy: 'jwt',
  },
}
