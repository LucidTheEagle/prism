import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/server'
import { SubscriptionTier } from '@/lib/types'

// ---------------------------------------------------------------------------
// SIGNATURE VERIFICATION
// Paystack signs every webhook with HMAC-SHA512 using your secret key.
// We verify before processing any event — unverified requests are rejected.
// ---------------------------------------------------------------------------

function verifyPaystackSignature(rawBody: string, signature: string): boolean {
  const hash = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest('hex')
  return hash === signature
}

// ---------------------------------------------------------------------------
// TIER RESOLUTION
// Maps a Paystack plan code back to our internal tier.
// Plan codes come from the subscription object in the webhook payload.
// ---------------------------------------------------------------------------

function resolveTier(planCode: string | null | undefined): SubscriptionTier {
  if (!planCode) return 'free'
  if (planCode === process.env.PAYSTACK_PLAN_PRO) return 'pro'
  if (planCode === process.env.PAYSTACK_PLAN_ENTERPRISE) return 'enterprise'
  return 'free'
}

// ---------------------------------------------------------------------------
// DATE HELPERS
// Paystack returns ISO strings — we store them directly.
// ---------------------------------------------------------------------------

function resolveDate(value: string | null | undefined): string | null {
  if (!value) return null
  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

// ---------------------------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-paystack-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing x-paystack-signature header' },
      { status: 400 }
    )
  }

  if (!verifyPaystackSignature(rawBody, signature)) {
    console.error('[Paystack Webhook] Signature verification failed')
    return NextResponse.json(
      { error: 'Signature verification failed' },
      { status: 400 }
    )
  }

  let event: { event: string; data: Record<string, unknown> }

  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    )
  }

  console.log(`[Paystack Webhook] Received event: ${event.event}`)

  try {
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(event.data)
        break

      case 'subscription.create':
        await handleSubscriptionCreate(event.data)
        break

      case 'subscription.disable':
        await handleSubscriptionDisable(event.data)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data)
        break

      default:
        console.log(`[Paystack Webhook] Unhandled event type: ${event.event}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Handler error'
    console.error(`[Paystack Webhook] Handler error for ${event.event}:`, message)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// EVENT HANDLERS
// ---------------------------------------------------------------------------

async function handleChargeSuccess(data: Record<string, unknown>) {
  const metadata = data.metadata as Record<string, unknown> | null
  const userId = metadata?.userId as string | undefined

  if (!userId) {
    console.error('[Paystack Webhook] charge.success: missing metadata.userId', {
      reference: data.reference,
    })
    throw new Error('Missing userId in charge metadata')
  }

  const customer = data.customer as Record<string, unknown> | null
  const customerCode = customer?.customer_code as string | undefined

  if (!customerCode) {
    console.error('[Paystack Webhook] charge.success: missing customer_code')
    throw new Error('Missing customer_code in charge payload')
  }

  // On charge.success we record the customer code and mark the
  // subscription as active. subscription.create fires separately
  // with full subscription details — that handler locks the plan code.
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        paystack_customer_code: customerCode,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[Paystack Webhook] charge.success: upsert failed:', error)
    throw error
  }

  await supabaseAdmin.from('audit_log').insert({
    user_id: userId,
    event_type: 'subscription_change',
    metadata: {
      paystack_event: 'charge.success',
      customer_code: customerCode,
      reference: data.reference,
    },
  })

  console.log(`[Paystack Webhook] Charge success: user=${userId} customer=${customerCode}`)
}

async function handleSubscriptionCreate(data: Record<string, unknown>) {
  const customer = data.customer as Record<string, unknown> | null
  const customerCode = customer?.customer_code as string | undefined
  const plan = data.plan as Record<string, unknown> | null
  const planCode = plan?.plan_code as string | undefined
  const subscriptionCode = data.subscription_code as string | undefined

  if (!customerCode) {
    console.error('[Paystack Webhook] subscription.create: missing customer_code')
    throw new Error('Missing customer_code in subscription payload')
  }

  // Look up user by customer code — written during charge.success
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('paystack_customer_code', customerCode)
    .single()

  if (lookupError || !existing) {
    console.error('[Paystack Webhook] subscription.create: no record for customer_code', customerCode)
    throw new Error(`No subscription record found for customer_code: ${customerCode}`)
  }

  const tier = resolveTier(planCode)
  const nextPaymentDate = data.next_payment_date as string | undefined
  const createdAt = data.createdAt as string | undefined

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      paystack_subscription_code: subscriptionCode ?? null,
      status: 'active',
      price_id: planCode ?? null,
      tier,
      current_period_start: resolveDate(createdAt),
      current_period_end: resolveDate(nextPaymentDate),
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('paystack_customer_code', customerCode)

  if (error) {
    console.error('[Paystack Webhook] subscription.create: update failed:', error)
    throw error
  }

  await supabaseAdmin.from('audit_log').insert({
    user_id: existing.user_id,
    event_type: 'subscription_change',
    metadata: {
      paystack_event: 'subscription.create',
      subscription_code: subscriptionCode,
      plan_code: planCode,
      tier,
      status: 'active',
    },
  })

  console.log(`[Paystack Webhook] Subscription created: user=${existing.user_id} tier=${tier}`)
}

async function handleSubscriptionDisable(data: Record<string, unknown>) {
  const subscriptionCode = data.subscription_code as string | undefined

  if (!subscriptionCode) {
    console.error('[Paystack Webhook] subscription.disable: missing subscription_code')
    throw new Error('Missing subscription_code in disable payload')
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('paystack_subscription_code', subscriptionCode)
    .single()

  if (lookupError || !existing) {
    console.error('[Paystack Webhook] subscription.disable: no record for', subscriptionCode)
    throw new Error(`No subscription record found for subscription_code: ${subscriptionCode}`)
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'canceled',
      tier: 'free',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('paystack_subscription_code', subscriptionCode)

  if (error) {
    console.error('[Paystack Webhook] subscription.disable: update failed:', error)
    throw error
  }

  await supabaseAdmin.from('audit_log').insert({
    user_id: existing.user_id,
    event_type: 'subscription_change',
    metadata: {
      paystack_event: 'subscription.disable',
      subscription_code: subscriptionCode,
      status: 'canceled',
      tier: 'free',
    },
  })

  console.log(`[Paystack Webhook] Subscription disabled: user=${existing.user_id}`)
}

async function handleInvoicePaymentFailed(data: Record<string, unknown>) {
  const subscription = data.subscription as Record<string, unknown> | null
  const subscriptionCode = subscription?.subscription_code as string | undefined

  if (!subscriptionCode) {
    console.error('[Paystack Webhook] invoice.payment_failed: missing subscription_code')
    return
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('paystack_subscription_code', subscriptionCode)
    .single()

  if (lookupError || !existing) {
    console.error('[Paystack Webhook] invoice.payment_failed: no record for', subscriptionCode)
    return
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('paystack_subscription_code', subscriptionCode)

  if (error) {
    console.error('[Paystack Webhook] invoice.payment_failed: update failed:', error)
  }

  await supabaseAdmin.from('audit_log').insert({
    user_id: existing.user_id,
    event_type: 'subscription_change',
    metadata: {
      paystack_event: 'invoice.payment_failed',
      subscription_code: subscriptionCode,
      status: 'past_due',
    },
  })

  console.log(`[Paystack Webhook] Payment failed: user=${existing.user_id} — marked past_due`)
}