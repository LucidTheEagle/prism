'use client'

import { useState, useCallback, useId } from 'react'
import { Upload, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface DocumentUploaderProps {
  onUploadComplete: (documentId: string, fileUrl?: string) => void
}

export function DocumentUploader({ onUploadComplete }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Unique IDs for ARIA associations — safe with SSR
  const inputId = useId()
  const errorId = useId()
  const progressId = useId()

  const handleUpload = useCallback(async (file: File) => {
    setError(null)

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported. Please select a .pdf file.')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds the 50MB limit. Please split it into smaller documents.')
      return
    }

    setIsUploading(true)
    setUploadProgress(10)

    try {
      const formData = new FormData()
      formData.append('file', file)

      setUploadProgress(30)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      setUploadProgress(70)

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to upload documents.')
        }
        throw new Error(data.error || 'Upload failed')
      }

      setUploadProgress(100)

      setTimeout(() => {
        onUploadComplete(data.documentId, data.fileUrl)
      }, 500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [onUploadComplete])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isUploading) setIsDragging(true)
  }, [isUploading])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (isUploading) return
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }, [handleUpload, isUploading])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    // Reset input so the same file can be re-selected after an error
    e.target.value = ''
  }, [handleUpload])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Keyboard users activate the drop zone with Enter or Space
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!isUploading) document.getElementById(inputId)?.click()
    }
  }, [isUploading, inputId])

  const openFilePicker = useCallback(() => {
    if (!isUploading) document.getElementById(inputId)?.click()
  }, [isUploading, inputId])

  return (
    <div className="w-full max-w-2xl mx-auto">

      {/*
       * Drop zone
       *
       * Previously a <div onClick> — not keyboard accessible and not
       * announced by screen readers as interactive.
       *
       * Now: role="button" + tabIndex + onKeyDown for Enter/Space.
       * aria-label describes the full action including constraints.
       * aria-disabled prevents interaction announcements while uploading.
       * aria-describedby links to the error message when one exists.
       */}
      <div
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-label="Upload PDF document. Click or drag and drop a file here. Maximum 50MB."
        aria-disabled={isUploading}
        aria-busy={isUploading}
        aria-describedby={error ? errorId : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFilePicker}
        onKeyDown={handleKeyDown}
        className={cn(
          'border-2 border-dashed rounded-xl text-center transition-all shadow-sm',
          // Mobile: less padding. Desktop: generous padding.
          'p-8 sm:p-12 md:p-16',
          isDragging
            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 shadow-md scale-[1.02]'
            : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 hover:shadow-md',
          isUploading
            ? 'pointer-events-none opacity-60 cursor-not-allowed'
            : 'cursor-pointer',
          // Visible focus ring for keyboard users
          'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2'
        )}
      >
        {isUploading ? (
          // ── Uploading state ────────────────────────────────────────
          <div className="space-y-3 sm:space-y-4">
            <Loader2
              className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-500 mx-auto animate-spin"
              aria-hidden="true"
            />
            <div>
              <p className="text-base sm:text-lg font-medium text-slate-700 dark:text-slate-300">
                Uploading…
              </p>

              {/*
               * Progress bar
               * role="progressbar" with aria-valuenow/min/max tells
               * screen readers the exact upload percentage.
               */}
              <div
                role="progressbar"
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Upload progress: ${uploadProgress}%`}
                id={progressId}
                className="w-full max-w-xs mx-auto bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-3 overflow-hidden"
              >
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${uploadProgress}%` }}
                  aria-hidden="true"
                />
              </div>

              <p
                className="text-xs text-slate-500 dark:text-slate-400 mt-2"
                aria-live="polite"
                aria-atomic="true"
              >
                {uploadProgress}% uploaded
              </p>
            </div>
          </div>

        ) : isDragging ? (
          // ── Drag-over state ────────────────────────────────────────
          <div className="animate-pulse">
            <Upload
              className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-500 mx-auto mb-3 sm:mb-4"
              aria-hidden="true"
            />
            <p className="text-base sm:text-lg font-medium text-emerald-600 dark:text-emerald-400">
              Drop PDF here
            </p>
          </div>

        ) : (
          // ── Default idle state ─────────────────────────────────────
          <>
            <Upload
              className="w-12 h-12 sm:w-16 sm:h-16 text-slate-400 dark:text-slate-500 mx-auto mb-3 sm:mb-4"
              aria-hidden="true"
            />
            <p className="text-base sm:text-lg font-medium text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">
              Upload PDF Document
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              Drag &amp; drop or{' '}
              <span className="text-emerald-600 dark:text-emerald-400 underline underline-offset-2">
                click to browse
              </span>
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Max 50MB · Text-based PDFs only
            </p>
          </>
        )}
      </div>

      {/*
       * Hidden file input
       *
       * Associated with the drop zone via aria-controls would be ideal
       * but file inputs can't be reliably labelled that way cross-browser.
       * The sr-only <label> gives screen readers a proper association.
       *
       * The input itself is hidden visually; the drop zone button triggers
       * it programmatically. This is the standard pattern for custom
       * file upload UIs.
       */}
      <label htmlFor={inputId} className="sr-only">
        Choose a PDF file to upload
      </label>
      <input
        id={inputId}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        onChange={handleFileInput}
        disabled={isUploading}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/*
       * Error message
       *
       * role="alert" + aria-live="assertive" means screen readers
       * announce this immediately when it appears — critical for upload
       * failures where the user needs to know what went wrong.
       */}
      {error && (
        <div
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="mt-4 p-3 sm:p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg flex items-start gap-3"
        >
          <XCircle
            className="w-5 h-5 text-rose-500 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-rose-700 dark:text-rose-400">
              Upload failed
            </p>
            <p className="text-sm text-rose-600 dark:text-rose-400 mt-0.5">
              {error}
            </p>
          </div>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss upload error"
            className="shrink-0 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400 rounded p-0.5"
          >
            <XCircle className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}