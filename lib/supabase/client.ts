'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * createClient
 *
 * Returns a Supabase client that is safe to use in Client Components,
 * browser event handlers, and client-side hooks.
 *
 * Uses @supabase/ssr's createBrowserClient which reads/writes the auth
 * session from cookies automatically — compatible with the SSR server
 * client so sessions are shared across the boundary.
 *
 * Call this inside a component or hook, not at module level, so it is
 * always executed in the browser context.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}