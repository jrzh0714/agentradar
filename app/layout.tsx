import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/ThemeProvider'
import { LanguageProvider } from '@/components/LanguageProvider'
import { SITE_URL, SOCIAL_IMAGE } from '@/lib/site'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'AgentRadar — AI tool discovery for developers',
  description:
    'Track emerging GenAI tools, agent frameworks, GitHub projects, and developer workflows. AI-curated and ranked daily.',
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': '/feed.xml' },
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'AgentRadar',
    title: 'AgentRadar — AI tool discovery for developers',
    description: 'Track emerging GenAI tools, agent frameworks, GitHub projects, and developer workflows.',
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentRadar — AI tool discovery for developers',
    description: 'Track emerging GenAI tools, agent frameworks, GitHub projects, and developer workflows.',
    images: [SOCIAL_IMAGE],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-zinc-950 text-zinc-100 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <ThemeProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
