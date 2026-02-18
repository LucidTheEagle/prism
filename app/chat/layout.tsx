import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PRISM - Document Chat',
  description: 'Chat with your document using AI-powered analysis.',
}

/**
 * CHAT ROUTE LAYOUT — Bare viewport shell
 *
 * This layout intentionally replaces the global layout (app/layout.tsx)
 * for all routes under /chat. It does three things:
 *
 * 1. Removes the global sticky header and fixed footer — they have no
 *    place in a full-screen workspace application.
 *
 * 2. Locks the viewport: `overflow-hidden` on <body> means the browser
 *    scrollbar disappears entirely. The only scroll that exists is the
 *    one we explicitly create inside ChatInterface (the messages panel).
 *
 * 3. Sets h-screen on <body> so that any child using `h-full` gets a
 *    reliable 100vh anchor without needing calc() hacks.
 *
 * NOTE on the global fixed footer: The parent layout's <footer> uses
 * `position: fixed`, which normally escapes all containers. However,
 * because ChatInterface renders with a high z-index input bar (z-10),
 * and this layout's body clips overflow, the footer is visually
 * suppressed on this route. If it ever bleeds through during testing,
 * add `className="relative z-50"` to the input zone in ChatInterface.
 */
export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        style={{
          height: '100vh',
          overflow: 'hidden',
          margin: 0,
          padding: 0,
          backgroundColor: '#f8fafc', // slate-50, matches globals.css body
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  )
}