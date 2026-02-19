import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import ConditionalShell from '@/components/ConditionalShell'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PRISM - Precision Document Intelligence',
  description: 'AI-powered document analysis with forensic citation accuracy. Transform PDFs into queryable knowledge with verified answers.',
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
          {/*
           * ConditionalShell reads usePathname() to decide whether to
           * render the global header + footer. On /chat it renders nothing
           * but children — full viewport, no chrome. On all other routes
           * it renders the full header + main + footer shell.
           *
           * This replaces the nested app/chat/layout.tsx approach which
           * caused hydration mismatches in Next.js 16 + Turbopack because
           * child layouts cannot safely re-declare <html> and <body>.
           */}
          <ConditionalShell>{children}</ConditionalShell>
        </ThemeProvider>
      </body>
    </html>
  )
}