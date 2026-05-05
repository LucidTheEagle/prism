import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSubscription } from '@/lib/billing/getSubscription'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const action = body.action as 'cancel' | 'get_status' | undefined

    if (!action) {
      return NextResponse.json(
        { error: 'action is required — cancel or get_status' },
        { status: 400 }
      )
    }

    const subscription = await getSubscription(user.id)

    if (!subscription.paystack_subscription_code) {
      return NextResponse.json(
        { error: 'No active subscription found.' },
        { status: 400 }
      )
    }

    if (action === 'get_status') {
      // Fetch current subscription state directly from Paystack
      const paystackResponse = await fetch(
        `https://api.paystack.co/subscription/${subscription.paystack_subscription_code}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const paystackData = await paystackResponse.json()

      if (!paystackResponse.ok || !paystackData.status) {
        console.error('[manage-subscription] Paystack status fetch failed:', paystackData)
        return NextResponse.json(
          { error: paystackData.message ?? 'Failed to fetch subscription status.' },
          { status: 502 }
        )
      }

      return NextResponse.json(
        { subscription: paystackData.data },
        { status: 200 }
      )
    }

    if (action === 'cancel') {
      // Disable the subscription on Paystack
      const paystackResponse = await fetch(
        `https://api.paystack.co/subscription/disable`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: subscription.paystack_subscription_code,
            token: subscription.paystack_customer_code,
          }),
        }
      )

      const paystackData = await paystackResponse.json()

      if (!paystackResponse.ok || !paystackData.status) {
        console.error('[manage-subscription] Paystack cancellation failed:', paystackData)
        return NextResponse.json(
          { error: paystackData.message ?? 'Failed to cancel subscription.' },
          { status: 502 }
        )
      }

      // Mirror the cancellation in our subscriptions table immediately.
      // The webhook will also fire — this upsert is idempotent.
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'canceled',
          tier: 'free',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (updateError) {
        console.error('[manage-subscription] Failed to mirror cancellation:', updateError)
        // Non-fatal — webhook will reconcile. Do not block the response.
      }

      await supabaseAdmin.from('audit_log').insert({
        user_id: user.id,
        event_type: 'subscription_change',
        metadata: {
          paystack_event: 'manual_cancellation',
          subscription_code: subscription.paystack_subscription_code,
          status: 'canceled',
          tier: 'free',
        },
      })

      return NextResponse.json(
        { success: true, message: 'Subscription canceled.' },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { error: 'Unrecognized action.' },
      { status: 400 }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[manage-subscription] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}