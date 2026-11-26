/**
 * src/App.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Audis — Pro-Audio Batch Workstation Shell
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import AudisLogo from './components/Logo'
import Dropzone from './components/Dropzone'
import BatchQueue from './components/BatchQueue'
import Waveform from './components/Waveform'
import Controls from './components/Controls'
import Settings from './components/Settings'

function deriveFallbackTitle(fileName = '') {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim() || 'Untitled'
}

function isCleanAutoItem(item) {
  if (!item || item.analysisStatus !== 'ready' || item.exportStatus !== 'pending') return false
  if (!item.cuts?.length) return true
  return item.cuts.every(c =>
    c.confidence >= 0.9 && ['leading_silence', 'trailing_silence'].includes(c.reason)
  )
}

function fileFromPath(filePath) {
  const fileName = filePath.split(/[\\/]/).pop() || filePath
  return { filePath, fileName, blobUrl: null }
}

export default function App () {
  const [queue,        setQueue]        = useState([])
  const [activeId,     setActiveId]     = useState(null)
  const [undoStack,    setUndoStack]    = useState([])
  const [batchSummary, setBatchSummary] = useState(null)
  const [cropRegion,   setCropRegion]   = useState({ start: 0, end: 0, duration: 0 })
  const [settings,     setSettings]     = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const queueRef = useRef(queue)
  useEffect(() => { queueRef.current = queue }, [queue])

  // Load settings
  useEffect(() => {
    if (window.electronAPI?.getSettings) {
      window.electronAPI.getSettings()
        .then((s) => setSettings(s))
        .catch((err) => console.error('[Audis] Failed to load settings:', err))
    } else {
      setSettings({
        introPath: '',
        outroPath: '',
        outputDir: '',
        fadeDuration: 2,
        exportFormat: 'original',
        defaultIntroOutro: 'on',
        loudnormEnabled: true,
      })
    }
  }, [])

  // Subscribe to IPC queue events
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    const unsubs = []
    if (api.onAnalysisStart) {
      unsubs.push(api.onAnalysisStart(({ id }) => {
        setQueue(q => q.map(item => item.id === id ? { ...item, analysisStatus: 'analyzing', error: null } : item))
      }))
    }
    if (api.onAnalysisResult) {
      unsubs.push(api.onAnalysisResult(({ id, duration, peaks, cuts, useIntro, useOutro, suggestedTitle }) => {
        setQueue(q => q.map(item => {
          if (item.id !== id) return item
          return {
            ...item,
            analysisStatus: 'ready',
            duration,
            peaks,
            cuts: cuts ?? [],
            useIntro: typeof useIntro === 'boolean' ? useIntro : item.useIntro,
            useOutro: typeof useOutro === 'boolean' ? useOutro : item.useOutro,
            suggestedTitle: suggestedTitle || item.suggestedTitle,
          }
        }))
      }))
    }
    if (api.onAnalysisError) {
      unsubs.push(api.onAnalysisError(({ id, error }) => {
        setQueue(q => q.map(item => item.id === id ? { ...item, analysisStatus: 'error', error } : item))
      }))
    }
    if (api.onExportStart) {
      unsubs.push(api.onExportStart(({ id }) => {
        setQueue(q => q.map(item =>
          item.id === id ? { ...item, exportStatus: 'exporting', exportProgress: { percent: 0, timemark: '' }, error: null } : item
        ))
      }))
    }
    if (api.onExportProgress) {
      unsubs.push(api.onExportProgress(({ id, percent, timemark }) => {
        setQueue(q => q.map(item =>
          item.id === id ? { ...item, exportProgress: { percent: Math.min(100, Math.max(0, percent || 0)), timemark: timemark || '' } } : item
        ))
      }))
    }
    if (api.onExportDone) {
      unsubs.push(api.onExportDone(({ id, outputPath }) => {
        setQueue(q => q.map(item =>
          item.id === id ? { ...item, exportStatus: 'done', outputPath, exportProgress: { percent: 100, timemark: '' } } : item
        ))
      }))
    }
    if (api.onExportError) {
      unsubs.push(api.onExportError(({ id, error }) => {
        setQueue(q => q.map(item => item.id === id ? { ...item, exportStatus: 'error', error } : item))
      }))
    }
    if (api.onBatchComplete) {
      unsubs.push(api.onBatchComplete(({ totalCount, outputDir }) => {
        setBatchSummary({ totalCount, outputDir })
      }))
    }
    return () => { unsubs.forEach(fn => fn?.()) }
  }, [])

  const handleSaveSettings = useCallback(async (updates) => {
    if (window.electronAPI?.setSettings) {
      const updated = await window.electronAPI.setSettings(updates)
      if (updated) setSettings(updated)
    } else {
      setSettings((prev) => ({ ...prev, ...updates }))
    }
  }, [])

  const handleFilesAccepted = useCallback((acceptedFiles) => {
    if (!acceptedFiles?.length) return
    setBatchSummary(null)

    const defaultIO = settings?.defaultIntroOutro !== 'off'
    const newItems = acceptedFiles.map(({ filePath, fileName, blobUrl }) => ({
      id:             crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      filePath:       filePath || '',
      fileName:       fileName || (filePath ? filePath.split(/[\\/]/).pop() : 'Untitled.wav'),
      blobUrl:        blobUrl || null,
      analysisStatus: filePath && window.electronAPI?.enqueueAnalysis ? 'queued' : 'ready',
      exportStatus:   'pending',
      exportProgress: null,
      duration:       null,
      peaks:          null,
      cuts:           filePath && window.electronAPI?.enqueueAnalysis ? null : [],
      useIntro:       defaultIO && Boolean(settings?.introPath),
      useOutro:       defaultIO && Boolean(settings?.outroPath),
      suggestedTitle: deriveFallbackTitle(fileName),
      outputPath:     null,
      error:          null,
    }))

    setQueue(prev => [...prev, ...newItems])
    setActiveId(prev => prev || newItems[0].id)

    if (window.electronAPI?.enqueueAnalysis) {
      newItems.forEach((item, idx) => {
        if (item.filePath) {
          window.electronAPI.enqueueAnalysis({
            id:       item.id,
            filePath: item.filePath,
            priority: idx === 0 ? 10 : 0,
          })
        }
      })
    }
  }, [settings])

  const handleAddFilesDialog = useCallback(async () => {
    const paths = await window.electronAPI?.openFilesDialog?.({
      title: 'Add Audio Files',
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'aac', 'flac', 'm4a'] }],
    })
    if (Array.isArray(paths) && paths.length) {
      handleFilesAccepted(paths.map(fileFromPath))
    }
  }, [handleFilesAccepted])

  const handleAddFolderDialog = useCallback(async () => {
    const paths = await window.electronAPI?.openFolderDialog?.({ title: 'Add Audio Folder' })
    if (Array.isArray(paths) && paths.length) {
      handleFilesAccepted(paths.map(fileFromPath))
    }
  }, [handleFilesAccepted])

  const buildExportPayload = useCallback((item, index) => {
    const useLegacyCrop = (!item.cuts || item.cuts.length === 0) && cropRegion.end > cropRegion.start
    return {
      mainPath:        item.filePath,
      startTime:       useLegacyCrop ? cropRegion.start : 0,
      endTime:         useLegacyCrop ? cropRegion.end   : (item.duration || undefined),
      cuts:            (item.cuts || []).filter(c => c.enabled !== false),
      suggestedTitle:  item.suggestedTitle || deriveFallbackTitle(item.fileName),
      fileIndex:       index + 1,
      introPath:       item.useIntro ? settings?.introPath : null,
      outroPath:       item.useOutro ? settings?.outroPath : null,
      useIntro:        Boolean(item.useIntro && settings?.introPath),
      useOutro:        Boolean(item.useOutro && settings?.outroPath),
      outputDir:       settings?.outputDir,
      exportFormat:    settings?.exportFormat || 'original',
      fadeDuration:    settings?.fadeDuration ?? 2,
      loudnormEnabled: settings?.loudnormEnabled ?? true,
      batchMode:       true,
    }
  }, [cropRegion, settings])

  const advanceToNextPending = useCallback((currentId, currentQueue) => {
    const curIdx = currentQueue.findIndex(i => i.id === currentId)
    const after  = currentQueue.slice(curIdx + 1)
    const before = currentQueue.slice(0, Math.max(0, curIdx))
    const nextReady = [...after, ...before].find(
      i => i.id !== currentId && i.exportStatus === 'pending' && i.analysisStatus === 'ready'
    )
    const nextAny = [...after, ...before].find(
      i => i.id !== currentId && i.exportStatus === 'pending'
    )
    const target = nextReady || nextAny
    if (target) {
      setActiveId(target.id)
      if (target.analysisStatus === 'queued') {
        window.electronAPI?.prioritizeAnalysis?.(target.id)
      }
    }
  }, [])

  const handleApproveAndNext = useCallback((targetId) => {
    const q = queueRef.current
    const idToApprove = targetId || activeId
    const idx = q.findIndex(i => i.id === idToApprove)
    if (idx === -1) return
    const item = q[idx]
    if (item.analysisStatus !== 'ready' || item.exportStatus !== 'pending') return

    setQueue(prev => prev.map(it =>
      it.id === item.id ? { ...it, exportStatus: 'approved' } : it
    ))

    window.electronAPI?.enqueueExport?.({
      id:      item.id,
      payload: buildExportPayload(item, idx),
    })

    advanceToNextPending(item.id, q)
  }, [activeId, buildExportPayload, advanceToNextPending])

  const handleSkip = useCallback(() => {
    if (!activeId) return
    advanceToNextPending(activeId, queueRef.current)
  }, [activeId, advanceToNextPending])

  const handleAutoApproveClean = useCallback(() => {
    const q = queueRef.current
    const cleanItems = q
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => isCleanAutoItem(item))

    if (cleanItems.length === 0) return

    const cleanIds = new Set(cleanItems.map(({ item }) => item.id))
    setQueue(prev => prev.map(it =>
      cleanIds.has(it.id) ? { ...it, exportStatus: 'approved' } : it
    ))

    cleanItems.forEach(({ item, idx }) => {
      window.electronAPI?.enqueueExport?.({
        id:      item.id,
        payload: buildExportPayload(item, idx),
      })
    })

    if (cleanIds.has(activeId)) {
      const remaining = q.filter(i => !cleanIds.has(i.id) && i.exportStatus === 'pending')
      if (remaining[0]) setActiveId(remaining[0].id)
    }
  }, [activeId, buildExportPayload])

  const handleItemFocus = useCallback((id) => {
    setActiveId(id)
    window.electronAPI?.prioritizeAnalysis?.(id)
  }, [])

  const handleToggleIntro = useCallback((id, val) => {
    setQueue(q => q.map(it => it.id === id ? { ...it, useIntro: val } : it))
  }, [])

  const handleToggleOutro = useCallback((id, val) => {
    setQueue(q => q.map(it => it.id === id ? { ...it, useOutro: val } : it))
  }, [])

  const handleUpdateCuts = useCallback((id, nextCuts) => {
    const current = queueRef.current.find(i => i.id === id)
    if (current) {
      setUndoStack(s => [...s.slice(-24), { id, cuts: current.cuts }])
    }
    setQueue(q => q.map(it => it.id === id ? { ...it, cuts: nextCuts } : it))
  }, [])

  const handleToggleCut = useCallback((itemId, cutId) => {
    const current = queueRef.current.find(i => i.id === itemId)
    if (!current?.cuts) return
    const nextCuts = current.cuts.map(c =>
      c.id === cutId ? { ...c, enabled: c.enabled === false } : c
    )
    handleUpdateCuts(itemId, nextCuts)
  }, [handleUpdateCuts])

  const handleRenameTitle = useCallback((id, title) => {
    setQueue(q => q.map(it => it.id === id ? { ...it, suggestedTitle: title } : it))
  }, [])

  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      setQueue(q => q.map(it => it.id === last.id ? { ...it, cuts: last.cuts } : it))
      setActiveId(last.id)
      return prev.slice(0, -1)
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.isComposing || settingsOpen || document.querySelector('dialog[open]')) return
      const tag = e.target?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return

      if (e.code === 'Escape' && queueRef.current.length > 0) {
        e.preventDefault()
        handleSkip()
        return
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyA' && queueRef.current.length > 0) {
          e.preventDefault()
          handleAutoApproveClean()
        } else if (e.code === 'KeyZ') {
          e.preventDefault()
          handleUndo()
        } else if (e.code === 'ArrowRight' && queueRef.current.length > 1) {
          e.preventDefault()
          const q = queueRef.current
          const curIdx = q.findIndex(i => i.id === activeId)
          const next = q[(curIdx + 1) % q.length]
          if (next) handleItemFocus(next.id)
        } else if (e.code === 'ArrowLeft' && queueRef.current.length > 1) {
          e.preventDefault()
          const q = queueRef.current
          const curIdx = q.findIndex(i => i.id === activeId)
          const prevItem = q[(curIdx - 1 + q.length) % q.length]
          if (prevItem) handleItemFocus(prevItem.id)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settingsOpen, activeId, handleSkip, handleAutoApproveClean, handleUndo, handleItemFocus])

  const activeItem     = useMemo(() => queue.find(i => i.id === activeId) || null, [queue, activeId])
  const activeIdx      = useMemo(() => queue.findIndex(i => i.id === activeId), [queue, activeId])
  const queueTotal     = queue.length
  const queueDone      = useMemo(() => queue.filter(i => i.exportStatus === 'done').length, [queue])
  const queueExporting = useMemo(() => queue.filter(i => ['approved', 'exporting'].includes(i.exportStatus)).length, [queue])

  return (
    <div className="flex flex-col h-screen bg-[#141619] overflow-hidden select-none">

      {/* Studio Top Toolbar */}
      <header className="drag-region h-11 flex items-center justify-between px-4 border-b border-[#2b2f37] bg-[#1a1d22] flex-shrink-0">
        <div className="no-drag flex items-center gap-4">
          <AudisLogo />
          {queueTotal > 0 && (
            <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded bg-[#121417] border border-[#2b2f37]">
              {queueDone}/{queueTotal} Exported
            </span>
          )}
        </div>

        {/* Center active track indicator */}
        {activeItem && (
          <div className="no-drag hidden md:flex items-center gap-2 text-xs text-slate-300 font-mono truncate max-w-md">
            <span className="text-slate-500">{String(activeIdx + 1).padStart(2, '0')}</span>
            <span className="text-slate-600">/</span>
            <span className="truncate">{activeItem.suggestedTitle || activeItem.fileName}</span>
          </div>
        )}

        <div className="no-drag flex items-center gap-2">
          {queueTotal > 0 && (
            <>
              <button type="button" onClick={handleAddFilesDialog} className="btn-secondary">
                + Files
              </button>
              {window.electronAPI?.openFolderDialog && (
                <button type="button" onClick={handleAddFolderDialog} className="btn-secondary">
                  + Folder
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  queue.forEach(i => { if (i.blobUrl) URL.revokeObjectURL(i.blobUrl) })
                  setQueue([])
                  setActiveId(null)
                  setUndoStack([])
                  setBatchSummary(null)
                }}
                className="btn-ghost"
              >
                Clear
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="btn-secondary"
          >
            <svg aria-hidden="true" className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main 3-Pane Workstation */}
      <main className="flex-1 flex overflow-hidden">
        {queueTotal === 0 ? (
          <section className="flex-1 flex flex-col p-6 overflow-hidden">
            <h1 className="sr-only">Audis Audio Batch Workspace</h1>
            <Dropzone onFilesAccepted={handleFilesAccepted} />
          </section>
        ) : (
          <>
            <aside className="w-80 flex-shrink-0 overflow-hidden">
              <BatchQueue
                queue={queue}
                activeId={activeId}
                onFocus={handleItemFocus}
                onToggleIntro={handleToggleIntro}
                onToggleOutro={handleToggleOutro}
                onApprove={handleApproveAndNext}
                onAutoApprove={handleAutoApproveClean}
                settings={settings}
              />
            </aside>

            <section className="flex-1 flex flex-col overflow-hidden min-w-0">
              {activeItem ? (
                <Waveform
                  filePath={activeItem.filePath}
                  blobUrl={activeItem.blobUrl}
                  peaks={activeItem.peaks}
                  duration={activeItem.duration}
                  cuts={activeItem.cuts}
                  useIntro={activeItem.useIntro}
                  useOutro={activeItem.useOutro}
                  onRegionUpdate={(start, end, duration) => setCropRegion({ start, end, duration })}
                  onReady={(dur) => {
                    setCropRegion(c => ({ ...c, duration: dur }))
                    setQueue(q => q.map(it =>
                      it.id === activeItem.id && it.duration == null ? { ...it, duration: dur } : it
                    ))
                  }}
                  onCutsChange={(nextCuts) => handleUpdateCuts(activeItem.id, nextCuts)}
                  onToggleIntro={() => handleToggleIntro(activeItem.id, !activeItem.useIntro)}
                  onToggleOutro={() => handleToggleOutro(activeItem.id, !activeItem.useOutro)}
                  onApproveAndNext={() => handleApproveAndNext(activeItem.id)}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                  Select a track from the Files Bin to inspect its waveform.
                </div>
              )}
            </section>

            <aside className="w-72 flex-shrink-0 flex flex-col p-3.5 border-l border-[#2b2f37] bg-[#181a1f] overflow-hidden">
              <Controls
                activeItem={activeItem}
                queueTotal={queueTotal}
                queueDone={queueDone}
                queueExporting={queueExporting}
                batchOutputDir={batchSummary?.outputDir || settings?.outputDir}
                onApproveAndNext={() => handleApproveAndNext(activeItem?.id)}
                onSkip={handleSkip}
                onAutoApprove={handleAutoApproveClean}
                onToggleCut={handleToggleCut}
                onRenameTitle={handleRenameTitle}
                onOpenOutputFolder={() =>
                  window.electronAPI?.openOutputFolder?.(batchSummary?.outputDir || settings?.outputDir)
                }
                settings={settings}
              />

              {activeItem?.error && (
                <div role="alert" className="mt-2 p-2.5 rounded-md bg-red-500/10 border border-red-500/30">
                  <p className="text-[11px] font-semibold text-red-300">Error</p>
                  <p className="text-[11px] text-red-400 mt-0.5 break-words">{activeItem.error}</p>
                </div>
              )}
            </aside>
          </>
        )}
      </main>

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  )
}
