'use client'
import { useState, useEffect } from 'react'
import { fmt, fmtPct } from '@/lib/utils'

interface Snapshot {
  id: string
  saved_at: string
  price_at_save: number
  fair_value: number
  wacc: number
  cagr: number
  upside_pct: number
}

interface Props {
  ticker: string
  onSave: () => Promise<{ ok: boolean; error?: string }>
  saving: boolean
}

// localStorage helpers (client-only)
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
        // merge: remote first, append local-only entries
        const remoteIds = new Set(remote.map((s) => s.id))
        const merged = [...remote, ...local.filter((s) => !remoteIds.has(s.id))]
        merged.sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime())
        setHistory(merged)
        setLoading(false)
      })
      .catch(() => {
        // API failed — fall back to localStorage only
        setHistory(loadLocal(ticker))
        setLoading(false)
      })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [ticker])

  const handleSave = async () => {
    setSaveError('')
    setSaveSuccess(false)
    const result = await onSave()
    if (result.ok) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } else {
      // page.tsx already saved to localStorage; show advisory message
      setSaveError(result.error ?? 'Save failed — snapshot stored locally (configure Supabase to persist across devices)')
    }
    load()
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Valuation History</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : '+ Save snapshot'}
        </button>
      </div>

      {saveSuccess && (
        <p className="mt-2 text-xs font-medium text-emerald-600">Snapshot saved successfully.</p>
      )}
      {saveError && (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{saveError}</p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-gray-400">Loading…</p>
      ) : history.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">No saved valuations yet. Click &ldquo;Save snapshot&rdquo; to record today&apos;s model.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left text-xs font-medium text-gray-400">Date</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">Price</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">Fair Value</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">Upside</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">WACC</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">CAGR</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id} className="border-b border-gray-50">
                  <td className="py-2 text-gray-600">
                    {new Date(s.saved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </td>
                  <td className="py-2 text-right text-gray-700">{s.price_at_save ? `$${fmt(s.price_at_save)}` : '—'}</td>
                  <td className="py-2 text-right font-semibold text-gray-800">{s.fair_value ? `$${fmt(s.fair_value)}` : '—'}</td>
                  <td className={`py-2 text-right font-medium ${s.upside_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {s.upside_pct ? `${s.upside_pct >= 0 ? '+' : ''}${fmtPct(s.upside_pct)}` : '—'}
                  </td>
                  <td className="py-2 text-right text-gray-500">{s.wacc ? fmtPct(s.wacc) : '—'}</td>
                  <td className="py-2 text-right text-gray-500">{s.cagr ? fmtPct(s.cagr) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
