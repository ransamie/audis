/**
 * src/components/Controls.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Export button panel and processing progress display.
 * Designed with a full-width hero Export button, status checklist, and progress.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react'

// ── Utility: format seconds → M:SS ─────────────────────────────────────────
function fmt (s) {
  if (!isFinite(s) || isNaN(s)) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function Controls ({
  canExport,
  isProcessing,
  progress,
  timemark,
  cropStart,
  cropEnd,
  outputPath,
  onExport,
  missingSteps,
  settings,
}) {
  const cropDur  = isFinite(cropEnd - cropStart) ? cropEnd - cropStart : 0

  return (
    <div className="space-y-4">
      {/* Export Settings Summary */}
      <div className="flex flex-col gap-1 text-[11px] font-mono text-slate-400 bg-surface-muted/30 p-3 rounded-lg border border-white/5">
        <div className="flex justify-between">
          <span>Format:</span>
          <span className="text-white font-semibold">
            {settings?.exportFormat === 'original' ? 'Original' : settings?.exportFormat?.toUpperCase()}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Crossfade:</span>
          <span className="text-white font-semibold">{settings?.fadeDuration ?? 2}s</span>
        </div>
        <div className="flex justify-between">
          <span>Duration:</span>
          <span className="text-brand-300 font-semibold">{cropDur > 0 ? fmt(cropDur) : '—'}</span>
        </div>
      </div>

      {/* Real-time Progress Bar */}
      {isProcessing && (
        <div className="glass-card p-4 space-y-2 animate-fade-in border-brand-500/40">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-white flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-brand-400 animate-ping" />
              Processing FFmpeg Pipeline…
            </span>
            <span className="font-mono text-cyan-400 text-sm font-bold">{progress}%</span>
          </div>

          <div className="h-2.5 rounded-full bg-surface-base overflow-hidden border border-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-accent-cyan transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {timemark && (
            <p className="text-[11px] font-mono text-slate-400 text-right">Time: {timemark}</p>
          )}
        </div>
      )}

      {/* Output Success Banner */}
      {outputPath && !isProcessing && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-green-500/10 border border-green-500/30 animate-fade-in">
          <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-green-300">Export Complete!</p>
            <p className="text-[11px] font-mono text-slate-300 truncate mt-0.5" title={outputPath}>
              {outputPath?.split(/[\\/]/).pop()}
            </p>
          </div>
        </div>
      )}

      {/* FULL WIDTH HERO EXPORT BUTTON */}
      <div className="relative group">
        {!canExport && missingSteps?.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-3 p-3 rounded-lg bg-surface-card border border-amber-500/30 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            <p className="text-xs font-bold text-amber-400 mb-1">Missing Requirements:</p>
            <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
              {missingSteps.map((s, i) => <li key={i}>{s.label}</li>)}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport || isProcessing}
          className={[
            'w-full py-4 px-6 rounded-xl font-bold text-sm tracking-wider uppercase whitespace-nowrap',
            'flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer',
            canExport && !isProcessing
              ? 'bg-gradient-to-r from-brand-600 via-brand-500 to-accent-cyan text-white shadow-[0_0_24px_rgba(96,48,255,0.45)] hover:shadow-[0_0_36px_rgba(96,48,255,0.7)] hover:scale-[1.01] active:scale-[0.98]'
              : 'bg-surface-hover border border-white/10 text-slate-500 cursor-not-allowed opacity-50 shadow-none'
          ].join(' ')}
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Stitching Audio ({progress}%)</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{canExport ? 'Export Final Audio' : 'Incomplete'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
