'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';

interface Trade {
  ticker: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  currentShares: number;
  deltaShares: number;
  deltaDirection: number;
  targetShares: number;
  arsPrice: number;
  usdEquiv: number;
  tradeValueARS: number;
  cocosCostARS: number;
  currentWeight: number;
  targetWeight: number;
  deltaWeightPct: number;
  zScore: number | null;
  label: 'RICH' | 'CHEAP' | 'NEUTRAL';
  valuationSuppressed?: boolean;
}

interface Portfolio {
  capital: number;
  currentWeights: Record<string, number>;
  currentShares: Record<string, number>;
  hasHoldings: boolean;
}

interface PairwiseItem {
  pair: string;
  tickerA: string;
  tickerB: string;
  currentRatio: number;
  currentZ: number | null;
  pearsonCorr: number;
  direction: 'A_RICH' | 'B_RICH' | 'NEUTRAL';
  signalStrength: 'none' | 'elevated' | 'extreme';
  suggestion: string;
}

interface FundamentalEntry {
  pe: number | null;
  evEbitda: number | null;
  pb: number | null;
  ps: number | null;
  targetPrice: number | null;
  currentPrice: number | null;
  upside: number | null;
}

interface LiveSignalResponse {
  dataAsOf: string;
  fetchedAt: string | null;
  ccl: { date: string; rate: number } | null;
  prices: { ars: Record<string, number>; usdEquiv: Record<string, number> };
  portfolio: Portfolio;
  signal: {
    regime: 'normal' | 'stretched' | 'broken';
    richTicker: string;
    cheapTicker: string;
    neutralTicker: string;
    zScores: Record<string, number | null>;
    targetWeights: Record<string, number>;
    shouldRebalance: boolean;
    rebalanceReason: string;
    corrWarnings: string[];
    confidence: 'high' | 'medium' | 'low';
    pairwiseMod?: number;
  };
  trades: Trade[];
  costs: {
    capital: number;
    totalTradeValueARS: number;
    totalCocosCostARS: number;
    effectiveCostBps: number;
    costBpsPerSide: number;
  };
  config: { lookback: number; zEntry: number; zExit: number; costBps: number };
  history: Record<string, string | number | null>[];
  correlations?: Record<string, string | number | null>[];
  usdPrices?: Record<string, string | number | null>[];
  ltmPerformance?: Record<string, string | number | null>[];
  pairwise?: PairwiseItem[];
  fundamentals?: Record<string, FundamentalEntry> | null;
  valuationGate?: Record<string, { upside: number | null; suppressed: boolean }>;
  fundamentalsFetchedAt?: string | null;
  error?: string;
  instruction?: string;
}

const TICKER_COLORS: Record<string, string> = { NU: '#2563EB', PAGS: '#059669', STNE: '#D97706' };

const REGIME_STYLE: Record<string, string> = {
  normal:    'text-emerald-700 border-emerald-200 bg-emerald-50',
  stretched: 'text-amber-700 border-amber-200 bg-amber-50',
  broken:    'text-red-700 border-red-200 bg-red-50',
};

const ACTION_STYLE: Record<string, string> = {
  BUY:  'bg-emerald-50 border-emerald-200 text-emerald-700',
  SELL: 'bg-red-50 border-red-200 text-red-700',
  HOLD: 'bg-slate-50 border-slate-200 text-slate-500',
};

function ars(v: number | null | undefined) {
  if (v == null || !isFinite(v)) return '—';
  return `$${v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function pctFmt(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export default function TradingPage() {
  const [holdings, setHoldings]           = useState({ NU: '799', PAGS: '1519', STNE: '357' });
  const [lookback, setLookback]           = useState(20);
  const [zEntry, setZEntry]               = useState(1.0);
  const [costBps, setCostBps]             = useState(50);
  const [valuationGate, setValuationGate] = useState(false);
  const [data, setData]                   = useState<LiveSignalResponse | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  const loadSignal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ lookback: String(lookback), zEntry: String(zEntry), costBps: String(costBps) });
      if (valuationGate) params.set('valuationGate', 'true');
      const nu   = parseInt(holdings.NU);
      const pags = parseInt(holdings.PAGS);
      const stne = parseInt(holdings.STNE);
      if (nu   > 0) params.set('nu',   String(nu));
      if (pags > 0) params.set('pags', String(pags));
      if (stne > 0) params.set('stne', String(stne));
      const res = await fetch(`/api/trading/live-signal?${params}`);
      const d   = await res.json();
      if (d.error) setError(`${d.error}${d.instruction ? '\n' + d.instruction : ''}`);
      else setData(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [holdings, lookback, zEntry, costBps, valuationGate]);

  useEffect(() => { loadSignal(); }, [loadSignal]);

  const {
    signal, trades, costs, prices, ccl, history,
    dataAsOf, fetchedAt, portfolio,
    pairwise: pairwiseData,
    fundamentals: fundData,
    fundamentalsFetchedAt,
  } = data ?? {};

  const chartData = (history ?? []).map((row: Record<string, string | number | null>) => ({
    date: String(row.date),
    NU:   row.NU   as number | null,
    PAGS: row.PAGS as number | null,
    STNE: row.STNE as number | null,
  }));

  return (
    <div className="min-h-screen bg-[#F8FAFB] px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Trading · NU / PAGS / STNE
            </h1>
            <p className="text-[12px] text-slate-500 mt-0.5">
              CEDEAR relative-value · CCL-deflated · Cocos Capital
            </p>
            {dataAsOf && (
              <div className="text-[11px] text-slate-400 mt-0.5">
                Data as of <span className="text-slate-600">{dataAsOf}</span>
                {fetchedAt && <span className="ml-2">(fetched {new Date(fetchedAt).toLocaleString()})</span>}
              </div>
            )}
          </div>
          <button onClick={loadSignal} disabled={loading}
            className="ml-auto text-[12px] border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 rounded-lg transition-colors disabled:opacity-40">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="border border-red-200 bg-red-50 rounded-lg p-4">
            <div className="text-xs font-semibold text-red-700 mb-1 uppercase tracking-wider">Data Not Available</div>
            <pre className="text-xs text-red-600 whitespace-pre-wrap">{error}</pre>
            <div className="mt-3 text-xs text-slate-500">
              Run: <code className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs">python3 scripts/fetch_live.py</code> then refresh.
            </div>
          </div>
        )}

        {/* Holdings */}
        <div className="border border-slate-200 bg-white rounded-xl p-4">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-3 font-medium">
            Current Holdings · Cocos Capital
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {(['NU', 'PAGS', 'STNE'] as const).map((t) => (
              <div key={t}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold" style={{ color: TICKER_COLORS[t] }}>{t}.BA</span>
                  {prices?.ars[t] && (
                    <span className="text-[11px] text-slate-400">{ars(prices.ars[t])}/share</span>
                  )}
                </div>
                <input
                  type="number" min={0} value={holdings[t]}
                  onChange={(e) => setHoldings((prev) => ({ ...prev, [t]: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-400"
                  placeholder="shares"
                />
                {prices?.ars[t] && parseInt(holdings[t]) > 0 && (
                  <div className="text-[11px] text-slate-400 mt-1">
                    = {ars(parseInt(holdings[t]) * prices.ars[t])}
                  </div>
                )}
              </div>
            ))}
          </div>
          {portfolio?.hasHoldings && (
            <div className="border-t border-slate-100 pt-3 flex items-center gap-6 flex-wrap">
              <div>
                <div className="text-[11px] text-slate-400">Total</div>
                <div className="text-sm font-bold text-slate-800">{ars(portfolio.capital)}</div>
              </div>
              {(['NU', 'PAGS', 'STNE'] as const).map((t) => (
                <div key={t}>
                  <div className="text-[11px]" style={{ color: TICKER_COLORS[t] }}>{t}</div>
                  <div className="text-sm font-bold text-slate-700">{pctFmt(portfolio.currentWeights[t] ?? 0)}</div>
                </div>
              ))}
              <div className="ml-auto">
                <button onClick={loadSignal} disabled={loading}
                  className="text-[12px] bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40 font-medium">
                  Recalculate
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CCL Strip */}
        {ccl && prices && (
          <div className="border border-slate-200 bg-white rounded-xl px-4 py-3 flex items-center gap-8 flex-wrap">
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">CCL · AAPL anchor</div>
              <div className="text-base font-bold text-blue-600">
                {ccl.rate.toLocaleString('es-AR')} <span className="text-slate-400 font-normal text-xs">ARS/USD</span>
              </div>
              <div className="text-[11px] text-slate-400">{ccl.date}</div>
            </div>
            {(['NU', 'PAGS', 'STNE'] as const).map((t) => (
              <div key={t}>
                <div className="text-[11px]" style={{ color: TICKER_COLORS[t] }}>{t}.BA</div>
                <div className="text-sm font-medium text-slate-800">{ars(prices.ars[t])}</div>
                <div className="text-[11px] text-slate-400">≈ ${prices.usdEquiv[t]?.toFixed(2)} USD</div>
              </div>
            ))}
          </div>
        )}

        {/* Signal Card */}
        {signal && !loading && (
          <div className={`border rounded-xl p-5 ${REGIME_STYLE[signal.regime]}`}>
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <div className="text-sm font-semibold uppercase tracking-wider">
                {signal.shouldRebalance ? '⚡ Rebalance' : '✓ Hold — No Action'}
              </div>
              <span className={`text-[11px] px-2 py-0.5 border rounded uppercase tracking-wider font-medium ${REGIME_STYLE[signal.regime]}`}>
                {signal.regime}
              </span>
              <span className={`text-[11px] font-medium ml-auto ${
                signal.confidence === 'high' ? 'text-emerald-600' :
                signal.confidence === 'medium' ? 'text-amber-600' : 'text-slate-400'
              }`}>
                {signal.confidence} confidence
              </span>
            </div>
            <p className="text-sm leading-relaxed opacity-80">{signal.rebalanceReason}</p>
            {signal.corrWarnings.map((w, i) => (
              <div key={i} className="text-sm text-red-600 mt-1">⚠ {w}</div>
            ))}
            {signal.pairwiseMod !== undefined && signal.pairwiseMod !== 0 && (
              <div className={`text-sm mt-1 ${signal.pairwiseMod > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {signal.pairwiseMod > 0
                  ? '↑ Pairwise confirms basket signal (+confidence)'
                  : '↓ Pairwise conflicts with basket signal (−confidence)'}
              </div>
            )}
          </div>
        )}

        {/* Pairwise Ratio Z-Scores */}
        {pairwiseData && pairwiseData.length > 0 && (
          <div className="border border-slate-200 bg-white rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-3 font-medium">
              Pairwise Ratio Z-Scores · 60-day window
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-left pb-2 font-medium">Pair</th>
                    <th className="text-right pb-2 font-medium">Ratio</th>
                    <th className="text-right pb-2 font-medium">Z-Score</th>
                    <th className="text-right pb-2 font-medium">Corr</th>
                    <th className="text-right pb-2 font-medium">Signal</th>
                    <th className="text-left pb-2 pl-4 font-medium">Suggestion</th>
                  </tr>
                </thead>
                <tbody>
                  {pairwiseData.map((p) => {
                    const zColor = p.signalStrength === 'extreme' ? 'text-red-600'
                      : p.signalStrength === 'elevated' ? 'text-amber-600' : 'text-slate-400';
                    const corrColor = p.pearsonCorr >= 0.6 ? 'text-emerald-600'
                      : p.pearsonCorr >= 0.3 ? 'text-amber-600' : 'text-red-600';
                    return (
                      <tr key={p.pair} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 font-semibold text-slate-700">{p.pair}</td>
                        <td className="py-2 text-right text-slate-400">{p.currentRatio.toFixed(3)}</td>
                        <td className={`py-2 text-right font-semibold ${zColor}`}>
                          {p.currentZ !== null ? (p.currentZ > 0 ? '+' : '') + p.currentZ.toFixed(2) : '—'}
                        </td>
                        <td className={`py-2 text-right ${corrColor}`}>{p.pearsonCorr.toFixed(2)}</td>
                        <td className="py-2 text-right">
                          {p.signalStrength === 'none' ? <span className="text-slate-300">—</span> : (
                            <span className={`px-1.5 py-0.5 border rounded-md text-[10px] uppercase tracking-wider ${
                              p.signalStrength === 'extreme'
                                ? 'text-red-700 border-red-200 bg-red-50'
                                : 'text-amber-700 border-amber-200 bg-amber-50'
                            }`}>{p.signalStrength}</span>
                          )}
                        </td>
                        <td className="py-2 pl-4 text-slate-400 max-w-[220px] truncate">{p.suggestion}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-[11px] text-slate-300">
              Conflicts lower signal confidence · agreement raises it
            </div>
          </div>
        )}

        {/* Trade Cards */}
        {trades && (
          <div className="space-y-3">
            {trades.map((trade) => (
              <div key={trade.ticker} className={`border rounded-xl p-4 ${ACTION_STYLE[trade.action]}`}>
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="min-w-[80px]">
                    <div className="text-sm font-bold">{trade.ticker}.BA</div>
                    <div className="text-[11px] opacity-60 mt-0.5 uppercase tracking-wider">{trade.label}</div>
                    <div className="text-[11px] opacity-50 mt-0.5">z = {trade.zScore?.toFixed(2) ?? '—'}</div>
                    {trade.valuationSuppressed && (
                      <div className="text-[11px] text-amber-600 mt-0.5">⚠ val gate</div>
                    )}
                  </div>
                  <div className="text-xl font-bold w-14 pt-0.5">{trade.action}</div>
                  {trade.action !== 'HOLD' ? (
                    <div>
                      <div className="text-2xl font-bold">{trade.deltaShares}</div>
                      <div className="text-[11px] opacity-60">shares</div>
                    </div>
                  ) : (
                    <div className="pt-1"><div className="text-sm text-slate-400">no change</div></div>
                  )}
                  {portfolio?.hasHoldings && (
                    <div className="text-center">
                      <div className="text-[11px] opacity-50 mb-1">shares</div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="opacity-60">{trade.currentShares}</span>
                        <span className="opacity-40">→</span>
                        <span className="font-bold">{trade.targetShares}</span>
                      </div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-[11px] opacity-50 mb-1">weight</div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="opacity-60">{pctFmt(trade.currentWeight)}</span>
                      <span className="opacity-40">→</span>
                      <span className="font-bold">{pctFmt(trade.targetWeight)}</span>
                    </div>
                    <div className={`text-[11px] mt-0.5 ${
                      trade.deltaWeightPct > 0 ? 'text-emerald-600' :
                      trade.deltaWeightPct < 0 ? 'text-red-600' : 'opacity-40'
                    }`}>
                      {trade.deltaWeightPct > 0 ? '+' : ''}{pctFmt(trade.deltaWeightPct)}
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-[11px] opacity-50 mb-0.5">@ {ars(trade.arsPrice)}/share</div>
                    {trade.action !== 'HOLD' && (
                      <>
                        <div className="text-xs">Trade: {ars(trade.tradeValueARS)}</div>
                        <div className="text-[11px] opacity-60">Cocos fee: {ars(trade.cocosCostARS)}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cost Summary */}
        {costs && signal?.shouldRebalance && (
          <div className="border border-slate-200 bg-white rounded-xl px-4 py-3 grid grid-cols-3 gap-6">
            <div>
              <div className="text-[11px] text-slate-400 uppercase mb-1 font-medium">Total trade value</div>
              <div className="text-sm text-slate-700">{ars(costs.totalTradeValueARS)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 uppercase mb-1 font-medium">Cocos commission</div>
              <div className="text-sm text-red-600">{ars(costs.totalCocosCostARS)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 uppercase mb-1 font-medium">Cost vs portfolio</div>
              <div className="text-sm text-red-600">{costs.effectiveCostBps.toFixed(1)} bps</div>
            </div>
          </div>
        )}

        {/* Valuation Strip */}
        {fundData && (
          <details className="border border-slate-200 bg-white rounded-xl">
            <summary className="px-4 py-3 text-[11px] text-slate-400 cursor-pointer select-none uppercase tracking-wider flex items-center gap-2 font-medium">
              Valuation · Yahoo Finance
              {fundamentalsFetchedAt && (
                <span className="normal-case font-normal text-slate-300 ml-auto">
                  as of {new Date(fundamentalsFetchedAt).toLocaleDateString()}
                </span>
              )}
            </summary>
            <div className="px-4 pb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-left pb-2 font-medium">Ticker</th>
                    <th className="text-right pb-2 font-medium">P/E</th>
                    <th className="text-right pb-2 font-medium">EV/EBITDA</th>
                    <th className="text-right pb-2 font-medium">P/B</th>
                    <th className="text-right pb-2 font-medium">P/S</th>
                    <th className="text-right pb-2 font-medium">Target</th>
                    <th className="text-right pb-2 font-medium">Upside</th>
                  </tr>
                </thead>
                <tbody>
                  {(['NU', 'PAGS', 'STNE'] as const).map((t) => {
                    const f = fundData[t];
                    if (!f) return null;
                    const upsideColor = f.upside === null ? 'text-slate-400'
                      : f.upside > 0.15 ? 'text-emerald-600'
                      : f.upside < -0.15 ? 'text-red-600' : 'text-slate-700';
                    return (
                      <tr key={t} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 font-bold" style={{ color: TICKER_COLORS[t] }}>{t}</td>
                        <td className="py-2 text-right text-slate-600">{f.pe?.toFixed(1) ?? '—'}</td>
                        <td className="py-2 text-right text-slate-600">{f.evEbitda?.toFixed(1) ?? '—'}</td>
                        <td className="py-2 text-right text-slate-600">{f.pb?.toFixed(2) ?? '—'}</td>
                        <td className="py-2 text-right text-slate-600">{f.ps?.toFixed(2) ?? '—'}</td>
                        <td className="py-2 text-right text-slate-400">{f.targetPrice ? `$${f.targetPrice.toFixed(2)}` : '—'}</td>
                        <td className={`py-2 text-right font-semibold ${upsideColor}`}>
                          {f.upside !== null ? `${f.upside > 0 ? '+' : ''}${(f.upside * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-2 text-[11px] text-slate-300">
                Analyst consensus · delayed · run <code className="bg-slate-100 border border-slate-200 px-1 rounded">python3 scripts/fetch_fundamentals.py</code> to refresh
              </div>
            </div>
          </details>
        )}

        {/* Signal Config */}
        <details className="border border-slate-200 bg-white rounded-xl">
          <summary className="px-4 py-3 text-[11px] text-slate-400 cursor-pointer select-none uppercase tracking-wider font-medium">
            Signal Config
          </summary>
          <div className="px-4 pb-4 flex gap-4 flex-wrap items-end">
            <label className="block">
              <div className="text-[11px] text-slate-400 mb-1 uppercase font-medium">Lookback (days)</div>
              <select value={lookback} onChange={(e) => setLookback(parseInt(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-400">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </label>
            <label className="block">
              <div className="text-[11px] text-slate-400 mb-1 uppercase font-medium">Z Entry</div>
              <select value={zEntry} onChange={(e) => setZEntry(parseFloat(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-400">
                <option value={0.75}>0.75</option>
                <option value={1.0}>1.0</option>
                <option value={1.25}>1.25</option>
                <option value={1.5}>1.5</option>
              </select>
            </label>
            <label className="block">
              <div className="text-[11px] text-slate-400 mb-1 uppercase font-medium">Cocos fee (bps/side)</div>
              <input type="number" value={costBps} onChange={(e) => setCostBps(parseFloat(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-400 w-20" />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={valuationGate} onChange={(e) => setValuationGate(e.target.checked)}
                className="border-slate-200 bg-white text-blue-600 focus:ring-0 rounded" />
              <div>
                <div className="text-[11px] text-slate-600 uppercase font-medium">Valuation gate</div>
                <div className="text-[11px] text-slate-400">Suppress BUY if analyst target &lt; −15%</div>
              </div>
            </label>
          </div>
        </details>

        {/* Z-Score Sparkline */}
        {chartData.length > 0 && (
          <div className="border border-slate-200 bg-white rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 font-medium">
              Z-Score · Last 30 Days · USD-equivalent CCL-deflated
            </div>

            {/* Z-score explainer */}
            <details className="mb-3">
              <summary className="text-[11px] text-blue-600/70 cursor-pointer select-none hover:text-blue-600 transition-colors">
                What is this?
              </summary>
              <div className="mt-2 text-[11px] text-slate-500 leading-relaxed space-y-1.5 border-l-2 border-slate-100 pl-3">
                <p>
                  The <span className="text-slate-700">z-score</span> measures how far each stock&apos;s price is from its recent average, expressed in standard deviations.
                </p>
                <p>
                  <span className="text-slate-700">How it&apos;s built:</span> We take the USD-equivalent price of each CEDEAR (adjusted for CCL and ratio), compute the basket average, then measure each ticker&apos;s deviation from that average over a rolling {data?.config.lookback ?? 20}-day window.
                </p>
                <p>
                  <span className="text-slate-700">Reading the chart:</span> A ticker above the blue line (+{data?.config.zEntry ?? 1.0}σ) is <span className="text-red-600">RICH</span> — expensive relative to its peers. A ticker below the lower blue line is <span className="text-emerald-600">CHEAP</span>. The strategy sells rich and buys cheap, betting the spread will mean-revert.
                </p>
                <p>
                  <span className="text-slate-700">Why USD-equivalent?</span> NU.BA, STNE.BA, and PAGSd.BA are all ARS or USD CEDEARs with different ratios. Converting to USD removes the CCL (blue-chip dollar) noise so you&apos;re comparing actual company valuations, not Argentine peso moves.
                </p>
                <p className="text-slate-400">
                  Z = (price − rolling mean) / rolling std deviation. Values beyond ±1 trigger a rebalance signal. Values beyond ±1.5 are considered &quot;stretched&quot;.
                </p>
              </div>
            </details>

            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false} axisLine={false} width={28} />
                <ReferenceLine y={zEntry}  stroke="#2563EB" strokeDasharray="4 2" strokeWidth={0.8} />
                <ReferenceLine y={-zEntry} stroke="#2563EB" strokeDasharray="4 2" strokeWidth={0.8} />
                <ReferenceLine y={0}       stroke="#e2e8f0" strokeWidth={1} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', fontSize: 11, borderRadius: 8 }}
                  formatter={(v: unknown) => [(v as number)?.toFixed(2)]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {(['NU', 'PAGS', 'STNE'] as const).map((t) => (
                  <Line key={t} type="monotone" dataKey={t} dot={false} strokeWidth={1.5}
                    stroke={TICKER_COLORS[t]} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Rolling Correlations */}
        {data?.correlations && data.correlations.length > 0 && (
          <div className="border border-slate-200 bg-white rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 font-medium">
              Rolling 20-Day Correlations
            </div>
            <div className="text-[11px] text-slate-400 mb-3">
              Pearson correlation of daily returns. Above 0.6 = stocks moving together (strategy works). Below 0.3 = regime broken (no trades).
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.correlations as Record<string, string | number | null>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={[-0.2, 1]} tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false} axisLine={false} width={28} />
                <ReferenceLine y={0.6} stroke="#059669" strokeDasharray="4 2" strokeWidth={0.8} label={{ value: '0.6', fill: '#059669', fontSize: 9 }} />
                <ReferenceLine y={0.3} stroke="#D97706" strokeDasharray="4 2" strokeWidth={0.8} label={{ value: '0.3', fill: '#D97706', fontSize: 9 }} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', fontSize: 11, borderRadius: 8 }}
                  formatter={(v: unknown) => [(v as number)?.toFixed(2)]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="NU/PAGS"   dot={false} strokeWidth={1.5} stroke="#2563EB" connectNulls />
                <Line type="monotone" dataKey="NU/STNE"   dot={false} strokeWidth={1.5} stroke="#D97706" connectNulls />
                <Line type="monotone" dataKey="PAGS/STNE" dot={false} strokeWidth={1.5} stroke="#059669" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* USD Price History */}
        {data?.usdPrices && data.usdPrices.length > 0 && (
          <div className="border border-slate-200 bg-white rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 font-medium">
              Price History · USD-Equivalent
            </div>
            <div className="text-[11px] text-slate-400 mb-3">
              CEDEAR prices converted to USD via CCL anchor. Removes Argentine peso inflation and devaluation noise.
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.usdPrices as Record<string, string | number | null>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false} axisLine={false} width={36}
                  tickFormatter={(v: number) => `$${v.toFixed(1)}`} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', fontSize: 11, borderRadius: 8 }}
                  formatter={(v: unknown) => [`$${(v as number)?.toFixed(2)}`]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {(['NU', 'PAGS', 'STNE'] as const).map((t) => (
                  <Line key={t} type="monotone" dataKey={t} dot={false} strokeWidth={1.5}
                    stroke={TICKER_COLORS[t]} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* LTM Performance */}
        {data?.ltmPerformance && data.ltmPerformance.length > 0 && (
          <div className="border border-slate-200 bg-white rounded-xl p-4">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 font-medium">
              Price Performance · Last 12 Months · Rebased to 100
            </div>
            <div className="text-[11px] text-slate-400 mb-3">
              All three tickers indexed to 100 at the start of the period. Shows relative performance independent of price level.
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.ltmPerformance as Record<string, string | number | null>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false} axisLine={false} width={36}
                  tickFormatter={(v: number) => `${v.toFixed(0)}`} />
                <ReferenceLine y={100} stroke="#e2e8f0" strokeWidth={1} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', fontSize: 11, borderRadius: 8 }}
                  formatter={(v: unknown) => [`${(v as number)?.toFixed(1)}`]}
                  labelFormatter={(label) => `${label}`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {(['NU', 'PAGS', 'STNE'] as const).map((t) => (
                  <Line key={t} type="monotone" dataKey={t} dot={false} strokeWidth={1.5}
                    stroke={TICKER_COLORS[t]} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Footer */}
        <div className="text-[11px] text-slate-300 space-y-1 border-t border-slate-200 pt-4">
          <p><span className="text-slate-400">NU / STNE:</span> ARS CEDEARs deflated by CCL (AAPL anchor) and ratio. <span className="text-slate-400">PAGS:</span> PAGSd.BA (USD CEDEAR) for signal history; ARS price synthetic.</p>
          <p><span className="text-slate-400">Trade delta:</span> Computed from your actual holdings above. Update share counts after each trade.</p>
          <p className="text-amber-500/60">Research tool only. Not financial advice.</p>
        </div>

      </div>
    </div>
  );
}
