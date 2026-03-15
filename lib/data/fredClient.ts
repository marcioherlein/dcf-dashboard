// Fetches the latest 10-year US Treasury yield (DGS10) from FRED
// Free API key required: https://fred.stlouisfed.org/docs/api/api_key.html
export async function getRfRate(): Promise<number> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return 4.29 // fallback hardcoded if no key

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${apiKey}&sort_order=desc&limit=5&file_type=json`
    const res = await fetch(url, { next: { revalidate: 3600 } }) // cache 1h
    if (!res.ok) return 4.29
    const data = await res.json()
    const observations: { value: string }[] = data.observations ?? []
    const latest = observations.find((o) => o.value !== '.')
    return latest ? parseFloat(latest.value) / 100 : 0.0429
  } catch {
    return 0.0429
  }
}
