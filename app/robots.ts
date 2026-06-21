import type { MetadataRoute } from 'next'

const BASE = 'https://insic.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/settings/',
          '/dashboard/',
          '/valuations/',
          '/simplifier/',
          '/redeem/',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
