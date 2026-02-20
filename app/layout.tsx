import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import ConditionalShell from '@/components/ConditionalShell'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'PRISM — Precision Document Intelligence',
    template: '%s — PRISM',
  },
  description:
    'Transform any PDF into an intelligent knowledge base with forensic citation accuracy. AI-powered document Q&A with hybrid search and multi-pass reasoning.',
  keywords: [
    'document intelligence',
    'PDF AI',
    'document Q&A',
    'RAG',
    'citation accuracy',
    'legal AI',
    'compliance AI',
  ],
  authors: [{ name: 'PRISM' }],
  creator: 'PRISM',

  // ── Open Graph (LinkedIn, Slack, WhatsApp previews) ──────────────
  openGraph: {
    type: 'website',
    title: 'PRISM — Precision Document Intelligence',
    description:
      'Transform any PDF into an intelligent knowledge base with forensic citation accuracy.',
    siteName: 'PRISM',
  },

  // ── Twitter / X card ─────────────────────────────────────────────
  twitter: {
    card: 'summary',
    title: 'PRISM — Precision Document Intelligence',
    description:
      'Transform any PDF into an intelligent knowledge base with forensic citation accuracy.',
  },

  // ── Favicon — Next.js picks up app/icon.tsx automatically ────────
  // No manual <link rel="icon"> needed. Next.js 16 generates all sizes
  // (16x16, 32x32, apple-touch-icon) from app/icon.tsx and
  // app/apple-icon.tsx at build time.

  // ── Robots ───────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConditionalShell>{children}</ConditionalShell>
        </ThemeProvider>
      </body>
    </html>
  )
}