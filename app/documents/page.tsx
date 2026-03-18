import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'My Documents',
  description: 'Manage your uploaded documents in PRISM.',
}

export default async function DocumentsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/documents')

  const { data: documents } = await supabaseAdmin
    .from('documents')
    .select('id, name, status, page_count, document_type, file_size_bytes, created_at, file_hash')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return <DocumentsClient documents={documents ?? []} />
}

// ── Inline client component ───────────────────────────────────────────────
import DocumentsClient from './DocumentsClient'