'use client'
import { useState, useEffect } from 'react'
import { fmt, fmtPct } from '@/lib/utils'

interface Snapshot { id: string; saved_at: string; price_at_save: number; fair_value: number; wacc: number; cagr: number; upside_pct: number }
interface Props { ticker: string; onSave: () => Promise<{ ok: boolean; error?: string }>; saving: boolean }

const localKey = (ticker: string) => `valuations_${ticker}`

function loadLocal(ticker: string): Snapshot[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(localKey(ticker)) ?? '[]') } catch { return [] }
}

export function saveLocal(ticker: string, snap: Snapshot) {
  if (typeof window === 'undefined') return
  const existing = loadLocal(ticker)
  const merged = [snap, ...existing.filter((s) => s.saved_at !== snap.saved_at)].slice(0, 20)
  localStorage.setItem(localKey(ticker), JSON.stringify(merged))
}

export default function ValuationHistory({ ticker, onSave, saving }: Props) {
  const [history, setHistory] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`/api/valuations?ticker=${ticker}`)
      .then((r) => r.json())
      .then((d) => {
        const remote: Snapshot[] = Array.isArray(d) ? d : []
        const local = loadLocal(ticker)
        const remoteIds = new Set(remote.map((s) => s.id))
        const merged = [...remote, ...local.filter((s) => !remoteIds.has(s.id))]
        merged.sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime())
        setHistory(merged); setLoading(false)
      })
      .catch(() => { setHistory(loadLocal(ticker)); setLoading(false) })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [ticker])

  const handleSave = async () => {
    setSaveError(''); setSaveSuccess(false)
    const result = await onSave()
    if (result.ok) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } else {
      setSaveError(result.error ?? 'Save failed — snapshot stored locally')
    }
    load()
  }

  return (
    <div className="rounded-xl bg-surface-container-lowest dark:bg-[#111] shadow-card border border-outline-variant/10 dark:border-white/8 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-headline font-semibold text-on-surface dark:text-white/70">Valuation History</h2>
        <button
          onClick={handleSave} disabled={saving}
          className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          {saving ? 'Saving…' : '+ Save snapshot'}
        </button>
      </div>

      {saveSuccess && <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">Snapshot saved successfully.</p>}
      {saveError && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">{saveError}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-gray-400 dark:text-white/25">Loading…</p>
      ) : history.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400 dark:text-white/25">No saved valuations yet. Click &ldquo;Save snapshot&rdquo; to record today&apos;s model.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 dark:border-white/8">
                {['Date', 'Price', 'Fair Value', 'Upside', 'WACC', 'CAGR'].map((h, i) => (
                  <th key={h} className={`pb-2 text-xs font-medium text-gray-400 dark:text-white/25 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 dark:border-white/5">
                  <td className="py-2 text-gray-600 dark:text-white/50">
                    {new Date(s.saved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </td>
                  <td className="py-2 text-right text-gray-700 dark:text-white/60">{s.price_at_save ? `$${fmt(s.price_at_save)}` : '—'}</td>
                  <td className="py-2 text-right font-semibold text-gray-800 dark:text-white/80">{s.fair_value ? `$${fmt(s.fair_value)}` : '—'}</td>
                  <td className={`py-2 text-right font-medium ${s.upside_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {s.upside_pct ? `${s.upside_pct >= 0 ? '+' : ''}${fmtPct(s.upside_pct)}` : '—'}
                  </td>
                  <td className="py-2 text-right text-gray-500 dark:text-white/30">{s.wacc ? fmtPct(s.wacc) : '—'}</td>
                  <td className="py-2 text-right text-gray-500 dark:text-white/30">{s.cagr ? fmtPct(s.cagr) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
