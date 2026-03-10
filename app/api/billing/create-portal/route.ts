import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSubscription } from '@/lib/billing/getSubscription'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

/**
 * POST /api/billing/create-portal
 *
 * Creates a Stripe Customer Portal session for the authenticated user.
 * Allows them to manage, upgrade, downgrade, or cancel their subscription.
 * Returns the portal URL — client redirects to it.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subscription = await getSubscription(user.id)

    if (!subscription.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe first.' },
        { status: 400 }
      )
    }

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/billing`,
    })

    return NextResponse.json({ url: portalSession.url }, { status: 200 })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[create-portal] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}