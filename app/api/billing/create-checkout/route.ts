import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSubscription } from '@/lib/billing/getSubscription'
import { supabaseAdmin } from '@/lib/supabase/server'
import { SubscriptionTier } from '@/lib/types'

const PLAN_CODE_MAP: Record<string, string | undefined> = {
  pro: process.env.PAYSTACK_PLAN_PRO,
  enterprise: process.env.PAYSTACK_PLAN_ENTERPRISE,
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const tier = body.tier as SubscriptionTier | undefined

    if (!tier || tier === 'free') {
      return NextResponse.json(
        { error: 'A valid tier is required to initiate checkout.' },
        { status: 400 }
      )
    }

    const planCode = PLAN_CODE_MAP[tier]
    if (!planCode) {
      return NextResponse.json(
        { error: `No Paystack plan configured for tier: ${tier}` },
        { status: 400 }
      )
    }

    const subscription = await getSubscription(user.id)
    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL

    // If the user already has a Paystack customer code, pass it through
    // so Paystack links this transaction to the existing customer record.
    const existingCustomerCode = subscription.paystack_customer_code ?? undefined

    // Initialize a Paystack transaction via the REST API directly.
    // We do not use paystack-node for this call — the initialize endpoint
    // is a simple POST and keeping it native avoids SDK version drift.
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: resolveAmountInKobo(tier),
        plan: planCode,
        currency: 'NGN',
        callback_url: `${origin}/chat?checkout=success`,
        metadata: {
          userId: user.id,
          tier,
          cancel_action: `${origin}/billing?checkout=canceled`,
          ...(existingCustomerCode ? { customer_code: existingCustomerCode } : {}),
        },
      }),
    })

    const paystackData = await paystackResponse.json()

    if (!paystackResponse.ok || !paystackData.status) {
      console.error('[create-checkout] Paystack initialization failed:', paystackData)
      return NextResponse.json(
        { error: paystackData.message ?? 'Failed to initialize payment.' },
        { status: 502 }
      )
    }

    // Persist the Paystack reference so the webhook can reconcile
    // this transaction against the user record on completion.
    const { error: refError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          user_id: user.id,
          paystack_customer_code: existingCustomerCode ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (refError) {
      // Non-fatal — log but do not block the redirect.
      console.error('[create-checkout] Failed to persist pre-checkout record:', refError)
    }

    return NextResponse.json(
      { url: paystackData.data.authorization_url },
      { status: 200 }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[create-checkout] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Paystack amounts are in kobo (NGN * 100)
function resolveAmountInKobo(tier: SubscriptionTier): number {
  switch (tier) {
    case 'pro':        return 15_000 * 100  // NGN 15,000 / month
    case 'enterprise': return 45_000 * 100  // NGN 45,000 / month
    default:           return 0
  }
}