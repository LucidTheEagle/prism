import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSubscription } from '@/lib/billing/getSubscription'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

/**
 * POST /api/billing/create-checkout
 *
 * Creates a Stripe Checkout session for the authenticated user.
 * Returns the session URL — client redirects to it.
 *
 * Body: { priceId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { priceId } = body

    if (!priceId || typeof priceId !== 'string') {
      return NextResponse.json(
        { error: 'priceId is required' },
        { status: 400 }
      )
    }

    const subscription = await getSubscription(user.id)

    // If user already has a Stripe customer ID, reuse it
    // so their payment methods and history are preserved
    let customerId = subscription.stripe_customer_id ?? undefined

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      })
      customerId = customer.id
    }

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/chat?checkout=success`,
      cancel_url: `${origin}/billing?checkout=canceled`,
      metadata: { userId: user.id },
      subscription_data: {
        metadata: { userId: user.id },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    })

    return NextResponse.json({ url: session.url }, { status: 200 })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[create-checkout] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}