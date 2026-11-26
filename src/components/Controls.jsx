/**
 * src/components/Controls.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Matte Studio Export & Cut Inspector Panel.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react'

function fmt(s) {
  if (!isFinite(s) || isNaN(s)) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function fmtPrecise(s) {
  if (!isFinite(s) || isNaN(s)) return '0:00.0'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1).padStart(4, '0')
  return `${m}:${sec}`
}

const REASON_LABELS = {
  leading_silence:  'Start Silence',
  trailing_silence: 'End Silence',
  long_pause:       'Long Pause',
  filler:           'Filler',
  retake:           'Retake',
  manual_cut:       'Manual Cut',
}

function KeyboardCheatsheet() {
  const shortcuts = [
    { keys: 'Space',        action: 'Play / Pause (skip-preview)' },
    { keys: 'Tab / ⇧Tab',  action: 'Next / prev cut + audition' },
    { keys: 'D',            action: 'Toggle active cut on / off' },
    { keys: 'C',            action: 'Add cut at playhead' },
    { keys: 'I / O',        action: 'Toggle Intro / Outro' },
    { keys: 'Enter',        action: 'Approve & Next' },
    { keys: 'Esc',          action: 'Skip / defer item' },
    { keys: '⌘/Ctrl + A',   action: 'Auto-approve clean items' },
    { keys: '⌘/Ctrl + Z',   action: 'Undo last cut edit' },
    { keys: '⌘/Ctrl + ←/→', action: 'Previous / Next item' },
  ]
  return (
    <details className="group text-[11px]">
      <summary className="cursor-pointer text-slate-400 hover:text-slate-200 transition-colors select-none flex items-center gap-1.5 font-medium py-1">
        <svg aria-hidden="true" className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Keyboard shortcuts
      </summary>
      <div className="mt-1.5 rounded-md bg-[#121417] border border-[#2b2f37] overflow-hidden">
        {shortcuts.map(({ keys, action }) => (
          <div key={keys} className="flex items-center justify-between px-2.5 py-1 border-b border-[#22262d] last:border-0">
            <span className="text-slate-400">{action}</span>
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#1d2026] border border-[#323742] text-slate-200">
              {keys}
            </kbd>
          </div>
        ))}
      </div>
    </details>
  )
}

export default function Controls({
  activeItem,
  queueTotal,
  queueDone,
  queueExporting,
  onApproveAndNext,
  onSkip,
  onAutoApprove,
  onOpenOutputFolder,
  onToggleCut,
  onRenameTitle,
  onEditMetadata,
  settings,
}) {
  const pct = (queueDone / Math.max(1, queueTotal)) * 100
  const isApproveDisabled =
    !activeItem ||
    activeItem.analysisStatus !== 'ready' ||
    activeItem.exportStatus !== 'pending'

  const cuts = activeItem?.cuts ?? []

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">

      {/* 1. Batch Queue Progress */}
      <div className="p-3.5 rounded-md bg-[#141619] border border-[#2b2f37] space-y-2.5 flex-shrink-0" aria-live="polite">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">
            Batch Queue
          </span>
          <span className="text-xs font-mono font-semibold text-slate-200">
            {queueDone}/{queueTotal}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[#242830] overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        {queueExporting > 0 && (
          <p className="text-[11px] text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
            {queueExporting} rendering in background…
          </p>
        )}
        {queueDone === queueTotal && queueTotal > 0 && (
          <button type="button" onClick={onOpenOutputFolder} className="btn-primary w-full py-1.5">
            Open Output Folder
          </button>
        )}
      </div>

      {/* 2. Output Title & Cut List Inspector */}
      {activeItem && (
        <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
          {/* Output Title */}
          <div className="flex-shrink-0">
            <label htmlFor="inspector-output-title" className="field-label">
              Output Title
            </label>
            <input
              id="inspector-output-title"
              type="text"
              value={activeItem.suggestedTitle || ''}
              onChange={(e) => onRenameTitle?.(activeItem.id, e.target.value)}
              placeholder={activeItem.fileName}
              className="input-field font-mono text-xs"
            />
          </div>

          {/* Detected Cuts List */}
          <div className="flex-1 min-h-0 flex flex-col rounded-md bg-[#141619] border border-[#2b2f37] overflow-hidden">
            <div className="px-3 py-2 border-b border-[#252930] flex items-center justify-between flex-shrink-0">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Edit Cuts ({cuts.filter(c => c.enabled !== false).length}/{cuts.length})
              </span>
              {activeItem.analysisStatus === 'analyzing' && (
                <span className="text-[10px] text-accent-cyan font-mono">Scanning…</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#20232a]">
              {cuts.length === 0 ? (
                <p className="text-[11px] text-slate-500 p-3 text-center">
                  {activeItem.analysisStatus === 'ready'
                    ? 'No silences or cuts flagged.'
                    : 'Waiting for analysis…'}
                </p>
              ) : (
                cuts.map((cut) => {
                  const enabled = cut.enabled !== false
                  return (
                    <button
                      key={cut.id}
                      type="button"
                      onClick={() => onToggleCut?.(activeItem.id, cut.id)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors hover:bg-[#1d2026] cursor-pointer ${
                        enabled ? 'text-slate-200' : 'text-slate-500 line-through'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium truncate">
                          {REASON_LABELS[cut.reason] || cut.reason}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          {fmtPrecise(cut.start)} – {fmtPrecise(cut.end)}
                          {cut.postPauseSec ? ` (→ ${cut.postPauseSec}s)` : ''}
                        </p>
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${
                        enabled
                          ? 'bg-red-500/15 text-red-300 border-red-500/35'
                          : 'bg-[#1c1f24] text-slate-500 border-[#2e323a]'
                      }`}>
                        {enabled ? 'CUT' : 'KEEP'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Render Chain Summary */}
          <div className="flex-shrink-0 p-3 rounded-md bg-[#141619] border border-[#2b2f37] space-y-1 text-[11px] font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Format</span>
              <span className="text-slate-200 font-semibold">
                {settings?.exportFormat === 'original' ? 'Original' : (settings?.exportFormat?.toUpperCase() ?? 'MP3')}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Crossfade</span>
              <span className="text-slate-200">{settings?.fadeDuration ?? 2}s</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Intro / Outro</span>
              <span className="text-slate-200">
                {activeItem.useIntro ? 'IN' : '—'} / {activeItem.useOutro ? 'OUT' : '—'}
              </span>
            </div>
            {!activeItem.useIntro && !activeItem.useOutro && (
              <div className="flex justify-between text-slate-400">
                <span>Loudness</span>
                <span className="text-slate-200">
                  {settings?.loudnormEnabled !== false ? '-16 LUFS' : 'Bypassed'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active item progress when exporting */}
      {activeItem?.exportStatus === 'exporting' && (
        <div className="p-3 rounded-md bg-[#141619] border border-brand-500/40 space-y-1.5 flex-shrink-0">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-200">Rendering FFmpeg…</span>
            <span className="font-mono text-brand-400">{activeItem.exportProgress?.percent ?? 0}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#242830] overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all duration-200"
              style={{ width: `${activeItem.exportProgress?.percent ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Primary Actions */}
      <div className="space-y-2 flex-shrink-0">
        <button
          type="button"
          onClick={onApproveAndNext}
          disabled={isApproveDisabled}
          className="w-full py-2.5 px-4 rounded-md font-semibold text-xs tracking-wide uppercase flex items-center justify-center gap-2 transition-colors bg-brand-600 hover:bg-brand-500 active:bg-brand-700 border border-brand-400/30 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Approve &amp; Next</span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-black/25 border border-white/15 font-mono">
            Enter
          </kbd>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSkip}
            disabled={!activeItem}
            className="btn-secondary py-1.5"
          >
            Skip (Esc)
          </button>
          <button
            type="button"
            onClick={onAutoApprove}
            className="btn-secondary py-1.5"
          >
            Auto-Clean
          </button>
        </div>

        {activeItem && (
          <button
            type="button"
            onClick={onEditMetadata}
            disabled={!activeItem.filePath}
            className="w-full btn-secondary py-1.5 text-xs font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.414l8.586-8.586z" />
            </svg>
            Edit Metadata
          </button>
        )}

        <KeyboardCheatsheet />
      </div>
    </div>
  )
}
