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

const TICKER_COLORS: Record<string, string> = { NU: '#60a5fa', PAGS: '#34d399', STNE: '#f59e0b' };

const REGIME_STYLE: Record<string, string> = {
  normal:    'text-green-400 border-green-400/30 bg-green-400/5',
  stretched: 'text-amber-400 border-amber-400/30 bg-amber-400/5',
  broken:    'text-red-400 border-red-400/30 bg-red-400/5',
};

const ACTION_STYLE: Record<string, string> = {
  BUY:  'bg-green-500/10 border-green-500/40 text-green-400',
  SELL: 'bg-red-500/10 border-red-500/40 text-red-400',
  HOLD: 'bg-[#111] border-[#222] text-[#888]',
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
    <div className="min-h-screen bg-[#080808] px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap border-b border-[#ff6600]/20 pb-4">
          <div>
            <h1 className="font-mono text-sm font-bold text-[#ff6600] uppercase tracking-widest">
              Trading · NU / PAGS / STNE
            </h1>
            <p className="font-mono text-[11px] text-[#555] mt-0.5">
              CEDEAR relative-value · CCL-deflated · Cocos Capital
            </p>
            {dataAsOf && (
              <div className="font-mono text-[10px] text-[#444] mt-0.5">
                Data as of <span className="text-[#666]">{dataAsOf}</span>
                {fetchedAt && <span className="ml-2">(fetched {new Date(fetchedAt).toLocaleString()})</span>}
              </div>
            )}
          </div>
          <button onClick={loadSignal} disabled={loading}
            className="ml-auto font-mono text-[11px] border border-[#ff6600]/40 text-[#ff6600] hover:bg-[#ff6600]/10 px-3 py-1 transition-colors disabled:opacity-40 uppercase tracking-wider">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="border border-red-500/30 bg-red-500/5 p-4">
            <div className="font-mono text-xs font-bold text-red-400 mb-1 uppercase tracking-wider">Data Not Available</div>
            <pre className="font-mono text-xs text-red-300/70 whitespace-pre-wrap">{error}</pre>
            <div className="mt-3 font-mono text-xs text-[#555]">
              Run: <code className="bg-[#111] border border-[#333] px-2 py-0.5">python3 scripts/fetch_live.py</code> then refresh.
            </div>
          </div>
        )}

        {/* Holdings */}
        <div className="border border-[#1e1e1e] bg-[#0a0a0a] p-4">
          <div className="font-mono text-[10px] text-[#555] uppercase tracking-widest mb-3">
            Current Holdings · Cocos Capital
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {(['NU', 'PAGS', 'STNE'] as const).map((t) => (
              <div key={t}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold" style={{ color: TICKER_COLORS[t] }}>{t}.BA</span>
                  {prices?.ars[t] && (
                    <span className="font-mono text-[10px] text-[#444]">{ars(prices.ars[t])}/share</span>
                  )}
                </div>
                <input
                  type="number" min={0} value={holdings[t]}
                  onChange={(e) => setHoldings((prev) => ({ ...prev, [t]: e.target.value }))}
                  className="w-full bg-[#111] border border-[#333] text-[#e0e0e0] text-sm font-mono px-3 py-2 focus:outline-none focus:border-[#ff6600]/60"
                  placeholder="shares"
                />
                {prices?.ars[t] && parseInt(holdings[t]) > 0 && (
                  <div className="font-mono text-[10px] text-[#444] mt-1">
                    = {ars(parseInt(holdings[t]) * prices.ars[t])}
                  </div>
                )}
              </div>
            ))}
          </div>
          {portfolio?.hasHoldings && (
            <div className="border-t border-[#1e1e1e] pt-3 flex items-center gap-6 flex-wrap">
              <div>
                <div className="font-mono text-[10px] text-[#444]">Total</div>
                <div className="font-mono text-sm font-bold text-[#e0e0e0]">{ars(portfolio.capital)}</div>
              </div>
              {(['NU', 'PAGS', 'STNE'] as const).map((t) => (
                <div key={t}>
                  <div className="font-mono text-[10px]" style={{ color: TICKER_COLORS[t] }}>{t}</div>
                  <div className="font-mono text-sm font-bold text-[#ccc]">{pctFmt(portfolio.currentWeights[t] ?? 0)}</div>
                </div>
              ))}
              <div className="ml-auto">
                <button onClick={loadSignal} disabled={loading}
                  className="font-mono text-[11px] bg-[#ff6600] hover:bg-[#cc5200] text-black px-4 py-1.5 transition-colors disabled:opacity-40 uppercase tracking-wider font-bold">
                  Recalculate
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CCL Strip */}
        {ccl && prices && (
          <div className="border border-[#1e1e1e] bg-[#0a0a0a] px-4 py-3 flex items-center gap-8 flex-wrap">
            <div>
              <div className="font-mono text-[10px] text-[#444] uppercase tracking-wider">CCL · AAPL anchor</div>
              <div className="font-mono text-base font-bold text-[#ff6600]">
                {ccl.rate.toLocaleString('es-AR')} <span className="text-[#444] font-normal text-xs">ARS/USD</span>
              </div>
              <div className="font-mono text-[10px] text-[#333]">{ccl.date}</div>
            </div>
            {(['NU', 'PAGS', 'STNE'] as const).map((t) => (
              <div key={t}>
                <div className="font-mono text-[10px]" style={{ color: TICKER_COLORS[t] }}>{t}.BA</div>
                <div className="font-mono text-sm font-medium text-[#e0e0e0]">{ars(prices.ars[t])}</div>
                <div className="font-mono text-[10px] text-[#444]">≈ ${prices.usdEquiv[t]?.toFixed(2)} USD</div>
              </div>
            ))}
          </div>
        )}

        {/* Signal Card */}
        {signal && !loading && (
          <div className={`border p-5 ${REGIME_STYLE[signal.regime]}`}>
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <div className="font-mono text-sm font-bold uppercase tracking-wider">
                {signal.shouldRebalance ? '⚡ Rebalance' : '✓ Hold — No Action'}
              </div>
              <span className={`font-mono text-[10px] px-2 py-0.5 border uppercase tracking-wider ${REGIME_STYLE[signal.regime]}`}>
                {signal.regime}
              </span>
              <span className={`font-mono text-[10px] font-medium ml-auto ${
                signal.confidence === 'high' ? 'text-green-400' :
                signal.confidence === 'medium' ? 'text-amber-400' : 'text-[#555]'
              }`}>
                {signal.confidence} confidence
              </span>
            </div>
            <p className="font-mono text-xs leading-relaxed opacity-80">{signal.rebalanceReason}</p>
            {signal.corrWarnings.map((w, i) => (
              <div key={i} className="font-mono text-xs text-red-400 mt-1">⚠ {w}</div>
            ))}
            {signal.pairwiseMod !== undefined && signal.pairwiseMod !== 0 && (
              <div className={`font-mono text-xs mt-1 ${signal.pairwiseMod > 0 ? 'text-green-400' : 'text-amber-400'}`}>
                {signal.pairwiseMod > 0
                  ? '↑ Pairwise confirms basket signal (+confidence)'
                  : '↓ Pairwise conflicts with basket signal (−confidence)'}
              </div>
            )}
          </div>
        )}

        {/* Pairwise Ratio Z-Scores */}
        {pairwiseData && pairwiseData.length > 0 && (
          <div className="border border-[#1e1e1e] bg-[#0a0a0a] p-4">
            <div className="font-mono text-[10px] text-[#555] uppercase tracking-widest mb-3">
              Pairwise Ratio Z-Scores · 60-day window
            </div>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="text-[#444] border-b border-[#1e1e1e]">
                    <th className="text-left pb-2 font-normal">Pair</th>
                    <th className="text-right pb-2 font-normal">Ratio</th>
                    <th className="text-right pb-2 font-normal">Z-Score</th>
                    <th className="text-right pb-2 font-normal">Corr</th>
                    <th className="text-right pb-2 font-normal">Signal</th>
                    <th className="text-left pb-2 pl-4 font-normal">Suggestion</th>
                  </tr>
                </thead>
                <tbody>
                  {pairwiseData.map((p) => {
                    const zColor = p.signalStrength === 'extreme' ? 'text-red-400'
                      : p.signalStrength === 'elevated' ? 'text-amber-400' : 'text-[#555]';
                    const corrColor = p.pearsonCorr >= 0.6 ? 'text-green-400'
                      : p.pearsonCorr >= 0.3 ? 'text-amber-400' : 'text-red-400';
                    return (
                      <tr key={p.pair} className="border-b border-[#111] last:border-0">
                        <td className="py-2 font-bold text-[#ccc]">{p.pair}</td>
                        <td className="py-2 text-right text-[#555]">{p.currentRatio.toFixed(3)}</td>
                        <td className={`py-2 text-right font-bold ${zColor}`}>
                          {p.currentZ !== null ? (p.currentZ > 0 ? '+' : '') + p.currentZ.toFixed(2) : '—'}
                        </td>
                        <td className={`py-2 text-right ${corrColor}`}>{p.pearsonCorr.toFixed(2)}</td>
                        <td className="py-2 text-right">
                          {p.signalStrength === 'none' ? <span className="text-[#333]">—</span> : (
                            <span className={`px-1.5 py-0.5 border text-[10px] uppercase tracking-wider ${
                              p.signalStrength === 'extreme'
                                ? 'text-red-400 border-red-400/30 bg-red-400/5'
                                : 'text-amber-400 border-amber-400/30 bg-amber-400/5'
                            }`}>{p.signalStrength}</span>
                          )}
                        </td>
                        <td className="py-2 pl-4 text-[#444] max-w-[220px] truncate">{p.suggestion}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 font-mono text-[10px] text-[#333]">
              Conflicts lower signal confidence · agreement raises it
            </div>
          </div>
        )}

        {/* Trade Cards */}
        {trades && (
          <div className="space-y-3">
            {trades.map((trade) => (
              <div key={trade.ticker} className={`border p-4 ${ACTION_STYLE[trade.action]}`}>
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="min-w-[80px]">
                    <div className="font-mono text-sm font-bold">{trade.ticker}.BA</div>
                    <div className="font-mono text-[10px] opacity-60 mt-0.5 uppercase tracking-wider">{trade.label}</div>
                    <div className="font-mono text-[10px] opacity-50 mt-0.5">z = {trade.zScore?.toFixed(2) ?? '—'}</div>
                    {trade.valuationSuppressed && (
                      <div className="font-mono text-[10px] text-amber-400 mt-0.5">⚠ val gate</div>
                    )}
                  </div>
                  <div className="font-mono text-xl font-bold w-14 pt-0.5">{trade.action}</div>
                  {trade.action !== 'HOLD' ? (
                    <div>
                      <div className="font-mono text-2xl font-bold">{trade.deltaShares}</div>
                      <div className="font-mono text-[10px] opacity-60">shares</div>
                    </div>
                  ) : (
                    <div className="pt-1"><div className="font-mono text-sm text-[#555]">no change</div></div>
                  )}
                  {portfolio?.hasHoldings && (
                    <div className="text-center">
                      <div className="font-mono text-[10px] opacity-50 mb-1">shares</div>
                      <div className="flex items-center gap-1.5 font-mono text-sm">
                        <span className="opacity-60">{trade.currentShares}</span>
                        <span className="opacity-40">→</span>
                        <span className="font-bold">{trade.targetShares}</span>
                      </div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="font-mono text-[10px] opacity-50 mb-1">weight</div>
                    <div className="flex items-center gap-1.5 font-mono text-sm">
                      <span className="opacity-60">{pctFmt(trade.currentWeight)}</span>
                      <span className="opacity-40">→</span>
                      <span className="font-bold">{pctFmt(trade.targetWeight)}</span>
                    </div>
                    <div className={`font-mono text-[10px] mt-0.5 ${
                      trade.deltaWeightPct > 0 ? 'text-green-400' :
                      trade.deltaWeightPct < 0 ? 'text-red-400' : 'opacity-40'
                    }`}>
                      {trade.deltaWeightPct > 0 ? '+' : ''}{pctFmt(trade.deltaWeightPct)}
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="font-mono text-[10px] opacity-50 mb-0.5">@ {ars(trade.arsPrice)}/share</div>
                    {trade.action !== 'HOLD' && (
                      <>
                        <div className="font-mono text-xs">Trade: {ars(trade.tradeValueARS)}</div>
                        <div className="font-mono text-[10px] opacity-60">Cocos fee: {ars(trade.cocosCostARS)}</div>
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
          <div className="border border-[#1e1e1e] bg-[#0a0a0a] px-4 py-3 grid grid-cols-3 gap-6">
            <div>
              <div className="font-mono text-[10px] text-[#444] uppercase mb-1">Total trade value</div>
              <div className="font-mono text-sm text-[#ccc]">{ars(costs.totalTradeValueARS)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-[#444] uppercase mb-1">Cocos commission</div>
              <div className="font-mono text-sm text-red-400">{ars(costs.totalCocosCostARS)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-[#444] uppercase mb-1">Cost vs portfolio</div>
              <div className="font-mono text-sm text-red-400">{costs.effectiveCostBps.toFixed(1)} bps</div>
            </div>
          </div>
        )}

        {/* Valuation Strip */}
        {fundData && (
          <details className="border border-[#1e1e1e] bg-[#0a0a0a]">
            <summary className="px-4 py-3 font-mono text-[10px] text-[#555] cursor-pointer select-none uppercase tracking-widest flex items-center gap-2">
              Valuation · Yahoo Finance
              {fundamentalsFetchedAt && (
                <span className="normal-case font-normal text-[#333] ml-auto">
                  as of {new Date(fundamentalsFetchedAt).toLocaleDateString()}
                </span>
              )}
            </summary>
            <div className="px-4 pb-4">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="text-[#444] border-b border-[#1e1e1e]">
                    <th className="text-left pb-2 font-normal">Ticker</th>
                    <th className="text-right pb-2 font-normal">P/E</th>
                    <th className="text-right pb-2 font-normal">EV/EBITDA</th>
                    <th className="text-right pb-2 font-normal">P/B</th>
                    <th className="text-right pb-2 font-normal">P/S</th>
                    <th className="text-right pb-2 font-normal">Target</th>
                    <th className="text-right pb-2 font-normal">Upside</th>
                  </tr>
                </thead>
                <tbody>
                  {(['NU', 'PAGS', 'STNE'] as const).map((t) => {
                    const f = fundData[t];
                    if (!f) return null;
                    const upsideColor = f.upside === null ? 'text-[#444]'
                      : f.upside > 0.15 ? 'text-green-400'
                      : f.upside < -0.15 ? 'text-red-400' : 'text-[#ccc]';
                    return (
                      <tr key={t} className="border-b border-[#111] last:border-0">
                        <td className="py-2 font-bold" style={{ color: TICKER_COLORS[t] }}>{t}</td>
                        <td className="py-2 text-right text-[#aaa]">{f.pe?.toFixed(1) ?? '—'}</td>
                        <td className="py-2 text-right text-[#aaa]">{f.evEbitda?.toFixed(1) ?? '—'}</td>
                        <td className="py-2 text-right text-[#aaa]">{f.pb?.toFixed(2) ?? '—'}</td>
                        <td className="py-2 text-right text-[#aaa]">{f.ps?.toFixed(2) ?? '—'}</td>
                        <td className="py-2 text-right text-[#666]">{f.targetPrice ? `$${f.targetPrice.toFixed(2)}` : '—'}</td>
                        <td className={`py-2 text-right font-bold ${upsideColor}`}>
                          {f.upside !== null ? `${f.upside > 0 ? '+' : ''}${(f.upside * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-2 font-mono text-[10px] text-[#333]">
                Analyst consensus · delayed · run <code className="bg-[#111] border border-[#222] px-1">python3 scripts/fetch_fundamentals.py</code> to refresh
              </div>
            </div>
          </details>
        )}

        {/* Signal Config */}
        <details className="border border-[#1e1e1e] bg-[#0a0a0a]">
          <summary className="px-4 py-3 font-mono text-[10px] text-[#555] cursor-pointer select-none uppercase tracking-widest">
            Signal Config
          </summary>
          <div className="px-4 pb-4 flex gap-4 flex-wrap items-end">
            <label className="block">
              <div className="font-mono text-[10px] text-[#444] mb-1 uppercase">Lookback (days)</div>
              <select value={lookback} onChange={(e) => setLookback(parseInt(e.target.value))}
                className="bg-[#111] border border-[#333] text-[#e0e0e0] font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-[#ff6600]/60">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </label>
            <label className="block">
              <div className="font-mono text-[10px] text-[#444] mb-1 uppercase">Z Entry</div>
              <select value={zEntry} onChange={(e) => setZEntry(parseFloat(e.target.value))}
                className="bg-[#111] border border-[#333] text-[#e0e0e0] font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-[#ff6600]/60">
                <option value={0.75}>0.75</option>
                <option value={1.0}>1.0</option>
                <option value={1.25}>1.25</option>
                <option value={1.5}>1.5</option>
              </select>
            </label>
            <label className="block">
              <div className="font-mono text-[10px] text-[#444] mb-1 uppercase">Cocos fee (bps/side)</div>
              <input type="number" value={costBps} onChange={(e) => setCostBps(parseFloat(e.target.value))}
                className="bg-[#111] border border-[#333] text-[#e0e0e0] font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-[#ff6600]/60 w-20" />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={valuationGate} onChange={(e) => setValuationGate(e.target.checked)}
                className="border-[#333] bg-[#111] text-[#ff6600] focus:ring-0" />
              <div>
                <div className="font-mono text-[10px] text-[#aaa] uppercase">Valuation gate</div>
                <div className="font-mono text-[10px] text-[#333]">Suppress BUY if analyst target &lt; −15%</div>
              </div>
            </label>
          </div>
        </details>

        {/* Z-Score Sparkline */}
        {chartData.length > 0 && (
          <div className="border border-[#1e1e1e] bg-[#0a0a0a] p-4">
            <div className="font-mono text-[10px] text-[#555] uppercase tracking-widest mb-1">
              Z-Score · Last 30 Days · USD-equivalent CCL-deflated
            </div>

            {/* Z-score explainer */}
            <details className="mb-3">
              <summary className="font-mono text-[10px] text-[#ff6600]/70 cursor-pointer select-none hover:text-[#ff6600] transition-colors">
                What is this?
              </summary>
              <div className="mt-2 font-mono text-[10px] text-[#555] leading-relaxed space-y-1.5 border-l border-[#222] pl-3">
                <p>
                  The <span className="text-[#aaa]">z-score</span> measures how far each stock&apos;s price is from its recent average, expressed in standard deviations.
                </p>
                <p>
                  <span className="text-[#aaa]">How it&apos;s built:</span> We take the USD-equivalent price of each CEDEAR (adjusted for CCL and ratio), compute the basket average, then measure each ticker&apos;s deviation from that average over a rolling {data?.config.lookback ?? 20}-day window.
                </p>
                <p>
                  <span className="text-[#aaa]">Reading the chart:</span> A ticker above the orange line (+{data?.config.zEntry ?? 1.0}σ) is <span className="text-red-400">RICH</span> — expensive relative to its peers. A ticker below the lower orange line is <span className="text-green-400">CHEAP</span>. The strategy sells rich and buys cheap, betting the spread will mean-revert.
                </p>
                <p>
                  <span className="text-[#aaa]">Why USD-equivalent?</span> NU.BA, STNE.BA, and PAGSd.BA are all ARS or USD CEDEARs with different ratios. Converting to USD removes the CCL (blue-chip dollar) noise so you&apos;re comparing actual company valuations, not Argentine peso moves.
                </p>
                <p className="text-[#333]">
                  Z = (price − rolling mean) / rolling std deviation. Values beyond ±1 trigger a rebalance signal. Values beyond ±1.5 are considered &quot;stretched&quot;.
                </p>
              </div>
            </details>

            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#141414" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#444', fontFamily: 'monospace' }}
                  tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#444', fontFamily: 'monospace' }}
                  tickLine={false} axisLine={false} width={28} />
                <ReferenceLine y={zEntry}  stroke="#ff6600" strokeDasharray="4 2" strokeWidth={0.8} />
                <ReferenceLine y={-zEntry} stroke="#ff6600" strokeDasharray="4 2" strokeWidth={0.8} />
                <ReferenceLine y={0}       stroke="#222" strokeWidth={1} />
                <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #222', fontSize: 10, fontFamily: 'monospace' }}
                  formatter={(v: unknown) => [(v as number)?.toFixed(2)]} />
                <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }} />
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
          <div className="border border-[#1e1e1e] bg-[#0a0a0a] p-4">
            <div className="font-mono text-[10px] text-[#555] uppercase tracking-widest mb-1">
              Rolling 20-Day Correlations
            </div>
            <div className="font-mono text-[10px] text-[#333] mb-3">
              Pearson correlation of daily returns. Above 0.6 = stocks moving together (strategy works). Below 0.3 = regime broken (no trades).
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.correlations as Record<string, string | number | null>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#141414" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#444', fontFamily: 'monospace' }}
                  tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={[-0.2, 1]} tick={{ fontSize: 9, fill: '#444', fontFamily: 'monospace' }}
                  tickLine={false} axisLine={false} width={28} />
                <ReferenceLine y={0.6} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={0.8} label={{ value: '0.6', fill: '#22c55e', fontSize: 8, fontFamily: 'monospace' }} />
                <ReferenceLine y={0.3} stroke="#ff6600" strokeDasharray="4 2" strokeWidth={0.8} label={{ value: '0.3', fill: '#ff6600', fontSize: 8, fontFamily: 'monospace' }} />
                <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #222', fontSize: 10, fontFamily: 'monospace' }}
                  formatter={(v: unknown) => [(v as number)?.toFixed(2)]} />
                <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }} />
                <Line type="monotone" dataKey="NU/PAGS"   dot={false} strokeWidth={1.5} stroke="#60a5fa" connectNulls />
                <Line type="monotone" dataKey="NU/STNE"   dot={false} strokeWidth={1.5} stroke="#f59e0b" connectNulls />
                <Line type="monotone" dataKey="PAGS/STNE" dot={false} strokeWidth={1.5} stroke="#34d399" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* USD Price History */}
        {data?.usdPrices && data.usdPrices.length > 0 && (
          <div className="border border-[#1e1e1e] bg-[#0a0a0a] p-4">
            <div className="font-mono text-[10px] text-[#555] uppercase tracking-widest mb-1">
              Price History · USD-Equivalent
            </div>
            <div className="font-mono text-[10px] text-[#333] mb-3">
              CEDEAR prices converted to USD via CCL anchor. Removes Argentine peso inflation and devaluation noise.
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.usdPrices as Record<string, string | number | null>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#141414" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#444', fontFamily: 'monospace' }}
                  tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#444', fontFamily: 'monospace' }}
                  tickLine={false} axisLine={false} width={36}
                  tickFormatter={(v: number) => `$${v.toFixed(1)}`} />
                <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #222', fontSize: 10, fontFamily: 'monospace' }}
                  formatter={(v: unknown) => [`$${(v as number)?.toFixed(2)}`]} />
                <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }} />
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
          <div className="border border-[#1e1e1e] bg-[#0a0a0a] p-4">
            <div className="font-mono text-[10px] text-[#555] uppercase tracking-widest mb-1">
              Price Performance · Last 12 Months · Rebased to 100
            </div>
            <div className="font-mono text-[10px] text-[#333] mb-3">
              All three tickers indexed to 100 at the start of the period. Shows relative performance independent of price level.
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.ltmPerformance as Record<string, string | number | null>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#141414" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#444', fontFamily: 'monospace' }}
                  tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#444', fontFamily: 'monospace' }}
                  tickLine={false} axisLine={false} width={36}
                  tickFormatter={(v: number) => `${v.toFixed(0)}`} />
                <ReferenceLine y={100} stroke="#333" strokeWidth={1} />
                <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #222', fontSize: 10, fontFamily: 'monospace' }}
                  formatter={(v: unknown) => [`${(v as number)?.toFixed(1)}`]}
                  labelFormatter={(label) => `${label}`} />
                <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }} />
                {(['NU', 'PAGS', 'STNE'] as const).map((t) => (
                  <Line key={t} type="monotone" dataKey={t} dot={false} strokeWidth={1.5}
                    stroke={TICKER_COLORS[t]} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Footer */}
        <div className="font-mono text-[10px] text-[#333] space-y-1 border-t border-[#1a1a1a] pt-4">
          <p><span className="text-[#444]">NU / STNE:</span> ARS CEDEARs deflated by CCL (AAPL anchor) and ratio. <span className="text-[#444]">PAGS:</span> PAGSd.BA (USD CEDEAR) for signal history; ARS price synthetic.</p>
          <p><span className="text-[#444]">Trade delta:</span> Computed from your actual holdings above. Update share counts after each trade.</p>
          <p className="text-amber-600/60">Research tool only. Not financial advice.</p>
        </div>

      </div>
    </div>
  );
}
