import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'

export const metadata: Metadata = {
  title: 'Profile — PRISM',
  description: 'Manage your account, security, and data custody settings.',
}

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/profile')

  // Fetch last 5 audit log entries for this user
  const { data: auditEntries } = await supabaseAdmin
    .from('audit_log')
    .select('id, event_type, document_id, created_at, metadata, ip_address')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Fetch document count
  const { count: documentCount } = await supabaseAdmin
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('status', 'failed')

  return (
    <ProfileClient
      userId={user.id}
      userEmail={user.email ?? ''}
      userName={user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''}
      auditEntries={auditEntries ?? []}
      documentCount={documentCount ?? 0}
    />
  )
}