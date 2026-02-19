import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /auth/callback
 *
 * Supabase redirects here after:
 *   - Google OAuth consent screen
 *   - Email confirmation link click
 *   - Magic link click (future)
 *
 * Exchanges the one-time `code` from the URL for a real session,
 * writes the session cookies, then redirects the user to their
 * intended destination (or / as fallback).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // Sanitise the redirect target — never redirect to an external URL
  const redirectTo = next.startsWith('/') ? next : '/'

  if (code) {
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }

    // Auth exchange failed — send to login with an error hint
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_failed`
    )
  }

  // No code present — malformed callback URL
  return NextResponse.redirect(`${origin}/login?error=missing_code`)
}