/**
 * src/components/BatchQueue.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Matte Studio Files Bin (inspired by Adobe Audition / Cakewalk Media Browser).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useMemo, useCallback } from 'react'

function fmt(s) {
  if (!s || !isFinite(s) || isNaN(s)) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function pad2(n) {
  return String(n + 1).padStart(2, '0')
}

function cutsReducedDuration(item) {
  if (!item.cuts?.length || !item.duration) return null
  const removed = item.cuts.reduce((sum, c) => {
    if (c.enabled === false) return sum
    const len = Math.max(0, (c.end ?? 0) - (c.start ?? 0))
    const keepPause = c.postPauseSec && len > c.postPauseSec ? c.postPauseSec : 0
    return sum + Math.max(0, len - keepPause)
  }, 0)
  return Math.max(0, item.duration - removed)
}

function totalSavedSeconds(queue) {
  return queue.reduce((sum, item) => {
    const after = cutsReducedDuration(item)
    if (after == null || !item.duration) return sum
    return sum + (item.duration - after)
  }, 0)
}

function isAutoClean(item) {
  if (!item || item.analysisStatus !== 'ready' || item.exportStatus !== 'pending') return false
  if (!item.cuts?.length) return true
  return item.cuts.every(c =>
    c.confidence >= 0.9 && ['leading_silence', 'trailing_silence'].includes(c.reason)
  )
}

function StatusIcon({ item }) {
  const { analysisStatus, exportStatus } = item

  if (exportStatus === 'done') {
    return (
      <svg aria-hidden="true" className="w-3.5 h-3.5 text-accent-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  if (exportStatus === 'exporting' || analysisStatus === 'analyzing') {
    return (
      <span
        aria-hidden="true"
        className={`w-3 h-3 border-[1.5px] border-t-transparent rounded-full animate-spin flex-shrink-0 ${
          exportStatus === 'exporting' ? 'border-brand-400' : 'border-accent-cyan'
        }`}
      />
    )
  }
  if (analysisStatus === 'error' || exportStatus === 'error') {
    return (
      <svg aria-hidden="true" className="w-3.5 h-3.5 text-accent-red flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M12 3a9 9 0 110 18 9 9 0 010-18z" />
      </svg>
    )
  }
  if (exportStatus === 'approved') {
    return <span className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0" />
  }
  if (analysisStatus === 'ready') {
    return <span className="w-2 h-2 rounded-full bg-accent-amber flex-shrink-0" />
  }
  return <span className="w-2 h-2 rounded-full bg-slate-600 flex-shrink-0" />
}

function statusText(item) {
  const { analysisStatus, exportStatus } = item
  if (exportStatus === 'done') return { text: 'Done', cls: 'text-accent-green' }
  if (exportStatus === 'exporting') return { text: `${item.exportProgress?.percent ?? 0}%`, cls: 'text-brand-400' }
  if (exportStatus === 'approved') return { text: 'Queued', cls: 'text-brand-300' }
  if (exportStatus === 'error' || analysisStatus === 'error') return { text: 'Error', cls: 'text-accent-red' }
  if (analysisStatus === 'analyzing') return { text: 'Scan…', cls: 'text-accent-cyan' }
  if (analysisStatus === 'ready') return { text: 'Ready', cls: 'text-slate-300' }
  return { text: 'Wait', cls: 'text-slate-500' }
}

const FILTER_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'review',    label: 'Review' },
  { key: 'autoready', label: 'Clean' },
  { key: 'exporting', label: 'Export' },
  { key: 'done',      label: 'Done' },
]

function filterItems(queue, tab) {
  switch (tab) {
    case 'review':
      return queue.filter(i => i.analysisStatus === 'ready' && i.exportStatus === 'pending')
    case 'autoready':
      return queue.filter(isAutoClean)
    case 'exporting':
      return queue.filter(i => ['exporting', 'approved'].includes(i.exportStatus))
    case 'done':
      return queue.filter(i => i.exportStatus === 'done')
    default:
      return queue
  }
}

function IOPill({ active, label, shortLabel, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${active ? 'Disable' : 'Enable'} ${label}`}
      title={`${active ? 'Disable' : 'Enable'} ${label}`}
      className={[
        'px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider transition-colors flex-shrink-0 border',
        active
          ? 'bg-brand-600/30 text-brand-200 border-brand-500/60'
          : 'bg-[#141619] text-slate-500 border-[#2e323a] hover:text-slate-300',
        disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {shortLabel}
    </button>
  )
}

export default function BatchQueue({
  queue,
  activeId,
  onFocus,
  onToggleIntro,
  onToggleOutro,
  onApprove,
  onAutoApprove,
  settings,
}) {
  const [activeTab, setActiveTab] = useState('all')

  const hasIntroPath = Boolean(settings?.introPath)
  const hasOutroPath = Boolean(settings?.outroPath)

  const filteredItems = useMemo(() => filterItems(queue, activeTab), [queue, activeTab])
  const doneCount     = useMemo(() => queue.filter(i => i.exportStatus === 'done').length, [queue])
  const totalCount    = queue.length

  const allIntroOn = queue.length > 0 && queue.every(i => i.useIntro)
  const allOutroOn = queue.length > 0 && queue.every(i => i.useOutro)
  const autoApprovableCount = useMemo(() => queue.filter(isAutoClean).length, [queue])
  const totalSaved = useMemo(() => totalSavedSeconds(queue), [queue])
  const batchComplete = totalCount > 0 && doneCount === totalCount

  const handleToggleAllIntro = useCallback(() => {
    const newVal = !allIntroOn
    queue.forEach(item => onToggleIntro(item.id, newVal))
  }, [queue, allIntroOn, onToggleIntro])

  const handleToggleAllOutro = useCallback(() => {
    const newVal = !allOutroOn
    queue.forEach(item => onToggleOutro(item.id, newVal))
  }, [queue, allOutroOn, onToggleOutro])

  return (
    <div className="flex flex-col h-full bg-[#181a1f] border-r border-[#2b2f37]">

      {/* Header */}
      <div className="flex-shrink-0 px-3.5 py-2.5 border-b border-[#2b2f37] flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">
          Files Bin
        </span>
        <span className="text-[11px] font-mono text-slate-400">
          {doneCount}/{totalCount}
        </span>
      </div>

      {/* 5-Tab Segmented Filter (no horizontal clipping) */}
      <div className="flex-shrink-0 grid grid-cols-5 gap-1 p-1.5 bg-[#141619] border-b border-[#2b2f37]">
        {FILTER_TABS.map(tab => {
          const count = filterItems(queue, tab.key).length
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                'py-1 px-1 rounded text-[10px] font-semibold transition-colors text-center truncate',
                isActive
                  ? 'bg-[#2a2f38] text-white border border-[#3d4452]'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent',
              ].join(' ')}
              title={`${tab.label} (${count})`}
            >
              {tab.label}
              {count > 0 && <span className="ml-0.5 text-[9px] text-slate-400 font-mono">({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Batch Override Bar */}
      {queue.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-2 border-b border-[#2b2f37] bg-[#1a1d22]">
          <button
            type="button"
            onClick={handleToggleAllIntro}
            disabled={!hasIntroPath}
            aria-pressed={allIntroOn && hasIntroPath}
            className={[
              'px-2 py-1 rounded text-[10px] font-semibold border transition-colors',
              allIntroOn && hasIntroPath
                ? 'bg-brand-600/25 text-brand-200 border-brand-500/50'
                : 'bg-[#141619] text-slate-400 border-[#2e323a] hover:text-slate-200',
              !hasIntroPath ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            Intro: {allIntroOn ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={handleToggleAllOutro}
            disabled={!hasOutroPath}
            aria-pressed={allOutroOn && hasOutroPath}
            className={[
              'px-2 py-1 rounded text-[10px] font-semibold border transition-colors',
              allOutroOn && hasOutroPath
                ? 'bg-brand-600/25 text-brand-200 border-brand-500/50'
                : 'bg-[#141619] text-slate-400 border-[#2e323a] hover:text-slate-200',
              !hasOutroPath ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            Outro: {allOutroOn ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={onAutoApprove}
            disabled={autoApprovableCount === 0}
            className={[
              'ml-auto px-2 py-1 rounded text-[10px] font-semibold border transition-colors flex items-center gap-1',
              autoApprovableCount > 0
                ? 'bg-[#1c2e24] text-accent-emerald border-[#2a4d3a] hover:bg-[#233a2d] cursor-pointer'
                : 'bg-[#141619] text-slate-500 border-[#2e323a] opacity-40 cursor-not-allowed',
            ].join(' ')}
          >
            <span>Auto-Clean</span>
            {autoApprovableCount > 0 && (
              <span className="font-mono text-[9px]">({autoApprovableCount})</span>
            )}
          </button>
        </div>
      )}

      {/* Track List */}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ scrollbarGutter: 'stable' }}>
        {filteredItems.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-xs text-slate-500">No tracks in this view</p>
          </div>
        ) : (
          <div className="divide-y divide-[#23272e]">
            {filteredItems.map((item) => {
              const isActive   = item.id === activeId
              const globalIdx  = queue.indexOf(item)
              const afterDur   = cutsReducedDuration(item)
              const savedSec   = item.duration && afterDur != null ? item.duration - afterDur : null
              const cutCount   = (item.cuts ?? []).filter(c => c.enabled !== false).length
              const isClean    = item.analysisStatus === 'ready' && cutCount === 0
              const canApprove = item.analysisStatus === 'ready' && item.exportStatus === 'pending'
              const st         = statusText(item)

              return (
                <div
                  key={item.id}
                  onClick={() => onFocus(item.id)}
                  title={item.filePath || item.fileName}
                  className={[
                    'px-3 py-2 cursor-pointer transition-colors border-l-2',
                    isActive
                      ? 'bg-[#232832] border-l-brand-500'
                      : 'bg-transparent border-l-transparent hover:bg-[#1e2229]',
                  ].join(' ')}
                >
                  {/* Line 1: Index + Status Icon + Title + State */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-slate-500 flex-shrink-0 w-5">
                      {pad2(globalIdx)}
                    </span>
                    <StatusIcon item={item} />
                    <span className="text-xs font-medium text-slate-100 truncate flex-1 min-w-0">
                      {item.suggestedTitle || item.fileName}
                    </span>
                    <span className={`text-[10px] font-mono flex-shrink-0 ${st.cls}`}>
                      {st.text}
                    </span>
                  </div>

                  {/* Line 2: Compact non-wrapping metadata + IO pills + Approve */}
                  <div className="flex items-center gap-2 mt-1.5 pl-7 flex-nowrap">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                      {item.duration != null && (
                        <span className="text-[10px] font-mono text-slate-400 truncate">
                          {fmt(item.duration)}
                          {afterDur != null && Math.abs(afterDur - item.duration) >= 0.5 && (
                            <>
                              <span className="text-slate-600 mx-0.5">→</span>
                              <span className="text-slate-200">{fmt(afterDur)}</span>
                              {savedSec > 0 && (
                                <span className="text-accent-red ml-1">-{Math.round(savedSec)}s</span>
                              )}
                            </>
                          )}
                        </span>
                      )}
                      {item.analysisStatus === 'ready' && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 border ${
                          isClean
                            ? 'bg-[#1a2b22] text-accent-emerald border-[#294937]'
                            : 'bg-[#2b2318] text-accent-amber border-[#4a3a22]'
                        }`}>
                          {isClean ? 'Clean' : `${cutCount} cut${cutCount > 1 ? 's' : ''}`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <IOPill
                        active={item.useIntro}
                        label="intro"
                        shortLabel="IN"
                        disabled={!hasIntroPath}
                        onClick={() => onToggleIntro(item.id, !item.useIntro)}
                      />
                      <IOPill
                        active={item.useOutro}
                        label="outro"
                        shortLabel="OUT"
                        disabled={!hasOutroPath}
                        onClick={() => onToggleOutro(item.id, !item.useOutro)}
                      />
                      {canApprove && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onApprove(item.id) }}
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-brand-600 hover:bg-brand-500 text-white cursor-pointer transition-colors"
                          title="Approve & enqueue export"
                        >
                          Ok
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Batch Summary Footer */}
      {batchComplete && totalCount > 0 && (
        <div className="flex-shrink-0 px-3.5 py-2.5 border-t border-[#2b2f37] bg-[#16221c] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-accent-emerald truncate">
              All {totalCount} exported
            </p>
            {totalSaved > 0 && (
              <p className="text-[10px] font-mono text-slate-400">
                Trimmed {fmt(totalSaved)} total
              </p>
            )}
          </div>
          {settings?.outputDir && (
            <button
              type="button"
              onClick={() => window.electronAPI?.openOutputFolder?.(settings.outputDir)}
              className="btn-secondary text-[10px] px-2.5 py-1 flex-shrink-0"
            >
              Open Folder
            </button>
          )}
        </div>
      )}
    </div>
  )
}
