/**
 * GET /api/relative-value/live-signal
 *
 * Reads yfinance live data from data/live/ (written by scripts/fetch_live.py).
 *
 * CEDEAR details:
 *   NU.BA    — ARS, ratio 10:1  → usd_equiv = ARS / (CCL × 10)
 *   STNE.BA  — ARS, ratio 6.676 → usd_equiv = ARS / (CCL × 6.676)
 *   PAGSd.BA — USD CEDEAR → usd_equiv = USD / 0.3481
 *   PAGS.BA  — ARS CEDEAR (sparse) → synthetic ARS = PAGSd × CCL × 19.07
 *
 * Query params:
 *   lookback     z-score window days (default 20)
 *   zEntry       entry threshold (default 1.0)
 *   zExit        exit threshold (default 0.25)
 *   costBps      Cocos bps per side (default 50)
 *   nu           current NU.BA shares held (optional)
 *   pags         current PAGS.BA shares held (optional)
 *   stne         current STNE.BA shares held (optional)
 *   capital      fallback ARS capital if no holdings provided (default 300000)
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { computePairwiseRatios, pairwiseConfidenceModifier } from '@/lib/rv/pairwise-ratio';

const TICKERS: [string, string, string] = ['NU', 'PAGS', 'STNE'];
const LIVE_DIR = path.join(process.cwd(), 'data', 'live');

interface USDEquivEntry {
  date: string;
  ba_price: number | null;
  usd_equiv: number;
  ccl: number | null;
}
interface CCLFile {
  ccl_series: Array<{ date: string; rate: number }>;
  latest_ccl: { date: string; rate: number } | null;
  usd_equiv: Record<string, USDEquivEntry[]>;
}
interface LiveFile { ticker: string; bars: Array<{ date: string; close: number | null }>; fetchedAt: string }

interface FundamentalsFile {
  tickers: Record<string, {
    pe: number | null;
    forwardPe: number | null;
    evEbitda: number | null;
    pb: number | null;
    ps: number | null;
    targetPrice: number | null;
    currentPrice: number | null;
    upside: number | null;
    marketCap: number | null;
    name: string | null;
  }>;
  fetchedAt: string;
}

function readJSON(filename: string) {
  const p = path.join(LIVE_DIR, filename);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function rollingMean(series: number[], w: number): (number | null)[] {
  return series.map((_, i) => {
    if (i < w - 1) return null;
    return series.slice(i - w + 1, i + 1).reduce((a, b) => a + b, 0) / w;
  });
}
function rollingStd(series: number[], w: number): (number | null)[] {
  return series.map((_, i) => {
    if (i < w - 1) return null;
    const sl = series.slice(i - w + 1, i + 1);
    const m = sl.reduce((a, b) => a + b, 0) / w;
    return Math.sqrt(sl.reduce((a, b) => a + (b - m) ** 2, 0) / (w - 1));
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lookback     = Math.min(parseInt(searchParams.get('lookback') ?? '20'), 60);
    const zEntry       = parseFloat(searchParams.get('zEntry')   ?? '1.0');
    const zExit        = parseFloat(searchParams.get('zExit')    ?? '0.25');
    const costBps      = parseFloat(searchParams.get('costBps')  ?? '50');
    const fallbackCapital = parseFloat(searchParams.get('capital') ?? '300000');

    // Current holdings (shares) — optional; if provided, overrides capital
    const currentShares: Record<string, number | null> = {
      NU:   searchParams.has('nu')   ? parseInt(searchParams.get('nu')!)   : null,
      PAGS: searchParams.has('pags') ? parseInt(searchParams.get('pags')!) : null,
      STNE: searchParams.has('stne') ? parseInt(searchParams.get('stne')!) : null,
    };
    const hasHoldings = TICKERS.some((t) => currentShares[t] !== null);

    // ── 1. Load CCL + USD-equiv ──────────────────────────────────────────────
    const cclFile = readJSON('ccl.json') as CCLFile | null;
    if (!cclFile?.usd_equiv) {
      return NextResponse.json(
        { error: 'Live data missing.', instruction: 'Run: python3 scripts/fetch_live.py' },
        { status: 422 }
      );
    }

    const latestCCL = cclFile.latest_ccl;

    // ── 1b. Load fundamentals (optional — valuation gate) ────────────────────
    const fundamentalsFile = readJSON('fundamentals.json') as FundamentalsFile | null;
    const fundamentals = fundamentalsFile?.tickers ?? null;
    const useValuationGate = searchParams.get('valuationGate') === 'true';

    // ── 2. Build aligned USD-equiv price arrays ──────────────────────────────
    const usdEquivByDate: Record<string, Record<string, number>> = {};
    const arsPriceByDate: Record<string, Record<string, number>> = {};

    for (const ticker of TICKERS) {
      const series = cclFile.usd_equiv[ticker] ?? [];
      if (!series.length) {
        return NextResponse.json(
          { error: `No data for ${ticker}.`, instruction: 'Run: python3 scripts/fetch_live.py' },
          { status: 422 }
        );
      }
      for (const entry of series) {
        if (!usdEquivByDate[entry.date]) usdEquivByDate[entry.date] = {};
        if (!arsPriceByDate[entry.date]) arsPriceByDate[entry.date] = {};
        usdEquivByDate[entry.date][ticker] = entry.usd_equiv;
        if (entry.ba_price !== null) arsPriceByDate[entry.date][ticker] = entry.ba_price;
      }
    }

    const commonDates = Object.keys(usdEquivByDate)
      .filter((d) => TICKERS.every((t) => usdEquivByDate[d][t] !== undefined))
      .sort();

    if (commonDates.length < lookback + 5) {
      return NextResponse.json(
        { error: `Only ${commonDates.length} aligned days — need ${lookback + 5}.`, instruction: 'Run: python3 scripts/fetch_live.py' },
        { status: 422 }
      );
    }

    const n = commonDates.length;
    const usdEquivPrices: Record<string, number[]> = Object.fromEntries(
      TICKERS.map((t) => [t, commonDates.map((d) => usdEquivByDate[d][t])])
    );

    // Latest ARS prices (for trade sizing)
    const latestARS: Record<string, number> = Object.fromEntries(
      TICKERS.map((t) => {
        // Walk back to find most recent ARS price
        for (let i = commonDates.length - 1; i >= 0; i--) {
          const v = arsPriceByDate[commonDates[i]]?.[t];
          if (v) return [t, v];
        }
        return [t, 0];
      })
    );
    const latestUSD: Record<string, number> = Object.fromEntries(
      TICKERS.map((t) => [t, usdEquivPrices[t][n - 1]])
    );

    // ── 3. Equal-weight spread + z-score ─────────────────────────────────────
    const spreadSeries: Record<string, number[]> = Object.fromEntries(TICKERS.map((t) => [t, []]));
    for (let i = 0; i < n; i++) {
      const logs = Object.fromEntries(TICKERS.map((t) => [t, Math.log(usdEquivPrices[t][i])]));
      const avg = TICKERS.reduce((s, t) => s + logs[t], 0) / TICKERS.length;
      for (const t of TICKERS) spreadSeries[t].push(logs[t] - avg);
    }

    const zScoreSeries: Record<string, (number | null)[]> = {};
    for (const t of TICKERS) {
      const means = rollingMean(spreadSeries[t], lookback);
      const stds  = rollingStd(spreadSeries[t], lookback);
      zScoreSeries[t] = spreadSeries[t].map((s, i) => {
        const m = means[i], sd = stds[i];
        if (m === null || sd === null || sd < 1e-8) return null;
        return (s - m) / sd;
      });
    }

    const currentZ: Record<string, number | null> = Object.fromEntries(
      TICKERS.map((t) => {
        const valid = zScoreSeries[t].filter((v): v is number => v !== null);
        return [t, valid.at(-1) ?? null];
      })
    );

    // ── 4. Signal + target weights ────────────────────────────────────────────
    const sorted = [...TICKERS].sort((a, b) => (currentZ[a] ?? 0) - (currentZ[b] ?? 0));
    const cheapTicker   = sorted[0];
    const richTicker    = sorted[2];
    const neutralTicker = sorted[1];

    // ── 4b. Pairwise ratio z-scores (DCF Compare approach) ───────────────────
    const pairwise = computePairwiseRatios(usdEquivPrices, 60);
    const pairwiseMod = pairwiseConfidenceModifier(pairwise, richTicker, cheapTicker);

    // ── 4c. Valuation gate (optional) ────────────────────────────────────────
    // Suppresses BUY if analyst upside < -15% (ticker is overvalued per consensus)
    const valuationGate: Record<string, { upside: number | null; suppressed: boolean }> = Object.fromEntries(
      TICKERS.map((t) => {
        const upside = fundamentals?.[t]?.upside ?? null;
        const suppressed = useValuationGate && upside !== null && upside < -0.15;
        return [t, { upside, suppressed }];
      })
    );

    const K = 0.20;
    const maxAbsZ = Math.max(...TICKERS.map((t) => Math.abs(currentZ[t] ?? 0)), 0.01);
    const rawW    = Object.fromEntries(TICKERS.map((t) => [t, 1/3 + K * (-(currentZ[t] ?? 0) / maxAbsZ)]));
    const capped  = Object.fromEntries(TICKERS.map((t) => [t, Math.min(Math.max(rawW[t], 0), 0.6)]));
    const wSum    = Object.values(capped).reduce((a, b) => a + b, 0);
    const targetWeights: Record<string, number> = Object.fromEntries(
      TICKERS.map((t) => [t, capped[t] / wSum])
    );

    const maxAbsCurrentZ = Math.max(...TICKERS.map((t) => Math.abs(currentZ[t] ?? 0)));
    const shouldRebalance = maxAbsCurrentZ >= zEntry;

    // 20d correlation gate
    const corrWarnings: string[] = [];
    for (const [a, b] of [['NU','PAGS'],['NU','STNE'],['PAGS','STNE']] as [string,string][]) {
      const ra = usdEquivPrices[a].slice(-21).map((v,i,arr) => i > 0 ? (v-arr[i-1])/arr[i-1] : 0).slice(1);
      const rb = usdEquivPrices[b].slice(-21).map((v,i,arr) => i > 0 ? (v-arr[i-1])/arr[i-1] : 0).slice(1);
      const nn = Math.min(ra.length, rb.length);
      const ma = ra.slice(0,nn).reduce((s,v)=>s+v,0)/nn;
      const mb = rb.slice(0,nn).reduce((s,v)=>s+v,0)/nn;
      const num = ra.slice(0,nn).reduce((s,v,i)=>s+(v-ma)*(rb[i]-mb),0);
      const da  = Math.sqrt(ra.slice(0,nn).reduce((s,v)=>s+(v-ma)**2,0));
      const db  = Math.sqrt(rb.slice(0,nn).reduce((s,v)=>s+(v-mb)**2,0));
      const corr = da>0&&db>0 ? num/(da*db) : 0;
      if (corr < 0.3) corrWarnings.push(`${a}/${b} 20d correlation = ${corr.toFixed(2)} (below 0.3 gate)`);
    }
    const regime: 'normal'|'stretched'|'broken' =
      corrWarnings.length > 0 ? 'broken' : maxAbsCurrentZ >= 1.5 ? 'stretched' : 'normal';

    // Confidence: base from z-score, adjusted by pairwise confirmation (+/- 0.2)
    const baseConf = regime === 'broken' ? 0 : maxAbsCurrentZ >= 1.5 ? 1 : maxAbsCurrentZ >= zEntry ? 0.5 : 0;
    const adjConf  = baseConf + pairwiseMod;
    const confidence: 'high'|'medium'|'low' = adjConf >= 0.8 ? 'high' : adjConf >= 0.4 ? 'medium' : 'low';

    // ── 5. Portfolio + trade sizing ───────────────────────────────────────────
    // If user provided holdings: compute capital from market value
    // Otherwise: use fallback capital with equal-weight assumption
    let capital: number;
    let currentWeights: Record<string, number>;
    let currentShareCount: Record<string, number>;

    if (hasHoldings) {
      const values = Object.fromEntries(
        TICKERS.map((t) => [t, (currentShares[t] ?? 0) * (latestARS[t] || 0)])
      );
      capital = Object.values(values).reduce((a, b) => a + b, 0);
      currentWeights = Object.fromEntries(
        TICKERS.map((t) => [t, capital > 0 ? values[t] / capital : 1/3])
      );
      currentShareCount = Object.fromEntries(TICKERS.map((t) => [t, currentShares[t] ?? 0]));
    } else {
      capital = fallbackCapital;
      currentWeights = Object.fromEntries(TICKERS.map((t) => [t, 1/3]));
      currentShareCount = Object.fromEntries(TICKERS.map((t) => [t, 0]));
    }

    const trades = TICKERS.map((t) => {
      const arsPrice   = latestARS[t];
      const currW      = currentWeights[t];
      const targW      = targetWeights[t];
      const deltaARS   = (targW - currW) * capital;
      const deltaPct   = targW - currW;

      // Shares to trade (round to nearest whole share)
      const deltaShares = arsPrice > 0 ? Math.round(deltaARS / arsPrice) : 0;
      const targetShares = currentShareCount[t] + deltaShares;
      const tradeValueARS = Math.abs(deltaShares * arsPrice);
      const cocosCost = (costBps / 10000) * tradeValueARS;

      // Apply valuation gate: suppress BUY if ticker is flagged overvalued
      const rawAction = (deltaARS > arsPrice * 0.5 ? 'BUY' : deltaARS < -arsPrice * 0.5 ? 'SELL' : 'HOLD') as 'BUY'|'SELL'|'HOLD';
      const gated = valuationGate[t]?.suppressed && rawAction === 'BUY';
      const action: 'BUY'|'SELL'|'HOLD' = gated ? 'HOLD' : rawAction;

      return {
        ticker:         t,
        action,
        currentShares:  currentShareCount[t],
        deltaShares:    Math.abs(deltaShares),
        deltaDirection: deltaShares,
        targetShares,
        arsPrice,
        usdEquiv:       latestUSD[t],
        currentWeight:  currW,
        targetWeight:   targW,
        deltaWeightPct: deltaPct,
        tradeValueARS,
        cocosCostARS:   cocosCost,
        zScore:         currentZ[t],
        label:          (t === richTicker ? 'RICH' : t === cheapTicker ? 'CHEAP' : 'NEUTRAL') as 'RICH'|'CHEAP'|'NEUTRAL',
        valuationSuppressed: gated,
      };
    });

    const totalCocosCost  = trades.reduce((s, t) => s + t.cocosCostARS, 0);
    const totalTradeValue = trades.reduce((s, t) => s + t.tradeValueARS, 0);

    // ── 6. Sparkline history ─────────────────────────────────────────────────
    const history = commonDates.slice(-30).map((date, ii) => {
      const idx = n - 30 + ii;
      const row: Record<string, string|number|null> = { date };
      for (const t of TICKERS) {
        row[t]        = zScoreSeries[t][idx] ?? null;
        row[`usd_${t}`] = usdEquivPrices[t][idx] ?? null;
      }
      return row;
    });

    const baFile = readJSON('NU_BA.json') as LiveFile | null;

    return NextResponse.json({
      dataAsOf:   commonDates[n - 1],
      fetchedAt:  baFile?.fetchedAt ?? null,
      ccl:        latestCCL,
      prices:     { ars: latestARS, usdEquiv: latestUSD },
      portfolio:  { capital, currentWeights, currentShares: currentShareCount, hasHoldings },
      signal: {
        regime, richTicker, cheapTicker, neutralTicker,
        zScores: currentZ, targetWeights,
        shouldRebalance: shouldRebalance && regime !== 'broken',
        rebalanceReason: shouldRebalance
          ? `Max |z| = ${maxAbsCurrentZ.toFixed(2)} ≥ ${zEntry}. ${richTicker} rich (z=${currentZ[richTicker]?.toFixed(2)}), ${cheapTicker} cheap (z=${currentZ[cheapTicker]?.toFixed(2)}).`
          : `Max |z| = ${maxAbsCurrentZ.toFixed(2)} < ${zEntry}. Spread within range — hold.`,
        corrWarnings,
        confidence,
        pairwiseMod,
      },
      trades,
      costs: {
        capital,
        totalTradeValueARS: totalTradeValue,
        totalCocosCostARS:  totalCocosCost,
        effectiveCostBps:   totalTradeValue > 0 ? parseFloat(((totalCocosCost / capital) * 10000).toFixed(1)) : 0,
        costBpsPerSide:     costBps,
      },
      config: { lookback, zEntry, zExit, costBps },
      history,
      pairwise: pairwise.map((p) => ({
        pair:           p.pair,
        tickerA:        p.tickerA,
        tickerB:        p.tickerB,
        currentRatio:   p.currentRatio,
        currentZ:       p.currentZ,
        pearsonCorr:    p.pearsonCorr,
        direction:      p.direction,
        signalStrength: p.signalStrength,
        suggestion:     p.suggestion,
      })),
      fundamentals: fundamentals ? Object.fromEntries(
        TICKERS.map((t) => [t, {
          pe:           fundamentals[t]?.pe ?? null,
          evEbitda:     fundamentals[t]?.evEbitda ?? null,
          pb:           fundamentals[t]?.pb ?? null,
          ps:           fundamentals[t]?.ps ?? null,
          targetPrice:  fundamentals[t]?.targetPrice ?? null,
          currentPrice: fundamentals[t]?.currentPrice ?? null,
          upside:       fundamentals[t]?.upside ?? null,
        }])
      ) : null,
      valuationGate,
      fundamentalsFetchedAt: fundamentalsFile?.fetchedAt ?? null,
    });

  } catch (err) {
    console.error('[live-signal]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
