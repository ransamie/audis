# Audis — 1-Click Audio Processing Desktop Utility

<img src="./public/assets/README.md" />

**Audis** is a premium Electron desktop application that lets you:
1. **Drag & Drop** a main audio file (MP3/WAV)  
2. **Visually crop** the start/end with an interactive waveform editor  
3. **1-Click Export** to stitch Intro + Trimmed Main + Outro with smooth crossfades  

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Wrapper | Electron 28 |
| Frontend | React 18 + Tailwind CSS v3 |
| Bundler | electron-vite |
| Audio Visualization | WaveSurfer.js 7 + Regions Plugin |
| Audio Processing | fluent-ffmpeg + ffmpeg-static |
| Persistence | electron-store |

## Project Structure

```
audis/
├── electron/
│   ├── main.js        # Main process: BrowserWindow, IPC, FFmpeg pipeline
│   └── preload.js     # Context bridge: exposes window.electronAPI
├── src/
│   ├── App.jsx                  # Root component + state management
│   ├── main.jsx                 # React entry point
│   ├── index.css                # Tailwind + custom styles
│   └── components/
│       ├── Dropzone.jsx         # Drag-and-drop file input
│       ├── Waveform.jsx         # WaveSurfer.js waveform + regions
│       ├── Controls.jsx         # Export panel + progress display
│       └── Settings.jsx         # Settings modal
├── public/
│   └── assets/
│       ├── intro.mp3            # ← Put your intro track here
│       └── outro.mp3            # ← Put your outro track here
├── package.json
├── electron.vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
git clone <repo>
cd audis
npm install
```

### Add Your Audio Assets

Place your `intro.mp3` and `outro.mp3` files in `public/assets/`:

```bash
cp /path/to/your/intro.mp3 public/assets/intro.mp3
cp /path/to/your/outro.mp3 public/assets/outro.mp3
```

You can also configure these paths at runtime via the **Settings** panel.

### Development

```bash
npm run dev
```

This launches the Electron app with Vite's hot-reload dev server.

### Production Build

```bash
npm run build    # Compile all processes
npm run dist     # Package as native installer (NSIS on Windows, DMG on macOS)
```

## FFmpeg Pipeline

The `audio:process` IPC handler in `electron/main.js` builds the following `filter_complex`:

```
[0:a] afade=t=out:st=(introDuration-FADE):d=FADE           [intro_faded]
[1:a] atrim=start=S:end=E, asetpts=PTS-STARTPTS            [main_trimmed]
[main_trimmed] afade=t=in:st=0:d=FADE,
               afade=t=out:st=(mainDuration-FADE):d=FADE   [main_faded]
[2:a] afade=t=in:st=0:d=FADE                               [outro_faded]
[intro_faded][main_faded][outro_faded] concat=n=3:v=0:a=1  [output]
```

**To adjust fade durations:** Open Settings → drag the "Crossfade Duration" slider.  
The default is **2 seconds**.

## IPC API Reference

| Channel | Direction | Description |
|---|---|---|
| `dialog:openFile` | Renderer → Main | Opens native OS file picker |
| `audio:process` | Renderer → Main | Starts FFmpeg pipeline |
| `audio:progress` | Main → Renderer | Live percent + timemark updates |
| `settings:get` | Renderer → Main | Returns stored settings |
| `settings:set` | Renderer → Main | Saves settings to disk |

## Output

Exported files are saved as `Final_Output_[ISO-timestamp].mp3` in your Downloads folder (configurable via Settings).

A native OS notification fires on completion, and the output folder opens automatically.

## Customization

| Setting | Default | Description |
|---|---|---|
| Intro Path | `public/assets/intro.mp3` | Intro track file |
| Outro Path | `public/assets/outro.mp3` | Outro track file |
| Fade Duration | `2s` | All crossfade durations |
| Output Dir | `~/Downloads` | Where exported files are saved |
