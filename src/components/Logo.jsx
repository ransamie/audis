import React from 'react'

/**
 * Crisp vector studio logo lockup (inspired by classic DAW workstations —
 * flat phosphor bars + clean uppercase wordmark, zero glare/blur filters).
 */
export default function AudisLogo({ className = 'h-6 w-auto' }) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 28 24"
        className="h-5 w-auto flex-shrink-0"
        fill="none"
      >
        <rect x="1"  y="9"  width="3" height="6"  rx="1" fill="#64748b" />
        <rect x="6"  y="5"  width="3" height="14" rx="1" fill="#2ec492" />
        <rect x="11" y="2"  width="3" height="20" rx="1" fill="#2ec492" />
        <rect x="16" y="6"  width="3" height="12" rx="1" fill="#3b82f6" />
        <rect x="21" y="4"  width="3" height="16" rx="1" fill="#3b82f6" />
      </svg>
      <span className="text-sm font-bold tracking-[0.18em] text-slate-100 uppercase">
        AUDIS<span className="text-accent-emerald">.</span>
      </span>
    </div>
  )
}
