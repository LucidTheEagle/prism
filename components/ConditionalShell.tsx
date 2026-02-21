'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { LogOut, User, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// UserMenu
// ─────────────────────────────────────────────────────────────────────────────
function UserMenu({ user }: { user: SupabaseUser }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
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

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Close on Escape and return focus to trigger
  useEffect(() => {
    if (!open) return
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open])

  return (
    <div className="relative" ref={menuRef}>
      {/*
       * Trigger button
       * aria-haspopup="menu" — tells screen readers this opens a menu.
       * aria-expanded — announces open/closed state on every toggle.
       * aria-label includes the user's name so screen readers say
       * "Alex's account menu, collapsed, button" rather than just "button".
       */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${displayName}'s account menu`}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 min-h-[36px]"
      >
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
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
          className={`w-3.5 h-3.5 text-slate-500 transition-transform hidden md:block ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/*
       * Dropdown menu
       * role="menu" + role="menuitem" — correct ARIA pattern for action menus.
       * This is distinct from role="listbox" (selection) or role="navigation"
       * (links). A menu is a set of actions triggered by a parent button.
       *
       * The user info section is role="presentation" — it's context,
       * not an interactive item.
       */}
      {open && (
        <div
          role="menu"
          aria-label={`${displayName}'s account options`}
          className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-50"
        >
          {/* User info — not interactive, purely informational */}
          <div
            role="presentation"
            className="px-4 py-3 border-b border-slate-100 dark:border-slate-800"
          >
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {displayName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {user.email}
            </p>
          </div>

          {/* Profile */}
          <button
            role="menuitem"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-800 min-h-[44px]"
          >
            <User className="w-4 h-4" aria-hidden="true" />
            Profile
          </button>

          {/* Sign out */}
          <button
            role="menuitem"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors focus:outline-none focus:bg-red-50 dark:focus:bg-red-950/40 min-h-[44px]"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ConditionalShell
// ─────────────────────────────────────────────────────────────────────────────
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
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setAuthLoaded(true)
  }, [supabase])

  useEffect(() => {
    queueMicrotask(() => { loadUser() })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setAuthLoaded(true)
      }
    )

    return () => subscription.unsubscribe()
  }, [loadUser, supabase])

  // ── CHAT ROUTE: bare viewport, no chrome ──────────────────────────────────
  if (isChatRoute) {
    return (
      <div
        className="h-screen overflow-hidden flex flex-col"
        /*
         * aria-label gives the chat viewport a name for screen readers
         * navigating by landmarks. Without this the region is anonymous.
         */
        aria-label="PRISM chat workspace"
      >
        {children}
      </div>
    )
  }

  // ── ALL OTHER ROUTES: full header + footer chrome ─────────────────────────
  return (
    <>
      {/*
       * Skip navigation link — must be the first focusable element on the page.
       * Invisible until focused (sr-only → focus:not-sr-only).
       * Keyboard users press Tab once and can jump straight to main content,
       * bypassing the header navigation entirely.
       * WCAG 2.4.1 Bypass Blocks — Level A requirement.
       */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/*
       * <header> is a landmark element — equivalent to role="banner".
       * Screen reader users can jump here directly via the landmarks list.
       * aria-label distinguishes it from any inner <header> elements.
       */}
      <header
        className="h-16 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0 z-50 shadow-sm"
        aria-label="PRISM site header"
      >
        <div className="container mx-auto h-full flex items-center justify-between px-4">

          {/* Brand */}
          <Link
            href="/"
            aria-label="PRISM — go to home page"
            className="flex items-center gap-2 sm:gap-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-lg"
          >
            <div
              className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded flex items-center justify-center shadow-md"
              aria-hidden="true"
            >
              <span className="text-white font-bold text-lg" aria-hidden="true">P</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-slate-900 dark:text-slate-50 leading-tight">
                PRISM
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5 tracking-wide hidden sm:block">
                Precision Document Intelligence
              </span>
            </div>
          </Link>

          {/*
           * Site navigation
           * <nav> is a landmark — screen reader users can jump here directly.
           * aria-label distinguishes it from any footer <nav> elements.
           */}
          <nav
            className="flex items-center gap-2 sm:gap-4"
            aria-label="Site navigation"
          >
            <Link
              href="/#how-it-works"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors hidden md:block font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 rounded"
            >
              How it works
            </Link>

            {/*
             * AI status indicator
             * aria-label gives it a meaningful description.
             * The pulsing dot is aria-hidden — decorative.
             * role="status" lets screen readers know this is a live indicator.
             */}
            <div
              className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 dark:text-slate-400"
              role="status"
              aria-label="AI system is ready"
            >
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" aria-hidden="true" />
              <span className="hidden sm:inline">AI Ready</span>
            </div>

            {/*
             * Auth section
             * Skeleton while loading prevents layout shift and has
             * role="status" so screen readers know something is loading.
             */}
            {!authLoaded ? (
              <div
                className="w-20 sm:w-24 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"
                role="status"
                aria-label="Loading account status"
                aria-busy="true"
              />
            ) : user ? (
              <UserMenu user={user} />
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  href="/login"
                  className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 transition-colors px-2 sm:px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 rounded min-h-[36px] flex items-center"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-semibold px-3 sm:px-4 py-2 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 min-h-[36px] flex items-center"
                >
                  Get Started
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/*
       * Main content landmark
       * id="main-content" is the target of the skip link above.
       * <main> is a landmark — screen reader users can jump here directly.
       * Only one <main> per page.
       */}
      <main
        id="main-content"
        className="min-h-[calc(100vh-4rem)] pb-8"
      >
        {children}
      </main>

      {/*
       * <footer> is a landmark — equivalent to role="contentinfo".
       * aria-label describes its purpose.
       * The disclaimer is kept readable but condensed on small screens.
       */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 py-2 px-4 text-center text-xs text-slate-500 dark:text-slate-400 z-40"
        aria-label="Legal disclaimer"
      >
        <span className="hidden sm:inline">
          PRISM is a research tool, not legal advice.{' '}
        </span>
        Always verify critical information.
      </footer>
    </>
  )
}