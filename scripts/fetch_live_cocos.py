#!/usr/bin/env python3
"""
Fetch LIVE intraday CEDEAR prices from Cocos Capital via pyhomebroker.

Uses the BYMA HomeBroker WebSocket (SignalR) — broker ID 265 (Cocos Capital).
Works during market hours: Mon–Fri 10:30–17:00 Argentina time.
Outside market hours, falls back to the last saved prices in data/live/.

Authentication:
  Set environment variables before running:
    COCOS_DNI=your_dni
    COCOS_USER=your_username (or email)
    COCOS_PASS=your_password

  Or create a file .env.cocos in the project root:
    COCOS_DNI=12345678
    COCOS_USER=usuario@mail.com
    COCOS_PASS=tu_password

Output:
  data/live/live_quotes.json  — last known live bid/ask/last for each CEDEAR
  data/live/ccl.json          — updated CCL using live prices (if AAPL available)

Usage:
    python3 scripts/fetch_live_cocos.py

Requires:
    pip install pyhomebroker
"""

import os
import json
import time
import signal
import threading
import sys
from datetime import datetime
from pathlib import Path

# ── Load credentials ──────────────────────────────────────────────────────────
def load_env_file():
    env_path = Path(".env.cocos")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

load_env_file()

DNI  = os.environ.get("COCOS_DNI",  "")
USER = os.environ.get("COCOS_USER", "")
PASS = os.environ.get("COCOS_PASS", "")

if not all([DNI, USER, PASS]):
    print("ERROR: Missing Cocos credentials.")
    print()
    print("Create a file called .env.cocos in the project root with:")
    print("  COCOS_DNI=your_dni_number")
    print("  COCOS_USER=your_email_or_username")
    print("  COCOS_PASS=your_password")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────
BROKER_ID = 265  # Cocos Capital (Negocios Financieros y Bursátiles S.A.)
DATA_DIR  = Path("data/live")
DATA_DIR.mkdir(parents=True, exist_ok=True)

# CEDEARs to track (ARS-denominated, BYMA tickers without .BA suffix)
# Settlement: T+2 is the default liquid market
CEDEARS_T2 = ["NU", "PAGS", "STNE", "AAPL"]  # AAPL for CCL anchor

# Settlement type: "T+2" for spot, "T+1", "T+0" for same-day
SETTLEMENT = "T+2"

# CEDEAR ratios (underlying shares per CEDEAR)
CEDEAR_RATIOS = {
    "NU":   10.0,
    "STNE": 6.676,
    "PAGS": 6.64,   # ARS CEDEAR ratio
    "AAPL": 1.0,    # CCL anchor (1:1)
}

quotes: dict[str, dict] = {}
received_event = threading.Event()

# ── Callbacks ─────────────────────────────────────────────────────────────────
def on_open(broker):
    print(f"[{now()}] Connected to Cocos Capital HomeBroker (broker {BROKER_ID})")
    broker.online.subscribe_securities(SETTLEMENT)

def on_securities(broker, df):
    """Receives a DataFrame with real-time quotes for all subscribed securities."""
    global quotes
    ts = now()

    # Filter to our CEDEARs
    target = [t for t in CEDEARS_T2]
    for _, row in df.iterrows():
        symbol = str(row.get("symbol", "")).strip().upper()
        if symbol not in target:
            continue

        bid   = float(row.get("bid",   0) or 0)
        ask   = float(row.get("ask",   0) or 0)
        last  = float(row.get("last",  0) or 0)
        close = float(row.get("close", 0) or 0)  # previous close
        change_pct = float(row.get("change", 0) or 0)

        price = last or ask or bid or close  # best available

        quotes[symbol] = {
            "symbol":     symbol,
            "price":      price,
            "last":       last,
            "bid":        bid,
            "ask":        ask,
            "close":      close,  # previous session close
            "change_pct": change_pct,
            "timestamp":  ts,
            "settlement": SETTLEMENT,
        }
        print(f"[{ts}] {symbol:6s}  last={price:>10,.2f}  bid={bid:>10,.2f}  ask={ask:>10,.2f}")

    # Signal that we got at least one update for our target symbols
    our_symbols = set(quotes.keys()) & set(CEDEARS_T2)
    if our_symbols:
        received_event.set()

def on_error(broker, exc, connection_id):
    print(f"[{now()}] ERROR: {exc}")

def on_close(broker):
    print(f"[{now()}] Connection closed.")

def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# ── Connect and collect ───────────────────────────────────────────────────────
print(f"[{now()}] Connecting to Cocos Capital (broker {BROKER_ID})…")
print(f"  User: {USER}  |  DNI: {DNI}")
print(f"  Tracking: {', '.join(CEDEARS_T2)}  ({SETTLEMENT})")
print()

try:
    from pyhomebroker import HomeBroker

    hb = HomeBroker(
        broker_id  = BROKER_ID,
        on_open    = on_open,
        on_securities = on_securities,
        on_error   = on_error,
        on_close   = on_close,
    )

    # Authenticate
    hb.auth.login(user=USER, password=PASS, dni=DNI, raise_exception=True)
    print(f"[{now()}] Authenticated successfully.")

    # Connect WebSocket
    hb.online.connect()

    # Wait up to 30s for quotes to arrive
    print(f"[{now()}] Waiting for live quotes…")
    received_event.wait(timeout=30)

    # Collect for a few more seconds to get fresh data
    time.sleep(3)

    # Disconnect
    hb.online.disconnect()

except Exception as e:
    print(f"[{now()}] Connection failed: {e}")
    print()
    print("Possible causes:")
    print("  - Market is closed (Mon–Fri 10:30–17:00 ART)")
    print("  - Wrong credentials in .env.cocos")
    print("  - pyhomebroker version incompatibility with Cocos")
    sys.exit(1)

# ── Save quotes ───────────────────────────────────────────────────────────────
if not quotes:
    print(f"[{now()}] No quotes received. Market may be closed or symbols not found.")
    sys.exit(1)

# Compute CCL from AAPL if available
ccl = None
aapl = quotes.get("AAPL")
if aapl and aapl["price"] > 0:
    # Load AAPL USD from yfinance cache for CCL denominator
    aapl_usd_file = DATA_DIR / "AAPL.json"
    if aapl_usd_file.exists():
        aapl_data = json.loads(aapl_usd_file.read_text())
        bars = [b for b in aapl_data.get("bars", []) if b.get("close")]
        if bars:
            aapl_usd = bars[-1]["close"]
            ccl = round(aapl["price"] / aapl_usd, 4)
            print(f"\nLive CCL (AAPL): {aapl['price']:,.2f} ARS / ${aapl_usd:.2f} USD = {ccl:.2f} ARS/USD")

# Compute USD-equivalent prices
usd_equiv: dict[str, dict] = {}
for symbol, q in quotes.items():
    if symbol == "AAPL":
        continue
    ratio = CEDEAR_RATIOS.get(symbol)
    if ratio and ccl and ccl > 0 and q["price"] > 0:
        usd_price = q["price"] / (ccl * ratio)
        usd_equiv[symbol] = {
            "date":      datetime.now().strftime("%Y-%m-%d"),
            "ba_price":  q["price"],
            "usd_equiv": round(usd_price, 4),
            "ccl":       ccl,
            "live":      True,
            "timestamp": q["timestamp"],
        }
        print(f"  {symbol}: {q['price']:>10,.2f} ARS  →  ${usd_price:.2f} USD equiv")

# Save live_quotes.json
live_path = DATA_DIR / "live_quotes.json"
output = {
    "quotes":    quotes,
    "ccl_live":  ccl,
    "usd_equiv": usd_equiv,
    "fetchedAt": now(),
    "source":    "pyhomebroker / Cocos Capital HomeBroker WebSocket",
    "settlement": SETTLEMENT,
}
live_path.write_text(json.dumps(output, indent=2))
print(f"\nSaved  →  {live_path}")

# Patch live prices into ccl.json so the API route picks them up
ccl_path = DATA_DIR / "ccl.json"
if ccl_path.exists() and usd_equiv:
    ccl_data = json.loads(ccl_path.read_text())
    today = datetime.now().strftime("%Y-%m-%d")
    # Inject live entries at front of each ticker's series
    for symbol, entry in usd_equiv.items():
        series = ccl_data.get("usd_equiv", {}).get(symbol, [])
        # Replace today's entry or append
        series = [e for e in series if e["date"] != today]
        series.append(entry)
        series.sort(key=lambda e: e["date"])
        if "usd_equiv" not in ccl_data:
            ccl_data["usd_equiv"] = {}
        ccl_data["usd_equiv"][symbol] = series
    # Update latest CCL
    if ccl:
        ccl_data["latest_ccl"] = {"date": today, "rate": ccl}
    ccl_path.write_text(json.dumps(ccl_data, indent=2))
    print(f"Updated →  {ccl_path}  (live prices injected)")

print(f"\n[{now()}] Done. Go to /relative-value/today and refresh.")
