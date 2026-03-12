import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase/server'
import { SubscriptionTier } from '@/lib/types'

function unixToIso(seconds: number | null | undefined): string | null {
  if (!seconds) return null
  return new Date(seconds * 1000).toISOString()
}

function resolveTier(priceId: string | null | undefined): SubscriptionTier {
  if (!priceId) return 'free'
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return 'enterprise'
  return 'free'
}

async function resolveSubscriptionPeriod(
  stripe: Stripe,
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

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  })

  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

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

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(stripe, event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripe, event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Handler error'
    console.error(`[Stripe Webhook] Handler error for ${event.type}:`, message)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutSessionCompleted(
  stripe: Stripe,
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
    console.log('[Stripe Webhook] checkout.session.completed: no subscription, skipping')
    return
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription
  const priceId = subscription.items.data[0]?.price.id ?? null
  const tier = resolveTier(priceId)
  const { current_period_start, current_period_end } =
    await resolveSubscriptionPeriod(stripe, subscription)

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

async function handleSubscriptionUpdated(
  stripe: Stripe,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price.id ?? null
  const tier = resolveTier(priceId)
  const { current_period_start, current_period_end } =
    await resolveSubscriptionPeriod(stripe, subscription)

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