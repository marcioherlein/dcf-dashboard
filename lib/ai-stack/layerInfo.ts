export interface LayerInfo {
  title: string
  what: string
  revenue: string
  profitability: string
  moat: string
  moatRating: 'Very Strong' | 'Strong' | 'Moderate' | 'Weak'
  marginRating: 'Excellent' | 'Good' | 'Moderate' | 'Thin' | 'Cyclical'
}

export const LAYER_INFO: Record<number, LayerInfo> = {
  0: {
    title: 'Edge Delivery & Inference',
    what: 'Run globally distributed server networks (PoPs) close to end-users to cache content, absorb DDoS attacks, and run AI inference at the edge — so responses arrive in milliseconds without routing back to a central data center.',
    revenue: 'Bandwidth consumption ($/GB), monthly platform fees, and security subscriptions. Cloudflare is fastest-growing; Akamai has the deepest enterprise base.',
    profitability: 'High gross margins (60–75%) because bandwidth costs are largely fixed. Operating margins are mid-tier — global PoP infrastructure is expensive to build and maintain.',
    moat: "Network effects (more PoPs = lower latency = better product) plus switching costs from deep CDN integration. AKAM has the deepest enterprise moat; NET has the strongest developer platform lock-in.",
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
    what: 'Integrate components (GPUs, CPUs, networking, storage) into complete server racks and systems, then sell to data centers. Super Micro specializes in high-density AI GPU servers with direct-liquid-cooling. Dell and HPE are full-stack IT vendors. Jabil and Celestica are contract manufacturers.',
    revenue: "Server and storage system sales, service contracts, and financing. Super Micro's DLC rack systems command a premium in AI deployments.",
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
    moat: "Vertiv is the reference design partner for hyperscalers in power/cooling — service agreements lock in recurring revenue. Eaton's power management software creates switching costs. CAT and Cummins have brand and service network moats for backup generators.",
    moatRating: 'Strong',
    marginRating: 'Good',
  },
  11: {
    title: 'Power Semiconductors',
    what: 'Make analog and mixed-signal chips that regulate, convert, and manage power — voltage regulators, power controllers, gate drivers. Every GPU server rack contains dozens. TXN and ADI are the giants; MPWR dominates high-efficiency DC-DC converters inside AI servers.',
    revenue: "Chip sales with 5–10 year design-win cycles. Once a chip is designed into a product, it stays for the product's entire life. TXN and ADI sell across 100,000+ customers with no single customer above 10%.",
    profitability: 'Exceptional and durable: TXN ~65% gross margin, ADI ~68%, MPWR ~55%. Operating margins 30–45%. Some of the most stable margin profiles in semiconductors because analog chips cannot be replicated by software.',
    moat: "Very strong. Analog design is an art — winning a design slot requires years of customer engagement and validation. TXN's 300mm fab ownership provides a structural cost moat. Once designed in, chips are re-ordered for the product's entire life.",
    moatRating: 'Very Strong',
    marginRating: 'Excellent',
  },
  12: {
    title: 'Data Center Construction',
    what: "Build data centers physically — electrical systems (EMCOR, Comfort Systems), civil construction (Sterling, Primoris), fiber/cable laying (Dycom, MasTec), and large-scale EPC projects (Fluor). These companies are in a capex supercycle driven by hyperscaler expansion.",
    revenue: "Fixed-price and cost-plus construction contracts. Backlogs are multi-year revenue visibility indicators — EMCOR's backlog exceeded $10B for the first time in 2024.",
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
    what: 'Provide the physical inputs for everything above. Copper (FCX, SCCO) goes into every wire, transformer, and busbar. Electrical steel (CLF, WS) goes into transformers. Rare earths (MP) go into cooling fan magnets. Industrial gases (LIN, APD) are used in chip fabrication. Grid equipment (GEV) and transmission contractors (PWR) build power grid upgrades reaching data centers.',
    revenue: 'Commodity prices for miners ($/lb copper, $/kg rare earth). Long-term take-or-pay supply agreements for industrial gases. Project contracts for grid and power equipment.',
    profitability: 'Commodity businesses are cyclical — copper miners swing from 40–50% EBITDA margin at peak to losses in downturns. Industrial gas (Linde, Air Products) is the most durable: ~30% operating margins on 20-year on-site contracts.',
    moat: "Linde has one of the best moats in materials — on-site gas plants built under 20-year contracts are too cheap to justify switching. Freeport's Grasberg mine is one of the largest and lowest-cost copper deposits on earth. MP Materials is the only significant Western miner-to-magnet rare earth player.",
    moatRating: 'Moderate',
    marginRating: 'Cyclical',
  },
}

export const MOAT_COLORS: Record<string, string> = {
  'Very Strong': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Strong':      'bg-blue-50 text-blue-700 border-blue-200',
  'Moderate':    'bg-amber-50 text-amber-700 border-amber-200',
  'Weak':        'bg-red-50 text-red-600 border-red-200',
}

export const MARGIN_COLORS: Record<string, string> = {
  'Excellent':  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Good':       'bg-blue-50 text-blue-700 border-blue-200',
  'Moderate':   'bg-amber-50 text-amber-700 border-amber-200',
  'Thin':       'bg-orange-50 text-orange-700 border-orange-200',
  'Cyclical':   'bg-purple-50 text-purple-700 border-purple-200',
}

// Hex colors for inline styles (used in print page where Tailwind may not apply)
export const MOAT_HEX: Record<string, { bg: string; text: string; border: string }> = {
  'Very Strong': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Strong':      { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'Moderate':    { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  'Weak':        { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
}

export const MARGIN_HEX: Record<string, { bg: string; text: string; border: string }> = {
  'Excellent':  { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Good':       { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'Moderate':   { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  'Thin':       { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  'Cyclical':   { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
}
