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
      waveColor: '#2ec492',
      progressColor: '#58dfaf',
      cursorColor: '#f59e0b',
      cursorWidth: 2,
      barWidth: 0, // continuous DAW waveform
      barGap: 0,
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
        color: 'rgba(56, 189, 248, 0.14)',
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
    <div className="w-full max-w-5xl mx-auto studio-panel rounded-xl p-6 sm:p-8 border border-surface-border shadow-lg relative overflow-hidden">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <AudisLogo variant="light" className="h-6 w-auto" />
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide">
              {fileName}
            </h3>
            <p className="text-[11px] text-slate-500">Interactive Web Demo</p>
          </div>
        </div>

        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#111315] hover:bg-surface-hover text-slate-200 text-sm font-semibold border border-[#343944] transition-all hover:border-brand-500/40">
          <Upload className="w-4 h-4 text-brand-400" />
          <span>Upload Audio to Test</span>
          <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      {/* Waveform Visualization Canvas */}
      <div className="relative bg-[#101214] rounded-md p-4 border border-[#2b2f37] mb-6 daw-waveform-bed">
        {isLoading && (
          <div className="absolute inset-0 bg-[#141619]/80 backdrop-blur-sm flex items-center justify-center z-20">
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
            className="w-10 h-8 rounded border flex items-center justify-center transition-colors cursor-pointer bg-brand-600 hover:bg-brand-500 border-brand-400/40 text-white"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 ml-0.5" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>
          <div>
            <div className="text-xs text-slate-500 font-mono uppercase tracking-wider block">CROP RANGE</div>
            <div className="text-sm font-semibold font-mono text-brand-300">
              {formatTime(cropRegion.start)} → {formatTime(cropRegion.end)}
            </div>
          </div>
        </div>

        {/* Selected Duration Badge */}
        <div className="flex items-center justify-center gap-4 bg-[#121417] rounded-md p-3 border border-[#2a2e36]">
          <div className="text-center">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Trimmed Duration</span>
            <span className="text-base font-bold font-mono text-accent-emerald">
              {formatTime(cropRegion.end - cropRegion.start)}
            </span>
          </div>
        </div>

        {/* Call-to-action banner for desktop app */}
        <div className="bg-[#1c2e24] border border-[#2a4d3a] rounded-md p-3 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-accent-emerald shrink-0" />
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-white">Desktop feature:</span> Auto-stitch intro/outro crossfades in 1-click!
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
