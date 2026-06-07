import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'insic',
    short_name: 'insic',
    description: 'Invest with a process, not a story.',
    start_url: '/analyze',
    display: 'standalone',
    theme_color: '#5F790B',
    background_color: '#5F790B',
    icons: [
      {
        src: '/insic-app-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/insic-app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
