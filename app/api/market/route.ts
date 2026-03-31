import { NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

export const revalidate = 300 // cache 5 minutes

const INSTRUMENTS = [
  // ── Índices Globales ──────────────────────────────────────────────────────────
  { ticker: '^GSPC',    label: 'S&P 500',       group: 'Indexes'  },
  { ticker: '^NDX',     label: 'Nasdaq 100',    group: 'Indexes'  },
  { ticker: '^DJI',     label: 'Dow Jones',     group: 'Indexes'  },
  { ticker: '^RUT',     label: 'Russell 2000',  group: 'Indexes'  },
  { ticker: '^VIX',     label: 'VIX',           group: 'Indexes'  },
  { ticker: 'EEM',      label: 'EM ETF',        group: 'Indexes'  },

  // ── MERVAL ───────────────────────────────────────────────────────────────────
  { ticker: '^MERV',    label: 'MERVAL',        group: 'MERVAL'   },
  { ticker: 'GGAL',     label: 'Galicia',       group: 'MERVAL'   },
  { ticker: 'YPF',      label: 'YPF',           group: 'MERVAL'   },
  { ticker: 'MELI',     label: 'MercadoLibre',  group: 'MERVAL'   },
  { ticker: 'GLOB',     label: 'Globant',       group: 'MERVAL'   },
  { ticker: 'LOMA',     label: 'Loma Negra',    group: 'MERVAL'   },
  { ticker: 'BMA',      label: 'Banco Macro',   group: 'MERVAL'   },
  { ticker: 'SUPV',     label: 'Grupo Supervielle', group: 'MERVAL' },

  // ── Brasil ───────────────────────────────────────────────────────────────────
  { ticker: 'EWZ',      label: 'Brazil ETF',    group: 'Brasil'   },
  { ticker: 'ITUB',     label: 'Itaú Unibanco', group: 'Brasil'   },
  { ticker: 'VALE',     label: 'Vale',          group: 'Brasil'   },
  { ticker: 'PBR',      label: 'Petrobras',     group: 'Brasil'   },
  { ticker: 'ABEV',     label: 'Ambev',         group: 'Brasil'   },
  { ticker: 'NU',       label: 'Nubank',        group: 'Brasil'   },

  // ── Tech ─────────────────────────────────────────────────────────────────────
  { ticker: 'AAPL',     label: 'Apple',         group: 'Tech'     },
  { ticker: 'MSFT',     label: 'Microsoft',     group: 'Tech'     },
  { ticker: 'GOOGL',    label: 'Alphabet',      group: 'Tech'     },
  { ticker: 'META',     label: 'Meta',          group: 'Tech'     },
  { ticker: 'AMZN',     label: 'Amazon',        group: 'Tech'     },
  { ticker: 'NFLX',     label: 'Netflix',       group: 'Tech'     },

  // ── AI ───────────────────────────────────────────────────────────────────────
  { ticker: 'NVDA',     label: 'NVIDIA',        group: 'AI'       },
  { ticker: 'PLTR',     label: 'Palantir',      group: 'AI'       },
  { ticker: 'AI',       label: 'C3.ai',         group: 'AI'       },
  { ticker: 'SOUN',     label: 'SoundHound',    group: 'AI'       },
  { ticker: 'BBAI',     label: 'BigBear.ai',    group: 'AI'       },
  { ticker: 'IONQ',     label: 'IonQ',          group: 'AI'       },

  // ── Chips / Semiconductors ───────────────────────────────────────────────────
  { ticker: 'AMD',      label: 'AMD',           group: 'Chips'    },
  { ticker: 'INTC',     label: 'Intel',         group: 'Chips'    },
  { ticker: 'AVGO',     label: 'Broadcom',      group: 'Chips'    },
  { ticker: 'QCOM',     label: 'Qualcomm',      group: 'Chips'    },
  { ticker: 'ASML',     label: 'ASML',          group: 'Chips'    },
  { ticker: 'TSM',      label: 'TSMC',          group: 'Chips'    },

  // ── China ────────────────────────────────────────────────────────────────────
  { ticker: 'BABA',     label: 'Alibaba',       group: 'China'    },
  { ticker: 'BIDU',     label: 'Baidu',         group: 'China'    },
  { ticker: 'JD',       label: 'JD.com',        group: 'China'    },
  { ticker: 'PDD',      label: 'PDD Holdings',  group: 'China'    },
  { ticker: 'TCEHY',    label: 'Tencent',       group: 'China'    },
  { ticker: 'FXI',      label: 'China ETF',     group: 'China'    },

  // ── Tasas ────────────────────────────────────────────────────────────────────
  { ticker: '^TNX',     label: 'UST 10Y',       group: 'Rates'    },
  { ticker: '^TYX',     label: 'UST 30Y',       group: 'Rates'    },
  { ticker: '^FVX',     label: 'UST 5Y',        group: 'Rates'    },

  // ── Energía ──────────────────────────────────────────────────────────────────
  { ticker: 'CL=F',    label: 'WTI',            group: 'Energy'   },
  { ticker: 'BZ=F',    label: 'Brent',          group: 'Energy'   },
  { ticker: 'RB=F',    label: 'Gasoline',       group: 'Energy'   },

  // ── Metales ──────────────────────────────────────────────────────────────────
  { ticker: 'GC=F',    label: 'Gold',           group: 'Metals'   },
  { ticker: 'SI=F',    label: 'Silver',         group: 'Metals'   },
  { ticker: 'HG=F',    label: 'Copper',         group: 'Metals'   },

  // ── Agro ─────────────────────────────────────────────────────────────────────
  { ticker: 'ZS=F',    label: 'Soybean',        group: 'Agro'     },
  { ticker: 'ZW=F',    label: 'Wheat',          group: 'Agro'     },
  { ticker: 'ZC=F',    label: 'Corn',           group: 'Agro'     },

  // ── Crypto ───────────────────────────────────────────────────────────────────
  { ticker: 'BTC-USD', label: 'Bitcoin',        group: 'Crypto'   },
  { ticker: 'ETH-USD', label: 'Ethereum',       group: 'Crypto'   },
  { ticker: 'SOL-USD', label: 'Solana',         group: 'Crypto'   },
  { ticker: 'BNB-USD', label: 'BNB',            group: 'Crypto'   },
  { ticker: 'XRP-USD', label: 'XRP',            group: 'Crypto'   },
  { ticker: 'AVAX-USD',label: 'Avalanche',      group: 'Crypto'   },

  // ── Monedas ──────────────────────────────────────────────────────────────────
  { ticker: 'EURUSD=X', label: 'EUR/USD',       group: 'FX'       },
  { ticker: 'USDBRL=X', label: 'USD/BRL',       group: 'FX'       },
  { ticker: 'USDMXN=X', label: 'USD/MXN',       group: 'FX'       },
  { ticker: 'USDCNY=X', label: 'USD/CNY',       group: 'FX'       },
  { ticker: 'DX-Y.NYB', label: 'DXY',           group: 'FX'       },
]

export async function GET() {
  try {
    const period2 = new Date().toISOString().split('T')[0]
    const d1 = new Date(); d1.setMonth(d1.getMonth() - 1)
    const period1 = d1.toISOString().split('T')[0]

    const [quoteRes, histRes] = await Promise.all([
      Promise.allSettled(INSTRUMENTS.map((i) => yf.quote(i.ticker))),
      Promise.allSettled(
        INSTRUMENTS.map((i) =>
          yf.historical(i.ticker, { period1, period2, interval: '1d' }).catch(() => [])
        )
      ),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = INSTRUMENTS.map((inst, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = quoteRes[i].status === 'fulfilled' ? (quoteRes[i] as PromiseFulfilledResult<any>).value : null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hist = histRes[i].status === 'fulfilled' ? (histRes[i] as PromiseFulfilledResult<any[]>).value : []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sparkline: number[] = (hist ?? []).map((r: any) => r.close ?? r.adjClose).filter((v: unknown) => typeof v === 'number')
      return {
        ticker: inst.ticker,
        label: inst.label,
        group: inst.group,
        price: (q?.regularMarketPrice ?? 0) as number,
        change: (q?.regularMarketChange ?? 0) as number,
        changePct: (q?.regularMarketChangePercent ?? 0) as number,
        sparkline,
      }
    })

    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
