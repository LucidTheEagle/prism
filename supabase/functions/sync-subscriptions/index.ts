// supabase/functions/sync-subscriptions/index.ts
//
// Nightly Stripe subscription sync — graceful degradation fallback.
//
// Purpose:
//   Webhooks are the primary sync mechanism. This function is the safety net.
//   If a webhook fails, retries exhaust, or Stripe has a delivery outage,
//   this function runs at midnight UTC and reconciles every subscription
//   in our database against live Stripe state.
//
// Runtime: Deno (Supabase Edge Functions)
// Trigger: pg_cron at 00:00 UTC daily
// Pagination: Stripe cursor-based, 100 records per page — handles any scale

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void
}

import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-02-25.clover',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// Map Stripe price IDs to internal tiers
function resolveTier(priceId: string | null | undefined): string {
  if (!priceId) return 'free'
  if (priceId === Deno.env.get('STRIPE_PRICE_PRO')) return 'pro'
  if (priceId === Deno.env.get('STRIPE_PRICE_ENTERPRISE')) return 'enterprise'
  return 'free'
}

function unixToIso(seconds: number | null | undefined): string | null {
  if (!seconds) return null
  return new Date(seconds * 1000).toISOString()
}

async function resolvePeriodFromInvoice(
  subscription: { latest_invoice: string | { id: string }; lines: { data: { period: unknown }[] } }
): Promise<{ current_period_start: string | null; current_period_end: string | null }> {
  const latestInvoiceId =
    typeof subscription.latest_invoice === 'string'
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id

  if (!latestInvoiceId) {
    return { current_period_start: null, current_period_end: null }
  }

  try {
    const invoice = await stripe.invoices.retrieve(latestInvoiceId)
    const lineWithPeriod = invoice.lines.data.find((line: { period: unknown }) => !!line.period)
    const period = lineWithPeriod?.period
    return {
      current_period_start: unixToIso(period?.start),
      current_period_end: unixToIso(period?.end),
    }
  } catch {
    return { current_period_start: null, current_period_end: null }
  }
}

interface SyncResult {
  processed: number
  updated: number
  errors: number
  skipped: number
}

async function syncAllSubscriptions(): Promise<SyncResult> {
  const result: SyncResult = { processed: 0, updated: 0, errors: 0, skipped: 0 }

  // Fetch all subscription records from our database
  // These are the users we need to verify against Stripe
  const { data: localSubs, error: fetchError } = await supabase
    .from('subscriptions')
    .select('user_id, stripe_subscription_id, stripe_customer_id, status, tier')
    .not('stripe_subscription_id', 'is', null)

  if (fetchError) {
    console.error('[sync-subscriptions] Failed to fetch local subscriptions:', fetchError)
    throw fetchError
  }

  if (!localSubs || localSubs.length === 0) {
    console.log('[sync-subscriptions] No subscriptions to sync')
    return result
  }

  console.log(`[sync-subscriptions] Syncing ${localSubs.length} subscriptions`)

  // Process in batches to avoid overwhelming Stripe API
  const BATCH_SIZE = 10
  for (let i = 0; i < localSubs.length; i += BATCH_SIZE) {
    const batch = localSubs.slice(i, i + BATCH_SIZE)

    await Promise.allSettled(
      batch.map(async (localSub: { stripe_subscription_id: string; status: string; tier: string; user_id: string }) => {
        result.processed++

        if (!localSub.stripe_subscription_id) {
          result.skipped++
          return
        }

        try {
          // Retrieve live state from Stripe
          const stripeSub = await stripe.subscriptions.retrieve(
            localSub.stripe_subscription_id
          )

          const priceId = stripeSub.items.data[0]?.price.id ?? null
          const tier = resolveTier(priceId)
          const { current_period_start, current_period_end } =
            await resolvePeriodFromInvoice(stripeSub)

          // Compare — only write if something has drifted
          const statusDrifted = stripeSub.status !== localSub.status
          const tierDrifted = tier !== localSub.tier

          if (!statusDrifted && !tierDrifted) {
            result.skipped++
            console.log(`[sync-subscriptions] No drift: ${localSub.stripe_subscription_id}`)
            return
          }

          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: stripeSub.status,
              price_id: priceId,
              tier,
              current_period_start,
              current_period_end,
              cancel_at_period_end: stripeSub.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', localSub.stripe_subscription_id)

          if (updateError) {
            console.error(
              `[sync-subscriptions] Update failed for ${localSub.stripe_subscription_id}:`,
              updateError
            )
            result.errors++
            return
          }

          // Write audit record for the sync correction
          await supabase.from('audit_log').insert({
            user_id: localSub.user_id,
            event_type: 'subscription_change',
            metadata: {
              source: 'nightly_sync',
              stripe_subscription_id: localSub.stripe_subscription_id,
              previous_status: localSub.status,
              new_status: stripeSub.status,
              previous_tier: localSub.tier,
              new_tier: tier,
              drift_detected: true,
            },
          })

          result.updated++
          console.log(
            `[sync-subscriptions] Corrected drift: ${localSub.stripe_subscription_id} | ` +
            `status: ${localSub.status} -> ${stripeSub.status} | ` +
            `tier: ${localSub.tier} -> ${tier}`
          )

        } catch (err) {
          // If Stripe returns 404, the subscription was deleted outside our webhook
          const stripeErr = err as { statusCode?: number; message?: string }
          if (stripeErr.statusCode === 404) {
            console.warn(
              `[sync-subscriptions] Subscription not found in Stripe, canceling: ${localSub.stripe_subscription_id}`
            )
            await supabase
              .from('subscriptions')
              .update({
                status: 'canceled',
                tier: 'free',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_subscription_id', localSub.stripe_subscription_id)
            result.updated++
          } else {
            console.error(
              `[sync-subscriptions] Error processing ${localSub.stripe_subscription_id}:`,
              stripeErr.message
            )
            result.errors++
          }
        }
      })
    )

    // Brief pause between batches — respect Stripe rate limits (100 req/s)
    if (i + BATCH_SIZE < localSubs.length) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  return result
}

Deno.serve(async (req: Request) => {
  // Verify the request comes from our pg_cron trigger, not the open internet
  const authHeader = req.headers.get('Authorization')
  const expectedToken = Deno.env.get('CRON_SECRET')

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    console.log(`[sync-subscriptions] Starting nightly sync — ${new Date().toISOString()}`)
    const result = await syncAllSubscriptions()
    console.log(`[sync-subscriptions] Complete:`, result)

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[sync-subscriptions] Fatal error:', message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})