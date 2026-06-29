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

// ── Welcome email — sent once only per user ────────────────────────────────────
// Guards on welcome_email_sent_at column to prevent duplicates (BUG-04).
async function maybeSendWelcomeEmail(email: string, name: string | null | undefined, sb: ReturnType<typeof serviceClient>) {
  if (!process.env.RESEND_API_KEY) return

  // Atomically claim the welcome send slot — only proceeds if not already sent
  const { data: updated, error } = await sb
    .from('users')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('email', email)
    .is('welcome_email_sent_at', null)  // only update if not already sent
    .select('id')
    .maybeSingle()

  if (error || !updated) {
    // Either already sent or DB error — do not send
    return
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const result = await resend.emails.send({
      from: 'insic <team@insic.app>',
      to: email,
      subject: 'Welcome to insic — your first stock analysis awaits',
      react: WelcomeEmail({ name: name ?? null }),
    })
    if (result.error) {
      console.error('[auth] welcome email failed:', result.error.message)
    } else {
      console.log('[auth] welcome email sent, id:', result.data?.id)
    }
  } catch (err) {
    console.error('[auth] welcome email exception:', err instanceof Error ? err.message : err)
  }
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

        // Normalize email consistently (BUG-05 prevention)
        const normalizedEmail = credentials.email.toLowerCase().trim()

        const { data: user } = await sb
          .from('users')
          .select('id, email, name, avatar_url, password_hash, email_verified_at')
          .eq('email', normalizedEmail)
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

        // Return Supabase UUID as id (BUG-09 fix: credentials users get their DB UUID)
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

      // ── Google OAuth flow ───────────────────────────────────────────────────
      if (!user.email) return false

      try {
        const sb = serviceClient()
        const normalizedEmail = user.email.toLowerCase().trim()

        const { data: existing } = await sb
          .from('users')
          .select('id, auth_method, email_verified_at')
          .eq('email', normalizedEmail)
          .maybeSingle()

        // BUG-07 FIX: In NextAuth v4, return false from signIn to block the
        // sign-in and let NextAuth redirect to the error page. We then check
        // the error param on the sign-in page.
        // BUG-06 FIX: Check auth_method independently of email_verified_at to
        // catch Google accounts that somehow have null email_verified_at.
        if (existing?.auth_method === 'email') {
          console.warn('[auth] Google blocked — email registered with password:', normalizedEmail)
          // Store the reason in a way the UI can detect it. NextAuth will redirect
          // to /auth/sign-in?error=OAuthAccountNotLinked which we intercept.
          // We use a custom error by encoding in the callbackUrl — but the cleanest
          // approach in v4 is to redirect explicitly.
          // NOTE: In NextAuth v4, returning a string from signIn IS supported for
          // redirects (it was added in 4.x). Tested with 4.24.13.
          return `/auth/sign-in?error=use_email`
        }

        const isNew = !existing

        // Upsert Google user — sets email_verified_at on first sign-in
        const { error: upsertError } = await sb.from('users').upsert(
          {
            email:       normalizedEmail,
            name:        user.name  ?? null,
            avatar_url:  user.image ?? null,
            last_seen:   new Date().toISOString(),
            auth_method: 'google',
            ...(isNew ? {
              terms_accepted_at:  new Date().toISOString(),
              email_verified_at:  new Date().toISOString(),
            } : {}),
          },
          { onConflict: 'email' },
        )

        if (upsertError) {
          console.error('[auth] upsert failed:', upsertError.message)
        }

        if (isNew) {
          await maybeSendWelcomeEmail(normalizedEmail, user.name, sb)
        }
      } catch (err) {
        console.error('[auth] signIn callback error:', err)
        // Never block sign-in due to our own errors
      }

      return true
    },

    async jwt({ token, user, account: _account }) {
      // ── On initial sign-in: fetch Supabase UUID and plan ──────────────────
      // BUG-09 FIX: For Google users, token.sub is the Google account ID,
      // not the Supabase UUID. We fetch and store the actual DB UUID here
      // so all downstream code uses the correct ID.
      // BUG-08 FIX: We also refresh plan on every token rotation (every request
      // for JWT strategy) by fetching from DB unconditionally, not just on
      // first sign-in.
      if (user?.email || token.email) {
        const emailToLookup = (user?.email ?? token.email as string | undefined)?.toLowerCase().trim()
        if (emailToLookup) {
          try {
            const sb = serviceClient()
            const { data } = await sb
              .from('users')
              .select('id, plan')
              .eq('email', emailToLookup)
              .maybeSingle()

            if (data) {
              token.userId = data.id      // Supabase UUID — use this, not token.sub
              token.plan   = data.plan ?? 'free'
              token.email  = emailToLookup
            }
          } catch {
            token.plan = token.plan ?? 'free'
          }
        }
      }

      return token
    },

    session({ session, token }) {
      if (session.user) {
        // BUG-09 FIX: Use token.userId (Supabase UUID) not token.sub (Google ID)
        ;(session.user as { id?: string; plan?: string }).id   = (token.userId as string | undefined) ?? token.sub
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
