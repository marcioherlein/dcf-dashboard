import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'insic',
    short_name: 'insic',
    description: 'Invest with a process, not a story.',
    start_url: '/',
    display: 'standalone',
    theme_color: '#06101F',
    background_color: '#F8F7F2',
    icons: [
      {
        src: '/insic-app-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/insic-app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
