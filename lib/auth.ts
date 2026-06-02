import { createClient } from '@supabase/supabase-js'
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

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
            fetch(`${process.env.NEXTAUTH_URL}/api/email/welcome`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: user.email, name: user.name }),
            }).catch(() => {})
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
