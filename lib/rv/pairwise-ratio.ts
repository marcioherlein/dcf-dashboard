/**
 * Pairwise price ratio z-score analysis for NU / PAGS / STNE.
 *
 * Mirrors the approach in the DCF dashboard Compare page:
 *   - Normalize price series to a common base
 *   - Compute A/B ratio
 *   - Rolling z-score of ratio: (ratio - mean) / std
 *   - Divergence signal at |z| ≥ 1.5 (elevated) and |z| ≥ 2.0 (extreme)
 *   - Pearson correlation as co-movement health indicator
 *
 * Used in live-signal route to confirm or discount the basket spread signal.
 */

export type PairDirection = 'A_RICH' | 'B_RICH' | 'NEUTRAL';
export type PairSignalStrength = 'none' | 'elevated' | 'extreme';

export interface PairwiseResult {
  pair: string;      // e.g. "NU/PAGS"
  tickerA: string;
  tickerB: string;
  /** Current ratio value (priceA / priceB) */
  currentRatio: number;
  /** Rolling z-score of ratio (current value) */
  currentZ: number | null;
  /** Full ratio series aligned to input dates */
  ratioSeries: number[];
  /** Full rolling z-score series (null for first window-1 entries) */
  zScoreSeries: (number | null)[];
  /** Pearson correlation of price levels */
  pearsonCorr: number;
  /** Which side is currently expensive */
  direction: PairDirection;
  /** Signal strength based on |z| */
  signalStrength: PairSignalStrength;
  /** Human-readable trade suggestion */
  suggestion: string;
}

/** Pearson correlation coefficient between two equal-length arrays */
function pearsonCorr(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const mb = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da  += (a[i] - ma) ** 2;
    db  += (b[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / (Math.sqrt(da) * Math.sqrt(db)) : 0;
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

/**
 * Compute pairwise ratio z-scores for all 3 pairs of the basket.
 *
 * @param prices  Map of ticker → USD-equivalent price series (same length, aligned)
 * @param window  Rolling window for z-score (default 60 days)
 * @returns       Array of PairwiseResult, one per pair
 */
export function computePairwiseRatios(
  prices: Record<string, number[]>,
  window = 60
): PairwiseResult[] {
  const PAIRS: [string, string][] = [
    ['NU', 'PAGS'],
    ['NU', 'STNE'],
    ['PAGS', 'STNE'],
  ];

  return PAIRS.map(([tickerA, tickerB]) => {
    const a = prices[tickerA];
    const b = prices[tickerB];

    if (!a?.length || !b?.length) {
      return {
        pair: `${tickerA}/${tickerB}`,
        tickerA, tickerB,
        currentRatio: 0,
        currentZ: null,
        ratioSeries: [],
        zScoreSeries: [],
        pearsonCorr: 0,
        direction: 'NEUTRAL' as PairDirection,
        signalStrength: 'none' as PairSignalStrength,
        suggestion: 'Insufficient data',
      };
    }

    const n = Math.min(a.length, b.length);
    const ratioSeries = Array.from({ length: n }, (_, i) =>
      b[i] > 0 ? a[i] / b[i] : 0
    );

    const means = rollingMean(ratioSeries, window);
    const stds  = rollingStd(ratioSeries, window);
    const zScoreSeries: (number | null)[] = ratioSeries.map((r, i) => {
      const m = means[i];
      const s = stds[i];
      if (m === null || s === null || s < 1e-8) return null;
      return (r - m) / s;
    });

    const currentRatio = ratioSeries[n - 1];
    const currentZ     = zScoreSeries[n - 1] ?? null;
    const corr         = pearsonCorr(a.slice(0, n), b.slice(0, n));

    // Direction: positive z → A is expensive relative to B
    let direction: PairDirection = 'NEUTRAL';
    if (currentZ !== null) {
      if (currentZ > 0.3) direction = 'A_RICH';
      else if (currentZ < -0.3) direction = 'B_RICH';
    }

    const absZ = currentZ !== null ? Math.abs(currentZ) : 0;
    const signalStrength: PairSignalStrength =
      absZ >= 2.0 ? 'extreme' : absZ >= 1.5 ? 'elevated' : 'none';

    let suggestion = 'No divergence';
    if (signalStrength !== 'none') {
      if (direction === 'A_RICH') {
        suggestion = `${tickerA} rich vs ${tickerB} (z=${currentZ?.toFixed(2)}) — reduce ${tickerA}, add ${tickerB}`;
      } else if (direction === 'B_RICH') {
        suggestion = `${tickerB} rich vs ${tickerA} (z=${currentZ?.toFixed(2)}) — reduce ${tickerB}, add ${tickerA}`;
      }
    }

    return {
      pair: `${tickerA}/${tickerB}`,
      tickerA, tickerB,
      currentRatio,
      currentZ,
      ratioSeries,
      zScoreSeries,
      pearsonCorr: corr,
      direction,
      signalStrength,
      suggestion,
    };
  });
}

/**
 * Derive a confidence modifier (-0.2 to +0.2) based on how well the pairwise
 * results confirm the basket spread signal.
 *
 * @param pairwise   Output of computePairwiseRatios
 * @param basketRich Ticker identified as richest by basket z-score
 * @param basketCheap Ticker identified as cheapest by basket z-score
 */
export function pairwiseConfidenceModifier(
  pairwise: PairwiseResult[],
  basketRich: string,
  basketCheap: string
): number {
  let confirmations = 0;
  let contradictions = 0;

  for (const p of pairwise) {
    if (p.signalStrength === 'none') continue;
    // Does this pair involve the rich and cheap tickers?
    const involvesRich  = p.tickerA === basketRich  || p.tickerB === basketRich;
    const involvesCheap = p.tickerA === basketCheap || p.tickerB === basketCheap;
    if (!involvesRich && !involvesCheap) continue;

    // Check if direction agrees with basket signal
    const richIsA    = p.tickerA === basketRich;
    const cheapIsA   = p.tickerA === basketCheap;
    const agreesRich  = (richIsA  && p.direction === 'A_RICH') || (!richIsA  && p.direction === 'B_RICH');
    const agreesCheap = (cheapIsA && p.direction === 'B_RICH') || (!cheapIsA && p.direction === 'A_RICH');

    if (agreesRich || agreesCheap) confirmations++;
    else contradictions++;
  }

  if (confirmations > contradictions) return 0.2;
  if (contradictions > confirmations) return -0.2;
  return 0;
}
