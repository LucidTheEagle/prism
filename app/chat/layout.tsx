import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'

export const metadata: Metadata = {
  title: 'PRISM - Document Chat',
  description: 'Chat with your document using AI-powered analysis.',
}

/**
 * CHAT ROUTE LAYOUT — Bare viewport shell
 *
 * Replaces the global layout for all routes under /chat.
 * Removes global header and footer — chat is a full-screen workspace.
 * Viewport is locked (overflow hidden) — only the messages panel scrolls.
 * ThemeProvider is included so dark mode works on this route too.
 */
export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        style={{
          height: '100vh',
          overflow: 'hidden',
          margin: 0,
          padding: 0,
        }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}