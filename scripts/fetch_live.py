#!/usr/bin/env python3
"""
Fetch live daily prices for NU/PAGS/STNE CEDEARs from yfinance.

CEDEAR details (BYMA):
  NU.BA    — ARS, ratio 10:1     (10 NU.BA = 1 NU share)
  STNE.BA  — ARS, ratio 6.676:1
  PAGS.BA  — ARS, ratio 6.64:1  ← sparse on yfinance; use PAGSd.BA as proxy
  PAGSd.BA — USD CEDEAR, ratio 0.3481:1

CCL anchor: AAPL.BA / AAPL (1:1 ratio, reliable)

USD-equivalent prices:
  NU_usd   = NU.BA_ars   / (CCL × 10)
  STNE_usd = STNE.BA_ars / (CCL × 6.676)
  PAGS_usd = PAGSd.BA_usd / 0.3481   ← already USD, just un-ratio

ARS price for trade sizing:
  NU_ars   = NU.BA_ars   (direct)
  STNE_ars = STNE.BA_ars (direct)
  PAGS_ars = PAGSd.BA_usd × CCL × (6.64 / 0.3481)  ← synthetic PAGS.BA ARS price

Usage:
    python3 scripts/fetch_live.py

Requires:
    pip install yfinance pandas
"""

import yfinance as yf
import json
import os
from datetime import datetime, timedelta
import pandas as pd

DATA_DIR = "data/live"
os.makedirs(DATA_DIR, exist_ok=True)

# CCL anchor
CCL_ANCHOR_BA  = "AAPL.BA"
CCL_ANCHOR_USD = "AAPL"

# Tickers to fetch
FETCH_TICKERS = [
    CCL_ANCHOR_BA, CCL_ANCHOR_USD,
    "NU.BA", "NU",
    "STNE.BA", "STNE",
    "PAGSd.BA", "PAGS",   # PAGSd.BA = USD CEDEAR (good history); PAGS = NYSE ADR
    "PAGS.BA",            # ARS CEDEAR (sparse — fetch anyway for current price)
]

LOOKBACK_DAYS = 400

# CEDEAR config used by the API route
CEDEAR_CONFIG = {
    "NU":   {"baFile": "NU_BA.json",     "currency": "ARS", "ratio": 10.0,   "arsRatio": 10.0},
    "STNE": {"baFile": "STNE_BA.json",   "currency": "ARS", "ratio": 6.676,  "arsRatio": 6.676},
    "PAGS": {"baFile": "PAGSd_BA.json",  "currency": "USD", "ratio": 0.3481, "arsRatio": 6.64},
}


def fetch_history(ticker: str, days: int) -> list[dict]:
    end = datetime.today()
    start = end - timedelta(days=days + 30)
    try:
        df = yf.download(
            ticker,
            start=start.strftime("%Y-%m-%d"),
            end=end.strftime("%Y-%m-%d"),
            auto_adjust=True,
            progress=False,
        )
        if df.empty:
            print(f"  WARNING: no data for {ticker}")
            return []
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        records = []
        for date, row in df.iterrows():
            close = row.get("Close")
            if pd.isna(close):
                continue
            records.append({
                "date":   date.strftime("%Y-%m-%d"),
                "open":   float(row["Open"])   if not pd.isna(row.get("Open",   float("nan"))) else None,
                "high":   float(row["High"])   if not pd.isna(row.get("High",   float("nan"))) else None,
                "low":    float(row["Low"])     if not pd.isna(row.get("Low",    float("nan"))) else None,
                "close":  float(close),
                "volume": float(row["Volume"]) if not pd.isna(row.get("Volume", float("nan"))) else None,
            })
        records.sort(key=lambda r: r["date"])
        return records
    except Exception as e:
        print(f"  ERROR fetching {ticker}: {e}")
        return []


def save_json(path: str, data: object) -> None:
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Fetch all tickers
# ─────────────────────────────────────────────────────────────────────────────

all_bars: dict[str, list[dict]] = {}

for ticker in FETCH_TICKERS:
    print(f"Fetching {ticker}…")
    bars = fetch_history(ticker, LOOKBACK_DAYS)
    all_bars[ticker] = bars
    safe = ticker.replace(".", "_")
    save_json(os.path.join(DATA_DIR, f"{safe}.json"), {
        "ticker": ticker,
        "bars": bars,
        "fetchedAt": datetime.now().isoformat(),
    })
    print(f"  {len(bars)} bars  →  data/live/{safe}.json")

# ─────────────────────────────────────────────────────────────────────────────
# 2. CCL from AAPL anchor
# ─────────────────────────────────────────────────────────────────────────────

print("\nComputing CCL from AAPL.BA / AAPL anchor…")

aapl_ba_map  = {r["date"]: r["close"] for r in all_bars.get(CCL_ANCHOR_BA, [])  if r["close"]}
aapl_usd_map = {r["date"]: r["close"] for r in all_bars.get(CCL_ANCHOR_USD, []) if r["close"]}

ccl_series: list[dict] = []
for date in sorted(set(aapl_ba_map) & set(aapl_usd_map)):
    usd = aapl_usd_map[date]
    if usd > 0:
        ccl_series.append({"date": date, "rate": round(aapl_ba_map[date] / usd, 4)})

latest_ccl  = ccl_series[-1] if ccl_series else None
ccl_map     = {e["date"]: e["rate"] for e in ccl_series}

if latest_ccl:
    print(f"  Latest CCL: {latest_ccl['rate']:.2f} ARS/USD  ({latest_ccl['date']})")

# ─────────────────────────────────────────────────────────────────────────────
# 3. USD-equivalent + ARS price series per ticker
# ─────────────────────────────────────────────────────────────────────────────

print("\nComputing USD-equivalent and ARS prices…")

usd_equiv: dict[str, list[dict]] = {}

# ── NU ───────────────────────────────────────────────────────────────────────
nu_ba = {r["date"]: r["close"] for r in all_bars.get("NU.BA", []) if r["close"]}
nu_series = []
for date, ars_price in nu_ba.items():
    ccl = ccl_map.get(date)
    if ccl and ccl > 0:
        nu_series.append({
            "date": date,
            "ba_price": ars_price,          # ARS — what you trade on Cocos
            "usd_equiv": round(ars_price / (ccl * 10.0), 4),
            "ccl": ccl,
        })
usd_equiv["NU"] = nu_series
if nu_series:
    last = nu_series[-1]
    print(f"  NU: {last['ba_price']:,.0f} ARS  →  ${last['usd_equiv']:.2f} USD  (CCL {last['ccl']:.2f})")

# ── STNE ─────────────────────────────────────────────────────────────────────
stne_ba = {r["date"]: r["close"] for r in all_bars.get("STNE.BA", []) if r["close"]}
stne_series = []
for date, ars_price in stne_ba.items():
    ccl = ccl_map.get(date)
    if ccl and ccl > 0:
        stne_series.append({
            "date": date,
            "ba_price": ars_price,
            "usd_equiv": round(ars_price / (ccl * 6.676), 4),
            "ccl": ccl,
        })
usd_equiv["STNE"] = stne_series
if stne_series:
    last = stne_series[-1]
    print(f"  STNE: {last['ba_price']:,.0f} ARS  →  ${last['usd_equiv']:.2f} USD  (CCL {last['ccl']:.2f})")

# ── PAGS (use PAGSd.BA USD CEDEAR for history; synthetic ARS for trade sizing) ──
pags_d_ba = {r["date"]: r["close"] for r in all_bars.get("PAGSd.BA", []) if r["close"]}
# ARS CEDEAR current price (sparse — just use latest if available, else synthetic)
pags_ars_latest = None
pags_ars_bars = [r for r in all_bars.get("PAGS.BA", []) if r["close"]]
if pags_ars_bars:
    pags_ars_latest = pags_ars_bars[-1]["close"]

pags_series = []
PAGS_USD_RATIO = 0.3481   # 1 PAGSd.BA = 0.3481 PAGS shares
PAGS_ARS_RATIO = 6.64     # 1 PAGS.BA = 1/6.64 PAGS shares → synthetic PAGS_ARS = PAGS_USD × CCL × 6.64

for date, usd_price in pags_d_ba.items():
    pags_usd = usd_price / PAGS_USD_RATIO
    ccl = ccl_map.get(date)
    # Synthetic ARS price (what PAGS.BA should trade at)
    synthetic_ars = round(pags_usd * (ccl or 0) * PAGS_ARS_RATIO, 2) if ccl else None
    pags_series.append({
        "date": date,
        "ba_price": synthetic_ars,   # synthetic ARS (for trade sizing)
        "ba_price_usd": usd_price,   # PAGSd.BA raw USD price
        "usd_equiv": round(pags_usd, 4),
        "ccl": ccl,
        "note": "ARS price is synthetic: PAGSd.BA / 0.3481 × CCL × 6.64",
    })

# Override latest ARS price with real PAGS.BA if available
if pags_ars_latest and pags_series:
    pags_series[-1]["ba_price"] = pags_ars_latest
    pags_series[-1]["note"] = f"ARS price from PAGS.BA (direct): {pags_ars_latest}"

usd_equiv["PAGS"] = pags_series
if pags_series:
    last = pags_series[-1]
    print(f"  PAGS: {last.get('ba_price') or '?'} ARS (synthetic)  →  ${last['usd_equiv']:.2f} USD")

# ─────────────────────────────────────────────────────────────────────────────
# 4. Save CCL + usd_equiv output
# ─────────────────────────────────────────────────────────────────────────────

ccl_output = {
    "ccl_series":   ccl_series,
    "latest_ccl":   latest_ccl,
    "usd_equiv":    usd_equiv,
    "cedear_config": CEDEAR_CONFIG,
    "anchor":       f"{CCL_ANCHOR_BA} / {CCL_ANCHOR_USD}",
    "note": (
        "CCL from AAPL.BA/AAPL (1:1 anchor). "
        "NU: NU.BA/(CCL×10). STNE: STNE.BA/(CCL×6.676). "
        "PAGS: PAGSd.BA/0.3481 (USD CEDEAR, no CCL needed for signal). "
        "PAGS ARS trade price: synthetic PAGSd.BA×CCL×19.07, overridden by PAGS.BA if available."
    ),
    "computedAt": datetime.now().isoformat(),
}

save_json(os.path.join(DATA_DIR, "ccl.json"), ccl_output)
print(f"\nSaved  →  data/live/ccl.json")
print("Fetch complete. Go to /relative-value/today")
