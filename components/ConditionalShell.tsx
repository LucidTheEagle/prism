'use client'

import { usePathname } from 'next/navigation'

/**
 * ConditionalShell
 *
 * Reads the current pathname and renders two different shells:
 *
 * /chat routes → bare shell
 *   No header, no footer. Children fill the full viewport.
 *   The body already has no margin/padding from globals.css.
 *   ChatInterface + SplitLayout own 100% of the screen.
 *
 * All other routes → full shell
 *   Sticky header (h-16) + fixed footer + main content area.
 *   Identical to the previous hardcoded layout.tsx structure.
 */
export default function ConditionalShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isChatRoute = pathname?.startsWith('/chat')

  // ── CHAT ROUTE: bare viewport ──────────────────────────────────────
  if (isChatRoute) {
    return (
      <div
        style={{
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    )
  }

  // ── ALL OTHER ROUTES: full chrome ──────────────────────────────────
  return (
    <>
      <header className="h-16 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto h-full flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-slate-900 dark:text-slate-50">PRISM</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 -mt-1 tracking-wide">
                Precision Document Intelligence
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 transition-colors hidden md:block">
              How it works
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="hidden sm:inline">AI Ready</span>
            </div>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-4rem)]">
        {children}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 py-2 px-4 text-center text-xs text-slate-500 dark:text-slate-400 z-40">
        <span className="hidden sm:inline">PRISM is a research tool, not legal advice. </span>
        Always verify critical information.
      </footer>
    </>
  )
}