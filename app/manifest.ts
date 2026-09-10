import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AgentRadar',
    short_name: 'AgentRadar',
    description: 'AI-curated discovery for emerging agent tools and developer workflows.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
  }
}
