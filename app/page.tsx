'use client'

import { useState, useEffect } from 'react'
import {
  FileText,
  Zap,
  Target,
  MessageSquare,
  Search,
  Brain,
  GitMerge,
  CheckCircle,
  ArrowRight,
} from 'lucide-react'
import { DocumentUploader } from '@/components/DocumentUploader'
import { DocumentStatus } from '@/components/DocumentStatus'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

function HowItWorksSection() {
  const steps = [
    {
      icon: <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
      step: '01',
      title: 'Secure Upload & Analysis',
      description:
        'Your PDF is encrypted the moment it touches our servers. PRISM reads the document structure — preserving legal clauses, numbered sections, and defined terms as coherent units rather than cutting them arbitrarily.',
      badge: 'Encrypted Ingestion',
    },
    {
      icon: <Search className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
      step: '02',
      title: 'Dual-Engine Search',
      description:
        'Every query fires two search engines simultaneously. One finds content by meaning — so "penalties" finds "consequences of breach" even without the exact word. The other finds exact terminology matches — critical for clause references and defined terms.',
      badge: 'Semantic + Keyword',
    },
    {
      icon: <GitMerge className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
      step: '03',
      title: 'Self-Validating Reasoning',
      description:
        'PRISM drafts an answer, then a second AI layer reviews it against the source document before it reaches you — catching errors and unsupported claims. By the time you read the response, it has already been stress-tested.',
      badge: 'Built-in Verification',
    },
    {
      icon: <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
      step: '04',
      title: 'Verified Answer with Proof',
      description:
        'Every answer is classified as Explicitly Stated, Inferred, or Silent — never a percentage guess. A clickable citation jumps your PDF viewer to the exact paragraph. You never trust the system blindly — you verify every claim in seconds.',
      badge: 'Forensic Citations',
    },
  ]

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 scroll-mt-16"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20">
        <div className="text-center mb-10 sm:mb-16">
          <div
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 mb-4 sm:mb-6"
            aria-hidden="true"
          >
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
            <span className="font-medium">The PRISM Engine</span>
          </div>
          <h2
            id="how-it-works-heading"
            className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-3 sm:mb-4"
          >
            How PRISM works
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            A four-stage pipeline that transforms a static PDF into a
            queryable knowledge base with enterprise-grade citation accuracy.
          </p>
        </div>

        <ol className="space-y-6 sm:space-y-8" aria-label="PRISM pipeline steps">
          {steps.map((item, i) => (
            <li
              key={i}
              className="relative flex gap-4 sm:gap-6 md:gap-10 items-start group"
            >
              <div className="flex flex-col items-center shrink-0" aria-hidden="true">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center group-hover:border-emerald-400 transition-colors shadow-sm">
                  {item.icon}
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px flex-1 min-h-[1.5rem] sm:min-h-[2rem] bg-gradient-to-b from-emerald-200 to-transparent dark:from-emerald-800 mt-2" />
                )}
              </div>

              <div className="pb-6 sm:pb-8 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500" aria-hidden="true">
                    {item.step}
                  </span>
                  <span className="text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-full font-medium border border-emerald-200 dark:border-emerald-800">
                    {item.badge}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 mb-1.5 sm:mb-2">
                  {item.title}
                </h3>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 sm:mt-16 text-center">
          <a
            href="#upload"
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Try it now — upload a PDF
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  )
}

function AuthGateBanner() {
  return (
    <div className="w-full max-w-2xl mx-auto mt-4" role="region" aria-label="Sign in required">
      <div className="rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 px-6 py-8 sm:p-10 text-center">
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-100 dark:bg-emerald-950 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
          <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50 mb-2">
          Sign in to upload documents
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm mx-auto">
          Create your free account to start uploading PDFs and querying them
          with AI precision.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center px-5 sm:px-6 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}

const DEMO_DOCUMENT_ID = process.env.NEXT_PUBLIC_DEMO_DOCUMENT_ID ?? ''

const ONBOARDING_QUERIES = [
  'What are the termination conditions and notice periods under this agreement?',
  'Does this agreement comply with the Nigeria Data Protection Act 2023?',
  'What is the liability cap and how does it relate to the total contract value?',
]

function OnboardingBanner() {
  const router = useRouter()

  function handleOpenDemo() {
    router.push(`/chat?doc=${DEMO_DOCUMENT_ID}`)
  }

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl p-6">

        {/* Framing statement */}
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-4">
          Getting started
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-5">
          Interrogate your document. Every answer is verified against the source or declared absent — never a guess.
        </p>

        {/* Sample document card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Professional Services and Technology Integration Agreement
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  19 pages · Nigerian commercial contract · Pre-loaded and ready
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenDemo}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Open
            </button>
          </div>

          {/* Pre-written queries */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Try these queries on this document:
            </p>
            <ul className="space-y-2 list-none">
              {ONBOARDING_QUERIES.map((q) => (
                <li key={q}>
                  <button
                    onClick={() => {
                      router.push(`/chat?doc=${DEMO_DOCUMENT_ID}`)
                    }}
                    className="w-full text-left text-xs text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          Or upload your own document below to begin your own analysis.
        </p>
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [documentReady, setDocumentReady] = useState(false)
  const [processingFailed, setProcessingFailed] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [hasDocuments, setHasDocuments] = useState<boolean | null>(null)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setAuthLoaded(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (!user) return
    fetch('/api/documents')
      .then(r => r.json())
      .then(data => {
        const docs = (data.documents ?? []).filter(
          (d: { status: string }) => d.status === 'ready'
        )
        setHasDocuments(docs.length > 0)
      })
      .catch(() => setHasDocuments(false))
  }, [user])

  const handleUploadComplete = (id: string) => {
    setDocumentId(id)
    setDocumentReady(false)
    setProcessingFailed(false)
  }

  const handleDocumentReady = () => {
    setDocumentReady(true)
  }

  const handleChatClick = () => {
    if (documentId) {
      router.push(`/chat?doc=${documentId}`)
    }
  }

 // ── Processing / Ready state ───────────────────────────────────────────────
 if (documentId) {
  return (
    <main className="min-h-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg p-5 sm:p-8"
          role="status"
          aria-live="polite"
          aria-label="Document processing status"
        >
          <div className="text-center mb-5 sm:mb-6">
            <div
              className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ${
                documentReady
                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                  : processingFailed
                    ? 'bg-gradient-to-br from-rose-500 to-rose-600'
                    : 'bg-gradient-to-br from-slate-400 to-slate-500'
              }`}
              aria-hidden="true"
            >
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-white" aria-hidden="true" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              {documentReady
                ? 'Document Ready for Analysis'
                : processingFailed
                  ? 'Upload Interrupted'
                  : 'Building Intelligence Base…'}
            </h2>
          </div>

          <DocumentStatus
            documentId={documentId}
            onReady={handleDocumentReady}
            onFailed={() => setProcessingFailed(true)}
            autoNavigate={!processingFailed}
          />

          <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row gap-3">
            {documentReady && (
              <button
                onClick={handleChatClick}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-lg transition-all shadow-md hover:shadow-lg font-medium text-sm sm:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 min-h-[44px]"
                aria-label="Start chatting with your uploaded document"
              >
                <MessageSquare className="w-5 h-5" aria-hidden="true" />
                Begin Analysis
              </button>
            )}
            <button
              onClick={() => {
                setDocumentId(null)
                setDocumentReady(false)
                setProcessingFailed(false)
              }}
              className="px-6 py-3 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 min-h-[44px]"
              aria-label="Upload another document"
            >
              Upload Another
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

  // ── Landing page ───────────────────────────────────────────────────────────
  return (
    <>
      <main
        id="upload"
        className="flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 scroll-mt-16"
      >
        <div className="w-full max-w-4xl px-4 sm:px-6 py-10 sm:py-14 md:py-16">

          <header className="text-center mb-8 sm:mb-12">
            <div
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 mb-4 sm:mb-6"
              aria-hidden="true"
            >
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
              <span className="font-medium">AI-Powered Document Intelligence</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-slate-50 mb-3 sm:mb-4 leading-tight">
              Upload. Ask. Verify.
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Transform any PDF into an intelligent knowledge base with{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                forensic citation accuracy
              </strong>
            </p>
            <p className="mt-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
              AES-256 encrypted · Isolated to your account · Never used to train any AI model
            </p>
          </header>

          <section aria-label="Document upload">
            {!authLoaded ? (
              <div
                className="w-full max-w-2xl mx-auto h-36 sm:h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"
                role="status"
                aria-label="Loading upload area"
                aria-busy="true"
              />
            ) : user ? (
              <>
                {hasDocuments === false && DEMO_DOCUMENT_ID && (
                  <OnboardingBanner />
                )}
                <DocumentUploader onUploadComplete={handleUploadComplete} />
              </>
            ) : (
              <AuthGateBanner />
            )}
          </section>

          <section aria-label="PRISM performance stats" className="mt-8 sm:mt-12">
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
              {[
                {
                  icon: <Target className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
                  stat: 'Verified or Silent',
                  label: 'Epistemic Certainty',
                  sub: 'Every answer categorised — never a guess',
                },
                {
                  icon: <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
                  stat: 'Four-Agent',
                  label: 'Reasoning Pipeline',
                  sub: 'Independent verification before every answer',
                },
                {
                  icon: <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
                  stat: 'Every Answer',
                  label: 'Source Verified',
                  sub: 'Click to exact paragraph',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex sm:flex-col items-center sm:items-center gap-4 sm:gap-0 p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center shrink-0 sm:mx-auto sm:mb-4">
                    {item.icon}
                  </div>
                  <div className="flex-1 sm:text-center">
                    <dt className="text-xs text-slate-500 dark:text-slate-400 sm:order-last sm:mt-1">
                      {item.label}
                    </dt>
                    <dd className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 sm:mb-1">
                      {item.stat}
                    </dd>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.sub}
                    </p>
                  </div>
                </div>
              ))}
            </dl>
          </section>

          <div className="mt-6 sm:mt-8 text-center" aria-label="Technology highlights">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Built for legal professionals, compliance officers, and researchers
            </p>
            <ul className="flex items-center justify-center gap-3 sm:gap-6 text-xs text-slate-400 dark:text-slate-500 flex-wrap list-none">
              {[
                'Finds answers by meaning, not just keywords',
                'Every answer verified before it reaches you',
                'Cites the exact paragraph, every time',
              ].map((label) => (
                <li key={label} className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full" aria-hidden="true" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      <HowItWorksSection />
    </>
  )
}