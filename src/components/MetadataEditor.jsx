/**
 * src/components/MetadataEditor.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Metadata Editor modal — edit ID3 / Vorbis / MP4 tags + embedded cover art.
 * Implemented with a native <dialog> for accessibility, matching the Settings
 * modal's matte-studio styling.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useRef, useId } from 'react'

export default function MetadataEditor ({ isOpen, onClose, filePath, onSaved }) {
  const dialogRef     = useRef(null)
  const coverInputRef = useRef(null)
  const uid           = useId()

  const [metadata,     setMetadata]     = useState({})
  const [coverArt,     setCoverArt]     = useState(null)
  const [coverPending, setCoverPending] = useState(null)
  const [coverRemoved, setCoverRemoved] = useState(false)
  const [isSaving,     setIsSaving]     = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState(null)

  const ids = {
    title:    `${uid}-meta-title`,
    artist:   `${uid}-meta-artist`,
    album:    `${uid}-meta-album`,
    date:     `${uid}-meta-date`,
    genre:    `${uid}-meta-genre`,
    comment:  `${uid}-meta-comment`,
    track:    `${uid}-meta-track`,
    disk:     `${uid}-meta-disk`,
    cover:    `${uid}-meta-cover`,
    titleLbl: `${uid}-meta-title-lbl`,
  }

  const loadMetadata = useCallback(async () => {
    if (!window.electronAPI?.readMetadata || !filePath) return
    try {
      const meta = await window.electronAPI.readMetadata(filePath)
      setMetadata(meta || {})
      const art = meta?.coverArt || (await window.electronAPI.extractCoverArt?.(filePath)) || null
      setCoverArt(art)
    } catch (err) {
      setError(`Failed to read metadata: ${err.message}`)
    }
  }, [filePath])

  // Open/close native <dialog> and reload when filePath changes while open
  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (isOpen) {
      setError(null)
      setSaved(false)
      setCoverPending(null)
      setCoverRemoved(false)
      if (!dlg.open) dlg.showModal()
      loadMetadata()
    } else if (dlg.open) {
      dlg.close()
    }
  }, [isOpen, filePath, loadMetadata])

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

  const handleChange = useCallback((field, value) => {
    setMetadata(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG or JPG).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setCoverPending(reader.result)
      setCoverRemoved(false)
      setError(null)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleRemoveCover = () => {
    setCoverPending(null)
    setCoverRemoved(true)
    setError(null)
  }

  const handleSave = useCallback(async () => {
    if (!window.electronAPI?.writeMetadata || !filePath) return

    setIsSaving(true)
    setError(null)

    try {
      const updates = {}
      for (const key of ['title', 'artist', 'album', 'date', 'genre', 'comment']) {
        const v = metadata[key]
        if (v !== undefined && v !== null) updates[key] = v
      }
      if (metadata.track !== undefined) updates.track = metadata.track === '' ? '' : String(metadata.track)
      if (metadata.disk  !== undefined) updates.disk  = metadata.disk  === '' ? '' : String(metadata.disk)

      await window.electronAPI.writeMetadata(filePath, updates)

      if (coverRemoved) {
        await window.electronAPI.removeCoverArt?.(filePath)
      } else if (coverPending) {
        await window.electronAPI.embedCoverArt?.(filePath, coverPending)
      }

      setSaved(true)
      setIsSaving(false)
      onSaved?.(updates)

      setTimeout(() => {
        setSaved(false)
        onClose()
      }, 450)
    } catch (err) {
      setIsSaving(false)
      setError(`Save failed: ${err.message}`)
    }
  }, [filePath, metadata, coverPending, coverRemoved, onClose, onSaved])

  const activeCoverSrc = coverRemoved ? null : (coverPending || coverArt)

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby={ids.titleLbl}
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
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <h1 id={ids.titleLbl} className="text-sm font-bold text-slate-100 uppercase tracking-wider">Edit Metadata</h1>
              <p className="text-[11px] text-slate-400">ID3 tags, cover art &amp; file info</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close metadata editor"
            className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-white"
          >
            <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSave() }}
          className="px-6 py-5 space-y-5 overflow-y-auto flex-1"
        >
          {error && (
            <div role="alert" className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-[11px] text-red-300">
              {error}
            </div>
          )}

          {/* Text fields grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'title',   label: 'Title',        id: ids.title,   placeholder: 'Track title', autoFocus: true },
              { key: 'artist',  label: 'Artist',       id: ids.artist,  placeholder: 'Artist name' },
              { key: 'album',   label: 'Album',        id: ids.album,   placeholder: 'Album name' },
              { key: 'date',    label: 'Year / Date',  id: ids.date,    placeholder: '2026' },
              { key: 'genre',   label: 'Genre',        id: ids.genre,   placeholder: 'e.g. Podcast' },
              { key: 'comment', label: 'Comment',      id: ids.comment, placeholder: 'Notes…' },
            ].map(field => (
              <div key={field.key} className="flex flex-col gap-1">
                <label htmlFor={field.id} className="field-label">{field.label}</label>
                <input
                  id={field.id}
                  name={field.key}
                  type="text"
                  autoFocus={field.autoFocus}
                  value={metadata[field.key] ?? ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="input-field font-mono text-xs"
                />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.track} className="field-label">Track #</label>
              <input
                id={ids.track}
                name="track"
                type="number"
                min="1"
                value={metadata.track != null ? metadata.track : ''}
                onChange={(e) => handleChange('track', e.target.value)}
                placeholder="1"
                className="input-field font-mono text-xs w-24"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.disk} className="field-label">Disc #</label>
              <input
                id={ids.disk}
                name="disk"
                type="number"
                min="1"
                value={metadata.disk != null ? metadata.disk : ''}
                onChange={(e) => handleChange('disk', e.target.value)}
                placeholder="1"
                className="input-field font-mono text-xs w-24"
              />
            </div>
          </div>

          {/* Cover art */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label htmlFor={ids.cover} className="field-label mb-0">Cover Art</label>
              <button
                type="button"
                onClick={handleRemoveCover}
                disabled={!activeCoverSrc}
                className="btn-ghost px-2 py-1 text-[10px] text-red-400 hover:text-red-300 disabled:opacity-40"
              >
                Remove cover
              </button>
            </div>
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="relative w-24 h-24 rounded-md bg-[#111315] border border-[#323741] overflow-hidden flex-shrink-0">
                {activeCoverSrc ? (
                  <img
                    src={activeCoverSrc}
                    alt="Cover art preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                    <svg aria-hidden="true" className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {coverRemoved && (
                      <span className="text-[10px] text-slate-500">Removed</span>
                    )}
                  </div>
                )}
              </div>

              {/* Upload controls */}
              <div className="flex-1 flex flex-col gap-2">
                <input
                  ref={coverInputRef}
                  id={ids.cover}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="sr-only"
                  onChange={handleCoverChange}
                />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[#111315] hover:bg-[#1a1d22] text-slate-200 text-xs font-medium border border-[#323741] transition-colors cursor-pointer self-start"
                >
                  <svg aria-hidden="true" className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span>Upload cover image</span>
                </button>
                <p className="text-[10px] text-slate-500">
                  PNG or JPG. Max 2 MB. Embedded into the file and preserved on export.
                </p>
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2b2f37]">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              disabled={isSaving}
              className="btn-secondary px-4 py-2 text-xs font-medium disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saved ? '✓ Saved!' : isSaving ? 'Saving…' : 'Save Metadata'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
