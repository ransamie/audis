import React, { useState, useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import AudisLogo from './Logo'
import { Play, Pause, Upload, CheckCircle2, Sparkles, Volume2, ShieldCheck, Cpu } from 'lucide-react'

function formatTime(seconds) {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00.00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
}

export default function InteractiveDemo() {
  const [audioUrl, setAudioUrl] = useState(null)
  const [fileName, setFileName] = useState('Sample_Podcast_Episode.mp3')
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(45)
  const [cropRegion, setCropRegion] = useState({ start: 5, end: 35 })
  const [isLoading, setIsLoading] = useState(false)

  const containerRef = useRef(null)
  const wavesurferRef = useRef(null)
  const regionsRef = useRef(null)

  // Initialize WaveSurfer on container ready
  useEffect(() => {
    if (!containerRef.current) return

    const regionsPlugin = RegionsPlugin.create()
    regionsRef.current = regionsPlugin

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#1e3a4c',
      progressColor: '#14b8a6',
      cursorColor: '#f59e0b',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 120,
      normalize: true,
      plugins: [regionsPlugin]
    })

    wavesurferRef.current = ws

    ws.on('ready', (dur) => {
      setDuration(dur)
      setIsLoading(false)
      regionsPlugin.clearRegions()
      const endVal = Math.min(dur, dur * 0.8)
      const region = regionsPlugin.addRegion({
        id: 'demo-region',
        start: dur * 0.1,
        end: endVal,
        color: 'rgba(20, 184, 166, 0.2)',
        drag: true,
        resize: true
      })
      setCropRegion({ start: dur * 0.1, end: endVal })
    })

    regionsPlugin.on('region-updated', (region) => {
      setCropRegion({ start: region.start, end: region.end })
    })

    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => setIsPlaying(false))

    // Default sample sound signal (synthesized audio buffer if no file uploaded)
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 20, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < buffer.length; i++) {
      data[i] = Math.sin(i * 0.05) * Math.exp(-i / (ctx.sampleRate * 2)) * 0.5
    }
    
    // Load synthesized demo sound or uploaded file
    if (audioUrl) {
      ws.load(audioUrl)
    } else {
      // Create object URL from audio buffer
      const wavData = createWavBlob(buffer)
      const defaultUrl = URL.createObjectURL(wavData)
      ws.load(defaultUrl)
    }

    return () => {
      try { ws.destroy() } catch {}
    }
  }, [audioUrl])

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setIsLoading(true)
    const url = URL.createObjectURL(file)
    setAudioUrl(url)
  }

  const togglePlay = () => {
    if (!wavesurferRef.current) return
    wavesurferRef.current.playPause()
  }

  return (
    <div className="w-full max-w-5xl mx-auto glass-card rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden">
      {/* Background glow accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 blur-3xl pointer-events-none rounded-full" />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <AudisLogo variant="light" className="h-6 w-auto" />
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide">
              {fileName}
            </h3>
            <p className="text-[11px] text-slate-400">Interactive Web Demo</p>
          </div>
        </div>

        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-sm font-semibold border border-white/10 transition-all hover:border-brand-500/40">
          <Upload className="w-4 h-4 text-brand-400" />
          <span>Upload Audio to Test</span>
          <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      {/* Waveform Visualization Canvas */}
      <div className="relative bg-[#0a0a10] rounded-xl p-4 border border-white/5 mb-6">
        {isLoading && (
          <div className="absolute inset-0 bg-[#0d0d14]/80 backdrop-blur-xs flex items-center justify-center z-20">
            <span className="text-sm font-medium text-brand-300 animate-pulse">Loading Waveform...</span>
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>

      {/* Control Bar & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Playback Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-brand-500 hover:bg-brand-400 text-slate-950 flex items-center justify-center transition-all shadow-lg shadow-brand-500/25 hover:scale-105 active:scale-95"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          <div>
            <div className="text-xs text-slate-400 font-mono">CROP RANGE</div>
            <div className="text-sm font-semibold font-mono text-brand-300">
              {formatTime(cropRegion.start)} → {formatTime(cropRegion.end)}
            </div>
          </div>
        </div>

        {/* Selected Duration Badge */}
        <div className="flex items-center justify-center gap-4 bg-white/5 rounded-xl p-3 border border-white/5">
          <div className="text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Trimmed Duration</span>
            <span className="text-base font-bold font-mono text-cyan-300">
              {formatTime(cropRegion.end - cropRegion.start)}
            </span>
          </div>
        </div>

        {/* Call-to-action banner for desktop app */}
        <div className="bg-brand-900/30 border border-brand-500/30 rounded-xl p-3 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-brand-400 shrink-0" />
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-white">Main software feature:</span> Auto-stitching intro/outro crossfades in 1-click on desktop!
          </div>
        </div>
      </div>
    </div>
  )
}

// Utility to create a simple WAV Blob for synthesized demo audio
function createWavBlob(audioBuffer) {
  const numOfChan = audioBuffer.numberOfChannels
  const length = audioBuffer.length * numOfChan * 2 + 44
  const out = new DataView(new ArrayBuffer(length))
  let pos = 0

  function writeString(str) {
    for (let i = 0; i < str.length; i++) {
      out.setUint8(pos++, str.charCodeAt(i))
    }
  }

  function writeUint32(data) {
    out.setUint32(pos, data, true)
    pos += 4
  }

  function writeUint16(data) {
    out.setUint16(pos, data, true)
    pos += 2
  }

  writeString('RIFF')
  writeUint32(length - 8)
  writeString('WAVE')
  writeString('fmt ')
  writeUint32(16)
  writeUint16(1)
  writeUint16(numOfChan)
  writeUint32(audioBuffer.sampleRate)
  writeUint32(audioBuffer.sampleRate * 2 * numOfChan)
  writeUint16(numOfChan * 2)
  writeUint16(16)
  writeString('data')
  writeUint32(length - pos - 4)

  const channelData = audioBuffer.getChannelData(0)
  for (let i = 0; i < channelData.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]))
    out.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
    pos += 2
  }

  return new Blob([out.buffer], { type: 'audio/wav' })
}
