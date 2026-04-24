export interface AIStackTicker {
  ticker: string
  name: string
  layer: number
  layerLabel: string
  sublayer?: string
}

export const AI_STACK_TICKERS: AIStackTicker[] = [
  // Layer 0: Edge Delivery and Inference
  { ticker: 'AKAM', name: 'Akamai Technologies', layer: 0, layerLabel: 'Edge Delivery & Inference' },
  { ticker: 'FSLY', name: 'Fastly', layer: 0, layerLabel: 'Edge Delivery & Inference' },
  { ticker: 'NET',  name: 'Cloudflare', layer: 0, layerLabel: 'Edge Delivery & Inference' },

  // Layer 1: Hyperscalers
  { ticker: 'AMZN',  name: 'Amazon / AWS', layer: 1, layerLabel: 'Hyperscalers' },
  { ticker: 'MSFT',  name: 'Microsoft / Azure', layer: 1, layerLabel: 'Hyperscalers' },
  { ticker: 'GOOGL', name: 'Alphabet / Google Cloud', layer: 1, layerLabel: 'Hyperscalers' },
  { ticker: 'META',  name: 'Meta Platforms', layer: 1, layerLabel: 'Hyperscalers' },

  // Layer 2: GPU Cloud & Neocloud
  { ticker: 'IREN', name: 'Iris Energy', layer: 2, layerLabel: 'GPU Cloud & Neocloud' },
  { ticker: 'CIFR', name: 'Cipher Mining', layer: 2, layerLabel: 'GPU Cloud & Neocloud' },
  { ticker: 'WULF', name: 'TeraWulf', layer: 2, layerLabel: 'GPU Cloud & Neocloud' },
  { ticker: 'APLD', name: 'Applied Digital', layer: 2, layerLabel: 'GPU Cloud & Neocloud' },
  { ticker: 'CRWV', name: 'CoreWeave', layer: 2, layerLabel: 'GPU Cloud & Neocloud' },
  { ticker: 'NBIS', name: 'Nebius Group', layer: 2, layerLabel: 'GPU Cloud & Neocloud' },
  { ticker: 'ORCL', name: 'Oracle', layer: 2, layerLabel: 'GPU Cloud & Neocloud' },
  { ticker: 'DOCN', name: 'DigitalOcean', layer: 2, layerLabel: 'GPU Cloud & Neocloud' },

  // Layer 3: Data Center Facilities (REITs)
  { ticker: 'EQIX', name: 'Equinix', layer: 3, layerLabel: 'Data Center Facilities' },
  { ticker: 'DLR',  name: 'Digital Realty', layer: 3, layerLabel: 'Data Center Facilities' },
  { ticker: 'IRM',  name: 'Iron Mountain', layer: 3, layerLabel: 'Data Center Facilities' },

  // Layer 4: Chip Design
  { ticker: 'SNPS', name: 'Synopsys', layer: 4, layerLabel: 'Chip Design', sublayer: 'EDA Software' },
  { ticker: 'CDNS', name: 'Cadence Design Systems', layer: 4, layerLabel: 'Chip Design', sublayer: 'EDA Software' },
  { ticker: 'ARM',  name: 'ARM Holdings', layer: 4, layerLabel: 'Chip Design', sublayer: 'Architecture IP' },
  { ticker: 'RMBS', name: 'Rambus', layer: 4, layerLabel: 'Chip Design', sublayer: 'Architecture IP' },
  { ticker: 'NVDA', name: 'Nvidia', layer: 4, layerLabel: 'Chip Design', sublayer: 'Fabless' },
  { ticker: 'AVGO', name: 'Broadcom', layer: 4, layerLabel: 'Chip Design', sublayer: 'Fabless' },
  { ticker: 'MRVL', name: 'Marvell Technology', layer: 4, layerLabel: 'Chip Design', sublayer: 'Fabless' },
  { ticker: 'AMD',  name: 'Advanced Micro Devices', layer: 4, layerLabel: 'Chip Design', sublayer: 'Fabless' },
  { ticker: 'INTC', name: 'Intel', layer: 4, layerLabel: 'Chip Design', sublayer: 'Fabless' },
  { ticker: 'QCOM', name: 'Qualcomm', layer: 4, layerLabel: 'Chip Design', sublayer: 'Fabless' },
  { ticker: 'LSCC', name: 'Lattice Semiconductor', layer: 4, layerLabel: 'Chip Design', sublayer: 'Fabless' },

  // Layer 5: Semiconductor Manufacturing — Equipment
  { ticker: 'ASML', name: 'ASML Holding', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Equipment' },
  { ticker: 'LRCX', name: 'Lam Research', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Equipment' },
  { ticker: 'KLAC', name: 'KLA Corporation', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Equipment' },
  { ticker: 'AMAT', name: 'Applied Materials', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Equipment' },
  { ticker: 'ENTG', name: 'Entegris', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Equipment' },
  { ticker: 'CAMT', name: 'Camtek', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Equipment' },
  { ticker: 'ONTO', name: 'Onto Innovation', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Equipment' },
  { ticker: 'PLAB', name: 'Photronics', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Equipment' },
  { ticker: 'NVMI', name: 'Nova Ltd.', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Equipment' },
  { ticker: 'ACMR', name: 'ACM Research', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Equipment' },
  { ticker: 'KLIC', name: 'Kulicke and Soffa', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Equipment' },
  { ticker: 'UCTT', name: 'Ultra Clean Holdings', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Equipment' },
  { ticker: 'ICHR', name: 'Ichor Holdings', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Equipment' },
  { ticker: 'SOLS', name: 'Solstice Advanced Materials', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Materials' },
  // Fabrication
  { ticker: 'TSM',  name: 'TSMC', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Fabrication' },
  { ticker: 'GFS',  name: 'GlobalFoundries', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Fabrication' },
  { ticker: 'UMC',  name: 'United Microelectronics', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Fabrication' },
  { ticker: 'TSEM', name: 'Tower Semiconductor', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Fabrication' },
  // Memory & Storage
  { ticker: 'MU',   name: 'Micron Technology', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Memory' },
  { ticker: 'SNDK', name: 'SanDisk', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Memory' },
  { ticker: 'WDC',  name: 'Western Digital', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Memory' },
  { ticker: 'STX',  name: 'Seagate Technology', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Memory' },
  { ticker: 'PSTG', name: 'Pure Storage', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Memory' },
  { ticker: 'NTAP', name: 'NetApp', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Memory' },
  // Packaging & Test
  { ticker: 'AMKR', name: 'Amkor Technology', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Packaging/Test' },
  { ticker: 'KEYS', name: 'Keysight Technologies', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Packaging/Test' },
  { ticker: 'TER',  name: 'Teradyne', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Packaging/Test' },
  { ticker: 'AEHR', name: 'Aehr Test Systems', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Packaging/Test' },
  { ticker: 'VIAV', name: 'Viavi Solutions', layer: 5, layerLabel: 'Semiconductor Mfg', sublayer: 'Packaging/Test' },

  // Layer 6: Electrical Connectivity
  { ticker: 'APH',  name: 'Amphenol', layer: 6, layerLabel: 'Electrical Connectivity', sublayer: 'Connectors' },
  { ticker: 'TEL',  name: 'TE Connectivity', layer: 6, layerLabel: 'Electrical Connectivity', sublayer: 'Connectors' },
  { ticker: 'CRDO', name: 'Credo Technology', layer: 6, layerLabel: 'Electrical Connectivity', sublayer: 'High-Speed Chips' },
  { ticker: 'ALAB', name: 'Astera Labs', layer: 6, layerLabel: 'Electrical Connectivity', sublayer: 'High-Speed Chips' },
  { ticker: 'SITM', name: 'SiTime Corporation', layer: 6, layerLabel: 'Electrical Connectivity', sublayer: 'High-Speed Chips' },
  { ticker: 'SMTC', name: 'Semtech Corporation', layer: 6, layerLabel: 'Electrical Connectivity', sublayer: 'High-Speed Chips' },
  { ticker: 'EXTR', name: 'Extreme Networks', layer: 6, layerLabel: 'Electrical Connectivity', sublayer: 'High-Speed Chips' },
  { ticker: 'TTMI', name: 'TTM Technologies', layer: 6, layerLabel: 'Electrical Connectivity', sublayer: 'PCBs' },

  // Layer 7: Optical Interconnects and Fiber
  { ticker: 'LITE', name: 'Lumentum Holdings', layer: 7, layerLabel: 'Optical Interconnects' },
  { ticker: 'COHR', name: 'Coherent Corp.', layer: 7, layerLabel: 'Optical Interconnects' },
  { ticker: 'FN',   name: 'Fabrinet', layer: 7, layerLabel: 'Optical Interconnects' },
  { ticker: 'GLW',  name: 'Corning', layer: 7, layerLabel: 'Optical Interconnects' },
  { ticker: 'MTSI', name: 'MACOM Technology', layer: 7, layerLabel: 'Optical Interconnects' },
  { ticker: 'CIEN', name: 'Ciena', layer: 7, layerLabel: 'Optical Interconnects' },
  { ticker: 'AAOI', name: 'Applied Optoelectronics', layer: 7, layerLabel: 'Optical Interconnects' },

  // Layer 8: Networking Hardware
  { ticker: 'ANET', name: 'Arista Networks', layer: 8, layerLabel: 'Networking Hardware' },
  { ticker: 'CSCO', name: 'Cisco', layer: 8, layerLabel: 'Networking Hardware' },

  // Layer 9: Rack Assembly / OEM / ODM
  { ticker: 'JBL',  name: 'Jabil', layer: 9, layerLabel: 'Rack Assembly / OEM' },
  { ticker: 'CLS',  name: 'Celestica', layer: 9, layerLabel: 'Rack Assembly / OEM' },
  { ticker: 'DELL', name: 'Dell Technologies', layer: 9, layerLabel: 'Rack Assembly / OEM' },
  { ticker: 'HPE',  name: 'Hewlett Packard Enterprise', layer: 9, layerLabel: 'Rack Assembly / OEM' },
  { ticker: 'SMCI', name: 'Super Micro Computer', layer: 9, layerLabel: 'Rack Assembly / OEM' },

  // Layer 10: Power and Cooling
  { ticker: 'VRT',  name: 'Vertiv Holdings', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'Distribution' },
  { ticker: 'MOD',  name: 'Modine Manufacturing', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'Cooling' },
  { ticker: 'ETN',  name: 'Eaton', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'Distribution' },
  { ticker: 'NVT',  name: 'nVent Electric', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'Cooling' },
  { ticker: 'CARR', name: 'Carrier Global', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'HVAC' },
  { ticker: 'TT',   name: 'Trane Technologies', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'HVAC' },
  { ticker: 'JCI',  name: 'Johnson Controls', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'HVAC' },
  { ticker: 'SPXC', name: 'SPX Technologies', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'Cooling' },
  { ticker: 'XYL',  name: 'Xylem', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'Cooling' },
  { ticker: 'VICR', name: 'Vicor Corporation', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'Distribution' },
  { ticker: 'ECL',  name: 'Ecolab', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'Cooling' },
  { ticker: 'CC',   name: 'Chemours', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'Cooling' },
  { ticker: 'ENS',  name: 'EnerSys', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'Backup Power' },
  { ticker: 'GNRC', name: 'Generac', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'Backup Power' },
  { ticker: 'CMI',  name: 'Cummins', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'Backup Power' },
  { ticker: 'CAT',  name: 'Caterpillar', layer: 10, layerLabel: 'Power & Cooling', sublayer: 'Backup Power' },

  // Layer 11: Power Semiconductors
  { ticker: 'TXN',  name: 'Texas Instruments', layer: 11, layerLabel: 'Power Semiconductors' },
  { ticker: 'ON',   name: 'Onsemi', layer: 11, layerLabel: 'Power Semiconductors' },
  { ticker: 'ADI',  name: 'Analog Devices', layer: 11, layerLabel: 'Power Semiconductors' },
  { ticker: 'MCHP', name: 'Microchip Technology', layer: 11, layerLabel: 'Power Semiconductors' },
  { ticker: 'MPWR', name: 'Monolithic Power Systems', layer: 11, layerLabel: 'Power Semiconductors' },
  { ticker: 'WOLF', name: 'Wolfspeed', layer: 11, layerLabel: 'Power Semiconductors' },
  { ticker: 'LFUS', name: 'Littelfuse', layer: 11, layerLabel: 'Power Semiconductors' },

  // Layer 12: Data Center Construction
  { ticker: 'EME',  name: 'EMCOR Group', layer: 12, layerLabel: 'DC Construction' },
  { ticker: 'FIX',  name: 'Comfort Systems USA', layer: 12, layerLabel: 'DC Construction' },
  { ticker: 'DY',   name: 'Dycom Industries', layer: 12, layerLabel: 'DC Construction' },
  { ticker: 'HUBB', name: 'Hubbell', layer: 12, layerLabel: 'DC Construction' },
  { ticker: 'MYRG', name: 'MYR Group', layer: 12, layerLabel: 'DC Construction' },
  { ticker: 'PRIM', name: 'Primoris Services', layer: 12, layerLabel: 'DC Construction' },
  { ticker: 'MTZ',  name: 'MasTec', layer: 12, layerLabel: 'DC Construction' },
  { ticker: 'STRL', name: 'Sterling Infrastructure', layer: 12, layerLabel: 'DC Construction' },
  { ticker: 'IESC', name: 'IES Holdings', layer: 12, layerLabel: 'DC Construction' },
  { ticker: 'AGX',  name: 'Argan Inc.', layer: 12, layerLabel: 'DC Construction' },
  { ticker: 'FLR',  name: 'Fluor Corporation', layer: 12, layerLabel: 'DC Construction' },

  // Layer 13: Logistics
  { ticker: 'EXPD', name: 'Expeditors International', layer: 13, layerLabel: 'Logistics' },
  { ticker: 'SAIA', name: 'Saia Inc.', layer: 13, layerLabel: 'Logistics' },

  // Layer 14: Energy Suppliers
  { ticker: 'CEG', name: 'Constellation Energy', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'Nuclear' },
  { ticker: 'VST', name: 'Vistra Corp', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'Nuclear/Gas' },
  { ticker: 'NRG', name: 'NRG Energy', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'IPP' },
  { ticker: 'TLN', name: 'Talen Energy', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'Nuclear' },
  { ticker: 'EQT', name: 'EQT Corporation', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'Natural Gas' },
  { ticker: 'KMI', name: 'Kinder Morgan', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'Pipeline' },
  { ticker: 'BKR', name: 'Baker Hughes', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'LNG Equipment' },
  { ticker: 'ENB', name: 'Enbridge', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'Pipeline' },
  { ticker: 'NEE', name: 'NextEra Energy', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'Renewables' },
  { ticker: 'BEP', name: 'Brookfield Renewable', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'Renewables' },
  { ticker: 'BE',  name: 'Bloom Energy', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'Fuel Cells' },
  { ticker: 'CCJ', name: 'Cameco', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'Uranium' },
  { ticker: 'LEU', name: 'Centrus Energy', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'Uranium' },
  { ticker: 'UEC', name: 'Uranium Energy', layer: 14, layerLabel: 'Energy Suppliers', sublayer: 'Uranium' },

  // Layer 15: Raw Materials
  { ticker: 'FCX',  name: 'Freeport-McMoRan', layer: 15, layerLabel: 'Raw Materials', sublayer: 'Copper' },
  { ticker: 'SCCO', name: 'Southern Copper', layer: 15, layerLabel: 'Raw Materials', sublayer: 'Copper' },
  { ticker: 'MP',   name: 'MP Materials', layer: 15, layerLabel: 'Raw Materials', sublayer: 'Rare Earth' },
  { ticker: 'NUE',  name: 'Nucor', layer: 15, layerLabel: 'Raw Materials', sublayer: 'Steel' },
  { ticker: 'STLD', name: 'Steel Dynamics', layer: 15, layerLabel: 'Raw Materials', sublayer: 'Steel' },
  { ticker: 'AA',   name: 'Alcoa', layer: 15, layerLabel: 'Raw Materials', sublayer: 'Aluminum' },
  { ticker: 'CLF',  name: 'Cleveland-Cliffs', layer: 15, layerLabel: 'Raw Materials', sublayer: 'Electrical Steel' },
  { ticker: 'WS',   name: 'Worthington Steel', layer: 15, layerLabel: 'Raw Materials', sublayer: 'Electrical Steel' },
  { ticker: 'GEV',  name: 'GE Vernova', layer: 15, layerLabel: 'Raw Materials', sublayer: 'Grid Equipment' },
  { ticker: 'PWR',  name: 'Quanta Services', layer: 15, layerLabel: 'Raw Materials', sublayer: 'Grid Equipment' },
  { ticker: 'LIN',  name: 'Linde', layer: 15, layerLabel: 'Raw Materials', sublayer: 'Industrial Gases' },
  { ticker: 'APD',  name: 'Air Products', layer: 15, layerLabel: 'Raw Materials', sublayer: 'Industrial Gases' },
]

export const LAYER_COLORS: Record<number, string> = {
  0:  '#6366f1',
  1:  '#8b5cf6',
  2:  '#a855f7',
  3:  '#ec4899',
  4:  '#3b82f6',
  5:  '#0ea5e9',
  6:  '#06b6d4',
  7:  '#14b8a6',
  8:  '#10b981',
  9:  '#22c55e',
  10: '#f59e0b',
  11: '#f97316',
  12: '#ef4444',
  13: '#84cc16',
  14: '#eab308',
  15: '#78716c',
}
