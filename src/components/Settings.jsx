/**
 * src/components/Settings.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Settings modal for configuring Intro/Outro file paths and output directory.
 * Includes explicit file and directory dialog triggers with real-time feedback.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'

const ExportFormatDropdown = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const options = [
    { id: 'original', label: 'Original Format', desc: 'Same as main file' },
    { id: 'mp3', label: 'MP3', desc: '320kbps' },
    { id: 'wav', label: 'WAV', desc: 'Lossless PCM' },
    { id: 'aac', label: 'AAC', desc: '320kbps' },
    { id: 'flac', label: 'FLAC', desc: 'Lossless' }
  ]
  const selected = options.find(o => o.id === value) || options[0]

  return (
    <div
      className="relative"
      tabIndex={0}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setIsOpen(false)
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-base border border-white/10 hover:border-brand-500/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-xs">{selected.label}</span>
          <span className="text-[10px] text-slate-400">{selected.desc}</span>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 p-1 rounded-xl bg-surface-card border border-white/10 shadow-2xl z-50 flex flex-col gap-1 backdrop-blur-xl">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { onChange(opt.id); setIsOpen(false) }}
              className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${value === opt.id ? 'bg-brand-500/20 text-brand-300' : 'hover:bg-white/5 text-slate-300'}`}
            >
              <span className="font-bold text-xs">{opt.label}</span>
              <span className="text-[10px] opacity-70">{opt.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Settings ({ isOpen, onClose, settings, onSave }) {
  const [form, setForm] = useState({
    introPath:    '',
    outroPath:    '',
    outputDir:    '',
    fadeDuration: 2,
    exportFormat: 'original',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saved,    setSaved]    = useState(false)

  // Fallback hidden file inputs
  const introInputRef = useRef(null)
  const outroInputRef = useRef(null)
  const dirInputRef = useRef(null)

  // Sync form state when settings object changes
  useEffect(() => {
    if (settings) {
      setForm({
        introPath:    settings.introPath || '',
        outroPath:    settings.outroPath || '',
        outputDir:    settings.outputDir || '',
        fadeDuration: settings.fadeDuration ?? 2,
        exportFormat: settings.exportFormat || 'original',
      })
    }
  }, [settings])

  // ── Browse for audio file (Intro or Outro) ──────────────────────────────────
  const browseFile = useCallback(async (field) => {
    if (!window.electronAPI?.openFileDialog) {
      if (field === 'introPath') introInputRef.current?.click()
      if (field === 'outroPath') outroInputRef.current?.click()
      return
    }
    try {
      const result = await window.electronAPI.openFileDialog({
        title: `Select ${field === 'introPath' ? 'Intro' : 'Outro'} Track`,
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'flac', 'm4a'] }],
        properties: ['openFile']
      })
      if (result) {
        setForm((f) => ({ ...f, [field]: result }))
      }
    } catch (err) {
      console.warn('File dialog failed:', err)
    }
  }, [])

  // ── Browse for export directory ─────────────────────────────────────────────
  const browseFolder = useCallback(async () => {
    if (!window.electronAPI?.openDirectoryDialog) {
      dirInputRef.current?.click()
      return
    }
    try {
      const result = await window.electronAPI.openDirectoryDialog({
        title: 'Select Output Folder',
        defaultPath: form.outputDir || undefined,
      })
      if (result) {
        setForm((f) => ({ ...f, outputDir: result }))
      }
    } catch (err) {
      console.warn('Folder dialog failed:', err)
    }
  }, [form.outputDir])

  // ── Save Settings ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async (e) => {
    if (e) e.preventDefault()
    setIsSaving(true)
    try {
      await onSave(form)
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        onClose()
      }, 600)
    } finally {
      setIsSaving(false)
    }
  }, [form, onSave, onClose])

  // ── Keyboard Escape Close ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-lg glass-card border border-white/10 shadow-2xl animate-slide-up overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5 bg-surface-card/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Audio Settings</h2>
              <p className="text-xs text-slate-400">Set default tracks, crossfade duration &amp; export path</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="px-6 py-5 space-y-5">

          {/* Intro path */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Intro Track</label>
              {form.introPath ? (
                <span className="text-[10px] text-green-400 font-mono flex items-center gap-1">
                  ✓ Configured
                </span>
              ) : (
                <span className="text-[10px] text-amber-400 font-mono">Missing</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
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
              <button
                type="button"
                onClick={() => browseFile('introPath')}
                className="btn-secondary px-4 py-2 flex-shrink-0 text-xs font-medium cursor-pointer"
              >
                Browse…
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Fades out over the last {form.fadeDuration}s before main audio starts.
            </p>
          </div>

          {/* Outro path */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Outro Track</label>
              {form.outroPath ? (
                <span className="text-[10px] text-green-400 font-mono flex items-center gap-1">
                  ✓ Configured
                </span>
              ) : (
                <span className="text-[10px] text-amber-400 font-mono">Missing</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
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
              <button
                type="button"
                onClick={() => browseFile('outroPath')}
                className="btn-secondary px-4 py-2 flex-shrink-0 text-xs font-medium cursor-pointer"
              >
                Browse…
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Fades in over the first {form.fadeDuration}s after main audio ends.
            </p>
          </div>

          {/* Output Folder */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 block">
              Output Folder
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                placeholder="Default Downloads folder..."
                value={form.outputDir}
                className="flex-1 bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-300 font-mono focus:outline-none focus:border-brand-500/50"
              />
              {/* Note: standard file inputs can't easily select directories without webkitdirectory.
                  This fallback allows directory selection in Chrome. */}
              <input
                type="file"
                ref={dirInputRef}
                className="hidden"
                webkitdirectory="true"
                directory="true"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    const path = e.target.files[0].path || ''
                    // Extract directory from file path if it selects a file
                    const dir = path.substring(0, path.lastIndexOf('/')) || path.substring(0, path.lastIndexOf('\\')) || path
                    setForm(f => ({ ...f, outputDir: dir }))
                  }
                }}
              />
              <button
                type="button"
                onClick={browseFolder}
                className="btn-secondary px-4 py-2 flex-shrink-0 text-xs font-medium cursor-pointer"
              >
                Browse…
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Location where finalized audio exports will be saved.
            </p>
          </div>

          {/* Export Format */}
          <div className="relative z-20">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Export Format</label>
            </div>
            
            <ExportFormatDropdown
              value={form.exportFormat}
              onChange={(val) => setForm((f) => ({ ...f, exportFormat: val }))}
            />
          </div>

          {/* Crossfade duration slider */}
          <div className="bg-surface-base/50 p-4 rounded-xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Crossfade Duration</label>
              <span className="text-sm font-mono font-bold text-brand-300 bg-brand-500/20 px-2.5 py-0.5 rounded-md border border-brand-500/30">
                {form.fadeDuration}s
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="6"
              step="0.5"
              value={form.fadeDuration}
              onChange={(e) => setForm((f) => ({ ...f, fadeDuration: Number(e.target.value) }))}
              className="w-full accent-brand-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">
              Applied automatically across intro fade-out, main audio fade-in &amp; fade-out, and outro fade-in.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
            >
              {saved ? (
                <>
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                  </svg>
                  Saved!
                </>
              ) : isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  Saving…
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
