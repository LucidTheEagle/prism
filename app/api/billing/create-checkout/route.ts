import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSubscription } from '@/lib/billing/getSubscription'
import { SubscriptionTier } from '@/lib/types'

const TIER_PRICE_MAP: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
}

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  })

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Accept either tier (new) or priceId (legacy) — tier takes precedence
    const tier = body.tier as SubscriptionTier | undefined
    const legacyPriceId = body.priceId as string | undefined

    let priceId: string | undefined

    if (tier) {
      priceId = TIER_PRICE_MAP[tier]
      if (!priceId) {
        return NextResponse.json(
          { error: `No price configured for tier: ${tier}` },
          { status: 400 }
        )
      }
    } else if (legacyPriceId) {
      priceId = legacyPriceId
    } else {
      return NextResponse.json(
        { error: 'tier or priceId is required' },
        { status: 400 }
      )
    }

    const subscription = await getSubscription(user.id)
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