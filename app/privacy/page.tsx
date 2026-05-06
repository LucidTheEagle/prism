import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'PRISM privacy policy — how your data is collected, stored, and protected.',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="mb-10">
        <Link
          href="/"
          className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
        >
          ← Back to PRISM
        </Link>
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-3">
        Privacy Policy
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-10">
        Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">
            1. What Data We Collect
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            PRISM collects only the minimum data required to provide the service:
          </p>
          <ul className="mt-3 space-y-2 text-slate-600 dark:text-slate-400">
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">·</span>Your email address and authentication credentials when you create an account.</li>
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">·</span>PDF documents you choose to upload for analysis.</li>
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">·</span>Queries you submit and the AI-generated responses.</li>
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">·</span>Usage metadata — document count, query count, and token consumption — for billing and plan enforcement.</li>
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">·</span>Audit logs — timestamped records of document uploads, queries, and deletions for your own security transparency.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">
            2. How Your Data Is Stored
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            All data is stored on infrastructure operated by Supabase and Microsoft Azure, both of which maintain SOC 2 Type II compliance.
          </p>
          <ul className="mt-3 space-y-2 text-slate-600 dark:text-slate-400">
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">·</span><strong className="text-slate-700 dark:text-slate-300">At rest:</strong> All files and database records are encrypted using AES-256.</li>
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">·</span><strong className="text-slate-700 dark:text-slate-300">In transit:</strong> All data is transmitted exclusively over HTTPS with TLS 1.3.</li>
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">·</span><strong className="text-slate-700 dark:text-slate-300">Isolation:</strong> Your documents are mathematically locked to your user identity using Row Level Security. No other user, firm, or tenant can access your files.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">
            3. Your Right to Delete
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            You retain absolute control over your data. You can permanently delete any document at any time directly from the PRISM interface. Deletion is immediate and irreversible — it purges the original PDF, all extracted text chunks, all vector embeddings, and the complete chat history associated with that document. A timestamped Destruction Receipt is issued as cryptographic proof of permanent deletion.
          </p>
          <p className="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            To request deletion of your entire account and all associated data, contact us at the address below. We will process the request within 7 business days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">
            4. AI Training Policy
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Your documents and chat history are <strong className="text-slate-700 dark:text-slate-300">never used to train any AI model</strong>. PRISM processes your documents in memory to generate answers. The AI infrastructure operates with content logging disabled. No third party — including our AI infrastructure provider — retains your document content after processing is complete.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">
            5. Data Retention
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Documents are retained for as long as your account is active and you choose to keep them. You can delete individual documents at any time. If you close your account, all associated data is permanently deleted within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">
            6. Who Can Access Your Data
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Only you can access your documents. PRISM staff do not access user documents except where explicitly required to resolve a technical support issue you have raised, and only with your consent. We do not sell, share, or transfer your data to any third party for commercial purposes.
          </p>
        </section>

        <section>
         <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">
           7. Nigeria Data Protection Act 2023 Compliance
         </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            PRISM processes all personal data in accordance with the Nigeria Data Protection Act 2023 (NDPA) and the General Application and Implementation Directive issued by the Nigeria Data Protection Commission (NDPC). Epopteia operates as a data controller in respect of account and usage data, and as a data processor in respect of documents you upload for analysis.
          </p>
          <ul className="mt-3 space-y-2 text-slate-600 dark:text-slate-400">
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">·</span><strong className="text-slate-700 dark:text-slate-300">Lawful basis:</strong> Personal data is processed on the basis of contractual necessity — to provide the service you have signed up for.</li>
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">·</span><strong className="text-slate-700 dark:text-slate-300">Data minimisation:</strong> Only the minimum personal data necessary to operate the service is collected and retained.</li>
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">·</span><strong className="text-slate-700 dark:text-slate-300">Cross-border transfers:</strong> Document processing may involve transfer of data to AI infrastructure operated by Microsoft Azure and Google Cloud. Both providers operate under data processing agreements that comply with NDPA cross-border transfer requirements.</li>
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">·</span><strong className="text-slate-700 dark:text-slate-300">Your rights:</strong> Under the NDPA, you have the right to access, rectify, object to processing of, and request erasure of your personal data. To exercise any of these rights, contact us at the address in Section 8.</li>
            <li className="flex gap-2"><span className="text-emerald-500 shrink-0">·</span><strong className="text-slate-700 dark:text-slate-300">Data breach notification:</strong> In the event of a personal data breach affecting your data, we will notify you and the NDPC within 72 hours of becoming aware of the breach, in accordance with NDPA requirements.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-3">
            8. Contact
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            For privacy-related enquiries or data deletion requests, contact Epopteia at{' '}
            <a
              href="mailto:privacy@epopteia.com"
              className="text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              privacy@epopteia.com
            </a>
          </p>
        </section>

      </div>

      <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700 flex gap-6 text-sm">
        <Link href="/security" className="text-emerald-600 dark:text-emerald-400 hover:underline">
          Security Architecture →
        </Link>
        <Link href="/" className="text-slate-500 dark:text-slate-400 hover:underline">
          Back to PRISM
        </Link>
      </div>
    </div>
  )
}