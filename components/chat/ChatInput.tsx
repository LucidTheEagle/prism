'use client'

import { useRef, useEffect } from 'react'
import { Send, Loader2, AlertCircle } from 'lucide-react'

interface ChatInputProps {
  input: string
  isLoading: boolean
  historyLoading: boolean
  submitError: string | null
  onInputChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  onDismissError: () => void
}

export function ChatInput({
  input,
  isLoading,
  historyLoading,
  submitError,
  onInputChange,
  onSubmit,
  onDismissError,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isDisabled = isLoading || historyLoading

  // Focus input after history loads
  useEffect(() => {
    if (!historyLoading) inputRef.current?.focus()
  }, [historyLoading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <div
      className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 sm:px-4 py-3 sm:py-4 z-10"
      role="region"
      aria-label="Message input"
    >
      {/* Submit error banner */}
      {submitError && (
        <div
          className="max-w-2xl mx-auto mb-3 flex items-start gap-3 px-3 sm:px-4 py-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{submitError}</p>
          <button
            onClick={onDismissError}
            aria-label="Dismiss error message"
            className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0 focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
          >
            ×
          </button>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="max-w-2xl mx-auto"
        aria-label="Send a message"
      >
        <div className="relative flex items-end gap-2">
          <div className="flex-1 relative">
            <label htmlFor="chat-input" className="sr-only">
              Ask a question about your document
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question…"
              disabled={isDisabled}
              rows={1}
              aria-label="Message input"
              aria-describedby="chat-input-hint"
              aria-disabled={isDisabled}
              className="w-full px-3 sm:px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-shadow text-sm sm:text-base"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || isDisabled}
            aria-label={isLoading ? 'Sending message…' : 'Send message'}
            aria-busy={isLoading}
            className="shrink-0 p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {isLoading
              ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              : <Send className="w-5 h-5" aria-hidden="true" />
            }
          </button>
        </div>

        <p
          id="chat-input-hint"
          className="text-xs text-slate-500 dark:text-slate-500 mt-2 text-center"
          aria-live="off"
        >
          Press Enter to send · Shift + Enter for new line
        </p>
      </form>
    </div>
  )
}