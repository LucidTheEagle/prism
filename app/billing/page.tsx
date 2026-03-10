import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSubscription } from '@/lib/billing/getSubscription'
import { TIER_LIMITS, PRICE_IDS } from '@/lib/types'
import BillingClient from '@/app/billing/BillingClient'

export const metadata = {
  title: 'Billing',
  description: 'Manage your PRISM subscription',
}

export default async function BillingPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/billing')

  const subscription = await getSubscription(user.id)

  return (
    <BillingClient
      subscription={subscription}
      tierLimits={TIER_LIMITS}
      priceIds={PRICE_IDS}
      userEmail={user.email ?? ''}
    />
  )
}