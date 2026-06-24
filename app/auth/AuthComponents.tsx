'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff } from 'lucide-react'
import { InsicLogoLockup } from '@/components/ui/InsicLogo'

const INPUT = 'w-full px-4 py-3 rounded-xl border border-[#E5E5E5] text-[14px] text-[#111111] placeholder-[#C4C4C4] bg-white focus:outline-none focus:ring-2 focus:ring-[#5F790B]/20 focus:border-[#5F790B] transition-colors'
const BTN_PRIMARY = 'w-full py-3 rounded-xl bg-[#5F790B] hover:bg-[#526A08] text-white text-[14px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]'
const BTN_GOOGLE = 'w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-[#E5E5E5] bg-white hover:bg-[#F8F8F8] text-[14px] font-semibold text-[#111111] transition-colors min-h-[48px]'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="m8.98 17 2.6-2.04c-.87.58-2 .93-2.6.93a5.38 5.38 0 0 1-5.1-3.72H1.24v2.08A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M3.88 12.17a5.3 5.3 0 0 1 0-3.35V6.74H1.24a8 8 0 0 0 0 7.17l2.64-1.74z"/>
      <path fill="#EA4335" d="M8.98 4.5a4.36 4.36 0 0 1 3.08 1.2l2.3-2.3A7.74 7.74 0 0 0 8.98 1a8 8 0 0 0-7.74 5.74l2.64 2.08A5.38 5.38 0 0 1 8.98 4.5z"/>
    </svg>
  )
}

function AuthShell({ children, title, sub }: { children: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="min-h-dvh bg-[#F5F4EF] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Link href="/"><InsicLogoLockup size="sm" /></Link>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-8 shadow-sm">
          <h1 className="text-[22px] font-bold text-[#111111] tracking-tight mb-1">{title}</h1>
          <p className="text-[13px] text-[#9B9B9B] mb-7">{sub}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Sign Up ───────────────────────────────────────────────────────────────────

export function SignUpPage() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [done, setDone]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setDone(true)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthShell title="Check your email" sub={`We sent a verification link to ${email}`}>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-[#EEF4DD] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#5F790B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-[14px] text-[#4B4B4B] leading-relaxed mb-6">
            Click the link in the email to activate your account. Check your spam folder if you don&apos;t see it.
          </p>
          <Link href="/auth/sign-in" className="text-[13px] text-[#5F790B] font-semibold hover:underline">
            Back to sign in →
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Create your account" sub="Free during beta — no credit card required">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className={INPUT} type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required autoFocus />
        <input className={INPUT} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
        <div className="relative">
          <input className={INPUT} type={showPwd ? 'text' : 'password'} placeholder="Password (min 8 characters)" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9B9B] hover:text-[#6B6B6B]">
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <input className={INPUT} type={showPwd ? 'text' : 'password'} placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        {error && <p className="text-[12px] text-red-500">{error}</p>}
        <button type="submit" disabled={loading} className={BTN_PRIMARY}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <hr className="flex-1 border-[#E5E5E5]" />
        <span className="text-[12px] text-[#C4C4C4]">or</span>
        <hr className="flex-1 border-[#E5E5E5]" />
      </div>

      <button onClick={() => signIn('google', { callbackUrl: '/analyze' })} className={BTN_GOOGLE}>
        <GoogleIcon />
        Continue with Google
      </button>

      <p className="text-center text-[13px] text-[#9B9B9B] mt-6">
        Already have an account?{' '}
        <Link href="/auth/sign-in" className="text-[#5F790B] font-semibold hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  )
}

// ── Sign In ───────────────────────────────────────────────────────────────────

export function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const verified  = searchParams.get('verified') === 'true'
  const reset     = searchParams.get('reset')    === 'true'
  const errorParam = searchParams.get('error')

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [unverified, setUnverified] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setUnverified(false)
    setLoading(true)
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
    setLoading(false)

    if (result?.error === 'EMAIL_NOT_VERIFIED') {
      setUnverified(true)
      return
    }
    if (result?.error || !result?.ok) {
      setError('Invalid email or password')
      return
    }
    router.push('/analyze')
  }

  return (
    <AuthShell title="Sign in" sub="Welcome back to insic">
      {verified && (
        <div className="mb-5 rounded-xl bg-[#EEF4DD] border border-[#BFD2A1] px-4 py-3 text-[13px] text-[#5F790B] font-medium">
          ✓ Email verified — you can now sign in
        </div>
      )}
      {reset && (
        <div className="mb-5 rounded-xl bg-[#EEF4DD] border border-[#BFD2A1] px-4 py-3 text-[13px] text-[#5F790B] font-medium">
          ✓ Password updated — sign in with your new password
        </div>
      )}
      {errorParam === 'token_expired' && (
        <div className="mb-5 rounded-xl bg-[#FCEAEA] border border-[#F0B8B8] px-4 py-3 text-[13px] text-[#D83B3B]">
          Verification link expired. Sign up again to get a new one.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input className={INPUT} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        <div className="relative">
          <input className={INPUT} type={showPwd ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9B9B] hover:text-[#6B6B6B]">
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="text-right">
          <Link href="/auth/forgot-password" className="text-[12px] text-[#9B9B9B] hover:text-[#5F790B] hover:underline">
            Forgot password?
          </Link>
        </div>
        {error && <p className="text-[12px] text-red-500">{error}</p>}
        {unverified && (
          <div className="rounded-xl bg-[#FFF4DA] border border-[#F3D391] px-4 py-3 text-[13px] text-[#B56A00]">
            Please verify your email first. Check your inbox for the verification link.
          </div>
        )}
        <button type="submit" disabled={loading} className={BTN_PRIMARY}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <hr className="flex-1 border-[#E5E5E5]" />
        <span className="text-[12px] text-[#C4C4C4]">or</span>
        <hr className="flex-1 border-[#E5E5E5]" />
      </div>

      <button onClick={() => signIn('google', { callbackUrl: '/analyze' })} className={BTN_GOOGLE}>
        <GoogleIcon />
        Continue with Google
      </button>

      <p className="text-center text-[13px] text-[#9B9B9B] mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/auth/sign-up" className="text-[#5F790B] font-semibold hover:underline">Sign up free</Link>
      </p>
    </AuthShell>
  )
}

// ── Forgot Password ───────────────────────────────────────────────────────────

export function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    setSent(true)
  }

  return (
    <AuthShell title="Reset your password" sub="We'll send you a link to reset it">
      {sent ? (
        <div className="text-center py-2">
          <p className="text-[14px] text-[#4B4B4B] leading-relaxed mb-6">
            If an account with that email exists, we&apos;ve sent a reset link. Check your inbox (and spam folder).
          </p>
          <Link href="/auth/sign-in" className="text-[13px] text-[#5F790B] font-semibold hover:underline">
            Back to sign in →
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className={INPUT} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          <button type="submit" disabled={loading} className={BTN_PRIMARY}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <p className="text-center text-[13px] text-[#9B9B9B]">
            <Link href="/auth/sign-in" className="text-[#5F790B] font-semibold hover:underline">Back to sign in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}

// ── Reset Password ────────────────────────────────────────────────────────────

export function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm)  { setError('Passwords do not match'); return }
    if (password.length < 8)   { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      router.push('/auth/sign-in?reset=true')
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthShell title="Invalid link" sub="This password reset link is invalid">
        <p className="text-[14px] text-[#4B4B4B] mb-6">The link is missing or malformed. Request a new one.</p>
        <Link href="/auth/forgot-password" className="text-[13px] text-[#5F790B] font-semibold hover:underline">
          Request new link →
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Choose a new password" sub="Must be at least 8 characters">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input className={INPUT} type={showPwd ? 'text' : 'password'} placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
          <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9B9B] hover:text-[#6B6B6B]">
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <input className={INPUT} type={showPwd ? 'text' : 'password'} placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        {error && <p className="text-[12px] text-red-500">{error}</p>}
        <button type="submit" disabled={loading} className={BTN_PRIMARY}>
          {loading ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </AuthShell>
  )
}
