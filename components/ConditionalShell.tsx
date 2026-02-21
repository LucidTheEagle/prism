'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { LogOut, User, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

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
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${displayName}'s account menu`}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 min-h-[36px]"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0" aria-hidden="true">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="text-white text-xs font-bold">{initials}</span>
          )}
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden md:block max-w-[120px] truncate">
          {displayName}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform hidden md:block ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`${displayName}'s account options`}
          className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-50"
        >
          <div role="presentation" className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{displayName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{user.email}</p>
          </div>
          <button
            role="menuitem"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-800 min-h-[44px]"
          >
            <User className="w-4 h-4" aria-hidden="true" />
            Profile
          </button>
          <button
            role="menuitem"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors focus-visible:outline-none focus-visible:bg-red-50 dark:focus-visible:bg-red-950/40 min-h-[44px]"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const isChatRoute = pathname?.startsWith('/chat')

  /*
   * Auth routes: render children only — no header, no footer.
   * This is what was causing the double PRISM logo: ConditionalShell
   * was rendering the header (with its logo) on top of the login page
   * which has its own PRISM wordmark. Auth pages own their full layout.
   */
  const isAuthRoute =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot-password')

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoaded(true)
    })
    return () => subscription.unsubscribe()
  }, [loadUser, supabase])

  /*
   * "How it works" smooth scroll.
   * Next.js does not smooth-scroll to same-page hash anchors — it does a
   * hard jump. We intercept the click, find the section by ID, and call
   * scrollIntoView. If not on the home page, we navigate there first.
   */
  const handleHowItWorksClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const section = document.getElementById('how-it-works')
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      router.push('/#how-it-works')
    }
  }, [router])

  // ── CHAT: bare viewport, no chrome ────────────────────────────────────────
  if (isChatRoute) {
    return (
      <div className="h-screen overflow-hidden flex flex-col">
        {children}
      </div>
    )
  }

  // ── AUTH: completely bare — no header, no footer, no extra logo ───────────
  if (isAuthRoute) {
    return <>{children}</>
  }

  // ── EVERYTHING ELSE: full header + footer chrome ──────────────────────────
  return (
    <>
      {/*
       * Skip link — ONLY appears on keyboard Tab, never on mouse click.
       * Uses focus-visible (not focus) — this was the cause of the
       * "Sign In has a focus border" bug. focus: applies on mouse click too.
       * focus-visible: only applies for keyboard navigation.
       */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-[100] focus-visible:px-4 focus-visible:py-2 focus-visible:bg-emerald-600 focus-visible:text-white focus-visible:rounded-lg focus-visible:text-sm focus-visible:font-medium focus-visible:shadow-lg"
      >
        Skip to main content
      </a>

      <header
        className="h-16 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0 z-50 shadow-sm"
        aria-label="PRISM site header"
      >
        <div className="container mx-auto h-full flex items-center justify-between px-4">

          <Link
            href="/"
            aria-label="PRISM — go to home page"
            className="flex items-center gap-2 sm:gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded flex items-center justify-center shadow-md" aria-hidden="true">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-slate-900 dark:text-slate-50 leading-tight">PRISM</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5 tracking-wide hidden sm:block">
                Precision Document Intelligence
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4" aria-label="Site navigation">

            {/*
             * Changed from <Link href="/#how-it-works"> to a <button> with
             * onClick. Next.js hash navigation doesn't smooth scroll —
             * it snaps. The handler above uses scrollIntoView instead.
             */}
            <button
              onClick={handleHowItWorksClick}
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors hidden md:block font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
            >
              How it works
            </button>

            <div
              className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 dark:text-slate-400"
              role="status"
              aria-label="AI system is ready"
            >
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" aria-hidden="true" />
              <span className="hidden sm:inline">AI Ready</span>
            </div>

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
                  className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 transition-colors px-2 sm:px-3 py-1.5 rounded min-h-[36px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-semibold px-3 sm:px-4 py-2 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md min-h-[36px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  Get Started
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/*
       * pb-8: breathing room so content doesn't sit flush against the footer.
       * Footer is now in normal document flow (not fixed/sticky) — the
       * fixed footer was sitting on top of interactive elements near the
       * bottom of the viewport and intercepting clicks on the upload zone,
       * form inputs, and buttons.
       */}
      <main id="main-content" className="min-h-[calc(100vh-4rem)] pb-8">
        {children}
      </main>

      <footer
        className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 py-3 px-4 text-center text-xs text-slate-500 dark:text-slate-400"
        aria-label="Legal disclaimer"
      >
        <span className="hidden sm:inline">PRISM is a research tool, not legal advice. </span>
        Always verify critical information.
      </footer>
    </>
  )
}