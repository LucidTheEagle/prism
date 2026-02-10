'use client'

import { useState, useCallback } from 'react'
import { Upload, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface DocumentUploaderProps {
  onUploadComplete: (documentId: string, fileUrl: string) => void
}

export function DocumentUploader({ onUploadComplete }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = useCallback(async (file: File) => {
    setError(null)
    
    // Validation
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds 50MB limit. Split into smaller documents.')
      return
    }

    setIsUploading(true)
    setUploadProgress(10)

    try {
      // Create FormData
      const formData = new FormData()
      formData.append('file', file)

      setUploadProgress(30)

      // Upload
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      setUploadProgress(70)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      // Success
      setUploadProgress(100)
      setTimeout(() => {
        onUploadComplete(data.documentId, data.fileUrl)
      }, 500)

    } catch (err: unknown) {
      let message = 'Upload failed'
      if (err instanceof Error) {
        message = err.message
      }
      setError(message)
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [onUploadComplete])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleUpload(file)
    }
  }, [handleUpload])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
  }, [handleUpload])

  return (
    <div className="w-full">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && document.getElementById('file-input')?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all shadow-sm",
          isDragging 
            ? "border-emerald-400 bg-emerald-50 shadow-md scale-105" 
            : "border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/30 hover:shadow-md",
          isUploading && "pointer-events-none opacity-60"
        )}
      >
        {isUploading ? (
          <div className="space-y-4">
            <Loader2 className="w-16 h-16 text-emerald-500 mx-auto animate-spin" />
            <div>
              <p className="text-lg font-medium text-slate-700">Uploading...</p>
              <div className="w-full max-w-xs mx-auto bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">{uploadProgress}%</p>
            </div>
          </div>
        ) : isDragging ? (
          <div className="animate-pulse">
            <Upload className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-emerald-600">Drop PDF here</p>
          </div>
        ) : (
          <>
            <Upload className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-700 mb-2">Upload PDF Document</p>
            <p className="text-sm text-slate-500 mb-1">Drag & drop or click to browse</p>
            <p className="text-xs text-slate-400">Max 50MB • Text-based PDFs only</p>
          </>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        id="file-input"
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileInput}
        disabled={isUploading}
      />

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-rose-700">Upload failed</p>
            <p className="text-sm text-rose-600 mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}