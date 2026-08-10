/**
 * src/App.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Audis — Main Application Shell & IPC Orchestrator
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import AudisLogo from './components/Logo'
import Dropzone from './components/Dropzone'
import Waveform from './components/Waveform'
import Controls from './components/Controls'
import Settings from './components/Settings'

export default function App () {
  // ── Audio file state ────────────────────────────────────────────────────────
  const [audioFile,  setAudioFile]  = useState(null)   // { path, name }
  const [cropRegion, setCropRegion] = useState({ start: 0, end: 0, duration: 0 })

  // ── Processing state ────────────────────────────────────────────────────────
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress,     setProgress]     = useState(0)
  const [timemark,     setTimemark]     = useState('')
  const [outputPath,   setOutputPath]   = useState(null)
  const [errorMsg,     setErrorMsg]     = useState(null)

  // ── Settings state ──────────────────────────────────────────────────────────
  const [settings,        setSettings]        = useState(null)
  const [settingsOpen,    setSettingsOpen]    = useState(false)

  // ── Ref: track progress cleanup ─────────────────────────────────────────────
  const progressCleanupRef = useRef(null)

  // ── Load settings on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (window.electronAPI?.getSettings) {
      window.electronAPI.getSettings()
        .then((s) => setSettings(s))
        .catch((err) => console.error('[Audis] Failed to load settings:', err))
    } else {
      setSettings({ introPath: '', outroPath: '', outputDir: '', fadeDuration: 2 })
    }
  }, [])

  // ── Subscribe to FFmpeg progress updates ────────────────────────────────────
  useEffect(() => {
    if (!window.electronAPI?.onProgressUpdate) return
    const cleanup = window.electronAPI.onProgressUpdate(({ percent, timemark: tm }) => {
      setProgress(Math.min(100, Math.max(0, percent || 0)))
      setTimemark(tm || '')
    })
    progressCleanupRef.current = cleanup
    return () => cleanup?.()
  }, [])

  // ── File accepted callback ──────────────────────────────────────────────────
  const handleFileAccepted = useCallback((filePath, fileName, blobUrl = null) => {
    const isWebPath = filePath.startsWith('blob:') || filePath.startsWith('http')
    
    setAudioFile({
      name: fileName,
      path: isWebPath ? null : (filePath || null), // Native path
      blobUrl: blobUrl || (isWebPath ? filePath : null)
    })
    setOutputPath(null)
    setErrorMsg(null)
    setProgress(0)
    setTimemark('')
  }, [])

  // ── Crop region updated from WaveSurfer ─────────────────────────────────────
  const handleRegionUpdate = useCallback((start, end, duration) => {
    setCropRegion({ start, end, duration })
  }, [])

  // ── Save settings ────────────────────────────────────────────────────────────
  const handleSaveSettings = useCallback(async (updates) => {
    if (window.electronAPI?.setSettings) {
      const updated = await window.electronAPI.setSettings(updates)
      if (updated) setSettings(updated)
    } else {
      setSettings(updates)
    }
  }, [])

  // ── Export final audio ──────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!audioFile || isProcessing) return

    setIsProcessing(true)
    setProgress(0)
    setTimemark('')
    setOutputPath(null)
    setErrorMsg(null)

    try {
      const result = await window.electronAPI.processAudio({
        mainPath:  audioFile.path,
        startTime: cropRegion.start,
        endTime:   cropRegion.end,
        introPath: settings?.introPath,
        outroPath: settings?.outroPath,
      })

      if (result?.success) {
        setOutputPath(result.outputPath)
        setProgress(100)
      }
    } catch (err) {
      console.error('[Audis] Export error:', err)
      setErrorMsg(err.message || 'An unknown error occurred during export.')
    } finally {
      setIsProcessing(false)
    }
  }, [audioFile, isProcessing, cropRegion, settings])

  // ── Check if export can proceed ─────────────────────────────────────────────
  const steps = [
    { label: 'Main Audio',    done: Boolean(audioFile) },
    { label: 'Intro Track',   done: Boolean(settings?.introPath) },
    { label: 'Outro Track',   done: Boolean(settings?.outroPath) },
    { label: 'Crop Region',   done: cropRegion.end > cropRegion.start },
    { label: 'Output Folder', done: Boolean(settings?.outputDir) },
  ]
  const completedSteps = steps.filter(s => s.done).length
  const progressPercent = Math.round((completedSteps / steps.length) * 100)
  const canExport = completedSteps === steps.length

  return (
    <div className="flex flex-col h-screen bg-gradient-dark overflow-hidden select-none">

      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <header className="drag-region flex items-center justify-between px-6 py-3 border-b border-white/5 bg-surface-card/40 flex-shrink-0">
        {/* Brand logo & title */}
        <div className="no-drag flex items-center gap-3">
          <AudisLogo className="h-7 w-auto" variant="light" />
        </div>

        {/* Top Right Header Controls */}
        <div className="no-drag flex items-center gap-3">
          {audioFile && audioFile.path && (
            <span className="badge bg-brand-500/15 text-brand-300 border border-brand-500/30 px-3 py-1 font-mono animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse-slow" />
              {audioFile.name}
            </span>
          )}

          {/* Prominent Settings Button in Header */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="btn-secondary px-3.5 py-1.5 text-xs font-semibold flex items-center gap-2 border border-white/10 hover:border-brand-500/50"
            title="Configure Audio Settings"
          >
            <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* ── Main Application Workspace ─────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Global Readiness Progress Timeline */}
        <div className="flex-shrink-0 px-6 py-5 bg-surface-muted/60 border-b border-white/5 flex flex-col items-center justify-center">
          <div className="w-full max-w-4xl relative mt-1 mb-1">
            {/* Background Track */}
            <div className="absolute top-3 left-0 right-0 h-1.5 bg-surface-base rounded-full shadow-inner" />
            
            {/* Fill Track */}
            <div 
              className="absolute top-3 left-0 h-1.5 bg-brand-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(96,48,255,0.5)]" 
              style={{ width: `${progressPercent}%` }}
            />
            
            {/* Stops / Nodes */}
            <div className="relative flex w-full">
              {steps.map((step, i) => {
                const isCompleted = step.done
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2.5 relative z-10 group cursor-default">
                    {/* Node */}
                    <div className={`w-7 h-7 rounded-full border-4 transition-all duration-300 flex items-center justify-center
                      ${isCompleted 
                        ? 'bg-brand-500 border-surface-muted shadow-[0_0_12px_rgba(96,48,255,0.8)] scale-110' 
                        : 'bg-surface-base border-surface-muted group-hover:border-surface-card'}`}
                    >
                      {isCompleted ? (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                        </svg>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-400">{i + 1}</span>
                      )}
                    </div>
                    {/* Label */}
                    <span className={`text-[10px] font-bold uppercase tracking-wider text-center leading-tight transition-colors duration-300
                      ${isCompleted ? 'text-brand-300 drop-shadow-[0_0_5px_rgba(96,48,255,0.8)]' : 'text-slate-500 group-hover:text-slate-400'}`}
                    >
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: File Workspace */}
          <section className="flex-1 flex flex-col p-6 gap-5 overflow-hidden min-w-0">
            {!audioFile ? (
              /* Spacious centered Dropzone when no file is loaded */
            <div className="flex-1 flex flex-col">
              <Dropzone
                onFileAccepted={handleFileAccepted}
                hasFile={false}
                fileName=""
              />
            </div>
          ) : (
            /* Active workspace when file is loaded */
            <>
              {/* Loaded file bar */}
              <Dropzone
                onFileAccepted={handleFileAccepted}
                hasFile={true}
                fileName={audioFile.name}
              />

              {/* Waveform visualizer & cropper */}
              <div className="flex-1 glass-card p-5 overflow-hidden flex flex-col border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Interactive Region</span>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  <Waveform
                    filePath={audioFile.path}
                    blobUrl={audioFile.blobUrl}
                    onRegionUpdate={handleRegionUpdate}
                    onReady={(duration) => setCropRegion((c) => ({ ...c, duration }))}
                  />
                </div>
              </div>
            </>
          )}
        </section>

        {/* Right Sidebar: Pipeline & Actions */}
        <aside className="w-80 flex-shrink-0 flex flex-col p-6 border-l border-white/5 gap-5 overflow-y-auto bg-surface-card/20 justify-end">

          {/* Minimal Controls */}
          <Controls
            canExport={canExport}
            isProcessing={isProcessing}
            progress={progress}
            timemark={timemark}
            cropStart={cropRegion.start}
            cropEnd={cropRegion.end}
            outputPath={outputPath}
            onExport={handleExport}
            missingSteps={steps.filter(s => !s.done)}
            settings={settings}
          />

          {/* Error display if any */}
          {errorMsg && !isProcessing && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 animate-fade-in">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-red-300">Processing Error</p>
                <p className="text-[11px] text-red-400/90 mt-0.5 break-words">{errorMsg}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-1">
            <p className="text-[10px] text-slate-500 text-center font-medium">
              Audis v1.0.0 · Developed by <span className="text-slate-300 font-semibold">Ransamie Technologies (RanTech)</span>
            </p>
          </div>
        </aside>
        </div>
      </main>

      {/* Settings Modal */}
      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  )
}
