import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * createSupabaseServerClient
 *
 * Use this in:
 *   - Server Components
 *   - Route Handlers (API routes)
 *   - Server Actions
 *
 * Reads the auth session from the request cookies so the correct
 * user context is available server-side. RLS policies will fire
 * correctly with this client.
 *
 * DO NOT use this in Client Components — use lib/supabase/client.ts instead.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — cookies can't be
            // set here. If you have middleware refreshing sessions this
            // can be safely ignored.
          }
        },
      },
    }
  )
}

/**
 * supabaseAdmin
 *
 * Service-role client — bypasses RLS entirely.
 *
 * Use this ONLY in trusted server-side contexts:
 *   - Document ingestion pipeline (ingest API route)
 *   - Embedding generation
 *   - Admin-level operations
 *
 * NEVER expose this client to the browser. NEVER import this in
 * Client Components or any file that ships to the client bundle.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)