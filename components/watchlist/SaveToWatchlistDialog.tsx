'use client'

import { useState } from 'react'
import { AlertTriangle, Bookmark, CheckCircle2, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { fmtPrice, fmtPct } from '@/lib/formatters'
import { saveWatchlistEntry, getWatchlistEntry } from '@/lib/simplifier/watchlistStore'
import type { WatchlistEntry } from '@/lib/simplifier/types'

export interface WatchlistSavePayload {
  ticker: string
  name: string
  assetType: 'stock' | 'etf'
  // only for stocks
  fairValue?: number | null
  upsidePct?: number | null
  valuationSnapshot?: {
    price_at_save: number
    fair_value: number
    wacc: number
    beta: number
    terminal_g: number
    cagr: number
    upside_pct: number
    inputs: Record<string, number>
    scenarios: { bull: number; base: number; bear: number }
  } | null
}

interface Props {
  open: boolean
  payload: WatchlistSavePayload | null
  onClose: () => void
  onReviewAssumptions: () => void
}

export default function SaveToWatchlistDialog({ open, payload, onClose, onReviewAssumptions }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (!payload) return null

  const isETF = payload.assetType === 'etf'

  async function handleSave() {
    if (!payload) return
    setStatus('saving')
    setErrorMsg('')
    try {
      // 1. Save to watchlist
      const wRes = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: payload.ticker,
          name: payload.name,
          asset_type: payload.assetType,
        }),
      })
      if (!wRes.ok) {
        const errBody = await wRes.json().catch(() => ({}))
        if (wRes.status === 402 && errBody.gate === 'unlimited_saves') {
          throw new Error('FREE_LIMIT')
        }
        throw new Error('Failed to save to watchlist')
      }

      // 2. Save valuation snapshot for stocks
      if (!isETF && payload.valuationSnapshot) {
        await fetch('/api/valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: payload.ticker,
            company: payload.name,
            ...payload.valuationSnapshot,
          }),
        })
      }

      setStatus('done')
      // Mirror into localStorage so the /valuations page shows this stock
      const existing = getWatchlistEntry(payload.ticker)
      const entry: WatchlistEntry = existing
        ? {
            ...existing,
            updatedAt: new Date().toISOString(),
            snapshot: {
              ...existing.snapshot,
              upsidePct: payload.upsidePct ?? existing.snapshot.upsidePct,
              price: payload.valuationSnapshot?.price_at_save ?? existing.snapshot.price,
              beta: payload.valuationSnapshot?.beta ?? existing.snapshot.beta,
              fairValue: payload.fairValue ?? existing.snapshot.fairValue,
            },
          }
        : {
            ticker: payload.ticker,
            companyName: payload.name,
            updatedAt: new Date().toISOString(),
            currentPhase: 1,
            answers: {},
            notes: {},
            phaseScores: {},
            overallScore: null,
            listTag: null,
            snapshot: {
              grossMargin: null, fcfMargin: null, moatScore: null,
              roic: null, cagr3y: null, insiderPct: null,
              beta: payload.valuationSnapshot?.beta ?? null,
              upsidePct: payload.upsidePct ?? null,
              price: payload.valuationSnapshot?.price_at_save ?? null,
              marketCap: null,
              fairValue: payload.fairValue ?? null,
            },
          }
      saveWatchlistEntry(entry)
      setTimeout(() => {
        setStatus('idle')
        onClose()
      }, 1200)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong')
      setStatus('error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setStatus('idle'); onClose() } }}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark size={16} className="text-blue-500" />
            {isETF ? `Add ${payload.ticker} to Watchlist` : `Save ${payload.ticker} Analysis`}
          </DialogTitle>
        </DialogHeader>

        {status === 'done' ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <p className="text-sm font-semibold text-slate-100">Saved to your watchlist</p>
          </div>
        ) : (
          <>
            {/* Valuation summary for stocks */}
            {!isETF && payload.fairValue != null && (
              <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Fair Value</span>
                  <span className="font-semibold text-slate-100">{fmtPrice(payload.fairValue)}</span>
                </div>
                {payload.upsidePct != null && (
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-500">Upside</span>
                    <span className={`font-semibold ${payload.upsidePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {fmtPct(payload.upsidePct)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Warning for stocks */}
            {!isETF && (
              <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 leading-relaxed">
                  <p className="font-semibold mb-0.5">Review assumptions before saving</p>
                  <p>These inputs were auto-derived from Yahoo Finance data. Growth rates, WACC, and multiples may not reflect your own research. Don&apos;t rely on the model blindly.</p>
                  <button
                    onClick={() => { onClose(); onReviewAssumptions() }}
                    className="mt-1.5 underline font-semibold hover:text-amber-900"
                  >
                    Review assumptions →
                  </button>
                </div>
              </div>
            )}

            {/* ETF simple message */}
            {isETF && (
              <p className="text-sm text-slate-500">
                {payload.name} will be added to your watchlist. No valuation is stored for ETFs.
              </p>
            )}

            {status === 'error' && (
              errorMsg === 'FREE_LIMIT' ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  <p className="font-semibold mb-0.5">Free tier limit reached (3 saves)</p>
                  <p>Upgrade to Pro for unlimited watchlist saves.</p>
                  <a href="/pricing" className="mt-1.5 inline-block underline font-semibold hover:text-blue-900">
                    View Pro plans →
                  </a>
                </div>
              ) : (
                <p className="text-xs text-red-600">{errorMsg}</p>
              )
            )}
          </>
        )}

        {status !== 'done' && (
          <DialogFooter>
            <button
              onClick={() => { setStatus('idle'); onClose() }}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={status === 'saving'}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
            >
              {status === 'saving'
                ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                : isETF ? 'Add to Watchlist' : 'Save Anyway'
              }
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
