import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/brand'

const BASE = `https://${SITE_URL}`

interface Props {
  params: Promise<{ ticker: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params
  const t = ticker.toUpperCase()

  // Fetch live valuation data server-side for OG card params
  let ogParams: Record<string, string> = { ticker: t }
  try {
    const res = await fetch(`${BASE}/api/financials?ticker=${t}`, {
      next: { revalidate: 1800 },
      headers: {
        // Automation key allows server-side OG metadata fetch without a user session
        'x-automation-key': process.env.AUTOMATION_API_KEY ?? '',
      },
    })
    if (res.ok) {
      const d = await res.json()
      const price   = d.quote?.price
      const fv      = d.valuationMethods?.cockpitFairValue ?? d.valuationMethods?.triangulatedFairValue
      const upside  = d.valuationMethods?.cockpitUpsidePct ?? d.valuationMethods?.triangulatedUpsidePct
      const bear    = d.scenarios?.bear?.fairValue
      const bull    = d.scenarios?.bull?.fairValue
      const currency = d.quote?.currency ?? 'USD'
      const name    = d.quote?.industry ?? ''

      // Derive verdict from upside using same thresholds as lib/formatters.ts upsideZone
      const verdict = upside == null
        ? 'Insufficient Data'
        : upside >= 0.20 ? 'Undervalued'
        : upside >= 0.00 ? 'Fairly Valued'
        : 'Overvalued'

      // Build model consensus array for the right panel (up to 3 models)
      const models = d.valuationMethods?.models
      const methods: { label: string; fv: number }[] = []
      if (models?.fcff?.fairValue)      methods.push({ label: 'DCF (FCFF)',   fv: models.fcff.fairValue })
      if (models?.fcfe?.applicable)     methods.push({ label: 'DCF (FCFE)',   fv: models.fcfe.fairValuePerShare })
      if (models?.ddm?.applicable)      methods.push({ label: 'DDM',          fv: models.ddm.fairValuePerShare })
      if (models?.multiples?.blendedFairValue) methods.push({ label: 'Multiples', fv: models.multiples.blendedFairValue })

      ogParams = {
        ticker: t,
        ...(name     && { name }),
        ...(price    && { price: String(price) }),
        ...(fv       && { fv:    String(fv) }),
        ...(upside   != null && { upside: String(upside) }),
        ...(bear     && { bear:  String(bear) }),
        ...(bull     && { bull:  String(bull) }),
        currency,
        verdict,
        ...(methods.length > 0 && { methods: encodeURIComponent(JSON.stringify(methods.slice(0, 3))) }),
      }
    }
  } catch {
    // fallback to ticker-only OG card
  }

  const ogUrl = `${BASE}/api/og?${new URLSearchParams(ogParams).toString()}`
  const pageUrl = `${BASE}/stock/${t}`

  const upside = ogParams.upside ? parseFloat(ogParams.upside) : null
  const fv     = ogParams.fv     ? parseFloat(ogParams.fv)     : null
  const price  = ogParams.price  ? parseFloat(ogParams.price)  : null

  const upsideStr = upside != null
    ? `${upside >= 0 ? '+' : ''}${(upside * 100).toFixed(1)}%`
    : null
  const fvStr   = fv    != null ? `$${fv.toFixed(2)}`    : null
  const priceStr = price != null ? `$${price.toFixed(2)}` : null

  const verdict = ogParams.verdict ?? 'Insufficient Data'
  const verdictWord = verdict === 'Undervalued' ? 'undervalued'
    : verdict === 'Overvalued'  ? 'overvalued'
    : verdict === 'Fairly Valued' ? 'fairly valued'
    : 'under review'

  const description = fvStr && priceStr && upsideStr
    ? `${t} looks ${verdictWord}. Fair value: ${fvStr} vs current price ${priceStr} (${upsideStr} implied upside). Full DCF model on insic.`
    : `DCF valuation and fair value estimate for ${t}. See the full model on insic.`

  return {
    title: `${t} — DCF Valuation & Fair Value | insic`,
    description,
    openGraph: {
      title: `${t} — ${verdict}`,
      description,
      url: pageUrl,
      siteName: 'insic',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: `${t} DCF valuation card` }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${t} — ${verdict}`,
      description,
      images: [ogUrl],
      site: '@insicapp',
    },
  }
}

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
