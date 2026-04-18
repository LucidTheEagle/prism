'use client'

interface Citation {
  chunk_id: string
  document_id: string
  text: string
  page: number
  relevance: number
  ai_summary?: string
  chunk_index: number
  section_reference?: string  // Sprint 3 ADI output — Clause X.X / Section Y.Y
}

interface CitationCardProps {
  citation: Citation
  index: number
  onCitationClick?: (page: number) => void
}

export function CitationCard({ citation, index, onCitationClick }: CitationCardProps) {
  // Support mixed indexing from ingestion pipelines:
  // 0-based pages become +1, while already 1-based pages remain unchanged.
  const displayPage = citation.page <= 0 ? citation.page + 1 : citation.page

  // section_reference from ADI when present — falls back to segment label
  // Segment label is 1-based for readers
  const segmentLabel = citation.chunk_index + 1
  const hasSection = Boolean(citation.section_reference?.trim())

  const handleClick = () => onCitationClick?.(displayPage)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onCitationClick?.(displayPage)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={
        hasSection
          ? `Citation ${index + 1}: ${citation.section_reference} — Jump to page ${displayPage}`
          : `Citation ${index + 1}: Jump to page ${displayPage}, segment ${segmentLabel}`
      }
      className="text-xs bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-sm transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
    >
      <div className="flex items-start gap-2">
        <span
          className="shrink-0 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold"
          aria-hidden="true"
        >
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-slate-900 dark:text-slate-100 font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
            {/* Section reference — from ADI when available */}
            {hasSection ? (
              <>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  {citation.section_reference}
                </span>
                <span className="text-slate-400 dark:text-slate-500 text-[10px]">·</span>
                <span>Page {displayPage} ↗</span>
              </>
            ) : (
              <>
                <span>Page {displayPage} ↗</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  · Seg. {segmentLabel}
                </span>
              </>
            )}
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