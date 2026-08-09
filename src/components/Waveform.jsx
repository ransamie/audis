/**
 * src/components/Waveform.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Audio waveform visualizer with interactive crop region.
 *
 * Supports Web Audio decoding + FFmpeg peak extraction fallback for
 * non-standard or container-mismatched files (AAC, M4A, FLAC, etc.).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js'

// Format seconds → M:SS.ms
function formatTime (seconds) {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00.00'
  const m  = Math.floor(seconds / 60)
  const s  = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
}

// Detect MIME type based on file extension and filename
function getMimeType(filePath = '') {
  const lower = filePath.toLowerCase()
  const ext = lower.split('.').pop()
  if (ext === 'wav') return 'audio/wav'
  if (ext === 'aac' || lower.includes('aac_')) return 'audio/aac'
  if (ext === 'm4a' || ext === 'mp4') return 'audio/mp4'
  if (ext === 'flac') return 'audio/flac'
  if (ext === 'ogg') return 'audio/ogg'
  return 'audio/mpeg'
}

const CROP_REGION_ID = 'audis-crop'

export default function Waveform ({ filePath, blobUrl: initialBlobUrl, onRegionUpdate, onReady }) {
  const containerRef  = useRef(null)
  const wrapperRef    = useRef(null)
  const timelineRef   = useRef(null)
  const wavesurferRef = useRef(null)
  const regionsRef    = useRef(null)

  const [isPlaying,   setIsPlaying]   = useState(false)
  const [isLoading,   setIsLoading]   = useState(true)
  const [isReady,     setIsReady]     = useState(false)
  const [errorMsg,    setErrorMsg]    = useState(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [zoom,        setZoom]        = useState(0) // 0 means fit-to-screen
  const [regionStart, setRegionStart] = useState(0)
  const [regionEnd,   setRegionEnd]   = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Fullscreen listener
  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFs)
    return () => document.removeEventListener('fullscreenchange', handleFs)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen?.().catch(err => {
        console.warn('Fullscreen error:', err)
      })
    } else {
      document.exitFullscreen?.()
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current || (!filePath && !initialBlobUrl)) return

    let active = true
    let createdObjectUrl = null

    // Destroy existing WaveSurfer instance
    if (wavesurferRef.current) {
      try { wavesurferRef.current.destroy() } catch {}
      wavesurferRef.current = null
    }

    setIsLoading(true)
    setIsReady(false)
    setIsPlaying(false)
    setErrorMsg(null)
    setCurrentTime(0)

    // Instantiate WaveSurfer & Regions
    const regionsPlugin = RegionsPlugin.create()
    regionsRef.current  = regionsPlugin

    const timelinePlugin = TimelinePlugin.create({
      container: timelineRef.current,
      height: 24,
      timeInterval: 30, // tick every 30 seconds
      primaryLabelInterval: 1, // label every tick
      style: {
        fontSize: '10px',
        color: '#64748b',
        fontFamily: 'monospace'
      }
    })

    const ws = WaveSurfer.create({
      container:     containerRef.current,
      waveColor:     '#1e4055',        // Dark teal for unselected waveform
      progressColor: '#1e4055',        
      cursorColor:   '#f59e0b',        // Bright amber for high contrast
      cursorWidth:   2,
      barWidth:      2,
      barGap:        1,
      barRadius:     2,
      height:        'auto',           
      normalize:     true,
      interact:      true,
      plugins:       [regionsPlugin, timelinePlugin],
    })

    wavesurferRef.current = ws

    // Helper to setup region once duration is known
    const setupRegion = (dur) => {
      if (!active) return
      setIsLoading(false)
      setIsReady(true)
      setDuration(dur)

      try {
        regionsPlugin.clearRegions()
        const region = regionsPlugin.addRegion({
          id:        CROP_REGION_ID,
          start:     0,
          end:       dur,
          color:     'rgba(0, 216, 255, 0.15)', // Cyan overlay
          drag:      true,
          resize:    true,
          minLength: 0.5,
        })
      } catch (e) {
        console.warn('Region creation warning:', e)
      }

      setRegionStart(0)
      setRegionEnd(dur)
      onRegionUpdate?.(0, dur, dur)
      onReady?.(dur)
    }


    // Load Audio Source
    const loadAudioSource = async () => {
      try {
        let urlToLoad = initialBlobUrl

        // If no initial Blob URL provided, read file via IPC and convert to Blob URL with correct MIME type
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

        // Pass URL to WaveSurfer
        await ws.load(urlToLoad)
      } catch (err) {
        if (!active) return
        window.electronAPI?.logToMain?.('warn', '[WaveSurfer WebAudio Load failed, attempting FFmpeg Peak fallback...]', err?.message)
        console.warn('[WaveSurfer WebAudio Load failed, attempting FFmpeg Peak fallback...]', err, err.message)

        // FFmpeg Repair Fallback for AAC/M4A/Corrupt containers
        if (filePath && window.electronAPI?.repairAudioFile) {
          try {
            window.electronAPI?.logToMain?.('log', '[Waveform] Attempting to repair file via FFmpeg:', filePath)
            const { repairedPath, format } = await window.electronAPI.repairAudioFile(filePath)
            if (!active) return

            if (repairedPath) {
              window.electronAPI?.logToMain?.('log', '[Waveform] Repair successful, reading repaired buffer', repairedPath)
              const rawBuffer = await window.electronAPI.readFileBuffer(repairedPath)
              if (!active) return
              
              const blob = new Blob([rawBuffer], { type: format })
              const newUrl = URL.createObjectURL(blob)
              if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl)
              createdObjectUrl = newUrl
              
              await ws.load(newUrl)
              window.electronAPI?.logToMain?.('log', '[Waveform] Repaired file loaded successfully')
              return // Return here. ws.on('ready') will handle the rest.
            }
          } catch (ffErr) {
            window.electronAPI?.logToMain?.('error', '[FFmpeg Repair Error]', ffErr?.message)
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

    // Event listeners
    ws.on('loading', () => setIsLoading(true))

    ws.on('ready', (dur) => {
      if (!active) return
      setupRegion(dur)
    })

    ws.on('error', (err) => {
      if (!active) return
      window.electronAPI?.logToMain?.('warn', '[WaveSurfer Error Event]', err?.message || err)
      console.warn('[WaveSurfer Error Event]', err)
      // Note: We don't set errorMsg here because the `loadAudioSource` catch block handles initial load failures.
    })

    ws.on('audioprocess', (t) => setCurrentTime(t))
    ws.on('seek', (pct) => {
      try { setCurrentTime(pct * (ws.getDuration() || 0)) } catch {}
    })
    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => setIsPlaying(false))

    // Handle region movements
    regionsPlugin.on('region-updated', (region) => {
      if (!active || region.id !== CROP_REGION_ID) return
      try {
        const start = Math.max(0, region.start)
        const dur = ws.getDuration()
        const end   = Math.min(dur || Infinity, region.end)
        setRegionStart(start)
        setRegionEnd(end)
        onRegionUpdate?.(start, end, dur)
      } catch {}
    })

    return () => {
      active = false
      try { ws.destroy() } catch {}
      wavesurferRef.current = null
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl)
      }
    }
  }, [filePath, initialBlobUrl])

  // Zoom slider
  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      try {
        if (zoom === 0) {
          // Fit to screen (default minPxPerSec is container width / duration)
          const width = containerRef.current.clientWidth
          const dur = wavesurferRef.current.getDuration()
          wavesurferRef.current.zoom(dur > 0 ? width / dur : 0)
        } else {
          // Zoom in
          wavesurferRef.current.zoom(zoom)
        }
      } catch (e) {
        console.warn('[WaveSurfer Zoom Error]', e)
      }
    }
  }, [zoom, isReady])

  // Transport controls
  const togglePlay = useCallback(() => {
    if (!wavesurferRef.current || !isReady) return
    try {
      const current = wavesurferRef.current.getCurrentTime()
      const ws = wavesurferRef.current

      if (!isPlaying) {
        if (current < regionStart || current >= regionEnd) {
          ws.setTime(regionStart)
        }
      }
      ws.playPause()
    } catch (e) {
      console.warn('[WaveSurfer Play Error]', e)
    }
  }, [isReady, isPlaying, regionStart, regionEnd])

  // Spacebar Play/Pause
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      
      if (e.code === 'Space') {
        e.preventDefault() // prevent page scroll
        togglePlay()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay])

  const seekToStart = useCallback(() => {
    if (!wavesurferRef.current || !isReady) return
    try { wavesurferRef.current.setTime(regionStart) } catch {}
  }, [isReady, regionStart])

  const seekToEnd = useCallback(() => {
    if (!wavesurferRef.current || !isReady) return
    try { wavesurferRef.current.setTime(Math.max(0, regionEnd - 0.5)) } catch {}
  }, [isReady, regionEnd])

  const hasCropped = regionStart > 0 || regionEnd < (duration - 0.5)
  const filename = filePath ? filePath.split(/[\\/]/).pop() : 'Untitled Project.wav'

  return (
    <div 
      ref={wrapperRef}
      className={`waveform-editor-wrapper flex flex-col h-full animate-fade-in space-y-4 ${
        isFullscreen ? 'bg-[#0d0d14] p-6 z-50' : ''
      }`}
    >
      {/* Waveform Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="10" width="2" height="4" rx="1"/>
            <rect x="6" y="8" width="2" height="8" rx="1"/>
            <rect x="10" y="4" width="2" height="16" rx="1"/>
            <rect x="14" y="6" width="2" height="12" rx="1"/>
            <rect x="18" y="9" width="2" height="6" rx="1"/>
            <rect x="22" y="11" width="2" height="2" rx="1"/>
          </svg>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Waveform Crop Editor</h1>
            <p className="text-xs text-slate-400 mt-0.5">{filename}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button className="w-9 h-9 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="px-2">
        <div ref={timelineRef} className="w-full" />
      </div>

      {/* Waveform container */}
      <div 
        className="relative rounded-xl overflow-hidden bg-[#10141a] p-2 flex-1 flex flex-col justify-center border-t border-b border-white/5"
        style={{ '--region-start-time': `'${formatTime(regionStart)}'`, '--region-end-time': `'${formatTime(regionEnd)}'` }}
      >

        {/* Instructional Helper Overlay */}
        {isReady && !hasCropped && !isPlaying && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 shadow-2xl animate-pulse-slow flex items-center gap-3">
              <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="text-sm font-bold text-white tracking-wide">Drag the left & right edges to select crop region</span>
            </div>
          </div>
        )}

        {/* Loading Spinner Overlay */}
        {isLoading && !errorMsg && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-base/90 z-20 backdrop-blur-xs">
            <div className="w-9 h-9 rounded-full border-3 border-brand-500 border-t-transparent animate-spin" />
            <p className="text-xs font-semibold text-brand-300">Decoding Waveform Audio…</p>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-red-500/10 z-20 text-center">
            <p className="text-xs font-bold text-red-400">{errorMsg}</p>
            <p className="text-[11px] text-slate-400 mt-1">Please try re-dropping or choosing a valid audio file.</p>
          </div>
        )}

        {/* WaveSurfer mount point */}
        <div ref={containerRef} id="waveform" className="w-full h-full flex-1" />

        {/* Time overlay */}
        {isReady && (
          <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between pointer-events-none">
            <span className="text-xs font-mono font-bold text-cyan-400">{formatTime(currentTime)}</span>
            <span className="text-xs font-mono text-slate-400">{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {/* Transport & Zoom Controls */}
      {isReady && (
        <div className="flex items-center justify-between px-2 pt-2">
          
          {/* Left: Crop Stats Panels */}
          <div className="flex items-center gap-3">
            <div className="bg-[#1a1a24] border border-white/5 rounded-lg px-4 py-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Crop In</p>
              <p className="text-sm font-mono font-bold text-white">{formatTime(regionStart)}</p>
            </div>
            <div className="bg-[#1a1a24] border border-brand-500/30 rounded-lg px-4 py-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Selected Length</p>
              <p className="text-sm font-mono font-bold text-cyan-400">{formatTime(regionEnd - regionStart)}</p>
            </div>
            <div className="bg-[#1a1a24] border border-white/5 rounded-lg px-4 py-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Crop Out</p>
              <p className="text-sm font-mono font-bold text-white">{formatTime(regionEnd)}</p>
            </div>
          </div>

          {/* Center: Playback Transport */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={seekToStart}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors"
              title="Jump to Crop In"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-[#9d4edd] hover:bg-[#b565f6] active:scale-95 flex items-center justify-center transition-all duration-150 shadow-lg shadow-purple-500/20 cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play from Crop In'}
            >
              {isPlaying ? (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={seekToEnd}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors"
              title="Jump to Crop Out"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zm2.5-6L6 6v12l8.5-6zm8-7h2v12h-2z" />
              </svg>
            </button>
          </div>

          {/* Right: Zoom & Fullscreen Controls */}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
              </svg>
              <input
                type="range"
                min="0"
                max="200"
                step="5"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="zoom-slider w-28 h-1.5 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#9d4edd] [&::-webkit-slider-thumb]:rounded-sm"
                title="Zoom waveform"
                style={{ background: `linear-gradient(to right, #9d4edd ${(zoom/200)*100}%, #1e293b ${(zoom/200)*100}%)` }}
              />
              <span className="w-14 text-right font-mono text-[10px] text-slate-500">Zoom {zoom === 0 ? 'Fit' : `${zoom}%`}</span>
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="btn-ghost px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors flex items-center gap-2"
              title="Toggle Fullscreen"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span className="font-medium">Fit</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
