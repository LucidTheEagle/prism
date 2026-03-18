import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Lock, Eye, Trash2, FileText } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Security Architecture',
  description: 'How PRISM protects your legal documents — encryption, isolation, and verifiable destruction.',
}

const sections = [
  {
    icon: Shield,
    number: '01',
    title: 'Cryptographic Document Isolation',
    body: `Your documents are mathematically locked to your specific user identity using strict Row Level Security (RLS) database protocols. It is architecturally impossible for another user, firm, or tenant to access, query, or even confirm the existence of your files. This is not a permission setting — it is a mathematical constraint enforced at the database layer.`,
  },
  {
    icon: Eye,
    number: '02',
    title: 'Zero-Knowledge Training Policy',
    body: `Your documents and chat history are never used to train any AI model. PRISM is powered by Microsoft Azure Enterprise AI infrastructure — the same security and compliance standards trusted by the world's largest legal and financial institutions. Azure operates with Content Logging disabled. The system processes your document in memory to provide citations, and the models retain nothing. Microsoft cannot see your data. Neither can we.`,
  },
  {
    icon: Lock,
    number: '03',
    title: 'Military-Grade Encryption',
    body: `In transit: all data is transmitted over strictly enforced HTTPS/TLS 1.3 connections. At rest: every file, text chunk, and vector embedding is encrypted using AES-256 — the same standard used by global financial institutions and governments. Encryption is not optional and cannot be disabled.`,
  },
  {
    icon: Trash2,
    number: '04',
    title: 'Total Custody and Verifiable Destruction',
    body: `You retain absolute control over the lifecycle of your data. With a single click, you can execute a permanent deletion. This action immediately and irreversibly purges the original PDF, all generated text chunks, all vector embeddings, and the complete associated chat history. A timestamped Destruction Receipt is generated as cryptographic proof of permanent deletion — a legal artifact you can retain for compliance purposes.`,
  },
  {
    icon: FileText,
    number: '05',
    title: 'Forensic Traceability',
    body: `Every answer PRISM generates is accompanied by a direct citation to the exact page and paragraph of your original document. You never have to trust the system blindly — you can verify every claim instantly against the source material. This is not a feature. It is the architectural foundation of the system.`,
  },
]

export default function SecurityPage() {
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

      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs text-emerald-700 dark:text-emerald-400 mb-6">
          <Shield className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="font-medium">Enterprise Security Architecture</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
          PRISM Security Architecture
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
          Absolute Clarity, Zero Compromise. In the legal sector, ambiguity is a liability. PRISM was engineered from the ground up as a Secure Enclave.
        </p>
      </div>

      <div className="space-y-8">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <div
              key={section.number}
              className="flex gap-5 sm:gap-8 p-5 sm:p-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="shrink-0">
                <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-center">
                  <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                    {section.number}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                    {section.title}
                  </h2>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm sm:text-base">
                  {section.body}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-12 p-6 sm:p-8 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-2">
          Ready to see it in action?
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Upload a document and experience PRISM&apos;s secure enclave for yourself. Your first 3 documents are free.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          Begin the Ascent →
        </Link>
      </div>

      <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-700 flex gap-6 text-sm">
        <Link href="/privacy" className="text-emerald-600 dark:text-emerald-400 hover:underline">
          Privacy Policy →
        </Link>
        <Link href="/" className="text-slate-500 dark:text-slate-400 hover:underline">
          Back to PRISM
        </Link>
      </div>
    </div>
  )
}