import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Today's Stock Ideas — DCF Signals | insic",
  description:
    "Daily-refreshed stock ideas based on DCF fair value: most undervalued, widest margin of safety, priced for perfection, contrarian plays, and more. Free, no account required.",
  openGraph: {
    title: "Today's Stock Ideas — DCF Signals | insic",
    description:
      "Daily-refreshed stock ideas powered by DCF fair value estimates. Free.",
    url: 'https://insic.app/ideas',
    siteName: 'insic',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Today's Stock Ideas — DCF Signals | insic",
    description: 'Daily-refreshed stock ideas powered by DCF fair value. Free.',
    site: '@insicapp',
  },
}

export default function IdeasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
