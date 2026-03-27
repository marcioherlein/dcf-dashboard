'use client'
import { useSession, signIn } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'

interface Position {
  ticker: string
  shares: number
  avgCost: number
  currency: string
}

export default function Portfolio() {
  const { data: session, status } = useSession()
  const [positions, setPositions] = useState<Position[] | null>(null)
  const [analysisHtml, setAnalysisHtml] = useState<string | null>(null)
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load portfolio on login
  useEffect(() => {
    if (!session) return
    setLoadingPositions(true)
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((d) => { setPositions(d.positions ?? null); setLoadingPositions(false) })
      .catch(() => setLoadingPositions(false))
  }, [session])

  // Generate analysis once positions loaded
  useEffect(() => {
    if (!positions?.length) return
    setLoadingAnalysis(true)
    fetch('/api/portfolio/analyze', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => { setAnalysisHtml(d.html ?? null); setLoadingAnalysis(false) })
      .catch(() => setLoadingAnalysis(false))
  }, [positions])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/portfolio/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Upload failed'); return }
      setPositions(data.positions)
      setAnalysisHtml(null) // force regeneration
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Not logged in
  if (status === 'unauthenticated') {
    return (
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/8 bg-[#111] px-8 py-20 text-center">
            <p className="mb-3 text-5xl">💼</p>
            <p className="text-lg font-semibold text-white">Your Portfolio</p>
            <p className="mt-2 mb-8 max-w-sm text-sm text-white/40">
              Sign in with Google to upload your portfolio and get a personalized daily analysis, risk assessment, and recommendations.
            </p>
            <button
              onClick={() => signIn('google')}
              className="flex items-center gap-2.5 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition-all"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      </section>
    )
  }

  // Loading session
  if (status === 'loading') {
    return (
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="animate-pulse rounded-2xl border border-white/8 bg-[#111]" style={{ height: 200 }} />
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 pb-20">
      <div className="mx-auto max-w-6xl">

        {/* Upload bar */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">
              {session?.user?.name ?? 'Portfolio'}
            </p>
            <p className="text-xs text-white/40">
              {positions ? `${positions.length} positions · ` : ''}
              Daily analysis updates automatically
            </p>
          </div>
          <div className="flex items-center gap-3">
            {error && <p className="text-xs text-red-400">{error}</p>}
            <label className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 transition-all">
              {uploading ? 'Uploading…' : positions ? '↺ Update Excel' : '↑ Upload Excel'}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* No portfolio yet */}
        {!loadingPositions && !positions && (
          <div className="rounded-2xl border border-white/8 bg-[#111] px-8 py-16 text-center">
            <p className="mb-2 text-4xl">📊</p>
            <p className="text-base font-semibold text-white">Upload your portfolio</p>
            <p className="mt-2 mb-6 text-sm text-white/40 max-w-sm mx-auto">
              Excel file with columns: <code className="rounded bg-white/8 px-1.5 py-0.5 text-xs text-white/60">Ticker</code>, <code className="rounded bg-white/8 px-1.5 py-0.5 text-xs text-white/60">Shares</code>, <code className="rounded bg-white/8 px-1.5 py-0.5 text-xs text-white/60">Avg Cost</code>
            </p>
            <label className="cursor-pointer rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition-all">
              {uploading ? 'Uploading…' : 'Upload Excel'}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        )}

        {/* Loading analysis */}
        {(loadingPositions || loadingAnalysis) && (
          <div className="space-y-3">
            <div className="animate-pulse rounded-2xl border border-white/8 bg-[#111]" style={{ height: 120 }} />
            <div className="animate-pulse rounded-2xl border border-white/8 bg-[#111]" style={{ height: 300 }} />
          </div>
        )}

        {/* Analysis iframe */}
        {analysisHtml && !loadingAnalysis && (
          <div className="overflow-hidden rounded-2xl border border-white/8" style={{ height: 'max(80vh, 600px)' }}>
            <iframe
              srcDoc={analysisHtml}
              className="h-full w-full"
              title="Portfolio Analysis"
            />
          </div>
        )}
      </div>
    </section>
  )
}
