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

// ─────────────────────────────────────────────────────────────────────────────
// How It Works Section
// ─────────────────────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    {
      icon: <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
      step: '01',
      title: 'Adaptive Ingestion',
      description:
        'Your PDF is parsed and split into intelligent chunks using document structure — not arbitrary character counts. Legal clauses, technical sections, and narrative paragraphs are preserved as coherent units.',
      badge: 'Adaptive Chunking',
    },
    {
      icon: <Search className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
      step: '02',
      title: 'Hybrid Search',
      description:
        'Every query fires two retrieval engines simultaneously. Vector search finds semantically similar content across the entire document. BM25 keyword search finds exact terminology matches. Results are fused using Reciprocal Rank Fusion.',
      badge: 'Vector + BM25 + RRF',
    },
    {
      icon: <GitMerge className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
      step: '03',
      title: 'Multi-Pass Reasoning',
      description:
        'Retrieved passages are re-ranked by a second AI pass before the answer is generated. The system drafts an answer, then a critic model validates it against the source material, catching hallucinations before they reach you.',
      badge: 'Self-Critique AI',
    },
    {
      icon: <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
      step: '04',
      title: 'Verified Answer',
      description:
        'Every answer arrives with a confidence score and pinned citations. Each citation is a clickable link that scrolls the PDF viewer to the exact paragraph the AI used. Zero ambiguity about where the answer came from.',
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

        {/* Section header */}
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

        {/* Steps — ordered list for screen reader sequence */}
        <ol className="space-y-6 sm:space-y-8" aria-label="PRISM pipeline steps">
          {steps.map((item, i) => (
            <li
              key={i}
              className="relative flex gap-4 sm:gap-6 md:gap-10 items-start group"
            >
              {/* Step icon + connector */}
              <div className="flex flex-col items-center shrink-0" aria-hidden="true">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center group-hover:border-emerald-400 transition-colors shadow-sm">
                  {item.icon}
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px flex-1 min-h-[1.5rem] sm:min-h-[2rem] bg-gradient-to-b from-emerald-200 to-transparent dark:from-emerald-800 mt-2" />
                )}
              </div>

              {/* Content */}
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

        {/* CTA */}
        <div className="mt-10 sm:mt-16 text-center">
          <a
            href="#upload"
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Try it now — upload a PDF
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Gate Banner
// ─────────────────────────────────────────────────────────────────────────────
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
            className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center px-5 sm:px-6 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Home Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter()
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [documentReady, setDocumentReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setAuthLoaded(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleUploadComplete = (id: string) => {
    setDocumentId(id)
  }

  const handleDocumentReady = () => {
    setDocumentReady(true)
  }

  const handleChatClick = () => {
    if (documentId) {
      router.push(`/chat?doc=${documentId}`)
    }
  }

  // ── Processing / Ready state ───────────────────────────────────────
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
                className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
                aria-hidden="true"
              >
                <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-white" aria-hidden="true" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                Document Uploaded Successfully!
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Processing your document with AI…
              </p>
            </div>

            <DocumentStatus
              documentId={documentId}
              onReady={handleDocumentReady}
              autoNavigate={true}
            />

            <div className="mt-5 sm:mt-6 p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 font-medium">
                What&apos;s happening:
              </p>
              {/* ul is appropriate here — these are list items, not steps */}
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-4 list-disc">
                <li>Document saved securely to encrypted storage</li>
                <li>AI analysis and adaptive chunking</li>
                <li>Vector embeddings generation (1536 dimensions)</li>
                <li>Metadata enrichment with AI summaries</li>
                <li>Hybrid search indexing (Vector + BM25)</li>
              </ul>
            </div>

            <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row gap-3">
              {documentReady && (
                <button
                  onClick={handleChatClick}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-lg transition-all shadow-md hover:shadow-lg font-medium text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 min-h-[44px]"
                  aria-label="Start chatting with your uploaded document"
                >
                  <MessageSquare className="w-5 h-5" aria-hidden="true" />
                  Start Chatting
                </button>
              )}
              <button
                onClick={() => setDocumentId(null)}
                className="px-6 py-3 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 min-h-[44px]"
                aria-label="Discard this document and upload another"
              >
                Upload Another
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ── Landing page ───────────────────────────────────────────────────
  return (
    <>
      {/* Skip to main content — first focusable element for keyboard users */}
      <a
        href="#upload"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to upload
      </a>

      <main
        id="upload"
        className="flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 scroll-mt-16"
      >
        <div className="w-full max-w-4xl px-4 sm:px-6 py-10 sm:py-14 md:py-16">

          {/* Hero */}
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
          </header>

          {/* Upload — gated by auth */}
          <section aria-label="Document upload">
            {!authLoaded ? (
              // Skeleton — prevents layout shift while auth resolves
              <div
                className="w-full max-w-2xl mx-auto h-36 sm:h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"
                role="status"
                aria-label="Loading upload area"
                aria-busy="true"
              />
            ) : user ? (
              <DocumentUploader onUploadComplete={handleUploadComplete} />
            ) : (
              <AuthGateBanner />
            )}
          </section>

          {/* Stats */}
          <section aria-label="PRISM performance stats" className="mt-8 sm:mt-12">
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
              {[
                {
                  icon: <Target className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
                  stat: '95%',
                  label: 'Average Confidence',
                  sub: 'AI self-validates every answer',
                },
                {
                  icon: <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
                  stat: '<30s',
                  label: 'Response Time',
                  sub: 'Complete multi-pass answer',
                },
                {
                  icon: <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" aria-hidden="true" />,
                  stat: '100%',
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

          {/* Trust indicators */}
          <div className="mt-6 sm:mt-8 text-center" aria-label="Technology highlights">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Trusted by legal teams, compliance officers, and researchers
            </p>
            <ul className="flex items-center justify-center gap-3 sm:gap-6 text-xs text-slate-400 dark:text-slate-500 flex-wrap list-none">
              {[
                'Hybrid Search (Vector + BM25)',
                'Multi-Pass Validation',
                'Self-Improving AI',
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

      {/* How It Works */}
      <HowItWorksSection />
    </>
  )
}