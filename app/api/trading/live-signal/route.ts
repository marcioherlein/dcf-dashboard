/**
 * GET /api/trading/live-signal
 *
 * Fetches live CEDEAR data directly from Yahoo Finance via yahoo-finance2.
 * No local files needed — works on Vercel.
 *
 * CEDEAR mechanics:
 *   CCL = AAPL.BA / AAPL   (most liquid ARS/USD implicit rate)
 *   NU.BA    ratio 10:1    → usd_equiv = ARS_price / (CCL × 10)
 *   STNE.BA  ratio 6.676:1 → usd_equiv = ARS_price / (CCL × 6.676)
 *   PAGSd.BA ratio 0.3481  → already USD → usd_equiv = USD / 0.3481
 *   PAGS.BA  (ARS, sparse) → synthetic ARS = PAGSd.BA_USD × CCL × (6.64/0.3481)
 *
 * Query params:
 *   lookback   z-score window in days (default 20, max 60)
 *   zEntry     entry threshold (default 1.0)
 *   zExit      exit threshold (default 0.25)
 *   costBps    Cocos fee bps per side (default 50)
 *   nu         current NU.BA shares held (optional)
 *   pags       current PAGS.BA shares held (optional)
 *   stne       current STNE.BA shares held (optional)
 *   capital    fallback ARS capital if no holdings provided (default 300000)
 *   valuationGate  'true' to suppress BUY when analyst upside < -15%
 */

import { NextRequest, NextResponse } from 'next/server';
import { computePairwiseRatios, pairwiseConfidenceModifier } from '@/lib/rv/pairwise-ratio';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });

const TICKERS: [string, string, string] = ['NU', 'PAGS', 'STNE'];

// CEDEAR ratios: ARS_price / (CCL × ratio) = USD_equiv
const CEDEAR_RATIO: Record<string, number> = {
  'NU.BA':    10.0,
  'STNE.BA':  6.676,
  'PAGSd.BA': 0.3481, // already USD-denominated
};

// How many calendar days of history to fetch (≥ lookback + pairwise_window + buffer)
const HISTORY_DAYS = 120;

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

async function fetchDaily(symbol: string, days: number): Promise<{ date: string; close: number }[]> {
  const period2 = new Date();
  const period1 = new Date();
  period1.setDate(period1.getDate() - days);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await yf.historical(symbol, {
    period1: period1.toISOString().split('T')[0],
    period2: period2.toISOString().split('T')[0],
    interval: '1d',
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows
    .filter((r: any) => r.close != null)
    .map((r: any) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
      close: r.close as number,
    }))
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFund(q: any) {
  if (!q) return null;
  const current = q.regularMarketPrice ?? null;
  const target  = q.targetMeanPrice    ?? null;
  const upside  = current && target && current > 0 ? (target - current) / current : null;
  return {
    pe:           q.trailingPE ?? null,
    evEbitda:     q.enterpriseToEbitda ?? null,
    pb:           q.priceToBook ?? null,
    ps:           q.priceToSalesTrailing12Months ?? null,
    targetPrice:  target,
    currentPrice: current,
    upside,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lookback        = Math.min(parseInt(searchParams.get('lookback') ?? '20'), 60);
    const zEntry          = parseFloat(searchParams.get('zEntry')   ?? '1.0');
    const zExit           = parseFloat(searchParams.get('zExit')    ?? '0.25');
    const costBps         = parseFloat(searchParams.get('costBps')  ?? '50');
    const fallbackCapital = parseFloat(searchParams.get('capital')  ?? '300000');
    const useValuationGate = searchParams.get('valuationGate') === 'true';

    const currentShares: Record<string, number | null> = {
      NU:   searchParams.has('nu')   ? parseInt(searchParams.get('nu')!)   : null,
      PAGS: searchParams.has('pags') ? parseInt(searchParams.get('pags')!) : null,
      STNE: searchParams.has('stne') ? parseInt(searchParams.get('stne')!) : null,
    };
    const hasHoldings = TICKERS.some((t) => currentShares[t] !== null);

    // ── 1. Fetch all historical series in parallel ────────────────────────────
    const [
      aaplBA, aapl,
      nuBA, stneBA, pagsDBA,
      nuQ, pagsQ, stneQ,
    ] = await Promise.all([
      fetchDaily('AAPL.BA',  HISTORY_DAYS),
      fetchDaily('AAPL',     HISTORY_DAYS),
      fetchDaily('NU.BA',    HISTORY_DAYS),
      fetchDaily('STNE.BA',  HISTORY_DAYS),
      fetchDaily('PAGSd.BA', HISTORY_DAYS),
      // Live quotes for fundamentals
      yf.quote('NU').catch(() => null),
      yf.quote('PAGS').catch(() => null),
      yf.quote('STNE').catch(() => null),
    ]);

    if (!aaplBA.length || !aapl.length) {
      return NextResponse.json({ error: 'Could not fetch AAPL/AAPL.BA from Yahoo Finance.' }, { status: 502 });
    }

    // ── 2. Compute daily CCL from AAPL.BA / AAPL ─────────────────────────────
    const aaplBAByDate = Object.fromEntries(aaplBA.map((r) => [r.date, r.close]));
    const aaplByDate   = Object.fromEntries(aapl.map((r) => [r.date, r.close]));

    const cclByDate: Record<string, number> = {};
    for (const date of Object.keys(aaplBAByDate)) {
      const usd = aaplByDate[date];
      if (usd && usd > 0) cclByDate[date] = aaplBAByDate[date] / usd;
    }

    // Fill forward CCL for days AAPL.BA traded but AAPL didn't (Argentine holiday vs US holiday)
    const cclDates = Object.keys(cclByDate).sort();
    let lastCCL = cclDates.length ? cclByDate[cclDates[0]] : null;
    if (!lastCCL) {
      return NextResponse.json({ error: 'Could not compute CCL from AAPL anchor.' }, { status: 502 });
    }

    // ── 3. Build USD-equivalent series ───────────────────────────────────────
    const nuBAByDate   = Object.fromEntries(nuBA.map((r) => [r.date, r.close]));
    const stneBAByDate = Object.fromEntries(stneBA.map((r) => [r.date, r.close]));
    const pagsDByDate  = Object.fromEntries(pagsDBA.map((r) => [r.date, r.close]));

    // Collect all dates where we have at least NU.BA, STNE.BA, and PAGSd.BA
    const allDates = Array.from(new Set([
      ...Object.keys(nuBAByDate),
      ...Object.keys(stneBAByDate),
      ...Object.keys(pagsDByDate),
    ])).sort();

    const usdEquivByDate: Record<string, Record<string, number>> = {};
    const arsPriceByDate: Record<string, Record<string, number>> = {};

    for (const date of allDates) {
      // Fill-forward CCL: find nearest prior date
      let ccl = cclByDate[date];
      if (!ccl) {
        // Find most recent CCL before this date
        const prior = cclDates.filter((d) => d <= date).at(-1);
        ccl = prior ? cclByDate[prior] : (lastCCL ?? 0);
      }
      if (!ccl || ccl <= 0) continue;
      lastCCL = ccl;

      const nuPrice   = nuBAByDate[date];
      const stnePrice = stneBAByDate[date];
      const pagsUSD   = pagsDByDate[date];

      if (!nuPrice || !stnePrice || !pagsUSD) continue;

      // ARS prices for trade sizing
      arsPriceByDate[date] = {
        NU:   nuPrice,
        STNE: stnePrice,
        PAGS: pagsUSD * ccl * (6.64 / 0.3481), // synthetic ARS
      };

      // USD-equivalent for signal computation
      usdEquivByDate[date] = {
        NU:   nuPrice   / (ccl * CEDEAR_RATIO['NU.BA']),
        STNE: stnePrice / (ccl * CEDEAR_RATIO['STNE.BA']),
        PAGS: pagsUSD   / CEDEAR_RATIO['PAGSd.BA'],
      };
    }

    const commonDates = Object.keys(usdEquivByDate)
      .filter((d) => TICKERS.every((t) => usdEquivByDate[d][t] !== undefined))
      .sort();

    if (commonDates.length < lookback + 5) {
      return NextResponse.json(
        { error: `Only ${commonDates.length} aligned trading days found. Need ${lookback + 5}.` },
        { status: 422 }
      );
    }

    const n = commonDates.length;
    const usdEquivPrices: Record<string, number[]> = Object.fromEntries(
      TICKERS.map((t) => [t, commonDates.map((d) => usdEquivByDate[d][t])])
    );

    // Latest prices
    const latestDate = commonDates[n - 1];
    const latestCCLRate = (() => {
      const prior = cclDates.filter((d) => d <= latestDate).at(-1);
      return prior ? cclByDate[prior] : 0;
    })();
    const latestARS: Record<string, number> = Object.fromEntries(
      TICKERS.map((t) => {
        for (let i = n - 1; i >= 0; i--) {
          const v = arsPriceByDate[commonDates[i]]?.[t];
          if (v) return [t, v];
        }
        return [t, 0];
      })
    );
    const latestUSD: Record<string, number> = Object.fromEntries(
      TICKERS.map((t) => [t, usdEquivPrices[t][n - 1]])
    );

    // ── 4. Basket z-score ────────────────────────────────────────────────────
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

    // ── 5. Signal ────────────────────────────────────────────────────────────
    const sorted      = [...TICKERS].sort((a, b) => (currentZ[a] ?? 0) - (currentZ[b] ?? 0));
    const cheapTicker = sorted[0];
    const richTicker  = sorted[2];
    const neutralTicker = sorted[1];

    const pairwise    = computePairwiseRatios(usdEquivPrices, 60);
    const pairwiseMod = pairwiseConfidenceModifier(pairwise, richTicker, cheapTicker);

    // Fundamentals from live quotes
    const fundamentals = {
      NU:   extractFund(nuQ),
      PAGS: extractFund(pagsQ),
      STNE: extractFund(stneQ),
    };

    const valuationGate: Record<string, { upside: number | null; suppressed: boolean }> = Object.fromEntries(
      TICKERS.map((t) => {
        const upside = fundamentals[t as keyof typeof fundamentals]?.upside ?? null;
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
      if (corr < 0.3) corrWarnings.push(`${a}/${b} 20d corr = ${corr.toFixed(2)} (below 0.3 gate)`);
    }
    const regime: 'normal'|'stretched'|'broken' =
      corrWarnings.length > 0 ? 'broken' : maxAbsCurrentZ >= 1.5 ? 'stretched' : 'normal';

    const baseConf = regime === 'broken' ? 0 : maxAbsCurrentZ >= 1.5 ? 1 : maxAbsCurrentZ >= zEntry ? 0.5 : 0;
    const adjConf  = baseConf + pairwiseMod;
    const confidence: 'high'|'medium'|'low' = adjConf >= 0.8 ? 'high' : adjConf >= 0.4 ? 'medium' : 'low';

    // ── 6. Portfolio + trade sizing ───────────────────────────────────────────
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
      const arsPrice    = latestARS[t];
      const currW       = currentWeights[t];
      const targW       = targetWeights[t];
      const deltaARS    = (targW - currW) * capital;
      const deltaShares = arsPrice > 0 ? Math.round(deltaARS / arsPrice) : 0;
      const targetSharesFinal = currentShareCount[t] + deltaShares;
      const tradeValueARS = Math.abs(deltaShares * arsPrice);
      const cocosCost = (costBps / 10000) * tradeValueARS;

      const rawAction = (deltaARS > arsPrice * 0.5 ? 'BUY' : deltaARS < -arsPrice * 0.5 ? 'SELL' : 'HOLD') as 'BUY'|'SELL'|'HOLD';
      const gated = valuationGate[t]?.suppressed && rawAction === 'BUY';
      const action: 'BUY'|'SELL'|'HOLD' = gated ? 'HOLD' : rawAction;

      return {
        ticker: t, action,
        currentShares:  currentShareCount[t],
        deltaShares:    Math.abs(deltaShares),
        deltaDirection: deltaShares,
        targetShares:   targetSharesFinal,
        arsPrice, usdEquiv: latestUSD[t],
        currentWeight: currW, targetWeight: targW,
        deltaWeightPct: targW - currW,
        tradeValueARS, cocosCostARS: cocosCost,
        zScore: currentZ[t],
        label: (t === richTicker ? 'RICH' : t === cheapTicker ? 'CHEAP' : 'NEUTRAL') as 'RICH'|'CHEAP'|'NEUTRAL',
        valuationSuppressed: gated,
      };
    });

    const totalCocosCost  = trades.reduce((s, t) => s + t.cocosCostARS, 0);
    const totalTradeValue = trades.reduce((s, t) => s + t.tradeValueARS, 0);

    // ── 7. Sparkline ─────────────────────────────────────────────────────────
    const history = commonDates.slice(-30).map((date, ii) => {
      const idx = n - 30 + ii;
      const row: Record<string, string|number|null> = { date };
      for (const t of TICKERS) row[t] = zScoreSeries[t][idx] ?? null;
      return row;
    });

    return NextResponse.json({
      dataAsOf:  latestDate,
      fetchedAt: new Date().toISOString(),
      ccl:       { date: latestDate, rate: latestCCLRate },
      prices:    { ars: latestARS, usdEquiv: latestUSD },
      portfolio: { capital, currentWeights, currentShares: currentShareCount, hasHoldings },
      signal: {
        regime, richTicker, cheapTicker, neutralTicker,
        zScores: currentZ, targetWeights,
        shouldRebalance: shouldRebalance && regime !== 'broken',
        rebalanceReason: shouldRebalance
          ? `Max |z| = ${maxAbsCurrentZ.toFixed(2)} ≥ ${zEntry}. ${richTicker} rich (z=${currentZ[richTicker]?.toFixed(2)}), ${cheapTicker} cheap (z=${currentZ[cheapTicker]?.toFixed(2)}).`
          : `Max |z| = ${maxAbsCurrentZ.toFixed(2)} < ${zEntry}. Spread within range — hold.`,
        corrWarnings, confidence, pairwiseMod,
      },
      trades,
      costs: {
        capital, totalTradeValueARS: totalTradeValue,
        totalCocosCostARS: totalCocosCost,
        effectiveCostBps: totalTradeValue > 0 ? parseFloat(((totalCocosCost / capital) * 10000).toFixed(1)) : 0,
        costBpsPerSide: costBps,
      },
      config: { lookback, zEntry, zExit, costBps },
      history,
      pairwise: pairwise.map((p) => ({
        pair: p.pair, tickerA: p.tickerA, tickerB: p.tickerB,
        currentRatio: p.currentRatio, currentZ: p.currentZ,
        pearsonCorr: p.pearsonCorr, direction: p.direction,
        signalStrength: p.signalStrength, suggestion: p.suggestion,
      })),
      fundamentals,
      valuationGate,
      fundamentalsFetchedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[trading/live-signal]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
