'use client'

interface Citation {
  chunk_id: string
  document_id: string
  text: string
  page: number
  relevance: number
  ai_summary?: string
  chunk_index: number
}

interface CitationCardProps {
  citation: Citation
  index: number
  onCitationClick?: (page: number) => void
}

export function CitationCard({ citation, index, onCitationClick }: CitationCardProps) {
  const handleClick = () => onCitationClick?.(citation.page)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onCitationClick?.(citation.page)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Citation ${index + 1}: Jump to page ${citation.page} in PDF viewer`}
      className="text-xs bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-sm transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
    >
      <div className="flex items-start gap-2">
        <span
          className="shrink-0 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold"
          aria-hidden="true"
        >
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-slate-900 dark:text-slate-100 font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
            Page {citation.page} ↗
          </p>
          {citation.ai_summary && (
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {citation.ai_summary}
            </p>
          )}
          <p className="text-slate-500 dark:text-slate-500 mt-1 text-[11px] line-clamp-2">
            {citation.text}
          </p>
        </div>
      </div>
    </div>
  )
}