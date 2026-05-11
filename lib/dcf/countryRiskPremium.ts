/**
 * Country Risk Premium (CRP) table — Damodaran, January 2025.
 * Source: https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/ctryprem.html
 *
 * Applied as: cost_of_equity = rf + β × (ERP_mature + CRP)
 * where ERP_mature = 4.6% (config/valuation.config.ts)
 *
 * Mature markets (developed economies with investment-grade sovereign ratings) → 0%
 * All values expressed as decimals (e.g., 0.034 = 3.4%)
 * Update annually.
 */

export const CRP_TABLE: Record<string, number> = {
  // ── Mature markets ────────────────────────────────────────────────────────
  USD: 0,     // United States
  EUR: 0,     // Eurozone (Germany, France, Netherlands, etc.)
  GBP: 0,     // United Kingdom
  JPY: 0,     // Japan
  CAD: 0,     // Canada
  AUD: 0,     // Australia
  CHF: 0,     // Switzerland
  SEK: 0,     // Sweden
  NOK: 0,     // Norway
  DKK: 0,     // Denmark
  NZD: 0,     // New Zealand
  SGD: 0,     // Singapore
  HKD: 0,     // Hong Kong

  // ── Emerging / Frontier ──────────────────────────────────────────────────
  BRL: 0.0340,  // Brazil
  CNY: 0.0072,  // China
  INR: 0.0325,  // India
  MXN: 0.0229,  // Mexico
  ZAR: 0.0338,  // South Africa
  KRW: 0.0051,  // South Korea
  TWD: 0.0044,  // Taiwan
  ILS: 0.0088,  // Israel
  TRY: 0.0458,  // Turkey
  ARS: 0.1541,  // Argentina
  IDR: 0.0176,  // Indonesia
  PHP: 0.0125,  // Philippines
  THB: 0.0044,  // Thailand
  MYR: 0.0059,  // Malaysia
  CLP: 0.0059,  // Chile
  COP: 0.0257,  // Colombia
  PEN: 0.0103,  // Peru
  VND: 0.0229,  // Vietnam
  EGP: 0.0636,  // Egypt
  NGN: 0.0891,  // Nigeria
  PKR: 0.0891,  // Pakistan
  BDT: 0.0325,  // Bangladesh
  UAH: 0.0891,  // Ukraine
  RON: 0.0088,  // Romania
  CZK: 0.0051,  // Czech Republic
  HUF: 0.0125,  // Hungary
  PLN: 0.0044,  // Poland
  SAR: 0.0044,  // Saudi Arabia (pegged to USD, low risk)
  AED: 0.0044,  // UAE
  QAR: 0.0044,  // Qatar
  KWD: 0.0044,  // Kuwait
  CNH: 0.0072,  // Offshore CNY
}

/** Returns the CRP for the given currency. Falls back to 1% for unknown currencies. */
export function getCRP(currency: string): number {
  return CRP_TABLE[currency.toUpperCase()] ?? 0.01
}
