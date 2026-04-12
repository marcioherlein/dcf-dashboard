"""
Download historical OHLCV data for the Trading Research Lab universe.
Uses yfinance (free, no API key needed).

Run from the project root:
    pip3 install --upgrade yfinance pandas
    python3 scripts/download_data.py

This will create CSV files in data/raw/ for each ticker.
Data goes back to 2010 by default (adjust START_DATE if needed).

IMPORTANT:
- yfinance data is NOT perfect. It has occasional errors and data gaps.
- Adjusted close prices incorporate splits and dividends (what we want for backtesting).
- Do not use this data for live trading without cross-checking another source.
"""

import yfinance as yf
import pandas as pd
import os
import sys
import time
from datetime import datetime

# ── Configuration ─────────────────────────────────────────────────────────────
START_DATE = "2018-01-01"
END_DATE = datetime.today().strftime("%Y-%m-%d")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "raw")

# All 55 tickers from the Phase 1 US universe
TICKERS = [
    # US Large-Cap Equities
    "AAPL", "MSFT", "NVDA", "GOOGL", "META", "AVGO", "CRM", "ADBE",
    "UNH", "LLY", "JNJ", "ABBV", "MDT",
    "JPM", "GS", "BRK-B", "V", "BLK",
    "AMZN", "TSLA", "HD", "NKE",
    "PG", "KO", "WMT",
    "CAT", "HON", "UPS",
    "XOM", "CVX", "SLB",
    "DIS", "T",
    "LIN",
    "PLD",
    # Broad Market ETFs
    "SPY", "QQQ", "IWM", "VTV", "VUG", "MTUM",
    # SPDR Sector ETFs
    "XLK", "XLV", "XLF", "XLE", "XLI", "XLP", "XLY", "XLB", "XLU", "XLRE", "XLC",
    # Fixed Income / Macro
    "TLT", "IEF", "GLD",

    # ── MERVAL stocks via US ADRs (USD-priced) ─────────────────────────────────
    # Using NYSE/NASDAQ ADR listings for clean USD data.
    # These can be ranked cross-sectionally with US assets.
    "GGAL", "BMA", "BBAR",           # Argentine banks (Galicia, Macro, BBVA Arg.)
    "YPF",                            # YPF (energy)
    "PAM",                            # Pampa Energía (utilities)
    "TX",                             # Ternium / TXAR (steel)
    "SUPV",                           # Grupo Supervielle (bank)
    "IRS",                            # IRSA (real estate)
    "CRESY",                          # Cresud (agro/real estate)
    "LOMA",                           # Loma Negra (cement)
    "TEO",                            # Telecom Argentina / TECO2
    "CEPU",                           # Central Puerto (utilities)
    "EDN",                            # Edenor (utilities)
    "MELI",                           # MercadoLibre (e-commerce/fintech)

    # ── Additional CEDEAR-eligible US names ────────────────────────────────────
    # Popular on BYMA but not in the original US universe.
    "NFLX", "AMD", "ORCL",
    "BAC", "MA", "AXP",
    "PFE", "MRK",
    "MCD", "SBUX", "COST",
    "BA",

    # ── LatAm Fintech — NU/PAGS/STNE relative-value module ────────────────────
    "NU",    # Nubank (NYSE)
    "PAGS",  # PagSeguro Digital (NASDAQ)
    "STNE",  # StoneCo Ltd (NASDAQ)
]


def check_yfinance_version():
    """Warn if yfinance is outdated."""
    try:
        import importlib.metadata
        version = importlib.metadata.version("yfinance")
        parts = version.split(".")
        major, minor = int(parts[0]), int(parts[1])
        if major == 0 and minor < 2:
            print(f"WARNING: yfinance {version} is old. Run: pip3 install --upgrade yfinance")
            print()
    except Exception:
        pass


def download_ticker(ticker: str, retries: int = 2) -> bool:
    """Download data for one ticker. Returns True on success."""
    # BRK.B in our config = BRK-B in yfinance
    yf_ticker = "BRK-B" if ticker == "BRK.B" else ticker
    # File saved as BRK.B to match universe config
    out_ticker = ticker

    for attempt in range(retries + 1):
        try:
            # Try the newer yfinance API first (0.2.x+)
            t = yf.Ticker(yf_ticker)
            df = t.history(
                start=START_DATE,
                end=END_DATE,
                auto_adjust=True,
                raise_errors=False,
            )

            if df is None or df.empty:
                # Fallback: try yf.download()
                df = yf.download(
                    yf_ticker,
                    start=START_DATE,
                    end=END_DATE,
                    auto_adjust=True,
                    progress=False,
                    multi_level_index=False,
                )

            if df is None or df.empty:
                if attempt < retries:
                    time.sleep(1)
                    continue
                print(f"  SKIP {ticker}: no data returned")
                return False

            # Flatten multi-level columns if present
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            # Normalize column names (handle both capitalizations)
            df.columns = [c.strip() for c in df.columns]
            rename_map = {}
            for col in df.columns:
                lower = col.lower()
                if lower in ("open", "high", "low", "close", "volume"):
                    rename_map[col] = lower
            df = df.rename(columns=rename_map)

            # Ensure required columns exist
            required = ["open", "high", "low", "close", "volume"]
            missing_cols = [c for c in required if c not in df.columns]
            if missing_cols:
                print(f"  SKIP {ticker}: missing columns {missing_cols}")
                return False

            # adj_close = close (already adjusted when auto_adjust=True)
            df["adj_close"] = df["close"]
            df["adjustment_factor"] = 1.0
            df.index.name = "date"

            # Drop rows with NaN prices or zero/negative close
            df = df.dropna(subset=["open", "high", "low", "close"])
            df = df[df["close"] > 0]

            if len(df) < 50:
                print(f"  SKIP {ticker}: only {len(df)} bars — insufficient history")
                return False

            # Format index as YYYY-MM-DD strings
            df.index = pd.to_datetime(df.index).strftime("%Y-%m-%d")

            # Select and reorder columns
            output_cols = ["open", "high", "low", "close", "volume", "adj_close", "adjustment_factor"]
            df = df[[c for c in output_cols if c in df.columns]]

            out_path = os.path.join(OUTPUT_DIR, f"{out_ticker}.csv")
            df.to_csv(out_path)

            print(f"  OK   {ticker}: {len(df)} bars ({df.index[0]} → {df.index[-1]})")
            return True

        except Exception as e:
            err_str = str(e)
            # YFTzMissingError = timezone issue in old yfinance — advise upgrade
            if "YFTz" in err_str or "timezone" in err_str.lower():
                print(f"  ERR  {ticker}: yfinance version issue — run: pip3 install --upgrade yfinance")
                return False
            if attempt < retries:
                time.sleep(1.5)
                continue
            print(f"  ERR  {ticker}: {err_str[:120]}")
            return False

    return False


def main():
    check_yfinance_version()

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Downloading {len(TICKERS)} tickers  |  {START_DATE} → {END_DATE}")
    print(f"Output: {os.path.abspath(OUTPUT_DIR)}")
    print("-" * 60)

    success = 0
    failed = []

    for i, ticker in enumerate(TICKERS, 1):
        print(f"[{i:2}/{len(TICKERS)}] ", end="", flush=True)
        ok = download_ticker(ticker)
        if ok:
            success += 1
        else:
            failed.append(ticker)
        # Small delay to avoid rate limiting
        time.sleep(0.3)

    print("-" * 60)
    print(f"Result: {success} succeeded, {len(failed)} failed")

    if failed:
        print(f"\nFailed: {', '.join(failed)}")
        if any("YFTz" in f or "timezone" in f for f in failed):
            print("\nFix: pip3 install --upgrade yfinance  then re-run this script")
        else:
            print("\nThese tickers will be skipped in backtests. The rest will work normally.")

    if success >= 10:
        print(f"\nYou have {success} tickers downloaded.")
        print("Start the app:  npm run dev")
        print("Then go to:     http://localhost:3000/backtest")
    else:
        print("\nNot enough data downloaded. Fix the errors above first.")


if __name__ == "__main__":
    main()
