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

// Fetches the latest 10-year US Treasury yield (DGS10) from FRED
// Free API key required: https://fred.stlouisfed.org/docs/api/api_key.html
export async function getRfRate(): Promise<number> {
  return fetchFredSeries('DGS10', 0.0429)
}

// Fetches the 2-year US Treasury yield (DGS2) — returns decimal (e.g. 0.0449)
export async function get2YTreasury(): Promise<number | null> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return null
  const val = await fetchFredSeries('DGS2', -1)
  return val === -1 ? null : val
}

// Fetches ICE BofA US High Yield OAS spread (BAMLH0A0HYM2) — returns basis points as raw number
export async function getHYSpread(): Promise<number | null> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return null
  const val = await fetchFredSeries('BAMLH0A0HYM2', -1, false)
  return val === -1 ? null : val
}
