/**
 * src/components/Dropzone.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Matte Studio Empty-State File Dropzone (multi-file + folder import).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback, useRef } from 'react'

const ACCEPTED_TYPES = ['.mp3', '.wav', '.aac', '.flac', '.m4a', '.ogg']
const ACCEPTED_MIME  = [
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/flac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
]

function isSupportedFile(file) {
  if (!file) return false
  const ext  = '.' + (file.name.split('.').pop() || '').toLowerCase()
  const mime = file.type
  return ACCEPTED_TYPES.includes(ext) || ACCEPTED_MIME.includes(mime)
}

function fileFromPath(filePath) {
  const fileName = filePath.split(/[\\/]/).pop() || filePath
  return { filePath, fileName, blobUrl: null }
}

export default function Dropzone ({ onFilesAccepted, onFileAccepted }) {
  const [isDragging, setIsDragging] = useState(false)
  const [errorMsg,   setErrorMsg]   = useState(null)
  const fileInputRef = useRef(null)

  const emitAccepted = useCallback((items) => {
    if (!items || items.length === 0) return
    if (onFilesAccepted) {
      onFilesAccepted(items)
    } else if (onFileAccepted) {
      const first = items[0]
      onFileAccepted(first.filePath || first.blobUrl || '', first.fileName, first.blobUrl)
    }
  }, [onFilesAccepted, onFileAccepted])

  const handleFileList = useCallback((fileList) => {
    setErrorMsg(null)
    const files = Array.from(fileList || [])
    if (files.length === 0) return

    const valid   = []
    const skipped = []

    for (const file of files) {
      if (!isSupportedFile(file)) {
        skipped.push(file.name)
        continue
      }
      let resolvedPath = ''
      try {
        resolvedPath = window.electronAPI?.getPathForFile?.(file) || file.path || ''
      } catch {
        resolvedPath = file.path || ''
      }
      const blobUrl = URL.createObjectURL(file)
      valid.push({ filePath: resolvedPath, fileName: file.name, blobUrl })
    }

    if (skipped.length > 0 && valid.length === 0) {
      setErrorMsg(`Unsupported format (${skipped[0]}). Use MP3, WAV, AAC, FLAC, M4A, or OGG.`)
      return
    }
    if (skipped.length > 0) {
      setErrorMsg(`Skipped ${skipped.length} unsupported file${skipped.length > 1 ? 's' : ''}.`)
    }

    emitAccepted(valid)
  }, [emitAccepted])

  const onDragOver  = useCallback((e) => { e.preventDefault(); setIsDragging(true) }, [])
  const onDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false) }, [])
  const onDrop      = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer?.files?.length) handleFileList(e.dataTransfer.files)
  }, [handleFileList])

  const onInputChange = useCallback((e) => {
    if (e.target.files?.length) handleFileList(e.target.files)
    e.target.value = ''
  }, [handleFileList])

  const openFilesPicker = useCallback(async () => {
    setErrorMsg(null)
    if (window.electronAPI?.openFilesDialog) {
      try {
        const paths = await window.electronAPI.openFilesDialog({
          title: 'Select Audio Files',
          filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg'] }],
        })
        if (Array.isArray(paths) && paths.length > 0) emitAccepted(paths.map(fileFromPath))
      } catch (err) {
        console.warn('Multi-file dialog failed:', err)
      }
    } else if (window.electronAPI?.openFileDialog) {
      try {
        const filePath = await window.electronAPI.openFileDialog({
          title: 'Select Audio File',
          filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg'] }],
        })
        if (filePath) emitAccepted([fileFromPath(filePath)])
      } catch (err) {
        console.warn('File dialog failed:', err)
      }
    } else {
      fileInputRef.current?.click()
    }
  }, [emitAccepted])

  const openFolderPicker = useCallback(async () => {
    setErrorMsg(null)
    if (!window.electronAPI?.openFolderDialog) return
    try {
      const paths = await window.electronAPI.openFolderDialog({ title: 'Select Audio Folder' })
      if (Array.isArray(paths) && paths.length > 0) {
        emitAccepted(paths.map(fileFromPath))
      } else if (Array.isArray(paths) && paths.length === 0) {
        setErrorMsg('No supported audio files found in that folder.')
      }
    } catch (err) {
      console.warn('Folder dialog failed:', err)
    }
  }, [emitAccepted])

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={[
        'flex-1 flex flex-col items-center justify-center gap-5 p-10 rounded-lg border border-dashed transition-colors',
        isDragging
          ? 'border-brand-500 bg-brand-500/5'
          : 'border-[#2e333c] bg-[#181a1f]',
      ].join(' ')}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        onChange={onInputChange}
        tabIndex={-1}
      />

      <div className="w-14 h-14 rounded-lg bg-[#22262e] border border-[#323741] flex items-center justify-center">
        <svg aria-hidden="true" className="w-7 h-7 text-accent-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </div>

      <div className="text-center max-w-md space-y-1.5">
        <p className="text-base font-semibold text-slate-100">
          {isDragging ? 'Drop files to load into batch workspace' : 'Import Audio Session'}
        </p>
        <p className="text-xs text-slate-400">
          Drag and drop individual tracks or an entire batch folder (MP3, WAV, AAC, FLAC, M4A, OGG).
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={openFilesPicker} className="btn-primary px-5 py-2.5">
          Open Audio Files
        </button>
        {window.electronAPI?.openFolderDialog && (
          <button type="button" onClick={openFolderPicker} className="btn-secondary px-5 py-2.5">
            Import Folder
          </button>
        )}
      </div>

      {errorMsg && (
        <div role="alert" className="px-4 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          {errorMsg}
        </div>
      )}
    </div>
  )
}
