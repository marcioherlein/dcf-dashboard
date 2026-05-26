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
          await serviceClient()
            .from('users')
            .upsert(
              {
                email: user.email,
                name: user.name ?? null,
                avatar_url: user.image ?? null,
                last_seen: new Date().toISOString(),
              },
              { onConflict: 'email' },
            )
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
