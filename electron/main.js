/**
 * electron/main.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Audis — Electron Main Process
 *
 * Responsibilities:
 *   • Create and manage the BrowserWindow
 *   • Register IPC handlers for:
 *       - dialog:openFile      → native file picker
 *       - audio:process        → full FFmpeg pipeline
 *       - settings:get         → retrieve stored intro/outro paths
 *       - settings:set         → persist intro/outro paths
 *   • Execute the FFmpeg filter complex:
 *       1. Trim main audio between [start, end]
 *       2. Apply 2-sec fade-out to intro
 *       3. Apply 2-sec fade-in + 2-sec fade-out to trimmed main audio
 *       4. Apply 2-sec fade-in to outro
 *       5. Concat all three → Final_Output_[timestamp].mp3
 *   • Send OS notification on completion or failure
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Notification,
  shell
} from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'
import fs from 'fs'
import Store from 'electron-store'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStaticPath from 'ffmpeg-static'
import ffprobeStaticPath from 'ffprobe-static'
import { repairAudioFile, processAudio } from './audio.js'

// ─── ESM __dirname shim ────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// ─── Tell fluent-ffmpeg where the static binary lives ─────────────────────
// ffmpeg-static resolves the correct binary for the current OS/arch.
// In production (packaged app) we point to the extraResources copy.
const resolvedFfmpegPath = app.isPackaged
  ? path.join(process.resourcesPath, 'ffmpeg-static', 'ffmpeg' + (process.platform === 'win32' ? '.exe' : ''))
  : ffmpegStaticPath

const resolvedFfprobePath = app.isPackaged
  ? path.join(process.resourcesPath, 'ffprobe-static', 'ffprobe' + (process.platform === 'win32' ? '.exe' : ''))
  : ffprobeStaticPath.path

ffmpeg.setFfmpegPath(resolvedFfmpegPath)
ffmpeg.setFfprobePath(resolvedFfprobePath)

// ─── Persistent settings store ─────────────────────────────────────────────
// Uses electron-store to persist intro/outro paths across sessions.
const store = new Store({
  name: 'audis-settings',
  defaults: {
    introPath: path.join(app.getAppPath(), 'public', 'assets', 'intro.mp3'),
    outroPath:  path.join(app.getAppPath(), 'public', 'assets', 'outro.mp3'),
    fadeDuration: 2,   // seconds — adjust this to change all crossfade durations
    outputDir:   path.join(os.homedir(), 'Downloads'),
    exportFormat: 'original',
  }
})

// ─── Window factory ────────────────────────────────────────────────────────
let mainWindow

function createWindow () {
  mainWindow = new BrowserWindow({
    width:          1200,
    height:         800,
    minWidth:       900,
    minHeight:      600,
    backgroundColor: '#0d0d14',
    titleBarStyle:  process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame:          process.platform !== 'darwin',
    webPreferences: {
      // electron-vite outputs preload as index.mjs when package "type" is "module"
      preload:          path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,   // MUST be true for contextBridge security
      nodeIntegration:  false,  // MUST be false for security
      webSecurity:      true,
    }
  })

  // Load renderer
  if (process.env['ELECTRON_RENDERER_URL']) {
    // Dev mode: Vite dev server
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // Production: built HTML (electron-vite outputs to out/renderer/)
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC: Open file dialog ─────────────────────────────────────────────────
ipcMain.handle('dialog:openFile', async (_event, options = {}) => {
  try {
    const win = BrowserWindow.fromWebContents(_event.sender) || mainWindow
    const props = options.properties || ['openFile']
    const dialogOptions = {
      title: options.title || 'Select Audio File',
      properties: props
    }

    if (!props.includes('openDirectory')) {
      if (Array.isArray(options.filters) && options.filters.length > 0) {
        dialogOptions.filters = options.filters
      } else {
        dialogOptions.filters = [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'flac', 'm4a'] }
        ]
      }
    }

    const result = (win && !win.isDestroyed())
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  } catch (err) {
    console.error('[Audis openFile Error]', err)
    return null
  }
})

ipcMain.on('log:renderer', (event, level, ...args) => {
  if (level === 'error') console.error('[Renderer]', ...args)
  else if (level === 'warn') console.warn('[Renderer]', ...args)
  else console.log('[Renderer]', ...args)
})

// ─── IPC: Read file buffer for WaveSurfer ─────────────────────────────────
ipcMain.handle('file:readBuffer', async (_event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }
    const buffer = await fs.promises.readFile(filePath)
    return buffer
  } catch (err) {
    console.error('[Audis readBuffer Error]', err)
    throw err
  }
})

// ─── IPC: Repair/Transcode broken audio files (Failsafe for AAC/M4A/Corrupt containers) ─
ipcMain.handle('audio:repairFile', async (_event, filePath) => {
  return await repairAudioFile(filePath)
})

// ─── IPC: Open directory dialog ─────────────────────────────────────────────
ipcMain.handle('dialog:openDirectory', async (_event, options = {}) => {
  try {
    const win = BrowserWindow.fromWebContents(_event.sender) || mainWindow
    const dialogOptions = {
      title: options.title || 'Select Output Folder',
      properties: ['openDirectory', 'createDirectory']
    }

    if (options.defaultPath && typeof options.defaultPath === 'string' && fs.existsSync(options.defaultPath)) {
      dialogOptions.defaultPath = options.defaultPath
    }

    const result = (win && !win.isDestroyed())
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  } catch (err) {
    console.error('[Audis openDirectory Error]', err)
    return null
  }
})

// ─── IPC: Get / Set settings ───────────────────────────────────────────────
ipcMain.handle('settings:get', () => store.store)

ipcMain.handle('settings:set', (_event, updates) => {
  for (const [key, value] of Object.entries(updates)) {
    store.set(key, value)
  }
  return store.store
})

// ─── IPC: Core audio processing pipeline ──────────────────────────────────
/**
 * Handles the 'audio:process' IPC call from the renderer.
 *
 * @param {Object} _event   - Electron IPC event (unused directly)
 * @param {Object} payload  - Processing parameters:
 *   @param {string} payload.mainPath   - Absolute path to the main audio file
 *   @param {number} payload.startTime  - Crop start in seconds (from WaveSurfer region)
 *   @param {number} payload.endTime    - Crop end   in seconds (from WaveSurfer region)
 *   @param {string} [payload.introPath] - Override intro path (optional)
 *   @param {string} [payload.outroPath] - Override outro path (optional)
 */
ipcMain.handle('audio:process', async (event, payload) => {
  const {
    mainPath,
    startTime,
    endTime,
  } = payload

  // Resolve intro/outro from payload or stored settings
  const introPath = payload.introPath || store.get('introPath')
  const outroPath = payload.outroPath || store.get('outroPath')
  const outputDir = store.get('outputDir')
  const exportFormat = store.get('exportFormat') || 'original'
  const fadeDuration = store.get('fadeDuration')

  try {
    const result = await processAudio({
      mainPath,
      startTime,
      endTime,
      introPath,
      outroPath,
      outputDir,
      exportFormat,
      fadeDuration,
      onProgress: (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('audio:progress', {
            percent: progress.percent,
            timemark: progress.timemark,
          })
        }
      }
    })

    if (Notification.isSupported()) {
      new Notification({
        title: '✅ Audis — Export Complete',
        body:  `Saved to: ${result.outputPath}`,
        silent: false,
      }).show()
    }
    shell.showItemInFolder(result.outputPath)
    return result

  } catch (err) {
    console.error('[Audis FFmpeg Error]', err.message)
    if (Notification.isSupported()) {
      new Notification({
        title: '❌ Audis — Export Failed',
        body:  err.message,
      }).show()
    }
    throw err
  }
})
