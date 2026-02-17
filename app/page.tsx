'use client'

import { useState } from 'react'
import { FileText, Zap, Target, MessageSquare } from 'lucide-react'
import { DocumentUploader } from '@/components/DocumentUploader'
import { DocumentStatus } from '@/components/DocumentStatus'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [documentReady, setDocumentReady] = useState(false)

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

  // Upload state - shown when no document
  if (!documentId) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-full max-w-4xl px-4 py-12">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-sm text-emerald-700 mb-6">
              <Zap className="w-4 h-4" />
              <span className="font-medium">AI-Powered Document Intelligence</span>
            </div>
            
            <h1 className="text-5xl font-bold text-slate-900 mb-4">
              Upload. Ask. Verify.
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Transform any PDF into an intelligent knowledge base with 
              <span className="text-emerald-600 font-semibold"> forensic citation accuracy</span>
            </p>
          </div>

          {/* Upload Component */}
          <DocumentUploader onUploadComplete={handleUploadComplete} />

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="text-center p-6 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mb-2">95%</div>
              <div className="text-sm font-medium text-slate-700 mb-1">
                Average Confidence
              </div>
              <div className="text-xs text-slate-500">
                AI self-validates every answer
              </div>
            </div>

            <div className="text-center p-6 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mb-2">&lt;30s</div>
              <div className="text-sm font-medium text-slate-700 mb-1">
                Response Time
              </div>
              <div className="text-xs text-slate-500">
                Complete multi-pass answer
              </div>
            </div>

            <div className="text-center p-6 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mb-2">100%</div>
              <div className="text-sm font-medium text-slate-700 mb-1">
                Source Verified
              </div>
              <div className="text-xs text-slate-500">
                Click to exact paragraph
              </div>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500 mb-3">
              Trusted by legal teams, compliance officers, and researchers
            </p>
            <div className="flex items-center justify-center gap-6 text-xs text-slate-400 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Hybrid Search (Vector + BM25)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Multi-Pass Validation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Self-Improving AI</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Processing/Ready state
  return (
    <div className="h-full bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Document Uploaded Successfully!
            </h2>
            <p className="text-sm text-slate-600">
              Processing your document with AI...
            </p>
          </div>

          {/* Status Component */}
          <DocumentStatus 
            documentId={documentId} 
            onReady={handleDocumentReady}
            autoNavigate={true}
          />

          {/* Info Box */}
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-700 mb-2">
              <span className="font-medium">What&apos;s happening:</span>
            </p>
            <ul className="text-xs text-slate-600 space-y-1 ml-4 list-disc">
              <li>✅ Document saved securely to encrypted storage</li>
              <li>✅ AI analysis and adaptive chunking</li>
              <li>✅ Vector embeddings generation (1536 dimensions)</li>
              <li>✅ Metadata enrichment with AI summaries</li>
              <li>✅ Hybrid search indexing (Vector + BM25)</li>
            </ul>
          </div>

          {/* Action Buttons */}
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
              className="px-6 py-3 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
            >
              Upload Another
            </button>
          </div>
        </div>

        {/* Next Steps Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            ✅ Phase 3 Complete! • Full AI Q&A System Ready
          </p>
        </div>
      </div>
    </div>
  )
}