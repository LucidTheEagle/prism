import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { ThemeProvider } from 'next-themes'
import ConditionalShell from '@/components/ConditionalShell'
import './globals.css'

// Inter served locally — no Google Fonts network dependency at build time
// Download Inter from https://rsms.me/inter/download/ and place in public/fonts/
// For now we fall back to system sans-serif which is production-safe
const inter = localFont({
  src: [
    {
      path: '../public/fonts/InterDisplay-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/InterDisplay-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/InterDisplay-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../public/fonts/Inter-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-inter',
  fallback: ['system-ui', 'sans-serif'],
  display: 'swap',
})

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

  openGraph: {
    type: 'website',
    title: 'PRISM — Precision Document Intelligence',
    description:
      'Transform any PDF into an intelligent knowledge base with forensic citation accuracy.',
    siteName: 'PRISM',
  },

  twitter: {
    card: 'summary',
    title: 'PRISM — Precision Document Intelligence',
    description:
      'Transform any PDF into an intelligent knowledge base with forensic citation accuracy.',
  },

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