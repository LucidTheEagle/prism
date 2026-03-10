import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase/server'
import { SubscriptionTier } from '@/lib/types'

// ============================================================================
// STRIPE WEBHOOK PIPELINE
// POST /api/webhooks/stripe
//
// This is the nervous system of PRISM's monetization engine.
// Stripe calls this endpoint when subscription state changes.
// We write the result to the subscriptions table so the paywall
// middleware never has to query Stripe at runtime.
//
// Events handled:
//   checkout.session.completed       → create subscription record
//   customer.subscription.updated   → sync status + tier
//   customer.subscription.deleted   → revoke access immediately
//
// Security: Stripe-Signature header verified on every request.
// Raw body required — do NOT parse as JSON before verification.
// ============================================================================

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

function unixToIso(seconds: number | null | undefined): string | null {
  if (!seconds) return null
  return new Date(seconds * 1000).toISOString()
}

async function resolveSubscriptionPeriod(
  subscription: Stripe.Subscription
): Promise<{ current_period_start: string | null; current_period_end: string | null }> {
  const latestInvoiceId =
    typeof subscription.latest_invoice === 'string'
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id

  if (!latestInvoiceId) {
    return { current_period_start: null, current_period_end: null }
  }

  const invoice = await stripe.invoices.retrieve(latestInvoiceId)
  const lineWithPeriod = invoice.lines.data.find((line) => !!line.period)
  const period = lineWithPeriod?.period

  return {
    current_period_start: unixToIso(period?.start),
    current_period_end: unixToIso(period?.end),
  }
}

// Map Stripe price IDs to internal tiers
function resolveTier(priceId: string | null | undefined): SubscriptionTier {
  if (!priceId) return 'free'
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return 'enterprise'
  return 'free'
}

export async function POST(request: NextRequest) {
  // ── Step 1: Extract raw body + signature ──────────────────────────────────
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  // ── Step 2: Verify webhook signature ─────────────────────────────────────
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed'
    console.error('[Stripe Webhook] Signature verification failed:', message)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    )
  }

  console.log(`[Stripe Webhook] Received event: ${event.type} | id: ${event.id}`)

  // ── Step 3: Route to handler ──────────────────────────────────────────────
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      default:
        // Acknowledge unhandled events — never return non-2xx for unknown types
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Handler error'
    console.error(`[Stripe Webhook] Handler error for ${event.type}:`, message)
    // Return 500 so Stripe retries the event
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

// ============================================================================
// HANDLER: checkout.session.completed
//
// Fired when a user completes the Stripe Checkout flow.
// The session contains customer_id and subscription_id.
// We retrieve the full subscription object to get price and period data,
// then upsert into our subscriptions table.
//
// The user_id is passed as metadata.userId when creating the
// checkout session (Sprint 7). It is the source of truth for
// linking Stripe state to our auth.users record.
// ============================================================================
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.userId

  if (!userId) {
    console.error('[Stripe Webhook] checkout.session.completed: missing metadata.userId', {
      sessionId: session.id,
    })
    throw new Error('Missing userId in checkout session metadata')
  }

  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  if (!subscriptionId) {
    // One-time payment, not a subscription — ignore
    console.log('[Stripe Webhook] checkout.session.completed: no subscription, skipping')
    return
  }

  // Retrieve full subscription from Stripe to get price + period data
  const subscription = (await stripe.subscriptions.retrieve(
    subscriptionId
  )) as Stripe.Subscription
  const priceId = subscription.items.data[0]?.price.id ?? null
  const tier = resolveTier(priceId)
  const { current_period_start, current_period_end } =
    await resolveSubscriptionPeriod(subscription)

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: subscription.status,
        price_id: priceId,
        tier,
        current_period_start,
        current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[Stripe Webhook] Failed to upsert subscription on checkout:', error)
    throw error
  }

  // Write audit record
  await supabaseAdmin.from('audit_log').insert({
    user_id: userId,
    event_type: 'subscription_change',
    metadata: {
      stripe_event: 'checkout.session.completed',
      subscription_id: subscriptionId,
      tier,
      status: subscription.status,
    },
  })

  console.log(`[Stripe Webhook] Subscription created: user=${userId} tier=${tier} status=${subscription.status}`)
}

// ============================================================================
// HANDLER: customer.subscription.updated
//
// Fired when plan changes, payment fails (→ past_due),
// cancellation is scheduled, or trial ends.
// We sync status, price_id, tier, and period dates.
// Identified by stripe_subscription_id — no metadata needed.
// ============================================================================
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price.id ?? null
  const tier = resolveTier(priceId)
  const { current_period_start, current_period_end } =
    await resolveSubscriptionPeriod(subscription)

  // Look up our user by stripe_subscription_id
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (lookupError || !existing) {
    console.error('[Stripe Webhook] subscription.updated: no matching record for', subscription.id)
    throw new Error(`No subscription record found for stripe_subscription_id: ${subscription.id}`)
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: subscription.status,
      price_id: priceId,
      tier,
      current_period_start,
      current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('[Stripe Webhook] Failed to update subscription:', error)
    throw error
  }

  await supabaseAdmin.from('audit_log').insert({
    user_id: existing.user_id,
    event_type: 'subscription_change',
    metadata: {
      stripe_event: 'customer.subscription.updated',
      subscription_id: subscription.id,
      tier,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
  })

  console.log(`[Stripe Webhook] Subscription updated: user=${existing.user_id} tier=${tier} status=${subscription.status}`)
}

// ============================================================================
// HANDLER: customer.subscription.deleted
//
// Fired when a subscription is fully canceled (not just scheduled).
// Access is revoked immediately — status set to 'canceled', tier to 'free'.
// This is the hard wall. No grace period at the application layer.
// ============================================================================
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
) {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (lookupError || !existing) {
    console.error('[Stripe Webhook] subscription.deleted: no matching record for', subscription.id)
    throw new Error(`No subscription record found for stripe_subscription_id: ${subscription.id}`)
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'canceled',
      tier: 'free',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('[Stripe Webhook] Failed to cancel subscription:', error)
    throw error
  }

  await supabaseAdmin.from('audit_log').insert({
    user_id: existing.user_id,
    event_type: 'subscription_change',
    metadata: {
      stripe_event: 'customer.subscription.deleted',
      subscription_id: subscription.id,
      status: 'canceled',
      tier: 'free',
    },
  })

  console.log(`[Stripe Webhook] Subscription canceled: user=${existing.user_id} — access revoked`)
}