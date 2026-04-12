#!/usr/bin/env python3
"""
Fetch fundamental valuation data for NU, PAGS, STNE from Yahoo Finance.

Outputs: data/live/fundamentals.json

Run once per week (or any time outside market hours — Yahoo fundamentals
are not real-time, they update daily at most).

Usage:
    python3 scripts/fetch_fundamentals.py

Requires:
    pip install yfinance
"""

import json
import sys
from datetime import datetime
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    print("ERROR: yfinance not installed. Run: pip install yfinance")
    sys.exit(1)

TICKERS = ["NU", "PAGS", "STNE"]
OUT_PATH = Path("data/live/fundamentals.json")
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

FIELDS = {
    "trailingPE":              "pe",
    "forwardPE":               "forwardPe",
    "enterpriseToEbitda":      "evEbitda",
    "priceToBook":             "pb",
    "priceToSalesTrailing12Months": "ps",
    "targetMeanPrice":         "targetPrice",
    "currentPrice":            "currentPrice",
    "fiftyTwoWeekHigh":        "high52w",
    "fiftyTwoWeekLow":         "low52w",
    "marketCap":               "marketCap",
    "shortName":               "name",
    "currency":                "currency",
}

result: dict = {}

for ticker in TICKERS:
    print(f"Fetching {ticker}…", end=" ", flush=True)
    try:
        info = yf.Ticker(ticker).info
        entry: dict = {}
        for yf_key, out_key in FIELDS.items():
            v = info.get(yf_key)
            entry[out_key] = v  # keep None values — UI handles missing data

        # Compute upside from analyst target vs current price
        target = entry.get("targetPrice")
        current = entry.get("currentPrice")
        if target and current and current > 0:
            entry["upside"] = round((target - current) / current, 4)
        else:
            entry["upside"] = None

        result[ticker] = entry
        print(f"OK  (P/E={entry.get('pe')}, upside={entry.get('upside')})")

    except Exception as e:
        print(f"ERROR: {e}")
        result[ticker] = {k: None for k in FIELDS.values()}
        result[ticker]["upside"] = None

output = {
    "tickers": result,
    "fetchedAt": datetime.now().isoformat(),
    "source": "Yahoo Finance (yfinance)",
    "note": "P/E, EV/EBITDA, P/B, P/S are trailing 12-month. targetPrice is analyst consensus mean. Data is delayed 15min–1 day.",
}

OUT_PATH.write_text(json.dumps(output, indent=2, default=str))
print(f"\nSaved → {OUT_PATH}")
print("Run again any time to refresh. Safe outside market hours.")
