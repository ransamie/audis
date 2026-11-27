/**
 * src/components/Settings.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Settings modal implemented with native <dialog>, accessible form controls,
 * <fieldset>/<legend> radio groups, native <select>, and <input type="checkbox" switch>.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useRef, useId } from 'react'

export default function Settings ({ isOpen, onClose, settings, onSave }) {
  const dialogRef     = useRef(null)
  const introInputRef = useRef(null)
  const outroInputRef = useRef(null)
  const uid           = useId()

  const [form, setForm] = useState({
    introPath:          '',
    outroPath:          '',
    outputDir:          '',
    fadeDuration:       2,
    exportFormat:       'original',
    aiMode:             'offline',
    apiProvider:        'groq',
    apiKey:             '',
    noisedB:            -35,
    minPauseDuration:   0.6,
    targetPauseSec:     0.35,
    defaultIntroOutro:  'on',
    analysisWorkers:    2,
    exportWorkers:      2,
    loudnormEnabled:    true,
    batchNamingPattern: '{index}_{title}',
  })
  const [hasExistingKey, setHasExistingKey] = useState(false)
  const [showApiKey,     setShowApiKey]     = useState(false)
  const [isSaving,       setIsSaving]       = useState(false)
  const [saved,          setSaved]          = useState(false)

  // Sync settings prop into form state
  useEffect(() => {
    if (settings) {
      setForm((prev) => ({
        ...prev,
        introPath:          settings.introPath ?? '',
        outroPath:          settings.outroPath ?? '',
        outputDir:          settings.outputDir ?? '',
        fadeDuration:       settings.fadeDuration ?? 2,
        exportFormat:       settings.exportFormat ?? 'original',
        aiMode:             settings.aiMode ?? 'offline',
        apiProvider:        settings.apiProvider ?? 'groq',
        noisedB:            settings.noisedB ?? -35,
        minPauseDuration:   settings.minPauseDuration ?? 0.6,
        targetPauseSec:     settings.targetPauseSec ?? 0.35,
        defaultIntroOutro:  settings.defaultIntroOutro ?? 'on',
        analysisWorkers:    settings.analysisWorkers ?? 2,
        exportWorkers:      settings.exportWorkers ?? 2,
        loudnormEnabled:    settings.loudnormEnabled ?? true,
        batchNamingPattern: settings.batchNamingPattern ?? '{index}_{title}',
      }))
    }
  }, [settings])

  // Load encrypted API key status cleanly when dialog opens
  useEffect(() => {
    if (!isOpen) return
    if (window.electronAPI?.getApiKey) {
      window.electronAPI.getApiKey()
        .then((key) => {
          setHasExistingKey(Boolean(key))
          if (key) setForm((f) => ({ ...f, apiKey: key }))
        })
        .catch(() => {})
    }
  }, [isOpen])

  // Open / close native <dialog> via showModal()
  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (isOpen && !dlg.open) {
      dlg.showModal()
    } else if (!isOpen && dlg.open) {
      dlg.close()
    }
  }, [isOpen])

  // Light-dismiss fallback when HTMLDialogElement lacks closedBy
  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg || 'closedBy' in HTMLDialogElement.prototype) return

    const outside = (e) => {
      const r = dlg.getBoundingClientRect()
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
    }
    let pressedOutside = false
    const onDown = (e) => { pressedOutside = outside(e) }
    const onUp   = (e) => { if (pressedOutside && outside(e)) dlg.close() }

    dlg.addEventListener('pointerdown', onDown)
    dlg.addEventListener('pointerup', onUp)
    return () => {
      dlg.removeEventListener('pointerdown', onDown)
      dlg.removeEventListener('pointerup', onUp)
    }
  }, [])

  const handleDialogClose = useCallback(() => {
    if (dialogRef.current) dialogRef.current.returnValue = ''
    onClose()
  }, [onClose])

  // Browse for audio file (Intro or Outro)
  const browseFile = useCallback(async (field) => {
    if (!window.electronAPI?.openFileDialog) {
      if (field === 'introPath') introInputRef.current?.click()
      if (field === 'outroPath') outroInputRef.current?.click()
      return
    }
    try {
      const result = await window.electronAPI.openFileDialog({
        title: `Select ${field === 'introPath' ? 'Intro' : 'Outro'} Track`,
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg'] }],
        properties: ['openFile'],
      })
      if (result) setForm((f) => ({ ...f, [field]: result }))
    } catch (err) {
      console.warn('File dialog failed:', err)
    }
  }, [])

  // Browse for export directory
  const outputDirRef = useRef(form.outputDir)
  outputDirRef.current = form.outputDir

  const browseFolder = useCallback(async () => {
    const api = window.electronAPI
    if (!api?.openDirectoryDialog) {
      alert('Folder picker is not available in this build.')
      return
    }
    try {
      const result = await api.openDirectoryDialog({
        title: 'Select Output Folder',
        defaultPath: outputDirRef.current || undefined,
      })
      const folderPath = Array.isArray(result) ? result[0] : result
      if (folderPath) setForm((f) => ({ ...f, outputDir: folderPath }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('Folder dialog failed:', msg)
      alert(`Failed to open folder picker: ${msg}`)
    }
  }, [])

  // Save Settings
  const handleSave = useCallback(async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const payload = { ...form }
      if (!payload.apiKey) delete payload.apiKey
      await onSave(payload)
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        onClose()
      }, 450)
    } finally {
      setIsSaving(false)
    }
  }, [form, onSave, onClose])

  const ids = {
    title:       `${uid}-title`,
    intro:       `${uid}-intro`,
    outro:       `${uid}-outro`,
    outputDir:   `${uid}-output-dir`,
    format:      `${uid}-format`,
    fade:        `${uid}-fade`,
    provider:    `${uid}-provider`,
    apiKey:      `${uid}-api-key`,
    apiKeyHint:  `${uid}-api-key-hint`,
    noiseDb:     `${uid}-noise-db`,
    minPause:    `${uid}-min-pause`,
    targetPause: `${uid}-target-pause`,
    aWorkers:    `${uid}-a-workers`,
    eWorkers:    `${uid}-e-workers`,
    loudnorm:    `${uid}-loudnorm`,
    loudHint:    `${uid}-loud-hint`,
    naming:      `${uid}-naming`,
  }

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby={ids.title}
      onClose={handleDialogClose}
      className="audis-dialog"
    >
      <div className="w-full bg-[#1b1e23] rounded-lg border border-[#323741] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3.5 border-b border-[#2b2f37] bg-[#181a1f] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#22262d] border border-[#343944] flex items-center justify-center">
              <svg aria-hidden="true" className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                  d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
              </svg>
            </div>
            <div>
              <h1 id={ids.title} className="text-sm font-bold text-slate-100 uppercase tracking-wider">Audio Settings</h1>
              <p className="text-[11px] text-slate-400">Tracks, silence detection, AI planner &amp; batch export</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close settings"
            className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-white"
          >
            <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

          {/* Intro path */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={ids.intro} className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Intro Track</label>
              <span className={`text-[10px] font-mono ${form.introPath ? 'text-green-400' : 'text-amber-400'}`}>
                {form.introPath ? '✓ Configured' : 'Optional / Unset'}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                id={ids.intro}
                name="introPath"
                type="text"
                autoFocus
                value={form.introPath}
                onChange={(e) => setForm((f) => ({ ...f, introPath: e.target.value }))}
                placeholder="Select or paste path to any audio file (e.g. C:\Theme.wav)"
                className="input-field flex-1 font-mono text-xs"
              />
              <input
                type="file"
                ref={introInputRef}
                className="hidden"
                accept="audio/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) setForm(f => ({ ...f, introPath: e.target.files[0].path || e.target.files[0].name }))
                }}
              />
              <button type="button" onClick={() => browseFile('introPath')} className="btn-secondary px-4 py-2 flex-shrink-0 text-xs font-medium">
                Browse…
              </button>
            </div>
          </div>

          {/* Outro path */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={ids.outro} className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Outro Track</label>
              <span className={`text-[10px] font-mono ${form.outroPath ? 'text-green-400' : 'text-amber-400'}`}>
                {form.outroPath ? '✓ Configured' : 'Optional / Unset'}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                id={ids.outro}
                name="outroPath"
                type="text"
                value={form.outroPath}
                onChange={(e) => setForm((f) => ({ ...f, outroPath: e.target.value }))}
                placeholder="Select or paste path to any audio file (e.g. D:\EndingJingle.mp3)"
                className="input-field flex-1 font-mono text-xs"
              />
              <input
                type="file"
                ref={outroInputRef}
                className="hidden"
                accept="audio/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) setForm(f => ({ ...f, outroPath: e.target.files[0].path || e.target.files[0].name }))
                }}
              />
              <button type="button" onClick={() => browseFile('outroPath')} className="btn-secondary px-4 py-2 flex-shrink-0 text-xs font-medium">
                Browse…
              </button>
            </div>
          </div>

          {/* Output Folder */}
          <div>
            <label htmlFor={ids.outputDir} className="field-label">Output Folder</label>
            <div className="flex gap-2">
              <input
                id={ids.outputDir}
                name="outputDir"
                type="text"
                value={form.outputDir}
                onChange={(e) => setForm((f) => ({ ...f, outputDir: e.target.value }))}
                placeholder="Default Downloads folder..."
                className="input-field flex-1 font-mono text-xs"
              />
              <button type="button" onClick={browseFolder} className="btn-secondary px-4 py-2 flex-shrink-0 text-xs font-medium">
                Browse…
              </button>
            </div>
          </div>

          {/* Export Format + Crossfade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={ids.format} className="field-label">Export Format</label>
              <select
                id={ids.format}
                name="exportFormat"
                value={form.exportFormat}
                onChange={(e) => setForm((f) => ({ ...f, exportFormat: e.target.value }))}
                className="brand-select"
              >
                <option value="original">Original Format (same as input)</option>
                <option value="mp3">MP3 — 320 kbps</option>
                <option value="wav">WAV — Lossless PCM</option>
                <option value="aac">AAC — 320 kbps</option>
                <option value="flac">FLAC — Lossless</option>
                <option value="ogg">OGG — Vorbis High Quality</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor={ids.fade} className="text-xs font-medium text-slate-400 uppercase tracking-wider">Crossfade</label>
                <span className="text-xs font-mono font-bold text-brand-300">{form.fadeDuration}s</span>
              </div>
              <input
                id={ids.fade}
                name="fadeDuration"
                type="range"
                min="0.5"
                max="6"
                step="0.5"
                value={form.fadeDuration}
                onChange={(e) => setForm((f) => ({ ...f, fadeDuration: Number(e.target.value) }))}
                className="w-full accent-brand-500 cursor-pointer mt-2"
              />
            </div>
          </div>

          {/* Default Intro / Outro Behavior (radio group) */}
          <fieldset className="p-4 rounded-md bg-[#141619] border border-[#2b2f37] space-y-2.5">
            <legend className="text-xs font-semibold text-slate-300 uppercase tracking-wider px-1">
              Default Intro / Outro Mode
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'on',  label: 'Always On' },
                { id: 'off', label: 'Always Off' },
                { id: 'ai',  label: 'AI Decides' },
              ].map(opt => {
                const radioId = `${uid}-io-${opt.id}`
                const checked = form.defaultIntroOutro === opt.id
                return (
                  <label
                    key={opt.id}
                    htmlFor={radioId}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                        : 'border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <input
                      id={radioId}
                      type="radio"
                      name="defaultIntroOutro"
                      value={opt.id}
                      checked={checked}
                      onChange={() => setForm(f => ({ ...f, defaultIntroOutro: opt.id }))}
                      className="accent-brand-500"
                    />
                    <span>{opt.label}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* AI Analysis Mode (radio group) */}
          <fieldset className="p-4 rounded-md bg-[#141619] border border-[#2b2f37] space-y-3">
            <legend className="text-xs font-semibold text-slate-300 uppercase tracking-wider px-1">
              AI Analysis Engine
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'offline', label: 'DSP Only (Offline)' },
                { id: 'cloud',   label: 'Cloud Whisper + LLM' },
              ].map(opt => {
                const radioId = `${uid}-ai-${opt.id}`
                const checked = form.aiMode === opt.id
                return (
                  <label
                    key={opt.id}
                    htmlFor={radioId}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                        : 'border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <input
                      id={radioId}
                      type="radio"
                      name="aiMode"
                      value={opt.id}
                      checked={checked}
                      onChange={() => setForm(f => ({ ...f, aiMode: opt.id }))}
                      className="accent-brand-500"
                    />
                    <span>{opt.label}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              DSP Only detects silences locally at 10–50x real-time. Cloud API adds Whisper word timestamps, retake/filler removal, and smart intro/outro decisions.
            </p>

            {form.aiMode === 'cloud' && (
              <div className="space-y-3 pt-2 border-t border-white/5">
                <div>
                  <label htmlFor={ids.provider} className="field-label">Cloud Provider</label>
                  <select
                    id={ids.provider}
                    name="apiProvider"
                    value={form.apiProvider}
                    onChange={(e) => setForm(f => ({ ...f, apiProvider: e.target.value }))}
                    className="brand-select"
                  >
                    <option value="groq">Groq (Fast Whisper + Llama 3.3 70B)</option>
                    <option value="openai">OpenAI (Whisper + GPT-4o mini)</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor={ids.apiKey} className="text-xs font-medium text-slate-400 uppercase tracking-wider">API Key</label>
                    {hasExistingKey && <span className="text-[10px] text-green-400 font-mono">✓ Stored encrypted</span>}
                  </div>
                  <div className="flex gap-2">
                    <input
                      id={ids.apiKey}
                      name="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      value={form.apiKey}
                      onChange={(e) => setForm(f => ({ ...f, apiKey: e.target.value }))}
                      placeholder={hasExistingKey ? 'Stored securely — paste new key to replace' : 'Paste Groq or OpenAI API key'}
                      autoComplete="off"
                      spellCheck={false}
                      aria-describedby={ids.apiKeyHint}
                      className="input-field flex-1 font-mono text-xs"
                    />
                    <button
                      type="button"
                      aria-pressed={showApiKey}
                      aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                      onClick={() => setShowApiKey(s => !s)}
                      className="btn-secondary px-3 py-2 text-xs"
                    >
                      {showApiKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p id={ids.apiKeyHint} className="text-[11px] text-slate-500 mt-1">
                    Encrypted locally using OS credential storage.
                  </p>
                </div>
              </div>
            )}
          </fieldset>

          {/* Silence Detection Rules */}
          <fieldset className="p-4 rounded-md bg-[#141619] border border-[#2b2f37] space-y-3">
            <legend className="text-xs font-semibold text-slate-300 uppercase tracking-wider px-1">
              Silence &amp; Pause Rules
            </legend>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor={ids.noiseDb} className="text-slate-300">Noise Floor Threshold</label>
                <span className="font-mono text-brand-300 font-bold">{form.noisedB} dB</span>
              </div>
              <input
                id={ids.noiseDb} name="noisedB" type="range" min="-60" max="-20" step="1"
                value={form.noisedB}
                onChange={e => setForm(f => ({ ...f, noisedB: Number(e.target.value) }))}
                className="w-full accent-brand-500 cursor-pointer"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor={ids.minPause} className="text-slate-300">Min Pause Flag</label>
                  <span className="font-mono text-brand-300 font-bold">{form.minPauseDuration}s</span>
                </div>
                <input
                  id={ids.minPause} name="minPauseDuration" type="range" min="0.3" max="2.5" step="0.1"
                  value={form.minPauseDuration}
                  onChange={e => setForm(f => ({ ...f, minPauseDuration: Number(e.target.value) }))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor={ids.targetPause} className="text-slate-300">Shorten Pause To</label>
                  <span className="font-mono text-brand-300 font-bold">{form.targetPauseSec}s</span>
                </div>
                <input
                  id={ids.targetPause} name="targetPauseSec" type="range" min="0.1" max="1.0" step="0.05"
                  value={form.targetPauseSec}
                  onChange={e => setForm(f => ({ ...f, targetPauseSec: Number(e.target.value) }))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
              </div>
            </div>
          </fieldset>

          {/* Batch Concurrency & Loudness Switch */}
          <div className="space-y-3 p-4 rounded-md bg-[#141619] border border-[#2b2f37]">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor={ids.aWorkers} className="text-slate-300">Analysis Workers</label>
                  <span className="font-mono text-brand-300 font-bold">{form.analysisWorkers}</span>
                </div>
                <input
                  id={ids.aWorkers} name="analysisWorkers" type="range" min="1" max="4" step="1"
                  value={form.analysisWorkers}
                  onChange={e => setForm(f => ({ ...f, analysisWorkers: Number(e.target.value) }))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor={ids.eWorkers} className="text-slate-300">Export Workers</label>
                  <span className="font-mono text-brand-300 font-bold">{form.exportWorkers}</span>
                </div>
                <input
                  id={ids.eWorkers} name="exportWorkers" type="range" min="1" max="4" step="1"
                  value={form.exportWorkers}
                  onChange={e => setForm(f => ({ ...f, exportWorkers: Number(e.target.value) }))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/5">
              <div>
                <label htmlFor={ids.loudnorm} className="text-xs font-semibold text-slate-300 cursor-pointer">
                  Loudness Normalization (-16 LUFS)
                </label>
                <p id={ids.loudHint} className="text-[11px] text-slate-500">
                  Balances volume on standalone voice messages without intro/outro.
                </p>
              </div>
              <input
                id={ids.loudnorm}
                name="loudnormEnabled"
                type="checkbox"
                switch=""
                checked={form.loudnormEnabled}
                aria-describedby={ids.loudHint}
                onChange={(e) => setForm(f => ({ ...f, loudnormEnabled: e.target.checked }))}
                className="audis-switch flex-shrink-0"
              />
            </div>

            <div>
              <label htmlFor={ids.naming} className="field-label">Batch Filename Pattern</label>
              <input
                id={ids.naming}
                name="batchNamingPattern"
                type="text"
                value={form.batchNamingPattern}
                onChange={(e) => setForm(f => ({ ...f, batchNamingPattern: e.target.value }))}
                className="input-field font-mono text-xs"
              />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="btn-secondary px-4 py-2 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
            >
              {saved ? '✓ Saved!' : isSaving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
