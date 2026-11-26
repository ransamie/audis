/**
 * src/components/Waveform.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Matte Studio Waveform Editor (Adobe Audition / Cakewalk / Audacity inspired).
 *
 * - Continuous DAW phosphor-emerald waveform (`renderLineWaveform`)
 * - Embedded synchronized WaveSurfer Timeline ruler
 * - Red/neutral cut regions with skip-preview & splice auditioning
 * - Full mechanical transport deck + dB center axis
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js'

function formatTime(seconds) {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00.00'
  const m  = Math.floor(seconds / 60)
  const s  = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
}

function getMimeType(filePath = '') {
  const lower = filePath.toLowerCase()
  const ext   = lower.split('.').pop()
  if (ext === 'wav')                           return 'audio/wav'
  if (ext === 'aac' || lower.includes('aac_')) return 'audio/aac'
  if (ext === 'm4a' || ext === 'mp4')          return 'audio/mp4'
  if (ext === 'flac')                          return 'audio/flac'
  if (ext === 'ogg')                           return 'audio/ogg'
  return 'audio/mpeg'
}

function totalCutTime(cuts) {
  if (!cuts) return 0
  return cuts.reduce((acc, c) => {
    if (c.enabled === false) return acc
    const len = Math.max(0, (c.end ?? 0) - (c.start ?? 0))
    const keepPause = c.postPauseSec && len > c.postPauseSec ? c.postPauseSec : 0
    return acc + Math.max(0, len - keepPause)
  }, 0)
}

const CROP_REGION_ID    = 'audis-crop'
const CUT_REGION_PREFIX = 'cut-'

// Cut region colors (crisp DAW markers without blur/glare)
const CUT_COLOR_ENABLED  = 'rgba(220, 38, 38, 0.24)'
const CUT_COLOR_DISABLED = 'rgba(148, 163, 184, 0.12)'
const CUT_COLOR_ACTIVE   = 'rgba(239, 68, 68, 0.45)'

export default function Waveform({
  filePath,
  blobUrl: initialBlobUrl,
  peaks,
  duration: durationProp,
  cuts,
  useIntro,
  useOutro,
  onRegionUpdate,
  onReady,
  onCutsChange,
  onToggleIntro,
  onToggleOutro,
  onApproveAndNext,
}) {
  const containerRef      = useRef(null)
  const wrapperRef        = useRef(null)
  const wavesurferRef     = useRef(null)
  const regionsRef        = useRef(null)
  const cutsRef           = useRef(cuts)
  const isPlayingRef      = useRef(false)
  const auditionStopAtRef = useRef(null)
  const isMultiCutModeRef = useRef(false)

  const [isPlaying,    setIsPlaying]    = useState(false)
  const [isLoading,    setIsLoading]    = useState(true)
  const [isReady,      setIsReady]      = useState(false)
  const [errorMsg,     setErrorMsg]     = useState(null)
  const [currentTime,  setCurrentTime]  = useState(0)
  const [duration,     setDuration]     = useState(0)
  const [zoom,         setZoom]         = useState(0)
  const [regionStart,  setRegionStart]  = useState(0)
  const [regionEnd,    setRegionEnd]    = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeCutId,  setActiveCutId]  = useState(null)

  const isMultiCutMode = cuts !== null && cuts !== undefined
  useEffect(() => { cutsRef.current = cuts }, [cuts])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { isMultiCutModeRef.current = isMultiCutMode }, [isMultiCutMode])

  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFs)
    return () => document.removeEventListener('fullscreenchange', handleFs)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen?.().catch(err => console.warn('Fullscreen error:', err))
    } else {
      document.exitFullscreen?.()
    }
  }, [])

  // ── WaveSurfer init ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || (!filePath && !initialBlobUrl)) return

    let active = true
    let createdObjectUrl = null

    if (wavesurferRef.current) {
      try { wavesurferRef.current.destroy() } catch {}
      wavesurferRef.current = null
    }

    setIsLoading(true)
    setIsReady(false)
    setIsPlaying(false)
    setErrorMsg(null)
    setCurrentTime(0)
    setZoom(0)
    setActiveCutId(null)

    const regionsPlugin = RegionsPlugin.create()
    regionsRef.current  = regionsPlugin

    // Embedded TimelinePlugin auto-scales ticks and syncs scroll/zoom cleanly
    const timelinePlugin = TimelinePlugin.create({
      height:         22,
      insertPosition: 'beforebegin',
      style: {
        fontSize:   '10px',
        color:      '#8b94a5',
        fontFamily: 'JetBrains Mono, monospace',
      },
    })

    // Omit barWidth/barGap so WaveSurfer renders a continuous DAW filled waveform
    const ws = WaveSurfer.create({
      container:     containerRef.current,
      waveColor:     '#2ec492',
      progressColor: '#58dfaf',
      cursorColor:   '#f59e0b',
      cursorWidth:   2,
      height:        'auto',
      normalize:     true,
      interact:      true,
      plugins:       [regionsPlugin, timelinePlugin],
    })

    wavesurferRef.current = ws

    const setupCropRegion = (dur) => {
      if (!active) return
      setIsLoading(false)
      setIsReady(true)
      setDuration(dur)

      if (!isMultiCutModeRef.current) {
        try {
          regionsPlugin.clearRegions()
          regionsPlugin.addRegion({
            id:        CROP_REGION_ID,
            start:     0,
            end:       dur,
            color:     'rgba(56, 189, 248, 0.14)',
            drag:      true,
            resize:    true,
            minLength: 0.5,
          })
        } catch (e) {
          console.warn('Region creation warning:', e)
        }
      }

      setRegionStart(0)
      setRegionEnd(dur)
      onRegionUpdate?.(0, dur, dur)
      onReady?.(dur)
    }

    const loadAudioSource = async () => {
      try {
        let urlToLoad = initialBlobUrl

        if (!urlToLoad && filePath) {
          if (window.electronAPI?.readFileBuffer) {
            const rawBuffer = await window.electronAPI.readFileBuffer(filePath)
            if (!active) return
            const mime = getMimeType(filePath)
            const blob = new Blob([rawBuffer], { type: mime })
            createdObjectUrl = URL.createObjectURL(blob)
            urlToLoad = createdObjectUrl
          } else {
            urlToLoad = filePath
          }
        }

        if (!active) return

        if (peaks?.length && durationProp) {
          await ws.load(urlToLoad, [new Float32Array(peaks)], durationProp)
        } else {
          await ws.load(urlToLoad)
        }
      } catch (err) {
        if (!active) return
        window.electronAPI?.logToMain?.('warn', '[WaveSurfer WebAudio Load failed, attempting FFmpeg repair...]', err?.message)

        if (filePath && window.electronAPI?.repairAudioFile) {
          try {
            const { repairedPath, format } = await window.electronAPI.repairAudioFile(filePath)
            if (!active) return
            if (repairedPath) {
              const rawBuffer = await window.electronAPI.readFileBuffer(repairedPath)
              if (!active) return
              const blob   = new Blob([rawBuffer], { type: format })
              const newUrl = URL.createObjectURL(blob)
              if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl)
              createdObjectUrl = newUrl
              await ws.load(newUrl)
              return
            }
          } catch (ffErr) {
            if (active) {
              setIsLoading(false)
              setErrorMsg(`Repair Failed: ${ffErr?.message}`)
            }
            return
          }
        }

        if (!active) return
        setIsLoading(false)
        setErrorMsg(`Audio Load Failed: ${err?.message || 'Unsupported format or corrupted file.'}`)
      }
    }

    loadAudioSource()

    ws.on('loading', () => setIsLoading(true))
    ws.on('ready', (dur) => {
      if (!active) return
      setupCropRegion(dur)
    })
    ws.on('error', (err) => {
      if (!active) return
      console.warn('[WaveSurfer Error]', err)
    })

    ws.on('audioprocess', (t) => {
      setCurrentTime(t)

      if (auditionStopAtRef.current !== null && t >= auditionStopAtRef.current) {
        auditionStopAtRef.current = null
        try { ws.pause() } catch {}
        return
      }

      const currentCuts = cutsRef.current
      if (currentCuts && isPlayingRef.current) {
        const activeCut = currentCuts.find(
          c => c.enabled !== false && t >= c.start && t < c.end
        )
        if (activeCut) {
          try { ws.setTime(Math.min(ws.getDuration() || activeCut.end, activeCut.end + 0.03)) } catch {}
        }
      }
    })

    ws.on('seek', (pct) => {
      try { setCurrentTime(pct * (ws.getDuration() || 0)) } catch {}
    })
    ws.on('play',   () => setIsPlaying(true))
    ws.on('pause',  () => { auditionStopAtRef.current = null; setIsPlaying(false) })
    ws.on('finish', () => { auditionStopAtRef.current = null; setIsPlaying(false) })

    regionsPlugin.on('region-updated', (region) => {
      if (!active) return
      if (region.id === CROP_REGION_ID) {
        try {
          const start = Math.max(0, region.start)
          const dur   = ws.getDuration()
          const end   = Math.min(dur || Infinity, region.end)
          setRegionStart(start)
          setRegionEnd(end)
          onRegionUpdate?.(start, end, dur)
        } catch {}
        return
      }

      if (region.id.startsWith(CUT_REGION_PREFIX)) {
        const cutId = region.id.slice(CUT_REGION_PREFIX.length)
        const currentCuts = cutsRef.current
        if (!currentCuts) return
        const updated = currentCuts.map(c =>
          c.id === cutId ? { ...c, start: region.start, end: region.end } : c
        )
        onCutsChange?.(updated)
      }
    })

    regionsPlugin.on('region-clicked', (region, e) => {
      if (!active || !region.id.startsWith(CUT_REGION_PREFIX)) return
      e.stopPropagation()

      const cutId = region.id.slice(CUT_REGION_PREFIX.length)
      const currentCuts = cutsRef.current
      if (!currentCuts) return

      const updated = currentCuts.map(c =>
        c.id === cutId ? { ...c, enabled: !c.enabled } : c
      )
      setActiveCutId(cutId)
      onCutsChange?.(updated)
    })

    return () => {
      active = false
      auditionStopAtRef.current = null
      try { ws.destroy() } catch {}
      wavesurferRef.current = null
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, initialBlobUrl])

  // Sync cut regions
  useEffect(() => {
    const rp = regionsRef.current
    const ws = wavesurferRef.current
    if (!rp || !ws || !isReady || !isMultiCutMode) return

    rp.getRegions().forEach(r => {
      if (r.id === CROP_REGION_ID || r.id.startsWith(CUT_REGION_PREFIX)) r.remove()
    })

    if (!cuts) return

    cuts.forEach(cut => {
      const isActive = cut.id === activeCutId
      rp.addRegion({
        id:        `${CUT_REGION_PREFIX}${cut.id}`,
        start:     cut.start,
        end:       cut.end,
        color:     isActive
          ? CUT_COLOR_ACTIVE
          : cut.enabled !== false ? CUT_COLOR_ENABLED : CUT_COLOR_DISABLED,
        drag:      true,
        resize:    true,
        minLength: 0.1,
      })
    })
  }, [cuts, isReady, isMultiCutMode, activeCutId])

  // Zoom slider
  useEffect(() => {
    if (!wavesurferRef.current || !isReady) return
    try {
      if (zoom === 0) {
        const width = containerRef.current.clientWidth
        const dur   = wavesurferRef.current.getDuration()
        wavesurferRef.current.zoom(dur > 0 ? width / dur : 0)
      } else {
        wavesurferRef.current.zoom(zoom)
      }
    } catch (e) {
      console.warn('[WaveSurfer Zoom Error]', e)
    }
  }, [zoom, isReady])

  // Transport helpers
  const togglePlay = useCallback(() => {
    if (!wavesurferRef.current || !isReady) return
    try {
      const ws = wavesurferRef.current
      const current = ws.getCurrentTime()
      if (!isPlayingRef.current && (current < regionStart || current >= regionEnd)) {
        ws.setTime(regionStart)
      }
      ws.playPause()
    } catch (e) {
      console.warn('[WaveSurfer Play Error]', e)
    }
  }, [isReady, regionStart, regionEnd])

  const seekToStart = useCallback(() => {
    if (!wavesurferRef.current || !isReady) return
    try { wavesurferRef.current.setTime(regionStart); setCurrentTime(regionStart) } catch {}
  }, [isReady, regionStart])

  const seekToEnd = useCallback(() => {
    if (!wavesurferRef.current || !isReady) return
    try {
      const t = Math.max(0, regionEnd - 0.5)
      wavesurferRef.current.setTime(t)
      setCurrentTime(t)
    } catch {}
  }, [isReady, regionEnd])

  const nudgeTime = useCallback((delta) => {
    if (!wavesurferRef.current || !isReady) return
    try {
      const dur = wavesurferRef.current.getDuration() || duration || 0
      const next = Math.max(0, Math.min(dur, wavesurferRef.current.getCurrentTime() + delta))
      wavesurferRef.current.setTime(next)
      setCurrentTime(next)
    } catch {}
  }, [isReady, duration])

  const auditionCut = useCallback((cut) => {
    const ws = wavesurferRef.current
    if (!ws || !isReady) return

    setActiveCutId(cut.id)
    const dur      = ws.getDuration() || duration || 0
    const preroll  = 1.5
    const postroll = 1.5
    const startAt  = Math.max(0, cut.start - preroll)
    const stopAt   = Math.min(dur || (cut.end + postroll), cut.end + postroll)

    auditionStopAtRef.current = stopAt
    ws.setTime(startAt)
    ws.play()
  }, [isReady, duration])

  const addCutAtPlayhead = useCallback(() => {
    const ws = wavesurferRef.current
    if (!ws || !isReady || !isMultiCutMode) return
    const dur = ws.getDuration() || duration || 0
    if (dur <= 0.2) return
    const t = ws.getCurrentTime()
    const start = Math.max(0, Number((t - 0.5).toFixed(2)))
    const end   = Math.min(dur, Number((t + 0.5).toFixed(2)))
    if (end - start < 0.1) return
    const newCut = {
      id: `manual_${Date.now()}`,
      start,
      end,
      reason: 'manual_cut',
      confidence: 1.0,
      enabled: true,
    }
    const nextCuts = [...(cutsRef.current || []), newCut].sort((a, b) => a.start - b.start)
    setActiveCutId(newCut.id)
    onCutsChange?.(nextCuts)
  }, [isReady, isMultiCutMode, duration, onCutsChange])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.isComposing || document.querySelector('dialog[open]')) return
      const tag = e.target?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if ((e.code === 'Space' || e.code === 'Enter') && ['BUTTON', 'A'].includes(tag)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlay()
          break
        case 'Tab': {
          e.preventDefault()
          const ws = wavesurferRef.current
          if (!ws || !isReady) break
          const allCuts = cutsRef.current || []
          if (!allCuts.length) break
          const currentIdx = allCuts.findIndex(c => c.id === activeCutId)
          const nextIdx = activeCutId !== null && currentIdx >= 0
            ? (currentIdx + (e.shiftKey ? -1 : 1) + allCuts.length) % allCuts.length
            : 0
          auditionCut(allCuts[nextIdx])
          break
        }
        case 'KeyD':
          e.preventDefault()
          if (activeCutId && cutsRef.current) {
            onCutsChange?.(cutsRef.current.map(c =>
              c.id === activeCutId ? { ...c, enabled: !c.enabled } : c
            ))
          }
          break
        case 'KeyC':
          e.preventDefault()
          addCutAtPlayhead()
          break
        case 'KeyI':
          e.preventDefault()
          onToggleIntro?.()
          break
        case 'KeyO':
          e.preventDefault()
          onToggleOutro?.()
          break
        case 'Enter':
          e.preventDefault()
          onApproveAndNext?.()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, isReady, activeCutId, auditionCut, addCutAtPlayhead, onCutsChange, onToggleIntro, onToggleOutro, onApproveAndNext])

  const filename    = filePath ? filePath.split(/[/\\]/).pop() : 'Untitled Project.wav'
  const enabledCuts = (cuts || []).filter(c => c.enabled !== false)
  const timeSaved   = totalCutTime(cuts)
  const netDuration = Math.max(0, duration - timeSaved)

  return (
    <div
      ref={wrapperRef}
      className={`flex flex-col h-full bg-[#141619] ${isFullscreen ? 'p-4 z-50' : ''}`}
    >
      {/* Editor Top Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#1a1d22] border-b border-[#2b2f37] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex-shrink-0">
            Waveform Editor
          </h1>
          <span className="text-[#363c48]" aria-hidden="true">|</span>
          <span className="text-xs font-mono text-slate-200 truncate" title={filename}>
            {filename}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isMultiCutMode && isReady && (
            <>
              <button
                type="button"
                onClick={addCutAtPlayhead}
                className="btn-secondary text-[11px] py-1 px-2.5"
                title="Mark 1s cut around playhead (C)"
              >
                + Cut Here
              </button>
              {activeCutId && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const active = (cuts || []).find(c => c.id === activeCutId)
                      if (active) auditionCut(active)
                    }}
                    className="btn-secondary text-[11px] py-1 px-2.5"
                    title="Audition splice transition (Tab)"
                  >
                    Audition Splice
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!cutsRef.current) return
                      onCutsChange?.(cutsRef.current.map(c =>
                        c.id === activeCutId ? { ...c, enabled: !c.enabled } : c
                      ))
                    }}
                    className="btn-secondary text-[11px] py-1 px-2.5"
                    title="Toggle cut active/bypassed (D)"
                  >
                    Toggle Cut
                  </button>
                </>
              )}
              <span className="text-[#363c48] mx-0.5" aria-hidden="true">|</span>
            </>
          )}

          {isMultiCutMode && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleIntro}
                aria-pressed={useIntro}
                title="Toggle Intro (I)"
                className={[
                  'px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer',
                  useIntro
                    ? 'bg-brand-600/25 border-brand-500/60 text-brand-200'
                    : 'bg-[#141619] border-[#2e323a] text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                Intro: {useIntro ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={onToggleOutro}
                aria-pressed={useOutro}
                title="Toggle Outro (O)"
                className={[
                  'px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer',
                  useOutro
                    ? 'bg-brand-600/25 border-brand-500/60 text-brand-200'
                    : 'bg-[#141619] border-[#2e323a] text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                Outro: {useOutro ? 'ON' : 'OFF'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Waveform Bed with dB Ruler Gutter */}
      <div className="relative flex-1 flex overflow-hidden daw-waveform-bed">

        {/* Left amplitude scale gutter (Audition / Audacity style) */}
        <div
          aria-hidden="true"
          className="w-9 flex-shrink-0 bg-[#17191d] border-r border-[#2b2f37] flex flex-col justify-between py-7 px-1 text-[9px] font-mono text-slate-500 select-none text-right"
        >
          <span>0dB</span>
          <span>-6</span>
          <span className="text-slate-400">-∞</span>
          <span>-6</span>
          <span>0dB</span>
        </div>

        {/* Waveform Stage */}
        <div
          className="relative flex-1 flex flex-col overflow-hidden"
          style={{
            '--region-start-time': `'${formatTime(regionStart)}'`,
            '--region-end-time':   `'${formatTime(regionEnd)}'`,
          }}
        >
          {/* Center 0-line axis */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-[calc(50%+11px)] h-px bg-white/[0.08] z-0"
          />

          {/* Analyzing overlay */}
          {cuts === null && isReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#141619]/80 z-30 pointer-events-none">
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium text-slate-300">Scanning waveform &amp; silences…</p>
            </div>
          )}

          {/* Loading overlay */}
          {isLoading && !errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#101214]/95 z-20">
              <div className="w-5 h-5 border-2 border-accent-emerald border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium text-slate-400">
                {peaks?.length && durationProp ? 'Rendering peaks…' : 'Decoding audio…'}
              </p>
            </div>
          )}

          {/* Error message */}
          {errorMsg && (
            <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-[#1a1416] z-20 text-center">
              <p className="text-xs font-semibold text-red-400">{errorMsg}</p>
              <p className="text-[11px] text-slate-400 mt-1">Verify the file exists and is a valid audio format.</p>
            </div>
          )}

          {/* WaveSurfer Mount (TimelinePlugin prepends inside #waveform) */}
          <div ref={containerRef} id="waveform" className="w-full h-full flex-1 z-10" />

          {/* Digital Timecode HUD (bottom corners of lane) */}
          {isReady && (
            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
              <span className="px-2 py-0.5 rounded bg-[#141619]/90 border border-[#2c3038] text-[11px] font-mono font-semibold text-accent-amber">
                {formatTime(currentTime)}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#141619]/90 border border-[#2c3038] text-[11px] font-mono text-slate-400">
                {formatTime(duration)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom DAW Transport & Selection Telemetry Bar */}
      <div className="flex-shrink-0 px-4 py-2.5 bg-[#1a1d22] border-t border-[#2b2f37] flex items-center justify-between gap-4">

        {/* Left: Telemetry Readout */}
        <div className="flex items-center gap-3 text-xs font-mono">
          {isMultiCutMode ? (
            <>
              <div className="px-2.5 py-1 rounded bg-[#121417] border border-[#2a2e36]">
                <span className="text-[10px] text-slate-500 uppercase mr-1.5">Cuts</span>
                <span className="text-slate-100 font-semibold">{enabledCuts.length}</span>
              </div>
              <div className="px-2.5 py-1 rounded bg-[#121417] border border-[#2a2e36]">
                <span className="text-[10px] text-slate-500 uppercase mr-1.5">Saved</span>
                <span className="text-accent-red font-semibold">−{formatTime(timeSaved)}</span>
              </div>
              <div className="px-2.5 py-1 rounded bg-[#121417] border border-[#2a2e36]">
                <span className="text-[10px] text-slate-500 uppercase mr-1.5">Net</span>
                <span className="text-accent-emerald font-semibold">{formatTime(netDuration)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="px-2.5 py-1 rounded bg-[#121417] border border-[#2a2e36]">
                <span className="text-[10px] text-slate-500 uppercase mr-1.5">In</span>
                <span className="text-slate-100 font-semibold">{formatTime(regionStart)}</span>
              </div>
              <div className="px-2.5 py-1 rounded bg-[#121417] border border-[#2a2e36]">
                <span className="text-[10px] text-slate-500 uppercase mr-1.5">Out</span>
                <span className="text-slate-100 font-semibold">{formatTime(regionEnd)}</span>
              </div>
            </>
          )}
        </div>

        {/* Center: Hardware-Style Transport Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={seekToStart}
            disabled={!isReady}
            aria-label="Jump to start"
            title="Jump to start"
            className="w-8 h-8 rounded bg-[#22262d] hover:bg-[#2c313b] border border-[#343944] flex items-center justify-center text-slate-300 disabled:opacity-40 cursor-pointer"
          >
            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => nudgeTime(-5)}
            disabled={!isReady}
            aria-label="Rewind 5 seconds"
            title="Rewind 5s"
            className="px-2 h-8 rounded bg-[#22262d] hover:bg-[#2c313b] border border-[#343944] text-[10px] font-mono text-slate-300 disabled:opacity-40 cursor-pointer"
          >
            -5s
          </button>

          <button
            type="button"
            onClick={togglePlay}
            disabled={!isReady}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause (Space)' : 'Play edited preview (Space)'}
            className={[
              'w-10 h-8 rounded border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40',
              isPlaying
                ? 'bg-accent-amber border-amber-400 text-[#141619]'
                : 'bg-brand-600 hover:bg-brand-500 border-brand-400/40 text-white',
            ].join(' ')}
          >
            {isPlaying ? (
              <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg aria-hidden="true" className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={() => nudgeTime(5)}
            disabled={!isReady}
            aria-label="Forward 5 seconds"
            title="Forward 5s"
            className="px-2 h-8 rounded bg-[#22262d] hover:bg-[#2c313b] border border-[#343944] text-[10px] font-mono text-slate-300 disabled:opacity-40 cursor-pointer"
          >
            +5s
          </button>

          <button
            type="button"
            onClick={seekToEnd}
            disabled={!isReady}
            aria-label="Jump to end"
            title="Jump to end"
            className="w-8 h-8 rounded bg-[#22262d] hover:bg-[#2c313b] border border-[#343944] flex items-center justify-center text-slate-300 disabled:opacity-40 cursor-pointer"
          >
            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* Right: Zoom & Fullscreen */}
        <div className="flex items-center gap-2.5 text-xs text-slate-400">
          <label htmlFor="waveform-zoom" className="sr-only">Waveform Zoom</label>
          <svg aria-hidden="true" className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            id="waveform-zoom"
            type="range"
            min="0"
            max="200"
            step="5"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-24 accent-brand-500 cursor-pointer"
          />
          <span className="w-11 text-right font-mono text-[10px] text-slate-400">
            {zoom === 0 ? 'Fit' : `${zoom}px`}
          </span>
          <button
            type="button"
            onClick={() => setZoom(0)}
            className="btn-secondary text-[10px] py-1 px-2"
            title="Fit entire waveform to view"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toggle Fullscreen"
            title="Toggle Fullscreen"
            className="btn-secondary p-1.5"
          >
            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
