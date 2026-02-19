'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { LogOut, User, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

/**
 * UserMenu
 *
 * Shown when a user is authenticated. Displays their avatar (or
 * initials fallback), name, and a dropdown with sign-out.
 */
function UserMenu({ user }: { user: SupabaseUser }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const supabase = createClient()

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'

  const avatarUrl =
    user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null

  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-user-menu]')) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className="relative" data-user-menu>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="User menu"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-white text-xs font-bold">{initials}</span>
          )}
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden md:block max-w-[120px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform hidden md:block ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {displayName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {user.email}
            </p>
          </div>

          {/* Profile link */}
          <button
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <User className="w-4 h-4" />
            Profile
          </button>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * ConditionalShell
 *
 * Reads the current pathname and renders two different shells:
 *
 * /chat routes → bare shell (no header/footer — chat owns the viewport)
 * All other routes → full chrome with auth-aware header
 */
export default function ConditionalShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isChatRoute = pathname?.startsWith('/chat')

  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const supabase = createClient()

  const loadUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setUser(user)
    setAuthLoaded(true)
  }, [supabase])

  useEffect(() => {
    // Defer so setState from loadUser() doesn't run synchronously in the effect
    queueMicrotask(() => { loadUser() })

    // Subscribe to auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoaded(true)
    })

    return () => subscription.unsubscribe()
  }, [loadUser, supabase])

  // ── CHAT ROUTE: bare viewport ──────────────────────────────────
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

  // ── ALL OTHER ROUTES: full chrome ──────────────────────────────
  return (
    <>
      <header className="h-16 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto h-full flex items-center justify-between px-4">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-slate-900 dark:text-slate-50 leading-tight">
                PRISM
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5 tracking-wide">
                Precision Document Intelligence
              </span>
            </div>
          </Link>

          {/* Nav actions */}
          <div className="flex items-center gap-4">
            {/* How it works — smooth scroll to section on home page */}
            <Link
              href="/#how-it-works"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors hidden md:block font-medium"
            >
              How it works
            </Link>

            {/* AI status indicator */}
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="hidden sm:inline">AI Ready</span>
            </div>

            {/* Auth section — skeleton while loading to prevent layout shift */}
            {!authLoaded ? (
              <div className="w-24 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            ) : user ? (
              <UserMenu user={user} />
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 transition-colors px-3 py-1.5"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-semibold px-4 py-2 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-4rem)] pb-8">{children}</main>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 py-2 px-4 text-center text-xs text-slate-500 dark:text-slate-400 z-40">
        <span className="hidden sm:inline">
          PRISM is a research tool, not legal advice.{' '}
        </span>
        Always verify critical information.
      </footer>
    </>
  )
}