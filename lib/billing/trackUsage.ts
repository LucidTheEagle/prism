import { supabaseAdmin } from '@/lib/supabase/server'
import { Subscription } from '@/lib/types'

interface TrackQueryParams {
  userId: string
  subscription: Subscription
  tokensInput: number
  tokensOutput: number
}

interface TrackDocumentParams {
  userId: string
  subscription: Subscription
}

/**
 * trackQuery
 *
 * Upserts a usage_tracking record for the current billing period,
 * incrementing query_count and token totals.
 * Called after a successful answer generation in /api/chat.
 */
export async function trackQuery({
  userId,
  subscription,
  tokensInput,
  tokensOutput,
}: TrackQueryParams): Promise<void> {
  const { periodStart, periodEnd } = resolvePeriod(subscription)
  const tokensConsumed = tokensInput + tokensOutput

  const { error } = await supabaseAdmin.rpc('upsert_usage_query', {
    p_user_id: userId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_tokens_input: tokensInput,
    p_tokens_output: tokensOutput,
    p_tokens_consumed: tokensConsumed,
  })

  if (error) {
    // Non-fatal — log but don't throw. A tracking failure must never
    // block the user from receiving their answer.
    console.error('[trackQuery] Failed to update usage:', error)
  }
}

/**
 * trackDocumentUpload
 *
 * Increments document_count for the current billing period.
 * Called after successful ingestion pipeline completion.
 */
export async function trackDocumentUpload({
  userId,
  subscription,
}: TrackDocumentParams): Promise<void> {
  const { periodStart, periodEnd } = resolvePeriod(subscription)

  const { error } = await supabaseAdmin.rpc('upsert_usage_document', {
    p_user_id: userId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  })

  if (error) {
    console.error('[trackDocumentUpload] Failed to update usage:', error)
  }
}

function resolvePeriod(subscription: Subscription): {
  periodStart: string
  periodEnd: string
} {
  if (subscription.current_period_start && subscription.current_period_end) {
    return {
      periodStart: subscription.current_period_start,
      periodEnd: subscription.current_period_end,
    }
  }

  // Free tier — use calendar month as the period
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
  return { periodStart, periodEnd }
}