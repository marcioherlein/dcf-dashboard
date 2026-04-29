'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { ValuationMetrics, ValuationAssumptions, metricColor, getScoreLabel } from '@/lib/ai-stack/scoring'
import { LAYER_COLORS } from '@/lib/ai-stack/tickers'

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtNum(v: number | null, decimals = 1): string {
  if (v === null || !isFinite(v)) return '—'
  return v.toFixed(decimals)
}

function fmtPct(v: number | null, isDecimal = true): string {
  if (v === null || !isFinite(v)) return '—'
  const val = isDecimal ? v * 100 : v
  return (val >= 0 ? '+' : '') + val.toFixed(1) + '%'
}

function fmtPctPlain(v: number | null, isDecimal = true): string {
  if (v === null || !isFinite(v)) return '—'
  const val = isDecimal ? v * 100 : v
  return val.toFixed(1) + '%'
}

function fmtMktCap(v: number | null): string {
  if (v === null || !isFinite(v)) return '—'
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T'
  if (v >= 1e9)  return '$' + (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6)  return '$' + (v / 1e6).toFixed(0) + 'M'
  return '$' + v.toFixed(0)
}

// Handles negative cash values (e.g. negative FCF shown as -$2.1B)
function fmtCash(v: number | null): string {
  if (v === null || !isFinite(v)) return '—'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return sign + '$' + (abs / 1e12).toFixed(2) + 'T'
  if (abs >= 1e9)  return sign + '$' + (abs / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6)  return sign + '$' + (abs / 1e6).toFixed(0) + 'M'
  return sign + '$' + abs.toFixed(0)
}

function fmtPrice(v: number | null): string {
  if (v === null || !isFinite(v)) return '—'
  if (v >= 1000) return '$' + v.toFixed(0)
  return '$' + v.toFixed(2)
}

// ─── Layer intelligence ───────────────────────────────────────────────────────

interface LayerInfo {
  title: string
  what: string
  revenue: string
  profitability: string
  moat: string
  moatRating: 'Very Strong' | 'Strong' | 'Moderate' | 'Weak'
  marginRating: 'Excellent' | 'Good' | 'Moderate' | 'Thin' | 'Cyclical'
}

const LAYER_INFO: Record<number, LayerInfo> = {
  0: {
    title: 'Edge Delivery & Inference',
    what: 'Run globally distributed server networks (PoPs) close to end-users to cache content, absorb DDoS attacks, and run AI inference at the edge — so responses arrive in milliseconds without routing back to a central data center.',
    revenue: 'Bandwidth consumption ($/GB), monthly platform fees, and security subscriptions. Cloudflare is fastest-growing; Akamai has the deepest enterprise base.',
    profitability: 'High gross margins (60–75%) because bandwidth costs are largely fixed. Operating margins are mid-tier — global PoP infrastructure is expensive to build and maintain.',
    moat: 'Network effects (more PoPs = lower latency = better product) plus switching costs from deep CDN integration. AKAM has the deepest enterprise moat; NET has the strongest developer platform lock-in.',
    moatRating: 'Strong',
    marginRating: 'Good',
  },
  1: {
    title: 'Hyperscalers',
    what: 'Own and operate massive data centers providing cloud compute (AWS, Azure, GCP), AI services, social infrastructure, and everything built on top. They are the primary buyers of every layer below them.',
    revenue: 'Cloud services (pay-per-use IaaS/PaaS/SaaS), advertising (GOOGL, META), e-commerce (AMZN). AWS, Azure, GCP combined represent ~65% of global cloud spend.',
    profitability: 'Among the most profitable businesses ever built. AWS ~38% operating margin, Azure ~45%+. Meta advertising >40% operating margin. Enormous FCF generation.',
    moat: 'Strongest moats in technology — massive switching costs (enterprises cannot easily migrate workloads), developer ecosystem network effects, proprietary AI models, and capital scale no new entrant can replicate.',
    moatRating: 'Very Strong',
    marginRating: 'Excellent',
  },
  2: {
    title: 'GPU Cloud & Neocloud',
    what: 'Rent GPU clusters to AI companies, researchers, and enterprises that cannot get hyperscaler capacity fast enough. Some (IREN, WULF, CIFR) pivoted from Bitcoin mining, leveraging cheap-power infrastructure. CoreWeave is purpose-built for GPU workloads.',
    revenue: 'GPU-hour rentals ($/hr per H100/A100) and long-term GPU lease contracts. CoreWeave has multi-year contracts with Microsoft. Oracle is competing aggressively.',
    profitability: 'Mixed and capital-intensive. Gross margins 50–60% at scale, but FCF is negative during build-out. Crypto-pivot companies have lower margins and volatile demand.',
    moat: 'Weak-to-moderate. GPU supply constraints gave early movers a temporary edge, but as NVIDIA supply normalizes and hyperscalers add capacity, pricing power compresses. Switching costs are low.',
    moatRating: 'Weak',
    marginRating: 'Moderate',
  },
  3: {
    title: 'Data Center Facilities (REITs)',
    what: 'Own the physical buildings where servers live. Equinix runs interconnection hubs where hundreds of networks and clouds meet. Digital Realty builds large-scale leased campuses. Iron Mountain is expanding from document storage into data centers.',
    revenue: 'Long-term leases (5–10 year terms) for cage space, power ($/kW), and cross-connects ($/month per cable). Predictable, utility-like cash flows.',
    profitability: 'REIT structure — distribute most taxable income as dividends. Operating margins solid (~30–40%) but capex-heavy. EQIX has best pricing power due to interconnection density.',
    moat: "Location-based network effects are the strongest in this layer. Equinix's 250+ IBX hubs are the preferred meeting points for financial exchanges, cloud on-ramps, and ISPs — once networks interconnect there, they don't leave.",
    moatRating: 'Very Strong',
    marginRating: 'Good',
  },
  4: {
    title: 'Chip Design',
    what: 'Design the chips that run AI — GPUs (NVDA, AMD), networking ASICs (AVGO, MRVL), edge AI chips (QCOM), and CPU IP (ARM). EDA software (SNPS, CDNS) provides the tools without which no chip on earth can be designed.',
    revenue: 'Fabless model: design chips, outsource manufacturing to TSMC, sell chips. ARM licenses CPU ISA per chip manufactured (royalty per unit). EDA companies sell software licenses and subscriptions.',
    profitability: 'Highest gross margins in hardware — 50–75% for fabless (no fab capex). ARM royalty model is 60%+ gross margin. EDA (SNPS, CDNS) are 80%+ gross margin software businesses.',
    moat: "NVIDIA's moat is CUDA — 15+ years of developer tooling AMD cannot replicate. ARM's architecture is a near-monopoly on mobile. Synopsys and Cadence form a duopoly in chip design software: there is no real alternative.",
    moatRating: 'Very Strong',
    marginRating: 'Excellent',
  },
  5: {
    title: 'Semiconductor Manufacturing',
    what: 'Make the chips (TSMC, UMC, GFS) or build the machines that make the chips (ASML, Lam, KLA, AMAT). Memory (MU) makes DRAM and HBM inside AI accelerators. Storage (WDC, STX) holds training data. Test & packaging ensures chips are assembled and verified.',
    revenue: 'TSMC charges per wafer (~$10K–$20K for cutting-edge nodes). Equipment makers sell machines for $50M–$350M each. Memory companies sell chips at commodity spot prices.',
    profitability: 'TSMC: ~55% gross margin, ~40% net margin. ASML: ~52% gross margin. Memory (MU) is highly cyclical — swings from large profits to large losses across the semiconductor cycle.',
    moat: "ASML's EUV monopoly is among the hardest moats to replicate in all of industry — 30 years and $40B+ to build, zero real alternatives for sub-5nm production. TSMC's process lead and customer trust is a deep operational moat. Memory is commodity with no durable moat.",
    moatRating: 'Very Strong',
    marginRating: 'Cyclical',
  },
  6: {
    title: 'Electrical Connectivity',
    what: 'Make the physical and electrical infrastructure that moves data inside and between server racks — high-speed connectors (Amphenol, TE), high-speed retimers/serializers (Credo, Astera Labs), timing chips (SiTime), and printed circuit boards (TTM).',
    revenue: 'Component sales on long-term supply agreements with OEMs and hyperscalers. Astera Labs and Credo sell high-ASP chips for 400G/800G data center interconnects.',
    profitability: 'Amphenol and TE: ~32–35% gross margin on connectors. Astera Labs and Credo: 60%+ gross margin but still investing heavily in growth. PCB companies (TTM): 20–25% gross margin, commodity-adjacent.',
    moat: "Amphenol's moat is breadth — connectors for every industry, nearly impossible to displace. Astera Labs and Credo have a timing advantage in PCIe Gen 5/CXL AI server infrastructure but face competition from AVGO and MRVL.",
    moatRating: 'Moderate',
    marginRating: 'Good',
  },
  7: {
    title: 'Optical Interconnects',
    what: 'Move data between data centers and across the internet backbone using light instead of electrons. At AI scale, bandwidth between GPU clusters exceeds what copper can handle — optical transceivers (Coherent, Lumentum), fiber cable (Corning), and optical systems (Ciena) are the solution.',
    revenue: 'Component sales (transceivers at $500–$5K each), complete optical networking systems (Ciena sells to telcos and hyperscalers), and long-term fiber supply agreements (Corning).',
    profitability: 'Corning: durable 35–40% gross margins. Lumentum and Coherent: 40–55% gross margin but cyclical with acquisition debt. Fabrinet is a contract manufacturer so net margins are 11–13%.',
    moat: "Corning invented low-loss optical fiber, has 50 years of manufacturing expertise, and long-term supply agreements with AT&T, Verizon, and hyperscalers — one of the best moats in materials. Others face pressure from Asian transceiver manufacturers.",
    moatRating: 'Moderate',
    marginRating: 'Moderate',
  },
  8: {
    title: 'Networking Hardware',
    what: 'Make the switches and routers connecting servers to each other and to the internet. Arista dominates AI-scale data center switching (400G/800G). Cisco is the broader networking incumbent covering enterprise, telco, security, and collaboration.',
    revenue: 'Hardware sales + software subscriptions. Arista now generates ~40% of revenue from software/services (recurring). Cisco has been transitioning its business to subscriptions.',
    profitability: 'Both have high gross margins (~60–65%). Arista operating margins ~40% and rising — one of the most profitable hardware companies. Cisco is more mature with strong FCF but slower growth.',
    moat: "Arista's EOS operating system is the standard for hyperscale data center networking (Meta, Microsoft, Google). Cisco's moat is in enterprise and telco — installed base stickiness and software lock-in, though it faces commoditization from open networking.",
    moatRating: 'Strong',
    marginRating: 'Excellent',
  },
  9: {
    title: 'Rack Assembly / OEM',
    what: 'Integrate components (GPUs, CPUs, networking, storage) into complete server racks and systems, then sell to data centers. Super Micro specializes in high-density AI GPU servers with direct-liquid-cooling. Dell and HPE are full-stack IT vendors. Jabil and Celestica are contract manufacturers building to hyperscaler specs.',
    revenue: 'Server and storage system sales, service contracts, and financing. Super Micro\'s DLC rack systems command a premium in AI deployments.',
    profitability: 'Thin margins — this is assembly, not design. Gross margins: SMCI ~15%, Dell ~20% blended, HPE ~32%. Contract manufacturers (Jabil, Celestica): 8–11% gross margin.',
    moat: 'Weak. Customers can switch OEMs relatively easily. SMCI had a moat on DLC speed-to-market but competitors have caught up. Value-add is integration and supply chain speed, not IP.',
    moatRating: 'Weak',
    marginRating: 'Thin',
  },
  10: {
    title: 'Power & Cooling',
    what: 'A hyperscale data center campus uses up to 1 GW of power and generates immense heat. This layer supplies uninterruptible power systems, PDUs, liquid cooling, HVAC chillers, and backup generators. Vertiv is the pure-play leader.',
    revenue: 'Equipment sales plus long-term service and maintenance contracts (30–50% of revenue, highly recurring). Ecolab and Chemours sell cooling fluids — consumable recurring revenue.',
    profitability: 'Vertiv improving rapidly (gross margin ~35–40%). Industrial companies (Eaton, Trane, Carrier): 35–45% gross margins with durable service revenue. Strong operating leverage as data center capex surges.',
    moat: 'Vertiv is the reference design partner for hyperscalers in power/cooling — service agreements lock in recurring revenue. Eaton\'s power management software creates switching costs. CAT and Cummins have brand and service network moats for backup generators.',
    moatRating: 'Strong',
    marginRating: 'Good',
  },
  11: {
    title: 'Power Semiconductors',
    what: 'Make analog and mixed-signal chips that regulate, convert, and manage power — voltage regulators, power controllers, gate drivers. Every GPU server rack contains dozens. TXN and ADI are the giants; MPWR dominates high-efficiency DC-DC converters inside AI servers.',
    revenue: 'Chip sales with 5–10 year design-win cycles. Once a chip is designed into a product, it stays for the product\'s entire life. TXN and ADI sell across 100,000+ customers with no single customer above 10%.',
    profitability: 'Exceptional and durable: TXN ~65% gross margin, ADI ~68%, MPWR ~55%. Operating margins 30–45%. Some of the most stable margin profiles in semiconductors because analog chips cannot be replicated by software.',
    moat: 'Very strong. Analog design is an art — winning a design slot requires years of customer engagement and validation. TXN\'s 300mm fab ownership provides a structural cost moat. Once designed in, chips are re-ordered for the product\'s entire life.',
    moatRating: 'Very Strong',
    marginRating: 'Excellent',
  },
  12: {
    title: 'Data Center Construction',
    what: 'Build data centers physically — electrical systems (EMCOR, Comfort Systems), civil construction (Sterling, Primoris), fiber/cable laying (Dycom, MasTec), and large-scale EPC projects (Fluor). These companies are in a capex supercycle driven by hyperscaler expansion.',
    revenue: 'Fixed-price and cost-plus construction contracts. Backlogs are multi-year revenue visibility indicators — EMCOR\'s backlog exceeded $10B for the first time in 2024.',
    profitability: 'Low by nature: gross margins 12–18% for pure contractors. But operating leverage is real — as volumes surge, fixed overhead spreads. EMCOR and Comfort Systems have been standout performers with rising margins and ROE.',
    moat: 'Moderate. Skilled labor shortages, licensing requirements, and established hyperscaler procurement relationships create real barriers. Not deep technology moats — a well-capitalized entrant can compete. Differentiation is execution quality and workforce scale.',
    moatRating: 'Moderate',
    marginRating: 'Thin',
  },
  13: {
    title: 'Logistics',
    what: 'Move the physical equipment — servers, GPUs, networking gear — from manufacturers (mostly Asia) to data centers worldwide. Expeditors is a freight forwarding and customs brokerage specialist. Saia is a less-than-truckload (LTL) carrier serving domestic US freight.',
    revenue: 'Freight forwarding fees, customs brokerage, and trucking revenue per shipment or per mile. Expeditors is asset-light (owns no planes or ships — brokers capacity).',
    profitability: 'Expeditors has exceptional asset-light margins (~32% operating margin, ~0 capex). Saia is asset-heavy LTL with 12–15% operating margins but strong pricing power in the LTL oligopoly.',
    moat: "Expeditors' moat is customs expertise and IT systems — multinationals rely on their compliance knowledge. Saia benefits from the LTL oligopoly (~4–5 major national carriers) which enforces pricing discipline and has high entry barriers.",
    moatRating: 'Moderate',
    marginRating: 'Good',
  },
  14: {
    title: 'Energy Suppliers',
    what: 'Power the data centers. Nuclear plants (CEG, VST, TLN) are signing 20-year PPAs with hyperscalers — Microsoft restarted Three Mile Island with Constellation. Gas pipelines (KMI, ENB, EQT) supply peaker plants and backup systems. Renewables (NEE, BEP) meet 24/7 carbon-free commitments. Uranium miners (CCJ, UEC) supply the nuclear renaissance.',
    revenue: 'Long-term power purchase agreements ($/MWh), regulated utility rates, pipeline throughput fees ($/MMBtu), and uranium sales ($/lb U3O8). Highly contracted, predictable cash flows.',
    profitability: 'Nuclear and gas pipeline are most profitable — long-term contracted revenues with low variable costs and high FCF. Renewables have lower returns due to capital intensity. Uranium is volatile.',
    moat: 'Nuclear plants have the strongest moat — took decades and billions to build, cannot be replicated, and provide 24/7 carbon-free baseload that wind/solar cannot. Pipeline companies have regulated infrastructure moats. Uranium supply is a strategic chokepoint.',
    moatRating: 'Very Strong',
    marginRating: 'Good',
  },
  15: {
    title: 'Raw Materials',
    what: 'Provide the physical inputs for everything above. Copper (FCX, SCCO) goes into every wire, transformer, and busbar. Electrical steel (CLF, WS) goes into transformers. Rare earths (MP) go into cooling fan magnets. Industrial gases (LIN, APD) are used in chip fabrication. Grid equipment (GEV) and transmission contractors (PWR) build the power grid upgrades reaching data centers.',
    revenue: 'Commodity prices for miners ($/lb copper, $/kg rare earth). Long-term take-or-pay supply agreements for industrial gases. Project contracts for grid and power equipment.',
    profitability: 'Commodity businesses are cyclical — copper miners swing from 40–50% EBITDA margin at peak to losses in downturns. Industrial gas (Linde, Air Products) is the most durable: ~30% operating margins on 20-year on-site contracts.',
    moat: "Linde has one of the best moats in materials — on-site gas plants built under 20-year contracts are too cheap to justify switching. Freeport's Grasberg mine is one of the largest and lowest-cost copper deposits on earth. MP Materials is the only significant Western miner-to-magnet rare earth player.",
    moatRating: 'Moderate',
    marginRating: 'Cyclical',
  },
}

const MOAT_COLORS: Record<string, string> = {
  'Very Strong': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Strong':      'bg-blue-50 text-blue-700 border-blue-200',
  'Moderate':    'bg-amber-50 text-amber-700 border-amber-200',
  'Weak':        'bg-red-50 text-red-600 border-red-200',
}

const MARGIN_COLORS: Record<string, string> = {
  'Excellent':  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Good':       'bg-blue-50 text-blue-700 border-blue-200',
  'Moderate':   'bg-amber-50 text-amber-700 border-amber-200',
  'Thin':       'bg-orange-50 text-orange-700 border-orange-200',
  'Cyclical':   'bg-purple-50 text-purple-700 border-purple-200',
}

// ─── Types ───────────────────────────────────────────────────────────────────

type SortKey = keyof ValuationMetrics
type SortDir = 'asc' | 'desc'

const LAYER_LABELS: Record<number, string> = {
  0:  'L0 Edge',
  1:  'L1 Hyperscalers',
  2:  'L2 GPU Cloud',
  3:  'L3 DC Facilities',
  4:  'L4 Chip Design',
  5:  'L5 Semi Mfg',
  6:  'L6 Connectivity',
  7:  'L7 Optical',
  8:  'L8 Networking',
  9:  'L9 Rack/OEM',
  10: 'L10 Power/Cool',
  11: 'L11 Power Semi',
  12: 'L12 Construction',
  13: 'L13 Logistics',
  14: 'L14 Energy',
  15: 'L15 Materials',
}

// ─── Table column config ─────────────────────────────────────────────────────

interface ColDef {
  key: SortKey
  label: string
  tooltip: string
  fmt: (row: ValuationMetrics) => string
  colorFn?: (row: ValuationMetrics) => string
  defaultDir?: SortDir
  clickable?: boolean  // opens valuation modal
}

const COLUMNS: ColDef[] = [
  // ── Forward Valuation ─────────────────────────────────────────────────────
  {
    key: 'fairValue', label: 'Fair Value', tooltip: 'Click to see assumptions. Forward PE model: 2031 Target Price discounted to today at WACC.',
    fmt: r => r.fairValue ? fmtPrice(r.fairValue) : '—',
    colorFn: r => {
      if (!r.fairValue || !r.upside) return 'text-slate-400'
      return r.upside >= 0.20 ? 'text-emerald-600 font-semibold cursor-pointer'
           : r.upside >= 0    ? 'text-amber-600 cursor-pointer'
           :                    'text-red-500 cursor-pointer'
    },
    defaultDir: 'desc',
    clickable: true,
  },
  {
    key: 'upside', label: 'Upside', tooltip: '(Fair Value − Price) / Price. Click for full assumptions.',
    fmt: r => {
      if (r.upside === null) return '—'
      return (r.upside >= 0 ? '+' : '') + (r.upside * 100).toFixed(0) + '%'
    },
    colorFn: r => {
      if (r.upside === null) return 'text-slate-400'
      return r.upside >= 0.20 ? 'text-emerald-600 font-semibold cursor-pointer'
           : r.upside >= 0    ? 'text-amber-600 cursor-pointer'
           :                    'text-red-500 cursor-pointer'
    },
    defaultDir: 'desc',
    clickable: true,
  },
  // ── Price & Performance ────────────────────────────────────────────────────
  {
    key: 'price', label: 'Price', tooltip: 'Last price from Yahoo Finance',
    fmt: r => fmtPrice(r.price),
    defaultDir: 'desc',
  },
  {
    key: 'marketCap', label: 'Mkt Cap', tooltip: 'Market capitalization',
    fmt: r => fmtMktCap(r.marketCap),
    defaultDir: 'desc',
  },
  {
    key: 'change1d', label: '1D%', tooltip: "Today's price change %",
    fmt: r => fmtPct(r.change1d),
    colorFn: r => r.change1d === null ? 'text-slate-400' : r.change1d >= 0 ? 'text-emerald-600' : 'text-red-500',
    defaultDir: 'desc',
  },
  {
    key: 'change52w', label: '52W%', tooltip: '52-week price performance',
    fmt: r => fmtPct(r.change52w),
    colorFn: r => r.change52w === null ? 'text-slate-400' : r.change52w >= 0 ? 'text-emerald-600' : 'text-red-500',
    defaultDir: 'desc',
  },
  // ── Valuation Multiples ────────────────────────────────────────────────────
  {
    key: 'pe', label: 'P/E', tooltip: 'Price / Trailing 12-month EPS',
    fmt: r => fmtNum(r.pe),
    colorFn: r => metricColor(r.pe, 'pe'),
    defaultDir: 'asc',
  },
  {
    key: 'forwardPe', label: 'Fwd P/E', tooltip: 'Price / Forward EPS estimate (analyst consensus)',
    fmt: r => fmtNum(r.forwardPe),
    colorFn: r => metricColor(r.forwardPe, 'pe'),
    defaultDir: 'asc',
  },
  {
    key: 'peg', label: 'PEG', tooltip: 'P/E ÷ EPS growth rate. < 1 = undervalued (Peter Lynch). Negative = negative EPS growth.',
    fmt: r => fmtNum(r.peg),
    colorFn: r => metricColor(r.peg, 'peg'),
    defaultDir: 'asc',
  },
  {
    key: 'pfcf', label: 'P/FCF', tooltip: 'Price / Free Cash Flow. "Neg FCF" means the company has negative free cash flow — burning cash.',
    fmt: r => {
      if (r.pfcf === null) return '—'
      if (r.pfcf < 0) return 'Neg FCF'
      return fmtNum(r.pfcf)
    },
    colorFn: r => {
      if (r.pfcf === null) return 'text-slate-400'
      if (r.pfcf < 0) return 'text-red-500 font-semibold'
      return metricColor(r.pfcf, 'pfcf')
    },
    defaultDir: 'asc',
  },
  {
    key: 'evEbitda', label: 'EV/EBITDA', tooltip: 'Enterprise Value / EBITDA. Captures debt. < 12x is attractive.',
    fmt: r => fmtNum(r.evEbitda),
    colorFn: r => metricColor(r.evEbitda, 'evEbitda'),
    defaultDir: 'asc',
  },
  {
    key: 'evRevenue', label: 'EV/Rev', tooltip: 'Enterprise Value / Revenue. Useful for pre-profit companies.',
    fmt: r => fmtNum(r.evRevenue),
    colorFn: r => metricColor(r.evRevenue, 'evRev'),
    defaultDir: 'asc',
  },
  {
    key: 'pb', label: 'P/B', tooltip: 'Price / Book Value. Graham: buy below book when possible.',
    fmt: r => fmtNum(r.pb),
    colorFn: r => metricColor(r.pb, 'pb'),
    defaultDir: 'asc',
  },
  {
    key: 'ps', label: 'P/S', tooltip: 'Price / Sales (TTM). < 3x often attractive. High for hypergrowth is OK.',
    fmt: r => fmtNum(r.ps),
    colorFn: r => metricColor(r.ps, 'ps'),
    defaultDir: 'asc',
  },
  // ── Cash Flow ──────────────────────────────────────────────────────────────
  {
    key: 'fcfYield', label: 'FCF Yield', tooltip: 'Free Cash Flow / Market Cap. Negative = burning cash. > 6% = very attractive.',
    fmt: r => {
      if (r.fcfYield === null) return '—'
      return fmtPctPlain(r.fcfYield)  // shows negative % directly
    },
    colorFn: r => metricColor(r.fcfYield, 'fcfYield'),
    defaultDir: 'desc',
  },
  {
    key: 'fcfMargin', label: 'FCF Mgn', tooltip: 'Free Cash Flow / Revenue. How much cash the business generates per $1 of sales. Negative = burning cash.',
    fmt: r => {
      if (r.fcfMargin === null) return '—'
      return fmtPctPlain(r.fcfMargin)
    },
    colorFn: r => metricColor(r.fcfMargin, 'fcfMargin'),
    defaultDir: 'desc',
  },
  {
    key: 'freeCashflow', label: 'FCF ($)', tooltip: 'Free cash flow in USD. For ADR companies, converted from reporting currency via live FX rate.',
    fmt: r => fmtCash(r.freeCashflow),
    colorFn: r => r.freeCashflow === null ? 'text-slate-400' : r.freeCashflow < 0 ? 'text-red-500' : 'text-emerald-600',
    defaultDir: 'desc',
  },
  {
    key: 'operatingCashflow', label: 'Op CF ($)', tooltip: 'Operating cash flow in USD. For ADR companies, converted from reporting currency via live FX rate.',
    fmt: r => fmtCash(r.operatingCashflow),
    colorFn: r => r.operatingCashflow === null ? 'text-slate-400' : r.operatingCashflow < 0 ? 'text-red-500' : 'text-slate-700',
    defaultDir: 'desc',
  },
  // ── Profitability ──────────────────────────────────────────────────────────
  {
    key: 'grossMargin', label: 'Gross Mgn', tooltip: 'Gross Margin % — moat indicator. Buffett loves > 40%.',
    fmt: r => fmtPctPlain(r.grossMargin),
    colorFn: r => metricColor(r.grossMargin, 'margin'),
    defaultDir: 'desc',
  },
  {
    key: 'operatingMargin', label: 'Op Mgn', tooltip: 'Operating Margin % — operating efficiency',
    fmt: r => fmtPctPlain(r.operatingMargin),
    colorFn: r => metricColor(r.operatingMargin, 'margin'),
    defaultDir: 'desc',
  },
  {
    key: 'profitMargin', label: 'Net Mgn', tooltip: 'Net Profit Margin %',
    fmt: r => fmtPctPlain(r.profitMargin),
    colorFn: r => metricColor(r.profitMargin, 'margin'),
    defaultDir: 'desc',
  },
  {
    key: 'roe', label: 'ROE', tooltip: 'Return on Equity. Buffett target: > 15% consistently.',
    fmt: r => fmtPctPlain(r.roe),
    colorFn: r => metricColor(r.roe, 'roe'),
    defaultDir: 'desc',
  },
  {
    key: 'roa', label: 'ROA', tooltip: 'Return on Assets — capital efficiency across debt + equity',
    fmt: r => fmtPctPlain(r.roa),
    colorFn: r => metricColor(r.roa, 'roe'),
    defaultDir: 'desc',
  },
  // ── Growth ─────────────────────────────────────────────────────────────────
  {
    key: 'revenueGrowth', label: 'Rev Growth', tooltip: 'YoY Revenue Growth %',
    fmt: r => fmtPct(r.revenueGrowth),
    colorFn: r => metricColor(r.revenueGrowth, 'growth'),
    defaultDir: 'desc',
  },
  {
    key: 'earningsGrowth', label: 'EPS Growth', tooltip: 'YoY Earnings Growth %',
    fmt: r => fmtPct(r.earningsGrowth),
    colorFn: r => metricColor(r.earningsGrowth, 'growth'),
    defaultDir: 'desc',
  },
  // ── Balance Sheet / Leverage ───────────────────────────────────────────────
  {
    key: 'netDebt', label: 'Net Debt ($)', tooltip: 'Total Debt − Cash in USD. Negative = net cash position.',
    fmt: r => fmtCash(r.netDebt),
    colorFn: r => r.netDebt === null ? 'text-slate-400' : r.netDebt < 0 ? 'text-emerald-600' : r.netDebt < 1e10 ? 'text-slate-700' : 'text-red-500',
    defaultDir: 'asc',
  },
  {
    key: 'netDebtToEbitda', label: 'ND/EBITDA', tooltip: 'Net Debt / EBITDA. Negative = net cash. < 2x safe, > 4x dangerous.',
    fmt: r => {
      if (r.netDebtToEbitda === null) return '—'
      const v = r.netDebtToEbitda
      return (v < 0 ? '' : '') + fmtNum(v)
    },
    colorFn: r => metricColor(r.netDebtToEbitda, 'netDebtEbitda'),
    defaultDir: 'asc',
  },
  {
    key: 'debtToEquity', label: 'D/E%', tooltip: 'Debt/Equity in % (Yahoo format). < 50% = low leverage.',
    fmt: r => r.debtToEquity === null ? '—' : r.debtToEquity.toFixed(0) + '%',
    colorFn: r => metricColor(r.debtToEquity, 'debtEq'),
    defaultDir: 'asc',
  },
  {
    key: 'currentRatio', label: 'Curr Ratio', tooltip: 'Current assets / current liabilities. > 1.5 is healthy.',
    fmt: r => fmtNum(r.currentRatio),
    colorFn: r => metricColor(r.currentRatio, 'current'),
    defaultDir: 'desc',
  },
  // ── Other ──────────────────────────────────────────────────────────────────
  {
    key: 'dividendYield', label: 'Div Yield', tooltip: 'Annual dividend yield %',
    fmt: r => r.dividendYield === null ? '—' : (r.dividendYield * 100).toFixed(2) + '%',
    colorFn: r => metricColor(r.dividendYield, 'divYield'),
    defaultDir: 'desc',
  },
  {
    key: 'beta', label: 'Beta', tooltip: 'Market beta. > 1 = more volatile than S&P 500.',
    fmt: r => fmtNum(r.beta),
    defaultDir: 'asc',
  },
]

// ─── Score bar component ─────────────────────────────────────────────────────

// ─── Valuation assumptions modal ──────────────────────────────────────────────

function fmtB(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return sign + '$' + (abs / 1e12).toFixed(2) + 'T'
  if (abs >= 1e9)  return sign + '$' + (abs / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6)  return sign + '$' + (abs / 1e6).toFixed(0) + 'M'
  return sign + '$' + abs.toFixed(0)
}

function NumInput({
  value, onChange, step = '0.1', min, max, suffix,
}: {
  value: string; onChange: (v: string) => void
  step?: string; min?: string; max?: string; suffix?: string
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        step={step}
        min={min}
        max={max}
        className="w-20 text-right border border-slate-200 rounded-md px-2 py-0.5 text-[12px] font-mono focus:outline-none focus:border-blue-400 bg-slate-50"
      />
      {suffix && <span className="text-slate-400 text-[11px]">{suffix}</span>}
    </div>
  )
}

function ValuationModal({
  row,
  onClose,
}: {
  row: ValuationMetrics
  onClose: () => void
}) {
  const a = row.valAssumptions as ValuationAssumptions | null

  // Hooks must run unconditionally — initialize with fallbacks when a is null
  const [cagr,     setCagr]     = useState(a ? (a.revenueCAGR     * 100).toFixed(1) : '10.0')
  const [margin,   setMargin]   = useState(a ? (a.profitMargin2031 * 100).toFixed(1) : '10.0')
  const [pe,       setPe]       = useState(a ? a.peRatio2031.toString()              : '20')
  const [dilution, setDilution] = useState(a ? (a.dilutionRate     * 100).toFixed(1) : '2.0')
  const [wacc,     setWacc]     = useState(a ? (a.discountRate     * 100).toFixed(1) : '10.0')

  const computed = useMemo(() => {
    if (!a) return null
    const c = parseFloat(cagr)     / 100
    const m = parseFloat(margin)   / 100
    const p = parseFloat(pe)
    const d = parseFloat(dilution) / 100
    const w = parseFloat(wacc)     / 100
    const price = row.price ?? 0

    if ([c, m, p, d, w].some(isNaN)) return null

    const N = 5
    const rev2031   = a.ltvRevenue * Math.pow(1 + c, N)
    const ni2031    = rev2031 * m
    const shr2031   = a.sharesOutstanding * Math.pow(1 + d, N)
    const target    = (ni2031 / shr2031) * p
    if (!isFinite(target) || target <= 0) return null

    const fair     = target / Math.pow(1 + w, N)
    const target1y = target / Math.pow(1 + w, N - 1)
    const upside   = price > 0 ? (fair - price) / price : 0
    const annRet   = (Math.pow(1 + upside, 1 / N) - 1) * 100
    return { target, fair, target1y, upside, annRet, rev2031, shr2031 }
  }, [cagr, margin, pe, dilution, wacc, a, row.price])

  // Guard after all hooks
  if (!a) return null

  const upsideColor = !computed ? '#64748b'
    : computed.upside >= 0.20 ? '#16a34a'
    : computed.upside >= 0    ? '#d97706'
    : '#dc2626'

  const isModified =
    cagr     !== (a.revenueCAGR     * 100).toFixed(1) ||
    margin   !== (a.profitMargin2031 * 100).toFixed(1) ||
    pe       !== a.peRatio2031.toString() ||
    dilution !== (a.dilutionRate     * 100).toFixed(1) ||
    wacc     !== (a.discountRate     * 100).toFixed(1)

  const reset = () => {
    setCagr(    (a.revenueCAGR     * 100).toFixed(1))
    setMargin(  (a.profitMargin2031 * 100).toFixed(1))
    setPe(       a.peRatio2031.toString())
    setDilution((a.dilutionRate     * 100).toFixed(1))
    setWacc(    (a.discountRate     * 100).toFixed(1))
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <span className="font-bold text-slate-900 font-mono text-lg">{row.ticker}</span>
            <span className="text-slate-500 text-sm ml-2">{row.name}</span>
            {row.financialCurrency && row.financialCurrency !== 'USD' && (
              <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                {row.financialCurrency} ADR
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-5 text-[13px]">

          {/* Currency note */}
          {a.currencyNote && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[12px]">
              <div className="text-amber-700 font-semibold mb-0.5">⚠ ADR Currency Adjustment</div>
              <div className="text-amber-600">{a.currencyNote}</div>
            </div>
          )}

          {/* Past Evidence */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Past Evidence &amp; Derivation
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-2">
              {[
                { label: 'Revenue CAGR',    evidence: a.cagrEvidence },
                { label: 'Net Margin 2031', evidence: a.marginEvidence },
                { label: 'Exit PE 2031',    evidence: a.peEvidence },
                { label: 'Share Dilution',  evidence: a.dilutionEvidence },
                { label: 'WACC',            evidence: a.waccEvidence },
              ].map(({ label, evidence }) => (
                <div key={label} className="flex gap-2">
                  <span className="text-slate-400 w-28 shrink-0 text-[11px] font-medium">{label}</span>
                  <span className="text-slate-600 text-[11px] leading-relaxed">{evidence}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Editable Assumptions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Assumptions {isModified && <span className="text-blue-500 normal-case ml-1">(modified)</span>}
              </div>
              {isModified && (
                <button
                  onClick={reset}
                  className="text-[11px] text-blue-500 hover:text-blue-700 underline"
                >
                  Reset to model
                </button>
              )}
            </div>
            <div className="space-y-2">
              {/* Read-only */}
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-slate-500">LTM Revenue</span>
                <span className="font-medium text-slate-800 font-mono">{fmtB(a.ltvRevenue)}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-slate-500">Shares Outstanding</span>
                <span className="font-medium text-slate-800 font-mono">{(a.sharesOutstanding / 1e9).toFixed(3)}B</span>
              </div>
              <div className="border-t border-slate-100 pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-700 font-medium">5Y Revenue CAGR</span>
                    <div className="text-[10px] text-slate-400">Annual revenue growth rate to 2031</div>
                  </div>
                  <NumInput value={cagr} onChange={setCagr} step="0.5" min="-10" max="100" suffix="%" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-700 font-medium">Net Margin 2031</span>
                    <div className="text-[10px] text-slate-400">Projected net profit margin</div>
                  </div>
                  <NumInput value={margin} onChange={setMargin} step="0.5" min="0" max="80" suffix="%" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-700 font-medium">Exit P/E 2031</span>
                    <div className="text-[10px] text-slate-400">Normalized sector multiple at exit</div>
                  </div>
                  <NumInput value={pe} onChange={setPe} step="1" min="5" max="100" suffix="×" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-700 font-medium">Annual Dilution</span>
                    <div className="text-[10px] text-slate-400">Stock-based comp / share count growth</div>
                  </div>
                  <NumInput value={dilution} onChange={setDilution} step="0.5" min="0" max="10" suffix="%" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-700 font-medium">Discount Rate (WACC)</span>
                    <div className="text-[10px] text-slate-400">Required return on equity + debt</div>
                  </div>
                  <NumInput value={wacc} onChange={setWacc} step="0.5" min="4" max="30" suffix="%" />
                </div>
              </div>
            </div>
          </div>

          {/* Formula display */}
          {computed && (
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Formula</div>
              <div className="text-[11px] font-mono text-slate-600 leading-relaxed">
                {fmtB(a.ltvRevenue)} × (1+{cagr}%)^5 × {margin}% × {pe}×
                <br />
                ÷ [{(a.sharesOutstanding / 1e9).toFixed(3)}B × (1+{dilution}%)^5]
                <br />
                = <span className="font-semibold text-slate-800">${computed.target.toFixed(0)}</span> target in 2031
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Discounted at {wacc}% for 5y → fair value today
              </div>
            </div>
          )}

          {/* Results */}
          {computed && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Results</div>
              {[
                { label: 'Actual Price',     value: fmtPrice(row.price),              color: 'text-slate-800' },
                { label: '2031 Target',      value: '$' + computed.target.toFixed(0), color: 'text-blue-600' },
                { label: 'Fair Value Today', value: '$' + computed.fair.toFixed(2),   color: computed.upside >= 0 ? 'text-emerald-700' : 'text-red-600' },
                { label: '1Y Price Target',  value: '$' + computed.target1y.toFixed(2), color: 'text-blue-700' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium uppercase text-[11px] tracking-wide">{item.label}</span>
                  <span className={`font-bold text-[15px] ${item.color}`}>{item.value}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-1.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium uppercase text-[11px] tracking-wide">Potential Upside</span>
                  <span className="font-bold text-[17px]" style={{ color: upsideColor }}>
                    {computed.upside >= 0 ? '+' : ''}{(computed.upside * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium uppercase text-[11px] tracking-wide">Expected Return</span>
                  <span className="font-bold text-[15px]" style={{ color: upsideColor }}>
                    {computed.annRet >= 0 ? '+' : ''}{computed.annRet.toFixed(1)}%/yr
                  </span>
                </div>
                {row.dividendYield ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium uppercase text-[11px] tracking-wide">Dividend Yield</span>
                    <span className="font-bold text-[13px] text-slate-700">+{(row.dividendYield * 100).toFixed(2)}%/yr</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
            Forward PE model. Modify any assumption above and results update live.
            CAGR mean-reverted from YoY data. WACC: beta + D/MktCap + RF 4.5% + ERP 5.5%.
            Sector PE assumes overvaluations compress by 2031. Not investment advice.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Layer insight card ───────────────────────────────────────────────────────

function LayerInsightCard({ layer }: { layer: number }) {
  const info = LAYER_INFO[layer]
  const color = LAYER_COLORS[layer] ?? '#6b7280'
  if (!info) return null
  return (
    <div
      className="rounded-xl border p-4 mb-4"
      style={{ borderColor: color + '40', backgroundColor: color + '08' }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold"
            style={{ backgroundColor: color + '20', color }}
          >
            L{layer}
          </span>
          <span className="font-bold text-slate-900 text-[14px]">{info.title}</span>
        </div>
        <div className="flex gap-2 shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${MOAT_COLORS[info.moatRating]}`}>
            Moat: {info.moatRating}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${MARGIN_COLORS[info.marginRating]}`}>
            Margins: {info.marginRating}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">What They Do</div>
          <p className="text-[12px] text-slate-700 leading-relaxed">{info.what}</p>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Revenue Model</div>
          <p className="text-[12px] text-slate-700 leading-relaxed">{info.revenue}</p>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Profitability</div>
          <p className="text-[12px] text-slate-700 leading-relaxed">{info.profitability}</p>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Competitive Moat</div>
          <p className="text-[12px] text-slate-700 leading-relaxed">{info.moat}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Score bar component ─────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const { color } = getScoreLabel(score)
  const pct = Math.max(0, Math.min(100, score))
  const barColor =
    score >= 70 ? '#16a34a' :
    score >= 55 ? '#65a30d' :
    score >= 40 ? '#d97706' :
    score >= 25 ? '#ea580c' : '#dc2626'

  return (
    <div className="flex items-center gap-1.5 min-w-[90px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
        {score}
      </span>
    </div>
  )
}

// ─── Layer badge ─────────────────────────────────────────────────────────────

function LayerBadge({ layer, label }: { layer: number; label: string }) {
  const color = LAYER_COLORS[layer] ?? '#6b7280'
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
      style={{ backgroundColor: color + '18', color }}
    >
      {label}
    </span>
  )
}

// ─── Stats summary cards ──────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 min-w-[130px]">
      <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-slate-900 mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Risk-averse screen ───────────────────────────────────────────────────────
// Capital Preservation + Quality + Value (Graham/Buffett framework)
// A stock passes only if ALL verifiable criteria are met.

const RISK_CRITERIA = [
  { label: 'Positive FCF',       desc: 'Free cash flow ≥ 0 — never buy cash-burning companies' },
  { label: 'D/E < 200%',         desc: 'Debt/Equity below 200% — leverage amplifies losses in downturns' },
  { label: 'Current Ratio ≥ 1',  desc: 'Can meet short-term obligations — avoids liquidity crises' },
  { label: 'Gross Margin ≥ 15%', desc: 'Some pricing power — margin buffer in bad markets' },
  { label: 'Value Score ≥ 40',   desc: 'Not in "Expensive" territory — margin of safety (Graham)' },
  { label: 'Data verified',      desc: 'Yahoo Finance data must be available — never act on missing data' },
]

function passesRiskScreen(row: ValuationMetrics): boolean {
  if (row.error) return false                                           // no data
  if (row.freeCashflow === null || row.freeCashflow < 0) return false  // burning cash
  if (row.debtToEquity !== null && row.debtToEquity > 200) return false // over-leveraged
  if (row.currentRatio !== null && row.currentRatio < 1.0) return false // liquidity risk
  if (row.grossMargin !== null && row.grossMargin < 0.15) return false  // no pricing power
  if (row.valueScore < 40) return false                                 // too expensive
  return true
}

export default function AIStackPage() {
  const [data, setData]               = useState<ValuationMetrics[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [layerFilter, setLayerFilter] = useState<number | null>(null)
  const [riskAverse, setRiskAverse]   = useState(false)
  const [valModal, setValModal]       = useState<ValuationMetrics | null>(null)
  const [sortKey, setSortKey]         = useState<SortKey>('valueScore')
  const [sortDir, setSortDir]         = useState<SortDir>('desc')
  const [lastFetch, setLastFetch]     = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-stack')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: ValuationMetrics[] = await res.json()
      setData(json)
      setLastFetch(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSort = (key: SortKey, defaultDir: SortDir = 'desc') => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(defaultDir)
    }
  }

  const filtered = useMemo(() => {
    let rows = [...data]

    if (riskAverse) {
      rows = rows.filter(passesRiskScreen)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(r =>
        r.ticker.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.layerLabel.toLowerCase().includes(q) ||
        (r.sublayer ?? '').toLowerCase().includes(q)
      )
    }

    if (layerFilter !== null) {
      rows = rows.filter(r => r.layer === layerFilter)
    }

    rows.sort((a, b) => {
      const av = a[sortKey] as number | null
      const bv = b[sortKey] as number | null
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return sortDir === 'asc' ? av - bv : bv - av
    })

    return rows
  }, [data, search, layerFilter, riskAverse, sortKey, sortDir])

  const stats = useMemo(() => {
    if (!data.length) return null
    const valid       = data.filter(r => !r.error && r.price !== null)
    const scored      = data.filter(r => r.valueScore > 0)
    const undervalued = scored.filter(r => r.valueScore >= 70).length
    const negFcf      = data.filter(r => r.freeCashflow !== null && r.freeCashflow < 0).length
    const safeCount   = data.filter(passesRiskScreen).length
    const avgScore    = scored.length ? Math.round(scored.reduce((s, r) => s + r.valueScore, 0) / scored.length) : 0
    const top5        = [...scored].sort((a, b) => b.valueScore - a.valueScore).slice(0, 5)
    return { total: valid.length, undervalued, negFcf, safeCount, avgScore, top5 }
  }, [data])

  const layers = useMemo(() => Array.from(new Set(data.map(r => r.layer))).sort((a, b) => a - b), [data])

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <span className="text-slate-300 ml-0.5">↕</span>
    return <span className="text-blue-500 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-[52px]">

      {/* Valuation assumptions modal */}
      {valModal?.valAssumptions && (
        <ValuationModal row={valModal} onClose={() => setValModal(null)} />
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                The AI Stack — Value Investing Dashboard
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {data.length} companies across 16 layers of the AI infrastructure supply chain.
                Live data from Yahoo Finance. Scored by Buffett/Lynch value metrics.
              </p>
              {lastFetch && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Last updated: {lastFetch.toLocaleTimeString()}
                  {' · '}Data cached 30 min
                </p>
              )}
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="shrink-0 h-8 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              {loading ? (
                <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Fetching…</>
              ) : (
                <><span>↻</span> Refresh</>
              )}
            </button>
          </div>

          {/* Stats strip */}
          {stats && !loading && (
            <div className="flex gap-3 mt-4 flex-wrap">
              <StatCard label="Total Tracked" value={stats.total.toString()} sub="public companies" />
              <StatCard label="Avg Score" value={stats.avgScore.toString()} sub="out of 100" />
              <StatCard label="Undervalued" value={stats.undervalued.toString()} sub="score ≥ 70" />
              <div
                className="bg-white border-2 rounded-xl px-4 py-3 min-w-[130px] cursor-pointer transition-colors"
                style={{ borderColor: riskAverse ? '#16a34a' : '#e2e8f0', backgroundColor: riskAverse ? '#f0fdf4' : 'white' }}
                onClick={() => setRiskAverse(v => !v)}
                title="Click to toggle risk-averse filter"
              >
                <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: riskAverse ? '#16a34a' : '#64748b' }}>
                  {riskAverse ? '🛡 Filter ON' : '🛡 Safe Picks'}
                </div>
                <div className="text-xl font-bold mt-0.5" style={{ color: riskAverse ? '#16a34a' : '#0f172a' }}>
                  {stats.safeCount}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: riskAverse ? '#16a34a' : '#94a3b8' }}>
                  {riskAverse ? 'click to clear' : 'pass all criteria'}
                </div>
              </div>
              <StatCard
                label="Negative FCF"
                value={stats.negFcf.toString()}
                sub="burning cash"
              />
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 min-w-[220px]">
                <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Top Picks (by score)</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {stats.top5.map(r => (
                    <Link
                      key={r.ticker}
                      href={`/stock/${r.ticker}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded transition-colors"
                    >
                      {r.ticker}
                      <span className="font-normal opacity-70">{r.valueScore}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 sticky top-[52px] z-20">
        <div className="max-w-screen-2xl mx-auto flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:border-blue-400 transition-colors">
            <svg className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ticker, company, layer…"
              className="bg-transparent text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none w-48"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">✕</button>
            )}
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setLayerFilter(null)}
              className={`h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors ${
                layerFilter === null ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Layers
            </button>
            {layers.map(layer => (
              <button
                key={layer}
                onClick={() => setLayerFilter(layerFilter === layer ? null : layer)}
                className={`h-7 px-2 text-[10px] font-medium rounded-md transition-colors ${
                  layerFilter === layer ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                style={layerFilter === layer ? { backgroundColor: LAYER_COLORS[layer] } : {}}
              >
                L{layer}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Risk-averse toggle */}
            <button
              onClick={() => setRiskAverse(v => !v)}
              className={`h-7 px-3 text-[11px] font-semibold rounded-md border transition-colors flex items-center gap-1.5 ${
                riskAverse
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-slate-300 text-slate-600 hover:border-emerald-500 hover:text-emerald-600'
              }`}
              title="Show only stocks that pass all 6 risk-averse criteria"
            >
              🛡 Risk-Averse{riskAverse ? ' ✓' : ''}
            </button>

            <div className="text-[12px] text-slate-400">
              {filtered.length} of {data.length} rows
            </div>
          </div>
        </div>

        {/* Risk-averse criteria panel */}
        {riskAverse && (
          <div className="max-w-screen-2xl mx-auto mt-0 pb-2 flex gap-2 flex-wrap">
            {RISK_CRITERIA.map(c => (
              <div key={c.label} className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-[11px]">
                <span className="text-emerald-600 font-semibold">✓ {c.label}</span>
                <span className="text-slate-500 hidden sm:inline">— {c.desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="px-6 py-4 max-w-screen-2xl mx-auto">
        {/* Layer insight card — shown when a specific layer is filtered */}
        {layerFilter !== null && <LayerInsightCard layer={layerFilter} />}

        {loading && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 gap-4 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
            <div className="text-sm font-medium">Loading ~125 tickers from Yahoo Finance…</div>
            <div className="text-xs text-slate-400">First load takes ~15 seconds. Data is cached for 30 minutes.</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-40 text-red-500 text-sm">{error}</div>
        ) : (
          <div className="relative overflow-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="sticky left-0 bg-slate-50 z-10 text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide w-8 border-r border-slate-200">#</th>
                  <th className="sticky left-8 bg-slate-50 z-10 text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide min-w-[68px] border-r border-slate-200">Ticker</th>
                  <th className="sticky left-[116px] bg-slate-50 z-10 text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide min-w-[160px] border-r border-slate-200">Company</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide min-w-[100px]">Layer</th>
                  <th
                    className="text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide cursor-pointer hover:text-blue-600 whitespace-nowrap min-w-[110px]"
                    onClick={() => handleSort('valueScore', 'desc')}
                    title="Composite value score 0–100"
                  >
                    Value Score <SortIcon k="valueScore" />
                  </th>
                  {COLUMNS.map(col => (
                    <th
                      key={col.key as string}
                      className="text-right px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide cursor-pointer hover:text-blue-600 whitespace-nowrap"
                      onClick={() => handleSort(col.key, col.defaultDir)}
                      title={col.tooltip}
                    >
                      {col.label} <SortIcon k={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => {
                  const { label: scoreLabel, color: scoreColor } = getScoreLabel(row.valueScore)
                  const isError = row.error === true
                  return (
                    <tr
                      key={row.ticker}
                      className={`border-b border-slate-100 transition-colors ${isError ? 'opacity-40' : 'hover:bg-blue-50/40'}`}
                    >
                      <td className="sticky left-0 bg-white z-10 px-3 py-2 text-slate-400 text-[11px] text-center border-r border-slate-100">
                        {idx + 1}
                      </td>
                      <td className="sticky left-8 bg-white z-10 px-3 py-2 border-r border-slate-100">
                        <Link
                          href={`/stock/${row.ticker}`}
                          className="font-bold text-blue-600 hover:text-blue-800 transition-colors font-mono text-[12px]"
                        >
                          {row.ticker}
                        </Link>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {row.exchange && (
                            <span className="text-[9px] font-medium text-slate-400 bg-slate-100 px-1 py-0.5 rounded">
                              {row.exchange}
                            </span>
                          )}
                          {row.financialCurrency !== 'USD' && (
                            <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1 py-0.5 rounded" title={`Financials reported in ${row.financialCurrency}, converted to USD via live FX rate`}>
                              ADR·{row.financialCurrency}→$
                            </span>
                          )}
                          {isError && <span className="text-[9px] text-red-400">no data</span>}
                        </div>
                      </td>
                      <td className="sticky left-[116px] bg-white z-10 px-3 py-2 border-r border-slate-100">
                        <div className="text-slate-700 text-[12px] truncate max-w-[155px]" title={row.name}>
                          {row.name}
                        </div>
                        {row.sublayer && (
                          <div className="text-[10px] text-slate-400 truncate">{row.sublayer}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <LayerBadge layer={row.layer} label={LAYER_LABELS[row.layer] ?? `L${row.layer}`} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          <ScoreBar score={row.valueScore} />
                          <span className="text-[10px]" style={{ color: scoreColor }}>{scoreLabel}</span>
                        </div>
                      </td>
                      {COLUMNS.map(col => {
                        const val = col.fmt(row)
                        const colorClass = col.colorFn ? col.colorFn(row) : 'text-slate-700'
                        const canClick = col.clickable && row.valAssumptions
                        return (
                          <td
                            key={col.key as string}
                            className={`px-3 py-2 text-right tabular-nums ${colorClass}`}
                            onClick={canClick ? () => setValModal(row) : undefined}
                            title={canClick ? 'Click to see valuation assumptions' : undefined}
                          >
                            {val}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length + 5} className="text-center py-12 text-slate-400 text-sm">
                      No results match your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Score legend */}
      {!loading && data.length > 0 && (
        <div className="px-6 pb-8 max-w-screen-2xl mx-auto">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
              How the Value Score Works (0–100)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
              {[
                { label: 'FCF Yield', weight: '18%', desc: 'Cash flow / market cap. The #1 signal — you\'re buying a stream of cash. Negative FCF = heavily penalized.' },
                { label: 'EV/EBITDA', weight: '15%', desc: 'Whole-company cost vs. operating earnings. Captures debt. Damodaran\'s preferred multiple.' },
                { label: 'PEG Ratio', weight: '13%', desc: 'P/E ÷ growth rate. < 1 = undervalued. Rewards growth at a fair price (Peter Lynch).' },
                { label: 'Return on Equity', weight: '12%', desc: 'Buffett\'s quality signal. > 15% consistently = durable competitive advantage.' },
                { label: 'Price / FCF', weight: '10%', desc: 'Market cap ÷ free cash flow. < 15x attractive. Negative FCF → score of 1/10.' },
                { label: 'Gross Margin', weight: '10%', desc: 'Moat / pricing power. Buffett: > 40% indicates durable competitive advantage.' },
                { label: 'Debt / Equity', weight: '9%',  desc: 'Balance sheet risk. < 50% = low leverage. Graham: avoid heavily indebted businesses.' },
                { label: 'Revenue Growth', weight: '8%', desc: 'YoY top-line momentum. Without growth, even cheap stocks can stay cheap.' },
                { label: 'Price / Book', weight: '5%',   desc: 'Graham floor. Buy below or near book value. Less meaningful for asset-light tech.' },
              ].map(item => (
                <div key={item.label} className="text-[11px]">
                  <div className="font-semibold text-slate-700">{item.label} <span className="text-slate-400 font-normal">({item.weight})</span></div>
                  <div className="text-slate-500 mt-0.5">{item.desc}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-4 flex-wrap mb-3">
              {[
                { score: '70–100', label: 'Undervalued', color: '#16a34a' },
                { score: '55–70', label: 'Fair Value',   color: '#65a30d' },
                { score: '40–55', label: 'Fairly Priced', color: '#d97706' },
                { score: '25–40', label: 'Overvalued',   color: '#ea580c' },
                { score: '0–25',  label: 'Expensive',    color: '#dc2626' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5 text-[11px]">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-slate-700">{item.score}</span>
                  <span className="text-slate-500">= {item.label}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 flex-wrap text-[11px]">
              {[
                { color: 'text-emerald-600', label: 'Green cell = attractive metric' },
                { color: 'text-slate-700',   label: 'Neutral' },
                { color: 'text-amber-600',   label: 'Yellow = watch' },
                { color: 'text-red-500',     label: 'Red = unfavorable or Neg FCF' },
                { color: 'text-slate-400',   label: '— = not available from Yahoo Finance' },
              ].map(item => (
                <div key={item.label} className={`flex items-center gap-1.5 ${item.color}`}>
                  <div className="w-2 h-2 rounded-full bg-current opacity-70" />
                  {item.label}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-3">
              Data: Yahoo Finance (live, cached 30 min). Scores are screening signals — not investment advice.
              Sector context matters: tech companies naturally have higher P/B; REIT D/E looks high but that&#39;s structural.
              A stock may score low due to negative FCF while in a high-growth reinvestment phase — use judgment.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
