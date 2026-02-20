'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import Link from 'next/link';

interface Props {
  children: ReactNode
  /**
   * Which panel this boundary wraps — used to tailor the fallback message.
   * 'pdf'  — left panel, PDF viewer crashed
   * 'chat' — right panel, chat interface crashed
   * 'page' — full page boundary (outermost fallback)
   */
  panel?: 'pdf' | 'chat' | 'page'
  /** Optional custom fallback — overrides the default UI entirely */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * ErrorBoundary
 *
 * A class component — React requires class components for error boundaries.
 * Functional components and hooks cannot catch render errors.
 *
 * Wraps a subtree and catches any unhandled errors thrown during:
 *   - render
 *   - lifecycle methods
 *   - constructors of child components
 *
 * Does NOT catch errors in:
 *   - event handlers (use try/catch there)
 *   - async code (use try/catch or .catch())
 *   - server-side rendering
 *
 * Usage:
 *   <ErrorBoundary panel="pdf">
 *     <PDFViewer ... />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production this is where you'd send to Sentry:
    // Sentry.captureException(error, { extra: info })
    console.error(`[ErrorBoundary:${this.props.panel ?? 'unknown'}]`, error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    // Custom fallback takes priority
    if (this.props.fallback) {
      return this.props.fallback
    }

    const { panel } = this.props

    // ── PDF panel fallback ─────────────────────────────────────────
    if (panel === 'pdf') {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950 p-6 text-center">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/50 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-1">
            PDF viewer crashed
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 max-w-xs">
            The PDF viewer encountered an error. Chat is still available on the right.
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload PDF viewer
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 text-left w-full max-w-sm">
              <summary className="text-xs text-slate-400 cursor-pointer">
                Error details
              </summary>
              <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg overflow-auto">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      )
    }

    // ── Chat panel fallback ────────────────────────────────────────
    if (panel === 'chat') {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-slate-900 p-6 text-center">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-1">
            Chat interface crashed
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 max-w-xs">
            The chat panel encountered an error. Your PDF is still visible on the left.
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload chat
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 text-left w-full max-w-sm">
              <summary className="text-xs text-slate-400 cursor-pointer">
                Error details
              </summary>
              <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg overflow-auto">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      )
    }

    // ── Full page fallback (outermost boundary) ────────────────────
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
          PRISM encountered an unexpected error. Your data is safe.
        </p>
        <div className="flex gap-3">
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center px-5 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Go home
          </Link>
        </div>
        {process.env.NODE_ENV === 'development' && this.state.error && (
          <details className="mt-6 text-left w-full max-w-lg">
            <summary className="text-xs text-slate-400 cursor-pointer">
              Error details (dev only)
            </summary>
            <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-4 rounded-lg overflow-auto">
              {this.state.error.stack}
            </pre>
          </details>
        )}
      </div>
    )
  }
}