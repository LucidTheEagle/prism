export interface TrustScoreConfig {
    color: 'emerald' | 'amber' | 'rose'
    label: string
    sublabel?: string
    icon: string
    description: string
    bgClass: string
    borderClass: string
    textClass: string
  }
  
  export function getTrustScoreConfig(score: number): TrustScoreConfig {
    if (score >= 90) {
      return {
        color: 'emerald',
        label: 'High Confidence',
        icon: 'CheckCircle',
        description: 'Direct answer found in document',
        bgClass: 'bg-emerald-50',
        borderClass: 'border-emerald-200',
        textClass: 'text-emerald-700'
      }
    }
    
    if (score >= 70) {
      return {
        color: 'amber',
        label: 'Medium Confidence',
        sublabel: 'Verify Carefully',
        icon: 'AlertCircle',
        description: 'Answer inferred from context',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        textClass: 'text-amber-700'
      }
    }
    
    return {
      color: 'rose',
      label: 'Low Confidence',
      sublabel: 'Insufficient Data',
      icon: 'XCircle',
      description: 'Limited information available',
      bgClass: 'bg-rose-50',
      borderClass: 'border-rose-200',
      textClass: 'text-rose-700'
    }
  }
  
  export function formatConfidenceScore(score: number): string {
    return `${Math.round(score)}%`
  }