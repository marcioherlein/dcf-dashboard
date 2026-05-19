async function fetchFredSeries(seriesId: string, fallback: number, asPercent = true): Promise<number> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return fallback
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&sort_order=desc&limit=5&file_type=json`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return fallback
    const data = await res.json()
    const observations: { value: string }[] = data.observations ?? []
    const latest = observations.find((o) => o.value !== '.')
    if (!latest) return fallback
    const raw = parseFloat(latest.value)
    return isNaN(raw) ? fallback : asPercent ? raw / 100 : raw
  } catch {
    return fallback
  }
}

export async function getRfRate(): Promise<number> {
  return fetchFredSeries('DGS10', 0.0429)
}

export async function get2YTreasury(): Promise<number | null> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return null
  const val = await fetchFredSeries('DGS2', -1)
  return val === -1 ? null : val
}

export async function getHYSpread(): Promise<number | null> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return null
  const val = await fetchFredSeries('BAMLH0A0HYM2', -1, false)
  return val === -1 ? null : val
}

export type YieldCurvePoint = {
  tenor: string
  label: string
  yield: number | null
}

// Returns the full US Treasury yield curve in percent (e.g. 4.62 for 4.62%)
export async function getYieldCurve(): Promise<YieldCurvePoint[]> {
  const series: { id: string; tenor: string; label: string; fallback: number }[] = [
    { id: 'DGS3MO', tenor: '3M',  label: '3 Month', fallback: 4.3 },
    { id: 'DGS1',   tenor: '1Y',  label: '1 Year',  fallback: 4.1 },
    { id: 'DGS2',   tenor: '2Y',  label: '2 Year',  fallback: 4.1 },
    { id: 'DGS5',   tenor: '5Y',  label: '5 Year',  fallback: 4.2 },
    { id: 'DGS10',  tenor: '10Y', label: '10 Year', fallback: 4.3 },
    { id: 'DGS20',  tenor: '20Y', label: '20 Year', fallback: 4.7 },
    { id: 'DGS30',  tenor: '30Y', label: '30 Year', fallback: 4.8 },
  ]
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return series.map(s => ({ tenor: s.tenor, label: s.label, yield: null }))
  const results = await Promise.allSettled(
    series.map(s => fetchFredSeries(s.id, -1))
  )
  return series.map((s, i) => {
    const r = results[i]
    const raw = r.status === 'fulfilled' ? r.value : -1
    return { tenor: s.tenor, label: s.label, yield: raw === -1 ? null : +(raw * 100).toFixed(3) }
  })
}

