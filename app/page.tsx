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
// Explains the PRISM engine pipeline visually.
// Anchor ID: "how-it-works" — targeted by the header nav link.
// ─────────────────────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    {
      icon: <FileText className="w-6 h-6 text-emerald-600" />,
      step: '01',
      title: 'Adaptive Ingestion',
      description:
        'Your PDF is parsed and split into intelligent chunks using document structure — not arbitrary character counts. Legal clauses, technical sections, and narrative paragraphs are preserved as coherent units.',
      badge: 'Adaptive Chunking',
    },
    {
      icon: <Search className="w-6 h-6 text-emerald-600" />,
      step: '02',
      title: 'Hybrid Search',
      description:
        'Every query fires two retrieval engines simultaneously. Vector search finds semantically similar content across the entire document. BM25 keyword search finds exact terminology matches. Results are fused using Reciprocal Rank Fusion.',
      badge: 'Vector + BM25 + RRF',
    },
    {
      icon: <GitMerge className="w-6 h-6 text-emerald-600" />,
      step: '03',
      title: 'Multi-Pass Reasoning',
      description:
        'Retrieved passages are re-ranked by a second AI pass before the answer is generated. The system drafts an answer, then a critic model validates it against the source material, catching hallucinations before they reach you.',
      badge: 'Self-Critique AI',
    },
    {
      icon: <Brain className="w-6 h-6 text-emerald-600" />,
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
      className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 scroll-mt-16"
    >
      <div className="max-w-5xl mx-auto px-4 py-20">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full text-sm text-emerald-700 dark:text-emerald-400 mb-6">
            <Zap className="w-4 h-4" />
            <span className="font-medium">The PRISM Engine</span>
          </div>
          <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">
            How PRISM works
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            A four-stage pipeline that transforms a static PDF into a
            queryable knowledge base with enterprise-grade citation accuracy.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-8">
          {steps.map((item, i) => (
            <div
              key={i}
              className="relative flex gap-6 md:gap-10 items-start group"
            >
              {/* Step number + connector line */}
              <div className="flex flex-col items-center shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center group-hover:border-emerald-400 transition-colors shadow-sm">
                  {item.icon}
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px flex-1 min-h-[2rem] bg-gradient-to-b from-emerald-200 to-transparent dark:from-emerald-800 mt-2" />
                )}
              </div>

              {/* Content */}
              <div className="pb-8 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                    {item.step}
                  </span>
                  <span className="text-xs px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-full font-medium border border-emerald-200 dark:border-emerald-800">
                    {item.badge}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA at bottom of section */}
        <div className="mt-16 text-center">
          <a
            href="#upload"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl text-sm"
          >
            Try it now — upload a PDF
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Gate Banner
// Shown in place of the uploader when the user is not signed in.
// ─────────────────────────────────────────────────────────────────────────────
function AuthGateBanner() {
  return (
    <div className="w-full max-w-2xl mx-auto mt-4">
      <div className="rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 p-10 text-center">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-2">
          Sign in to upload documents
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm mx-auto">
          Create your free account to start uploading PDFs and querying them
          with AI precision.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center px-6 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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

  // ── Processing/Ready state — shown after successful upload ─────
  if (documentId) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
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

            <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 font-medium">
                What&apos;s happening:
              </p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-4 list-disc">
                <li>Document saved securely to encrypted storage</li>
                <li>AI analysis and adaptive chunking</li>
                <li>Vector embeddings generation (1536 dimensions)</li>
                <li>Metadata enrichment with AI summaries</li>
                <li>Hybrid search indexing (Vector + BM25)</li>
              </ul>
            </div>

            <div className="mt-6 flex gap-3">
              {documentReady && (
                <button
                  onClick={handleChatClick}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-lg transition-all shadow-md hover:shadow-lg font-medium"
                >
                  <MessageSquare className="w-5 h-5" />
                  Start Chatting
                </button>
              )}
              <button
                onClick={() => setDocumentId(null)}
                className="px-6 py-3 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
              >
                Upload Another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Landing page — upload state ────────────────────────────────
  return (
    <>
      <div
        id="upload"
        className="flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 scroll-mt-16"
      >
        <div className="w-full max-w-4xl px-4 py-16">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-full text-sm text-emerald-700 dark:text-emerald-400 mb-6">
              <Zap className="w-4 h-4" />
              <span className="font-medium">AI-Powered Document Intelligence</span>
            </div>

            <h1 className="text-5xl font-bold text-slate-900 dark:text-slate-50 mb-4">
              Upload. Ask. Verify.
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Transform any PDF into an intelligent knowledge base with{' '}
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                forensic citation accuracy
              </span>
            </p>
          </div>

          {/* Upload area — gated by auth */}
          {!authLoaded ? (
            // Skeleton — prevents layout shift while auth resolves
            <div className="w-full max-w-2xl mx-auto h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ) : user ? (
            <DocumentUploader onUploadComplete={handleUploadComplete} />
          ) : (
            <AuthGateBanner />
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {[
              {
                icon: <Target className="w-6 h-6 text-emerald-600" />,
                stat: '95%',
                label: 'Average Confidence',
                sub: 'AI self-validates every answer',
              },
              {
                icon: <Zap className="w-6 h-6 text-emerald-600" />,
                stat: '<30s',
                label: 'Response Time',
                sub: 'Complete multi-pass answer',
              },
              {
                icon: <CheckCircle className="w-6 h-6 text-emerald-600" />,
                stat: '100%',
                label: 'Source Verified',
                sub: 'Click to exact paragraph',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="text-center p-6 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto mb-4">
                  {item.icon}
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-1">
                  {item.stat}
                </div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {item.label}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {item.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Trust indicators */}
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Trusted by legal teams, compliance officers, and researchers
            </p>
            <div className="flex items-center justify-center gap-6 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
              {[
                'Hybrid Search (Vector + BM25)',
                'Multi-Pass Validation',
                'Self-Improving AI',
              ].map((label) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* How It Works — below the fold, smooth scroll target */}
      <HowItWorksSection />
    </>
  )
}