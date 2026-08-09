/**
 * src/components/Dropzone.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Drag-and-drop file input for the main audio file.
 *
 * Props:
 *   onFileAccepted(filePath: string) — called when a valid audio file is dropped
 *   hasFile (boolean)               — whether a file is already loaded
 *   fileName (string)               — display name of the loaded file
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback, useRef } from 'react'

const ACCEPTED_TYPES = ['.mp3', '.wav', '.aac', '.flac', '.m4a']
const ACCEPTED_MIME  = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/flac', 'audio/mp4', 'audio/x-m4a']

export default function Dropzone ({ onFileAccepted, hasFile, fileName }) {
  const [isDragging,  setIsDragging]  = useState(false)
  const [errorMsg,    setErrorMsg]    = useState(null)
  const fileInputRef = useRef(null)

  // ── Validate dropped / selected file ──────────────────────────────────────
  const validateFile = useCallback((file) => {
    if (!file) return 'No file received'
    const ext  = '.' + file.name.split('.').pop().toLowerCase()
    const mime = file.type
    if (!ACCEPTED_TYPES.includes(ext) && !ACCEPTED_MIME.includes(mime)) {
      return `Unsupported format "${ext}". Please drop an MP3 or WAV file.`
    }
    return null
  }, [])

  // ── Handle file (from input or drop) ──────────────────────────────────────
  const handleFile = useCallback((file) => {
    setErrorMsg(null)
    const err = validateFile(file)
    if (err) { setErrorMsg(err); return }
    
    // In Electron 31+, file.path is hidden by security.
    // Our preload script intercepts the 'drop' event and stores the real path here:
    let filePath = window.__lastDroppedFilePath || file.path || ''
    window.__lastDroppedFilePath = null // clear it

    // Create instant in-memory Blob URL for WaveSurfer
    const blobUrl = URL.createObjectURL(file)
    onFileAccepted(filePath, file.name, blobUrl)
  }, [validateFile, onFileAccepted])

  // ── Drag events ───────────────────────────────────────────────────────────
  const onDragOver  = useCallback((e) => { e.preventDefault(); setIsDragging(true)  }, [])
  const onDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false) }, [])
  const onDrop      = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    handleFile(file)
  }, [handleFile])

  // ── Click to browse ───────────────────────────────────────────────────────
  const onInputChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }, [handleFile])

  const openFilePicker = useCallback(() => {
    // Prefer native Electron dialog
    if (window.electronAPI?.openFileDialog) {
      window.electronAPI.openFileDialog({
        title:   'Select Audio File',
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'aac', 'flac', 'm4a'] }]
      }).then((filePath) => {
        if (filePath) {
          const name = filePath.split(/[\\/]/).pop()
          onFileAccepted(filePath, name)
        }
      }).catch((err) => {
        console.warn('Dialog failed:', err)
      })
    } else {
      fileInputRef.current?.click()
    }
  }, [onFileAccepted])

  // ── Loaded state ───────────────────────────────────────────────────────────
  if (hasFile) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 glass-card border-brand-500/30 animate-fade-in">
        {/* Hidden fallback file input for the replace button */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="sr-only"
          onChange={onInputChange}
          tabIndex={-1}
        />
        {/* File icon */}
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-brand-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{fileName}</p>
          <p className="text-xs text-slate-400 mt-0.5">Ready to edit</p>
        </div>
        {/* Replace button */}
        <button
          type="button"
          onClick={openFilePicker}
          className="btn-ghost text-xs flex-shrink-0"
          title="Load a different file"
        >
          Replace
        </button>
      </div>
    )
  }

  // ── Dropzone (no file loaded) ──────────────────────────────────────────────
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={openFilePicker}
      className={[
        'relative group cursor-pointer select-none',
        'flex flex-col items-center justify-center gap-3',
        'rounded-2xl border-2 border-dashed',
        'py-12 px-8 transition-all duration-300',
        isDragging
          ? 'border-brand-400 bg-brand-500/10 scale-[1.01]'
          : 'border-white/10 bg-surface-muted/50 hover:border-brand-500/50 hover:bg-brand-500/5',
      ].join(' ')}
    >
      {/* Hidden fallback file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        onChange={onInputChange}
        tabIndex={-1}
      />

      {/* Animated drop icon */}
      <div className={[
        'w-16 h-16 rounded-2xl flex items-center justify-center',
        'bg-gradient-to-br from-brand-600/30 to-brand-400/20',
        'transition-transform duration-300',
        isDragging ? 'scale-110' : 'group-hover:scale-105',
      ].join(' ')}>
        <svg
          className={['w-8 h-8 transition-colors duration-200', isDragging ? 'text-brand-300' : 'text-brand-500'].join(' ')}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          {isDragging
            ? /* drop arrow */
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            : /* waveform icon */
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          }
        </svg>
      </div>

      {/* Text */}
      <div className="text-center">
        <p className={['text-base font-semibold transition-colors duration-200', isDragging ? 'text-brand-300' : 'text-white'].join(' ')}>
          {isDragging ? 'Release to load' : 'Drop your audio file here'}
        </p>
        <p className="text-sm text-slate-400 mt-1">
          or <span className="text-brand-400 font-medium">click to browse</span>
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Supports MP3, WAV, AAC, FLAC, M4A
        </p>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs text-center animate-fade-in">
          {errorMsg}
        </div>
      )}

      {/* Glow overlay on drag */}
      {isDragging && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-radial from-brand-500/10 via-transparent to-transparent animate-pulse-slow" />
      )}
    </div>
  )
}
