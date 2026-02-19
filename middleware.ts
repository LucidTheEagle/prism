import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * PRISM Middleware — Auth & Route Protection
 *
 * Runs on every request that matches the config.matcher below.
 *
 * Three responsibilities:
 *   1. Refresh the Supabase session token if it is stale (keeps users
 *      logged in across tabs and page refreshes without a round-trip
 *      to the auth server from the client).
 *   2. Protect gated routes — redirect unauthenticated users to /login.
 *   3. Redirect already-authenticated users away from auth pages.
 *
 * Public routes (no auth required):
 *   /          — marketing landing page
 *   /login     — sign-in page
 *   /register  — sign-up page
 *   /auth/**   — OAuth callback handler
 *
 * Protected routes (auth required):
 *   /chat/**   — document Q&A interface
 *   /api/upload, /api/chat, /api/ingest, /api/documents — data APIs
 */

const PUBLIC_ROUTES = ['/', '/login', '/register']
const AUTH_ROUTES = ['/login', '/register']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not add any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make your
  // application very hard to debug and may break production auth.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Auth callback — always allow through ────────────────────────
  if (pathname.startsWith('/auth/')) {
    return supabaseResponse
  }

  // ── API routes — enforce auth, return 401 (not a redirect) ──────
  if (pathname.startsWith('/api/')) {
    // These API routes are public (no user context needed)
    const publicApiRoutes = ['/api/test-supabase']
    if (publicApiRoutes.includes(pathname)) {
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

  // ── Already logged in — redirect away from auth pages ───────────
  if (user && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // ── Protected routes — redirect to login if not authed ──────────
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Preserve the intended destination so we can redirect back after login
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico   (browser tab icon)
     * - public assets (svg, png, jpg, etc.)
     * - pdf.worker    (react-pdf worker)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs)$).*)',
  ],
}