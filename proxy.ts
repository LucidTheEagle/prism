import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * PRISM Proxy — Auth & Route Protection
 *
 * Next.js 16 renames middleware.ts → proxy.ts and the exported
 * function from `middleware` → `proxy`.
 * Functionality is identical; only the file name and export name change.
 *
 * IMPORTANT — Security architecture note:
 * Next.js 16 moved away from middleware-first auth after a March 2025
 * vulnerability (CVE) where spoofed internal headers bypassed middleware
 * entirely. Our actual data security is enforced at the database layer
 * via Supabase RLS policies — this proxy handles session refresh and
 * UX-level redirects only. Never treat this as the sole auth gate.
 *
 * Responsibilities:
 *   1. Refresh stale Supabase session tokens on every request (keeps
 *      users logged in without a client round-trip).
 *   2. Redirect unauthenticated users away from protected routes.
 *   3. Redirect authenticated users away from /login and /register.
 *   4. Return 401 JSON for protected API routes (not a redirect).
 *
 * Public routes (no auth required):
 *   /          — marketing landing page
 *   /login     — sign-in page
 *   /register  — sign-up page
 *   /auth/**   — OAuth callback handler
 *
 * Protected routes (auth required):
 *   /chat/**
 *   /api/** (except whitelist below)
 */

const PUBLIC_ROUTES = ['/', '/login', '/register']
const AUTH_ROUTES = ['/login', '/register']
const PUBLIC_API_ROUTES = ['/api/test-supabase']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write cookies to the outgoing request first
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Rebuild supabaseResponse so the refreshed session cookies
          // are propagated to the browser
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not add any logic between createServerClient and
  // supabase.auth.getUser(). Even a single await in between can cause
  // session tokens not to be refreshed correctly in Next.js 16.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Auth callback — always allow through ────────────────────────
  if (pathname.startsWith('/auth/')) {
    return supabaseResponse
  }

  // ── API routes — return 401 JSON (not a browser redirect) ───────
  if (pathname.startsWith('/api/')) {
    if (PUBLIC_API_ROUTES.includes(pathname)) {
      return supabaseResponse
    }
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }
    return supabaseResponse
  }

  // ── Already authenticated — redirect away from auth pages ────────
  if (user && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // ── Protected routes — redirect to login ─────────────────────────
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Preserve intended destination for post-login redirect
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT static files and Next.js internals.
     * This regex excludes:
     *   _next/static  — compiled assets
     *   _next/image   — image optimisation endpoint
     *   favicon.ico   — browser tab icon
     *   *.svg/png/jpg/jpeg/gif/webp/mjs — public assets + pdf.worker
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs)$).*)',
  ],
}