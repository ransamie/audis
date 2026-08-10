import React from 'react'
import AudisLogo from './components/Logo'
import InteractiveDemo from './components/InteractiveDemo'
import {
  Download,
  Sparkles,
  Zap,
  Layers,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  AudioWaveform,
  Monitor,
  Apple,
  Clock
} from 'lucide-react'

export default function App() {
  return (
    <div className="min-h-screen bg-[#0d0d14] text-slate-100 font-sans selection:bg-brand-500/30 selection:text-brand-300 relative overflow-x-hidden">
      
      {/* Background Decorative Glow Gradients */}
      <div className="gradient-glow top-0 left-1/4 w-[600px] h-[600px] bg-brand-500" />
      <div className="gradient-glow top-1/3 right-10 w-[500px] h-[500px] bg-cyan-500" />
      <div className="gradient-glow bottom-10 left-1/3 w-[600px] h-[600px] bg-purple-600/30" />

      {/* Fixed Sticky Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0d0d14]/90 border-b border-white/10 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AudisLogo className="h-9 w-auto" variant="light" />
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#demo" className="hover:text-brand-300 transition-colors flex items-center gap-1.5 font-semibold text-brand-400">
              <Sparkles className="w-4 h-4" />
              <span>Test It Now</span>
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-4">
            <a
              href="#download"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:-translate-y-0.5"
            >
              <Download className="w-4 h-4" />
              <span>Download Desktop App</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 sm:pt-28 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border border-brand-500/30 text-brand-300 text-xs font-semibold uppercase tracking-wider mb-8 animate-pulse-slow">
          <Sparkles className="w-4 h-4 text-brand-400" />
          <span>Automated Audio Production for Creators</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
          Stitch Intros, Outros & Crop Audio in <span className="gradient-text">1-Click</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Stop wasting hours in complex DAWs. Audis automatically merges your brand intro & outro with buttery crossfades and precision waveform trimming in seconds.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://github.com/ransamie/audis/releases/download/v1.0.0/Audis-Setup-1.0.0.exe"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-cyan-400 hover:from-brand-400 hover:to-cyan-300 text-slate-950 font-extrabold text-sm transition-all shadow-xl shadow-brand-500/30 hover:scale-105 flex items-center justify-center gap-2.5"
          >
            <Monitor className="w-4 h-4" />
            <span>Windows (.exe)</span>
          </a>
          <a
            href="https://github.com/ransamie/audis/releases/download/v1.0.0/Audis-1.0.0-arm64.dmg"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl glass-card hover:bg-white/15 text-white font-bold text-sm border border-white/15 transition-all hover:scale-105 flex items-center justify-center gap-2.5"
          >
            <Apple className="w-4 h-4 text-cyan-300" />
            <span>macOS (.dmg)</span>
          </a>
          <a
            href="https://github.com/ransamie/audis/releases/download/v1.0.0/Audis-1.0.0.AppImage"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl glass-card hover:bg-white/15 text-white font-bold text-sm border border-white/15 transition-all hover:scale-105 flex items-center justify-center gap-2.5"
          >
            <Download className="w-4 h-4 text-purple-300" />
            <span>Linux (.AppImage)</span>
          </a>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-brand-400" /> Free & Open Source</span>
          <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-cyan-400" /> Official Release v1.0.0</span>
          <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-purple-400" /> Powered by FFmpeg Engine</span>
        </div>
      </section>

      {/* Interactive Showcase Section (Test it Now) */}
      <section id="demo" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Experience the Interface <span className="gradient-text">Live Right Now</span>
          </h2>
          <p className="mt-3 text-slate-400 text-base max-w-xl mx-auto">
            Test the waveform cropper directly in your browser. Drag handles to crop timestamps in real-time.
          </p>
        </div>

        <InteractiveDemo />
      </section>

      {/* Feature Cards Grid */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-400">Why Choose Audis</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
            Built for Podcasters, Preachers & Media Editors
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="glass-card glass-card-hover rounded-2xl p-8 border border-white/10">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-6">
              <Sliders className="w-6 h-6 text-brand-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Auto Crossfades</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Configurable 2-second crossfade overlays between intro, main content, and outro tracks ensure zero harsh audio cuts.
            </p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-8 border border-white/10">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6">
              <Zap className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">FFmpeg Native Power</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Process audio in seconds without re-encoding quality degradation. Supports MP3, WAV, AAC, M4A, FLAC, and OGG.
            </p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-8 border border-white/10">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
              <Layers className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Persistent Brand Presets</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Set your intro, outro, and export folder paths once in Settings. Audis remembers them for every single edit session.
            </p>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-400">Streamlined Workflow</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
            3 Simple Steps to Finalized Audio
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-card rounded-2xl p-8 text-center border border-white/10 relative">
            <div className="w-10 h-10 rounded-full bg-brand-500 text-slate-950 font-black text-lg flex items-center justify-center mx-auto mb-6">
              1
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Drop Main Audio</h3>
            <p className="text-sm text-slate-400">Drag and drop your raw sermon or podcast recording file onto the canvas.</p>
          </div>

          <div className="glass-card rounded-2xl p-8 text-center border border-white/10 relative">
            <div className="w-10 h-10 rounded-full bg-brand-500 text-slate-950 font-black text-lg flex items-center justify-center mx-auto mb-6">
              2
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Select Crop Region</h3>
            <p className="text-sm text-slate-400">Adjust the visual waveform handles to cut off silence or unwanted audio.</p>
          </div>

          <div className="glass-card rounded-2xl p-8 text-center border border-white/10 relative">
            <div className="w-10 h-10 rounded-full bg-brand-500 text-slate-950 font-black text-lg flex items-center justify-center mx-auto mb-6">
              3
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Click Export</h3>
            <p className="text-sm text-slate-400">Audis automatically stitches Intro + Main + Outro with crossfades into your output folder.</p>
          </div>
        </div>
      </section>

      {/* Download CTA Section */}
      <section id="download" className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="glass-card rounded-3xl p-10 sm:p-16 border border-brand-500/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/10 to-cyan-500/10 pointer-events-none" />
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4">
            Ready to Accelerate Your Audio Pipeline?
          </h2>
          <p className="text-slate-300 text-lg max-w-xl mx-auto mb-10">
            Select your platform below to download Audis v1.0.0 directly.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-2xl mx-auto">
            <a
              href="https://github.com/ransamie/audis/releases/download/v1.0.0/Audis-Setup-1.0.0.exe"
              className="w-full sm:w-1/3 px-6 py-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-extrabold text-sm transition-all shadow-lg shadow-brand-500/30 hover:scale-105 flex items-center justify-center gap-2"
            >
              <Monitor className="w-5 h-5" />
              <span>Windows (.exe)</span>
            </a>
            <a
              href="https://github.com/ransamie/audis/releases/download/v1.0.0/Audis-1.0.0-arm64.dmg"
              className="w-full sm:w-1/3 px-6 py-4 rounded-xl glass-card hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              <Apple className="w-5 h-5 text-cyan-300" />
              <span>macOS (.dmg)</span>
            </a>
            <a
              href="https://github.com/ransamie/audis/releases/download/v1.0.0/Audis-1.0.0.AppImage"
              className="w-full sm:w-1/3 px-6 py-4 rounded-xl glass-card hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5 text-purple-300" />
              <span>Linux (.AppImage)</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10 text-center text-xs text-slate-500">
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
