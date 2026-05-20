'use client'

const ROW_1 = [
  { ticker: 'AAPL',  price: '$213.45', change: '+1.2%',  up: true  },
  { ticker: 'NVDA',  price: '$118.20', change: '-0.8%',  up: false },
  { ticker: 'MSFT',  price: '$415.10', change: '+0.4%',  up: true  },
  { ticker: 'AMZN',  price: '$196.30', change: '+2.1%',  up: true  },
  { ticker: 'TSLA',  price: '$177.80', change: '-1.4%',  up: false },
  { ticker: 'GOOGL', price: '$174.50', change: '+0.6%',  up: true  },
  { ticker: 'META',  price: '$573.20', change: '+1.8%',  up: true  },
  { ticker: 'JPM',   price: '$214.60', change: '+0.3%',  up: true  },
  { ticker: 'V',     price: '$278.90', change: '+0.5%',  up: true  },
  { ticker: 'BRK.B', price: '$456.20', change: '-0.2%',  up: false },
  { ticker: 'LLY',   price: '$894.30', change: '+0.9%',  up: true  },
  { ticker: 'WMT',   price: '$89.40',  change: '-0.3%',  up: false },
  { ticker: 'NFLX',  price: '$641.80', change: '+1.1%',  up: true  },
  { ticker: 'UBER',  price: '$74.30',  change: '-0.5%',  up: false },
]

const ROW_2 = [
  { label: 'S&P 500',   value: '5,234',  change: '▲0.6%',  up: true  },
  { label: 'NASDAQ',    value: '16,420', change: '▲0.9%',  up: true  },
  { label: 'DOW',       value: '38,810', change: '▲0.2%',  up: true  },
  { label: '10Y YIELD', value: '4.31%',  change: '▼0.02',  up: false },
  { label: 'VIX',       value: '14.2',   change: '▼2.1%',  up: false },
  { label: 'BTC/USD',   value: '$67,420',change: '▲1.4%',  up: true  },
  { label: 'EUR/USD',   value: '1.0842', change: '▼0.1%',  up: false },
  { label: 'GOLD',      value: '$2,342', change: '▲0.3%',  up: true  },
  { label: 'CRUDE OIL', value: '$78.40', change: '▼0.7%',  up: false },
  { label: 'NIKKEI',    value: '38,640', change: '▲0.4%',  up: true  },
  { label: 'FTSE 100',  value: '8,246',  change: '▲0.2%',  up: true  },
]

function Dot() {
  return <span className="text-slate-300 mx-3 select-none">·</span>
}

function TickerCell({ ticker, price, change, up }: (typeof ROW_1)[0]) {
  return (
    <span className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
      <span className="font-bold text-slate-500">{ticker}</span>
      <span className="text-slate-400">{price}</span>
      <span className={up ? 'text-emerald-500' : 'text-red-400'}>{change}</span>
      <Dot />
    </span>
  )
}

function IndexCell({ label, value, change, up }: (typeof ROW_2)[0]) {
  return (
    <span className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="text-slate-400">{value}</span>
      <span className={up ? 'text-emerald-500' : 'text-red-400'}>{change}</span>
      <Dot />
    </span>
  )
}

export default function TickerStrip() {
  return (
    <div
      className="w-full overflow-hidden py-2.5 border-y border-[rgba(59,130,246,0.15)]"
      style={{
        background: 'rgba(5,13,31,0.7)',
        maskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
      }}
    >
      {/* Row 1: stocks — scrolls right-to-left */}
      <div className="overflow-hidden mb-1">
        <div className="animate-marquee">
          {[...ROW_1, ...ROW_1].map((item, i) => (
            <TickerCell key={i} {...item} />
          ))}
        </div>
      </div>

      {/* Row 2: indices — scrolls left-to-right */}
      <div className="overflow-hidden">
        <div className="animate-marquee-reverse">
          {[...ROW_2, ...ROW_2].map((item, i) => (
            <IndexCell key={i} {...item} />
          ))}
        </div>
      </div>
    </div>
  )
}
