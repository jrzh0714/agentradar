import { ImageResponse } from 'next/og'

export const alt = 'AgentRadar — AI tool discovery for developers'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'stretch',
          background: '#09090b',
          color: '#f4f4f5',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'monospace',
          height: '100%',
          justifyContent: 'space-between',
          padding: '72px 80px',
          width: '100%',
        }}
      >
        <div style={{ alignItems: 'center', display: 'flex', fontSize: 26, fontWeight: 700 }}>
          <span
            style={{
              background: '#10b981',
              borderRadius: 999,
              boxShadow: '0 0 18px rgba(16,185,129,0.65)',
              display: 'flex',
              height: 16,
              marginRight: 18,
              width: 16,
            }}
          />
          AgentRadar
          <span style={{ color: '#71717a', display: 'flex', fontSize: 20, marginLeft: 20 }}>
            AI signal, ranked daily
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, letterSpacing: '-4px' }}>
            Find the tools shaping
          </div>
          <div style={{ color: '#a1a1aa', display: 'flex', fontSize: 72, fontWeight: 800, letterSpacing: '-4px' }}>
            the agent ecosystem.
          </div>
          <div style={{ color: '#a1a1aa', display: 'flex', fontFamily: 'sans-serif', fontSize: 28, marginTop: 30 }}>
            GenAI tools · agent frameworks · research · developer workflows
          </div>
        </div>

        <div style={{ alignItems: 'center', color: '#71717a', display: 'flex', fontSize: 21 }}>
          GitHub
          <span style={{ display: 'flex', margin: '0 14px' }}>·</span>
          Hacker News
          <span style={{ display: 'flex', margin: '0 14px' }}>·</span>
          Curated RSS
          <span style={{ color: '#10b981', display: 'flex', marginLeft: 'auto' }}>agentradarlive.vercel.app</span>
        </div>
      </div>
    ),
    size,
  )
}
