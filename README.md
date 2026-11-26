# Audis — 1-Click Audio Processing Desktop Utility & Marketing Showcase

![Electron Version](https://img.shields.io/badge/Electron-43.3-47A248?style=for-the-badge&logo=electron&logoColor=white)
![React Version](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![FFmpeg Engine](https://img.shields.io/badge/FFmpeg-6.1-0078D7?style=for-the-badge&logo=ffmpeg&logoColor=white)
![Vercel Ready](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white)

**Audis** is a premium, open-source desktop application and web showcase designed for podcast creators, sermon editors, and audio producers. It eliminates tedious DAW editing by automating intro/outro stitching, crossfading, and precision waveform cropping.

---

## ✨ Features

- 🎵 **Drag & Drop Workflow**: Instant audio file loading with drag-and-drop support.
- 🌊 **Interactive Waveform Cropper**: Visual region selector powered by `WaveSurfer.js` v7 with zoom and timestamp controls.
- ⚡ **1-Click Auto-Stitching**: Seamlessly merges **Intro + Trimmed Content + Outro** with customizable 2-second crossfades.
- 🛠️ **Automatic FFmpeg Error Resilience**: Detects non-standard or corrupt audio bitstreams (e.g., raw AAC/M4A disguised as MP3) and repairs them on the fly into standard PCM WAV/MP3 without crashing.
- ⚙️ **Persistent Brand Presets**: Remembers your custom intro, outro, crossfade duration, and output directory across sessions via `electron-store`.
- 🌐 **Marketing Website Showcase**: Includes a standalone Vite/React marketing website in `website/` featuring a live interactive browser demo ready for Vercel deployment.

---

## ⚡ Bulk AI Editing — 50 Messages / Hour

### Overview

Audis supports a **review-by-exception** batch workflow designed for sermon editors, podcast producers, and content teams who process large volumes of recordings each week.

**Workflow:** Drop a folder of audio files → AI analyzes each file in the background (silence detection + optional Whisper transcription) → Review only the clips that need attention → Approve the rest with a single keypress → Background export runs concurrently and fires a single notification when done.

---

### Quick Start Workflow

1. **Drop 50 audio files** (or select a folder) onto the Audis dropzone — files join the processing queue immediately.
2. **AI analyzes in the background** — silence detection runs on every file; optional Whisper cloud transcription adds word-level timestamps, filler-word flags, and a suggested title.
3. **Review proposed cuts** — the queue surfaces each message with its AI-suggested edits pre-applied. High-confidence items are pre-approved; only exceptions need your eyes.
4. Press **`Enter`** to approve & auto-advance to the next message, or **`D`** to toggle individual cuts on/off.
5. **Export runs in the background** — a single desktop notification fires when every file is done.

---

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause (skips over removed sections) |
| `Tab` | Jump to next flagged cut + auto-audition |
| `Shift+Tab` | Jump to previous flagged cut + auto-audition |
| `D` | Toggle active cut on / off |
| `C` | Add 1s manual cut at playhead |
| `I` | Toggle Intro for current message |
| `O` | Toggle Outro for current message |
| `Enter` | Approve & load next message |
| `Escape` | Defer / skip current message |
| `Ctrl/Cmd+A` | Auto-approve all clean (high-confidence) items |
| `Ctrl/Cmd+Z` | Undo last cut change |
| `Ctrl/Cmd+←/→` | Previous / Next queued item |

---

### AI Analysis Modes

| Mode | Speed | Internet | Features |
|---|---|---|---|
| **DSP Only (Offline)** | ~5–15 s/file | ❌ No | Silence detection, leading/trailing trim |
| **Cloud API (Groq/OpenAI)** | ~10–25 s/file | ✅ Yes | Whisper word timestamps, retake detection, filler words, auto title |

---

### FFmpeg Filter Graph — 4 Render Modes

| Mode | Filter Graph |
|---|---|
| Intro + Main + Outro | `[intro][main][outro]concat=n=3:v=0:a=1` |
| Intro only | `[intro][main]concat=n=2:v=0:a=1` |
| Outro only | `[main][outro]concat=n=2:v=0:a=1` |
| Voice note only | `[main]loudnorm=I=-16:LRA=11:TP=-1.5` |

---

### New Settings

| Setting | Description | Default |
|---|---|---|
| `aiMode` | `'offline'` (DSP) or `'cloud'` (Whisper + LLM API) | `'offline'` |
| `apiProvider` | Cloud transcription/LLM provider — `'groq'` or `'openai'` | `'groq'` |
| `apiKey` | API key for the selected cloud provider (stored via `safeStorage`) | _(empty)_ |
| `defaultIntroOutro` | `'on'`, `'off'`, or `'ai'` (let AI decide per file) | `'on'` |
| `noisedB` | Silence floor threshold in dB | `-35` |
| `minPauseDuration` | Silences longer than this (seconds) are flagged as cut candidates | `0.6` |
| `targetPauseSec` | Post-cut pause to leave in place after shortening long pauses | `0.35` |
| `loudnormEnabled` | Apply `-16 LUFS` normalization on voice-only exports | `true` |
| `analysisWorkers` / `exportWorkers` | Parallel background worker pool sizes (1–4) | `2` |

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Desktop Runtime** | Electron v43.3.0 |
| **Frontend UI** | React 18 + Tailwind CSS v3 |
| **Bundler & Tooling** | `electron-vite` |
| **Audio Visualization** | `WaveSurfer.js` v7 + Regions & Timeline Plugins |
| **Audio Processing Engine** | `fluent-ffmpeg` + `ffmpeg-static` (v6.1) + `ffprobe-static` |
| **Settings Storage** | `electron-store` |
| **Marketing Website** | React + Vite + Lucide Icons (Vercel Ready) |

---

## 📁 Project Structure

```
audis/
├── electron/
│   ├── main.js             # Main process: BrowserWindow, IPC handlers, FFmpeg pipeline
│   ├── preload.js          # Secure context bridge: exposes window.electronAPI
│   └── audio.js            # Core FFmpeg processing & error-resilient repair logic
├── src/
│   ├── App.jsx             # Main application state & layout
│   ├── main.jsx            # React entry point
│   ├── index.css           # Tailwind CSS directives + custom glassmorphism styles
│   └── components/
│       ├── Dropzone.jsx    # Drag-and-drop file upload zone
│       ├── Waveform.jsx    # WaveSurfer.js waveform visualizer & region cropper
│       ├── Controls.jsx    # Export panel & real-time progress indicator
│       └── Settings.jsx    # Brand preset settings modal
├── website/                # Marketing website & interactive live browser demo
│   ├── src/                # Marketing landing page components
│   ├── dist/               # Production Vercel build output
│   └── vercel.json         # Vercel deployment configuration
├── public/assets/          # Default intro/outro audio assets
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher

### Installation

```bash
git clone https://github.com/ransamie/audis.git
cd audis
npm install
```

### Development

Run the Electron desktop app in dev mode with hot reload:

```bash
npm run dev
```

### Marketing Website Development

Run the standalone marketing website locally:

```bash
cd website
npm install
npm run dev
```

---

## ⚡ FFmpeg Processing Pipeline

The `audio:process` pipeline in `electron/audio.js` constructs an optimized `filter_complex` command with error tolerance:

```
[0:a] afade=t=out:st=(introDuration-FADE):d=FADE           [intro_faded]
[1:a] atrim=start=S:end=E, asetpts=PTS-STARTPTS            [main_trimmed]
[main_trimmed] afade=t=in:st=0:d=FADE,
               afade=t=out:st=(mainDuration-FADE):d=FADE   [main_faded]
[2:a] afade=t=in:st=0:d=FADE                               [outro_faded]
[intro_faded][main_faded][outro_faded] concat=n=3:v=0:a=1  [output]
```

**Error Resilience Flags:**
`-err_detect ignore_err -fflags +genpts+discardcorrupt -max_error_rate 1.0`

---

## 📦 Production Packaging

To build and package the native desktop installer:

```bash
# Compile processes
npm run build

# Package installer (NSIS on Windows, DMG on macOS, AppImage on Linux)
npm run dist
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
