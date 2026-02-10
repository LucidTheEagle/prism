'use client'

import { useState } from 'react'
import { Upload, FileText, Zap, Target } from 'lucide-react'

export default function Home() {
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)

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

          {/* Upload Area Placeholder */}
          <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-16 text-center hover:border-emerald-400 transition-colors cursor-pointer shadow-sm hover:shadow-md">
            <Upload className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-700 mb-2">
              Upload PDF Document
            </p>
            <p className="text-sm text-slate-500 mb-1">
              Drag & drop or click to browse
            </p>
            <p className="text-xs text-slate-400">
              Max 50MB • Text-based PDFs only
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="text-center p-6 bg-white rounded-lg border border-slate-200 shadow-sm">
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

            <div className="text-center p-6 bg-white rounded-lg border border-slate-200 shadow-sm">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mb-2">&lt;2s</div>
              <div className="text-sm font-medium text-slate-700 mb-1">
                Response Time
              </div>
              <div className="text-xs text-slate-500">
                Faster than Ctrl+F search
              </div>
            </div>

            <div className="text-center p-6 bg-white rounded-lg border border-slate-200 shadow-sm">
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
            <div className="flex items-center justify-center gap-6 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Hybrid Search (Vector + BM25)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Multi-Pass Validation</span>
              </div>
              <div className="flex items-center gap-2 hidden md:flex">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Self-Improving AI</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main interface (will be built in next checkpoints)
  return (
    <div className="h-full bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <FileText className="w-8 h-8 text-white" />
        </div>
        <p className="text-lg font-medium text-slate-700">
          Document uploaded successfully!
        </p>
        <p className="text-sm text-slate-500 mt-2">
          Chat interface coming in Checkpoint 1.5...
        </p>
      </div>
    </div>
  )
}