import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In — PRISM',
  description: 'Sign in to PRISM Precision Document Intelligence',
}

/**
 * Auth Layout
 *
 * Used by /login and /register.
 * Deliberately bare — no ConditionalShell, no header, no footer.
 * Full-viewport centered card layout, dark-mode aware.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      {/* Brand mark — top of card, consistent across auth pages */}
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-semibold text-slate-900 dark:text-slate-50 leading-tight">
              PRISM
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 tracking-wide -mt-0.5">
              Precision Document Intelligence
            </span>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}