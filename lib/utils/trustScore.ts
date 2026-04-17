import type { EpistemicCategory } from '@/lib/types'

// ============================================================================
// PRISM TRUST SCORE — V1 EPISTEMIC CATEGORIZATION
// Replaces percentage confidence scoring with three-category epistemic system.
// Input: EpistemicCategory from pipeline. Output: TrustScoreConfig for UI.
//
// Previous implementation archived below.
// ============================================================================

export interface TrustScoreConfig {
  color: 'emerald' | 'amber' | 'rose'
  label: string
  sublabel: string
  icon: 'CheckCircle' | 'AlertCircle' | 'XCircle'
  description: string
  bgClass: string
  borderClass: string
  textClass: string
  badgeVariant: 'epistemic-green' | 'epistemic-yellow' | 'epistemic-red'
}

export function getEpistemicConfig(category: EpistemicCategory): TrustScoreConfig {
  switch (category) {
    case 'EXPLICITLY_STATED':
      return {
        color: 'emerald',
        label: 'Explicitly Stated',
        sublabel: 'Verified from document',
        icon: 'CheckCircle',
        description: 'This answer is directly and explicitly stated in the document. Every claim traces to a verified source location.',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
        borderClass: 'border-emerald-200 dark:border-emerald-800',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        badgeVariant: 'epistemic-green',
      }

    case 'INFERRED':
      return {
        color: 'amber',
        label: 'Inferred',
        sublabel: 'Reasoned from verified provisions',
        icon: 'AlertCircle',
        description: 'This answer is derived from verified document content through legal reasoning. The foundation is verified — the conclusion requires interpretation.',
        bgClass: 'bg-amber-50 dark:bg-amber-950/40',
        borderClass: 'border-amber-200 dark:border-amber-800',
        textClass: 'text-amber-700 dark:text-amber-400',
        badgeVariant: 'epistemic-yellow',
      }

    case 'SILENT':
      return {
        color: 'rose',
        label: 'Silent — Not in Document',
        sublabel: 'Document does not address this',
        icon: 'XCircle',
        description: 'This document does not contain information responsive to this query. No conclusion can be drawn from document content alone.',
        bgClass: 'bg-rose-50 dark:bg-rose-950/40',
        borderClass: 'border-rose-200 dark:border-rose-800',
        textClass: 'text-rose-700 dark:text-rose-400',
        badgeVariant: 'epistemic-red',
      }
  }
}

// ============================================================================
// ARCHIVED — percentage confidence system
// ============================================================================

// export interface TrustScoreConfig {
//   color: 'emerald' | 'amber' | 'rose'
//   label: string
//   sublabel?: string
//   icon: string
//   description: string
//   bgClass: string
//   borderClass: string
//   textClass: string
// }
//
// export function getTrustScoreConfig(score: number): TrustScoreConfig {
//   if (score >= 90) {
//     return {
//       color: 'emerald',
//       label: 'High Confidence',
//       icon: 'CheckCircle',
//       description: 'Direct answer found in document',
//       bgClass: 'bg-emerald-50',
//       borderClass: 'border-emerald-200',
//       textClass: 'text-emerald-700'
//     }
//   }
//   if (score >= 70) {
//     return {
//       color: 'amber',
//       label: 'Medium Confidence',
//       sublabel: 'Verify Carefully',
//       icon: 'AlertCircle',
//       description: 'Answer inferred from context',
//       bgClass: 'bg-amber-50',
//       borderClass: 'border-amber-200',
//       textClass: 'text-amber-700'
//     }
//   }
//   return {
//     color: 'rose',
//     label: 'Low Confidence',
//     sublabel: 'Insufficient Data',
//     icon: 'XCircle',
//     description: 'Limited information available',
//     bgClass: 'bg-rose-50',
//     borderClass: 'border-rose-200',
//     textClass: 'text-rose-700'
//   }
// }
//
// export function formatConfidenceScore(score: number): string {
//   return `${Math.round(score)}%`
// }