import React from 'react'
import AudisLogo from './components/Logo'
import InteractiveDemo from './components/InteractiveDemo'
import { useLatestRelease } from './hooks/useLatestRelease'
import {
  Download,
  Sparkles,
  Zap,
  Layers,
  Sliders,
  ShieldCheck,
  AudioWaveform,
  Monitor,
  Apple,
  Clock,
  Play,
} from 'lucide-react'

export default function App() {
  const { urls } = useLatestRelease()

  return (
    <div className="min-h-screen bg-surface-base text-slate-100 font-sans selection:bg-brand-500/30 selection:text-brand-300 relative overflow-x-hidden">

      {/* Subtle decorative glows (toned down, matte) */}
      <div className="gradient-glow top-0 left-1/4 w-[600px] h-[600px] bg-brand-500" />
      <div className="gradient-glow top-1/3 right-10 w-[500px] h-[500px] bg-accent-cyan" />
      <div className="gradient-glow bottom-10 left-1/3 w-[600px] h-[600px] bg-surface-card" />

      {/* Fixed Sticky Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-surface-border bg-surface-base/90 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AudisLogo className="h-8 w-auto" variant="light" />
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-brand-300 transition-colors">Features</a>
            <a href="#demo" className="hover:text-brand-300 transition-colors flex items-center gap-1.5 font-semibold text-brand-400">
              <Sparkles className="w-4 h-4" />
              <span>Test It Now</span>
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="#download"
              className="btn-primary"
            >
              <Download className="w-4 h-4" />
              <span>Download Desktop App</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 sm:pt-28 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-600/10 border border-brand-500/20 text-brand-300 text-[11px] font-semibold uppercase tracking-wider mb-8">
          <Sparkles className="w-3 h-3 text-brand-400" />
          <span>Batch Audio Workstation · Desktop App</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
          Stitch Intros, Outros & Crop Audio in <span className="gradient-text">1-Click</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Process batches of recordings in a DAW-style workstation. Audis auto-detects silences,
          flags cut regions, and stitches your brand intro & outro with precision crossfades — no
          hours wasted in complex DAWs.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={urls.windows}
            className="btn-primary w-full sm:w-auto"
          >
            <Monitor className="w-4 h-4" />
            <span>Windows (.exe)</span>
          </a>
          <a
            href={urls.macos}
            className="btn-secondary w-full sm:w-auto"
          >
            <Apple className="w-4 h-4 text-accent-cyan" />
            <span>macOS (.dmg)</span>
          </a>
          <a
            href={urls.linux}
            className="btn-secondary w-full sm:w-auto"
          >
            <Download className="w-4 h-4 text-accent-emerald" />
            <span>Linux (.AppImage)</span>
          </a>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-brand-400" /> Free & Open Source</span>
          <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-accent-cyan" /> Official Release v1.0.0</span>
          <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-accent-amber" /> Powered by FFmpeg</span>
        </div>
      </section>

      {/* Interactive Showcase Section (Test it Now) */}
      <section id="demo" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-surface-border">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Experience the <span className="gradient-text">DAW-Style Interface</span> Live
          </h2>
          <p className="mt-3 text-slate-400 text-base max-w-xl mx-auto">
            Test the waveform cropper and transport controls in your browser. Drag region handles,
            audition cuts, and preview the batch workflow.
          </p>
        </div>

        <InteractiveDemo />
      </section>

      {/* Feature Cards Grid */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-surface-border">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-400">Why Choose Audis</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
            Built for Batch Audio Production
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="studio-panel rounded-xl p-6">
            <div className="w-10 h-10 rounded-lg bg-brand-600/10 border border-brand-500/20 flex items-center justify-center mb-5">
              <Sliders className="w-5 h-5 text-brand-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Batch Queue</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Drop multiple MP3, WAV, AAC, FLAC, or M4A files into the Files Bin. Each track gets
              its own analysis, cut review, and export status — process them one by one or all at once.
            </p>
          </div>

          <div className="studio-panel rounded-xl p-6">
            <div className="w-10 h-10 rounded-lg bg-accent-emerald/10 border border-accent-emerald/20 flex items-center justify-center mb-5">
              <Zap className="w-5 h-5 text-accent-emerald" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Smart Silence Detection</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Audis scans for leading/trailing silence, long pauses, and filler, then flags cut
              regions with confidence scores. One click auto-approves every clean track.
            </p>
          </div>

          <div className="studio-panel rounded-xl p-6">
            <div className="w-10 h-10 rounded-lg bg-accent-amber/10 border border-accent-amber/20 flex items-center justify-center mb-5">
              <AudioWaveform className="w-5 h-5 text-accent-amber" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Waveform Editor</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Visual cut regions, transport deck (play / ±5s / jump), zoom slider, dB ruler, and
              fullscreen auditioning — straight from Audacity, Cakewalk & Adobe Audition.
            </p>
          </div>

          <div className="studio-panel rounded-xl p-6">
            <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center mb-5">
              <Layers className="w-5 h-5 text-accent-cyan" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Crossfade & Loudness</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Configurable crossfades between intro, main, and outro. Optional -16 LUFS loudness
              normalization and export to MP3, WAV, AAC, or FLAC without re-en coding quality loss.
            </p>
          </div>

          <div className="studio-panel rounded-xl p-6">
            <div className="w-10 h-10 rounded-lg bg-brand-600/10 border border-brand-500/20 flex items-center justify-center mb-5">
              <Play className="w-5 h-5 text-brand-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Intro / Outro Presets</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Set your brand intro & outro paths once in Settings. Audis remembers them and lets you
              toggle per-track with a single keypress (I / O).
            </p>
          </div>

          <div className="studio-panel rounded-xl p-6">
            <div className="w-10 h-10 rounded-lg bg-surface-hover border border-surface-border flex items-center justify-center mb-5">
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Keyboard-First</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Space to play, C to add a cut, D to toggle, I/O for intro/outro, Enter to approve,
              Esc to skip, and ⌘/Ctrl+Z to undo. Built for speed, not clicking.
            </p>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-surface-border">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-400">Streamlined Workflow</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
            3 Steps to Finalized Audio
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="studio-panel rounded-xl p-6 text-center relative">
            <div className="w-10 h-10 rounded-full bg-brand-600 text-surface-base font-black text-lg flex items-center justify-center mx-auto mb-5">
              1
            </div>
            <h3 className="text-base font-bold text-white mb-2">Drop Your Files</h3>
            <p className="text-sm text-slate-400">
              Drag and drop a batch of recordings into the Files Bin. Audis queues each one for
              silence analysis.
            </p>
          </div>

          <div className="studio-panel rounded-xl p-6 text-center relative">
            <div className="w-10 h-10 rounded-full bg-accent-amber text-surface-base font-black text-lg flex items-center justify-center mx-auto mb-5">
              2
            </div>
            <h3 className="text-base font-bold text-white mb-2">Review Detected Cuts</h3>
            <p className="text-sm text-slate-400">
              Audis flags silence and pause regions. Toggle, trim, or audition each cut in the
              waveform editor before committing.
            </p>
          </div>

          <div className="studio-panel rounded-xl p-6 text-center relative">
            <div className="w-10 h-10 rounded-full bg-accent-emerald text-surface-base font-black text-lg flex items-center justify-center mx-auto mb-5">
              3
            </div>
            <h3 className="text-base font-bold text-white mb-2">Batch Export</h3>
            <p className="text-sm text-slate-400">
              Approve each track and Audis stitches intro + main + outro with crossfades into your
              output folder — all without re-encoding quality loss.
            </p>
          </div>
        </div>
      </section>

      {/* Download CTA Section */}
      <section id="download" className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="studio-panel rounded-2xl p-10 sm:p-16 border border-brand-500/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-brand-500/5 pointer-events-none" />
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4">
            Ready to Accelerate Your Audio Pipeline?
          </h2>
          <p className="text-slate-300 text-lg max-w-xl mx-auto mb-10">
            Select your platform below to download Audis v1.1.0 directly.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-2xl mx-auto">
            <a
              href={urls.windows}
              className="btn-primary w-full sm:w-1/3"
            >
              <Monitor className="w-5 h-5" />
              <span>Windows (.exe)</span>
            </a>
            <a
              href={urls.macos}
              className="btn-secondary w-full sm:w-1/3"
            >
              <Apple className="w-5 h-5 text-accent-cyan" />
              <span>macOS (.dmg)</span>
            </a>
            <a
              href={urls.linux}
              className="btn-secondary w-full sm:w-1/3"
            >
              <Download className="w-5 h-5 text-accent-emerald" />
              <span>Linux (.AppImage)</span>
            </a>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-surface-border">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-400">Frequently Asked Questions</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">Common Questions</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* FAQ 1 */}
          <div className="studio-panel rounded-xl p-6">
            <h3 className="text-base font-bold text-white mb-3">What audio formats does Audis support?</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Audis supports MP3, WAV, AAC, FLAC, and M4A. Non-standard or corrupt bitstreams (e.g., raw
              AAC/M4A disguised as MP3) are automatically repaired on the fly into standard PCM WAV/MP3.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="studio-panel rounded-xl p-6">
            <h3 className="text-base font-bold text-white mb-3">Can I batch-process multiple files?</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Yes. Drop a folder of recordings into the Files Bin and Audis queues each track for silence
              analysis, cut review, and background export — process them one by one or all at once.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="studio-panel rounded-xl p-6">
            <h3 className="text-base font-bold text-white mb-3">Does Audis remember my intro/outro presets?</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Yes. Your custom intro, outro, crossfade duration, and output directory are saved across
              sessions via persistent brand presets. Toggle per-track with the I / O keys.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="studio-panel rounded-xl p-6">
            <h3 className="text-base font-bold text-white mb-3">Is there a metadata / cover art editor?</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Yes. Audis includes a metadata editor with cover art support so you can tag your exported
              audio with title, artist, album, and artwork before shipping.
            </p>
          </div>

          {/* FAQ 5 */}
          <div className="studio-panel rounded-xl p-6">
            <h3 className="text-base font-bold text-white mb-3">What keyboard shortcuts are available?</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Space (play/pause), C (add cut), D (toggle cut), I/O (intro/outro), Enter (approve), Esc
              (skip), ⌘/Ctrl+Z (undo), and mouse-wheel zoom on the waveform for precise cursor placement.
            </p>
          </div>

          {/* FAQ 6 */}
          <div className="studio-panel rounded-xl p-6">
            <h3 className="text-base font-bold text-white mb-3">Is Audis free and open source?</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Yes. Audis is distributed under the MIT License and is free to use. The desktop app and
              marketing website source are both open source on GitHub.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-surface-border text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">Audis</span>
            <span>— Desktop Audio Editing Made Effortless</span>
          </div>
          <div>
            © {new Date().getFullYear()} Audis Software. Developed by <span className="font-semibold text-slate-300">Ransamie Technologies (RanTech)</span>. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
