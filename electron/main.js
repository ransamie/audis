/**
 * electron/main.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Audis — Electron Main Process
 *
 * Responsibilities:
 *   • Create and manage the BrowserWindow
 *   • Register IPC handlers for file dialogs, audio processing, settings
 *   • Analysis Queue Manager (concurrency-limited, in-memory)
 *   • Export Queue Manager  (concurrency-limited, in-memory)
 *   • Batch-complete OS notification
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Notification,
  shell,
  safeStorage,
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
import {
  readMetadata,
  writeMetadata,
  embedCoverArt,
  removeCoverArt,
  extractCoverArt,
} from './metadata.js'

// ─── Lazy-import analyzeFile from analyzer.js (may not exist yet) ───────────
let analyzeFile = null
try {
  const analyzerModule = await import('./analyzer.js')
  analyzeFile = analyzerModule.analyzeFile
} catch (err) {
  console.warn('[Audis] analyzer.js not found or failed to load — analysis queue will be inert:', err.message)
}

// ─── ESM __dirname shim ────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// ─── Tell fluent-ffmpeg where the static binary lives ─────────────────────
const resolvedFfmpegPath = app.isPackaged
  ? path.join(process.resourcesPath, 'ffmpeg-static', 'ffmpeg' + (process.platform === 'win32' ? '.exe' : ''))
  : ffmpegStaticPath

const resolvedFfprobePath = app.isPackaged
  ? path.join(process.resourcesPath, 'ffprobe-static', 'ffprobe' + (process.platform === 'win32' ? '.exe' : ''))
  : ffprobeStaticPath.path

ffmpeg.setFfmpegPath(resolvedFfmpegPath)
ffmpeg.setFfprobePath(resolvedFfprobePath)

// ─── Audio file extensions for folder scanning ────────────────────────────
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.aac', '.flac', '.m4a'])

// ─── Persistent settings store ─────────────────────────────────────────────
const store = new Store({
  name: 'audis-settings',
  defaults: {
    introPath: path.join(app.getAppPath(), 'public', 'assets', 'intro.mp3'),
    outroPath:  path.join(app.getAppPath(), 'public', 'assets', 'outro.mp3'),
    fadeDuration: 2,
    outputDir:   path.join(os.homedir(), 'Downloads'),
    exportFormat: 'original',
    // ── New bulk-editing settings ────────────────────────────────────────
    analysisWorkers:    2,
    exportWorkers:      2,
    aiMode:             'offline',   // 'offline' | 'cloud'
    apiProvider:        'groq',      // 'groq' | 'openai'
    apiKey:             '',          // stored encrypted (base64 of safeStorage ciphertext)
    noisedB:            -35,
    minPauseDuration:   0.6,
    targetPauseSec:     0.35,
    defaultIntroOutro:  'on',        // 'on' | 'off' | 'ai'
    loudnormEnabled:    true,
    batchNamingPattern: '{index}_{title}',
  }
})

// ─── Window factory & single-instance lock ─────────────────────────────────
let mainWindow

function createWindow () {
  mainWindow = new BrowserWindow({
    width:          1280,
    height:         820,
    minWidth:       960,
    minHeight:      620,
    show:           false,
    autoHideMenuBar: true,
    backgroundColor: '#141619',
    titleBarStyle:  process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame:          process.platform !== 'darwin',
    webPreferences: {
      preload:          path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
      webSecurity:      true,
    }
  })

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[Audis Window Load Failed] ${code} (${desc}) at ${url}`)
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── App lifecycle ─────────────────────────────────────────────────────────
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS QUEUE MANAGER
// ═══════════════════════════════════════════════════════════════════════════

/** @type {Array<{ id: string, filePath: string, priority: number }>} */
const analysisQueue   = []
/** @type {Set<string>} IDs of currently running analysis jobs */
const analysisRunning = new Set()

/** How many analysis jobs run concurrently — read from settings at drain time */
function getAnalysisConcurrency () {
  return store.get('analysisWorkers') || 2
}

/**
 * Add an item to the analysis queue and kick the drain loop.
 * @param {string} id
 * @param {string} filePath
 * @param {number} [priority=0]  higher = more urgent
 */
function enqueueAnalysis (id, filePath, priority = 0) {
  // Avoid duplicates
  if (analysisRunning.has(id) || analysisQueue.some(x => x.id === id)) return
  analysisQueue.push({ id, filePath, priority })
  drainAnalysisQueue()
}

/**
 * Move an item to the front of the analysis queue (called when user focuses it).
 * @param {string} id
 */
function prioritizeAnalysis (id) {
  const idx = analysisQueue.findIndex(x => x.id === id)
  if (idx > 0) {
    const [item] = analysisQueue.splice(idx, 1)
    analysisQueue.unshift(item)
  }
}

/** Start up to ANALYSIS_CONCURRENCY parallel analysis jobs. */
async function drainAnalysisQueue () {
  const CONCURRENCY = getAnalysisConcurrency()
  while (analysisRunning.size < CONCURRENCY && analysisQueue.length > 0) {
    // Pick the highest-priority item (we keep the queue simple; unshift handles it)
    const item = analysisQueue.shift()
    runAnalysis(item.id, item.filePath)   // fire-and-forget; manages its own slot
  }
}

/**
 * Run a single analysis job. Pushes IPC events to the renderer.
 * @param {string} id
 * @param {string} filePath
 */
async function runAnalysis (id, filePath) {
  analysisRunning.add(id)

  const send = (channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data)
    }
  }

  send('analysis:start', { id })

  try {
    if (!analyzeFile) {
      throw new Error('analyzer.js is not available — cannot analyse file.')
    }
    const settings = store.store
    const result = await analyzeFile(filePath, settings)
    send('analysis:result', { id, ...result })
  } catch (err) {
    console.error(`[Audis Analysis Error] id=${id}`, err.message)
    send('analysis:error', { id, error: err.message })
  } finally {
    analysisRunning.delete(id)
    drainAnalysisQueue()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT QUEUE MANAGER
// ═══════════════════════════════════════════════════════════════════════════

/** @type {Array<{ id: string, payload: object }>} */
const exportQueue   = []
/** @type {Set<string>} IDs of currently running export jobs */
const exportRunning = new Set()

/** Batch tracking — set when a batch is initiated so we can fire batch:complete */
let batchOutputDir  = null
let batchTotalCount = 0
let batchHasFinalItem = false

/** How many export jobs run concurrently — read from settings at drain time */
function getExportConcurrency () {
  return store.get('exportWorkers') || 2
}

/**
 * Add an item to the export queue and kick the drain loop.
 * @param {string} id
 * @param {object} payload
 */
function enqueueExport (id, payload) {
  if (exportRunning.has(id) || exportQueue.some(x => x.id === id)) return
  exportQueue.push({ id, payload })
  if (payload?.isLastBatchItem) batchHasFinalItem = true
  // Track batch output dir from the first payload that has one
  if (payload.outputDir && !batchOutputDir) {
    batchOutputDir  = payload.outputDir
    batchTotalCount = 0
  }
  drainExportQueue()
}

/** Start up to EXPORT_CONCURRENCY parallel export jobs. */
async function drainExportQueue () {
  const CONCURRENCY = getExportConcurrency()
  while (exportRunning.size < CONCURRENCY && exportQueue.length > 0) {
    const item = exportQueue.shift()
    runExport(item.id, item.payload)   // fire-and-forget
  }
}

/**
 * Run a single export job. Pushes IPC progress events to the renderer.
 * @param {string} id
 * @param {object} payload
 */
async function runExport (id, payload) {
  exportRunning.add(id)
  batchTotalCount++

  const send = (channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data)
    }
  }

  const isBatchMode = payload.batchMode !== false

  send('export:start', { id })

  try {
    const settings  = store.store
    const introPath = payload.introPath !== undefined ? payload.introPath : settings.introPath
    const outroPath = payload.outroPath !== undefined ? payload.outroPath : settings.outroPath
    const outputDir = payload.outputDir || settings.outputDir
    const exportFormat       = payload.exportFormat       || settings.exportFormat  || 'original'
    const fadeDuration       = payload.fadeDuration       ?? settings.fadeDuration  ?? 2
    const loudnormEnabled    = payload.loudnormEnabled    ?? settings.loudnormEnabled ?? true
    const batchNamingPattern = payload.batchNamingPattern || settings.batchNamingPattern || '{index}_{title}'

    const result = await processAudio({
      ...payload,
      introPath,
      outroPath,
      outputDir,
      exportFormat,
      fadeDuration,
      loudnormEnabled,
      batchNamingPattern,
      onProgress: (progress) => {
        send('export:progress', {
          id,
          percent:   progress.percent,
          timemark:  progress.timemark,
        })
      },
    })

    send('export:done', { id, outputPath: result.outputPath })

    // Legacy single-file mode: open in Finder/Explorer
    if (!isBatchMode) {
      if (Notification.isSupported()) {
        new Notification({
          title: '✅ Audis — Export Complete',
          body:  `Saved to: ${result.outputPath}`,
          silent: false,
        }).show()
      }
      shell.showItemInFolder(result.outputPath)
    }

  } catch (err) {
    console.error(`[Audis Export Error] id=${id}`, err.message)
    if (Notification.isSupported()) {
      new Notification({
        title: '❌ Audis — Export Failed',
        body:  err.message,
      }).show()
    }
    send('export:error', { id, error: err.message })
  } finally {
    exportRunning.delete(id)

    // Check for batch completion (avoid firing per-item OS toast between user reviews)
    if (exportQueue.length === 0 && exportRunning.size === 0 && batchOutputDir) {
      const outputDir    = batchOutputDir
      const count        = batchTotalCount
      const shouldNotify = batchHasFinalItem || count > 1
      batchOutputDir     = null
      batchTotalCount    = 0
      batchHasFinalItem  = false

      if (shouldNotify) {
        send('batch:complete', { totalCount: count, outputDir })
        if (Notification.isSupported()) {
          new Notification({
            title: '✅ Audis — Batch Complete',
            body:  `${count} file${count === 1 ? '' : 's'} exported to ${outputDir}`,
          }).show()
        }
      }
    } else {
      drainExportQueue()
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// IPC HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

// ─── Renderer log relay ────────────────────────────────────────────────────
ipcMain.on('log:renderer', (_event, level, ...args) => {
  if (level === 'error') console.error('[Renderer]', ...args)
  else if (level === 'warn')  console.warn('[Renderer]', ...args)
  else                        console.log('[Renderer]', ...args)
})

// ─── dialog:openFile (legacy single-file, returns string | null) ───────────
ipcMain.handle('dialog:openFile', async (_event, options = {}) => {
  try {
    const win = BrowserWindow.fromWebContents(_event.sender) || mainWindow
    const props = options.properties || ['openFile']
    const dialogOptions = {
      title: options.title || 'Select Audio File',
      properties: props,
    }
    if (!props.includes('openDirectory')) {
      dialogOptions.filters = Array.isArray(options.filters) && options.filters.length
        ? options.filters
        : [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg'] }]
    }
    const result = (win && !win.isDestroyed())
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || !result.filePaths?.length) return null
    return result.filePaths[0]
  } catch (err) {
    console.error('[Audis openFile Error]', err)
    return null
  }
})

// ─── dialog:openFiles (multi-file, returns string[] | null) ───────────────
ipcMain.handle('dialog:openFiles', async (_event, options = {}) => {
  try {
    const win = BrowserWindow.fromWebContents(_event.sender) || mainWindow
    const dialogOptions = {
      title: options.title || 'Select Audio Files',
      properties: ['openFile', 'multiSelections'],
      filters: Array.isArray(options.filters) && options.filters.length
        ? options.filters
        : [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg'] }],
    }
    const result = (win && !win.isDestroyed())
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || !result.filePaths?.length) return null
    return result.filePaths
  } catch (err) {
    console.error('[Audis openFiles Error]', err)
    return null
  }
})

// ─── dialog:openFolder (folder picker → scan for audio → string[]) ────────
ipcMain.handle('dialog:openFolder', async (_event, options = {}) => {
  try {
    const win = BrowserWindow.fromWebContents(_event.sender) || mainWindow
    const dialogOptions = {
      title: options.title || 'Select Folder',
      properties: ['openDirectory', 'createDirectory'],
    }
    if (options.defaultPath && fs.existsSync(options.defaultPath)) {
      dialogOptions.defaultPath = options.defaultPath
    }
    const result = (win && !win.isDestroyed())
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || !result.filePaths?.length) return null

    const folderPath = result.filePaths[0]
    const entries    = await fs.promises.readdir(folderPath, { withFileTypes: true })
    const audioPaths = entries
      .filter(e => e.isFile() && AUDIO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map(e => path.join(folderPath, e.name))

    return audioPaths
  } catch (err) {
    console.error('[Audis openFolder Error]', err)
    return null
  }
})

// ─── dialog:openDirectory (legacy directory picker, returns string | null) ─
ipcMain.handle('dialog:openDirectory', async (_event, options = {}) => {
  try {
    const win = BrowserWindow.fromWebContents(_event.sender) || mainWindow
    const dialogOptions = {
      title: options.title || 'Select Output Folder',
      properties: ['openDirectory', 'createDirectory'],
    }
    if (options.defaultPath && typeof options.defaultPath === 'string' && fs.existsSync(options.defaultPath)) {
      dialogOptions.defaultPath = options.defaultPath
    }
    const result = (win && !win.isDestroyed())
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || !result.filePaths?.length) return null
    return result.filePaths[0]
  } catch (err) {
    console.error('[Audis openDirectory Error]', err)
    return null
  }
})

// ─── file:readBuffer ───────────────────────────────────────────────────────
ipcMain.handle('file:readBuffer', async (_event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`)
    return await fs.promises.readFile(filePath)
  } catch (err) {
    console.error('[Audis readBuffer Error]', err)
    throw err
  }
})

// ─── file:getDroppedPath ───────────────────────────────────────────────────
// Kept for backward-compat; preload now uses webUtils.getPathForFile directly.
ipcMain.handle('file:getDroppedPath', async (_event, fileName) => {
  // This handler is a no-op shim — in Electron 31+ the renderer resolves the
  // path itself via webUtils.getPathForFile in the preload.
  console.warn('[Audis] file:getDroppedPath called — use webUtils.getPathForFile in preload instead.')
  return fileName
})

// ─── audio:repairFile ──────────────────────────────────────────────────────
ipcMain.handle('audio:repairFile', async (_event, filePath) => {
  try {
    return await repairAudioFile(filePath)
  } catch (err) {
    console.error('[Audis repairFile Error]', err)
    throw err
  }
})

// ─── audio:process (legacy single-file pipeline) ──────────────────────────
ipcMain.handle('audio:process', async (event, payload) => {
  const { mainPath, startTime, endTime } = payload
  const introPath    = payload.introPath    || store.get('introPath')
  const outroPath    = payload.outroPath    || store.get('outroPath')
  const outputDir    = store.get('outputDir')
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
      batchMode: false,
      onProgress: (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('audio:progress', {
            percent:  progress.percent,
            timemark: progress.timemark,
          })
        }
      },
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

// ─── metadata:read ──────────────────────────────────────────────────────────
ipcMain.handle('metadata:read', async (_event, { filePath }) => {
  try {
    return await readMetadata(filePath)
  } catch (err) {
    console.error('[Audis metadata:read Error]', err)
    throw err
  }
})

// ─── metadata:write ─────────────────────────────────────────────────────────
ipcMain.handle('metadata:write', async (_event, { filePath, updates }) => {
  try {
    await writeMetadata(filePath, updates)
    return { ok: true }
  } catch (err) {
    console.error('[Audis metadata:write Error]', err)
    throw err
  }
})

// ─── metadata:embedCover ────────────────────────────────────────────────────
ipcMain.handle('metadata:embedCover', async (_event, { filePath, imageSource }) => {
  try {
    await embedCoverArt(filePath, imageSource)
    return { ok: true }
  } catch (err) {
    console.error('[Audis metadata:embedCover Error]', err)
    throw err
  }
})

// ─── metadata:removeCover ───────────────────────────────────────────────────
ipcMain.handle('metadata:removeCover', async (_event, { filePath }) => {
  try {
    await removeCoverArt(filePath)
    return { ok: true }
  } catch (err) {
    console.error('[Audis metadata:removeCover Error]', err)
    throw err
  }
})

// ─── metadata:extractCover ──────────────────────────────────────────────────
ipcMain.handle('metadata:extractCover', async (_event, { filePath }) => {
  try {
    return await extractCoverArt(filePath)
  } catch (err) {
    console.error('[Audis metadata:extractCover Error]', err)
    throw err
  }
})

// ─── analysis:enqueue ─────────────────────────────────────────────────────
ipcMain.handle('analysis:enqueue', async (_event, { id, filePath, priority = 0 }) => {
  try {
    enqueueAnalysis(id, filePath, priority)
    return { queued: true }
  } catch (err) {
    console.error('[Audis analysis:enqueue Error]', err)
    throw err
  }
})

// ─── analysis:prioritize ──────────────────────────────────────────────────
ipcMain.handle('analysis:prioritize', async (_event, { id }) => {
  try {
    prioritizeAnalysis(id)
    return { ok: true }
  } catch (err) {
    console.error('[Audis analysis:prioritize Error]', err)
    throw err
  }
})

// ─── export:enqueue ───────────────────────────────────────────────────────
ipcMain.handle('export:enqueue', async (_event, { id, payload }) => {
  try {
    // Reset batch tracker when first item of a new batch arrives
    if (exportQueue.length === 0 && exportRunning.size === 0) {
      batchOutputDir    = payload?.outputDir || store.get('outputDir') || null
      batchTotalCount   = 0
      batchHasFinalItem = Boolean(payload?.isLastBatchItem)
    }
    enqueueExport(id, payload)
    return { queued: true }
  } catch (err) {
    console.error('[Audis export:enqueue Error]', err)
    throw err
  }
})

// ─── export:cancel ────────────────────────────────────────────────────────
ipcMain.handle('export:cancel', async (_event, { id }) => {
  try {
    const idx = exportQueue.findIndex(x => x.id === id)
    if (idx !== -1) {
      exportQueue.splice(idx, 1)
      return { cancelled: true }
    }
    // If already running we cannot cancel FFmpeg mid-flight
    return { cancelled: false, reason: 'already running or not found' }
  } catch (err) {
    console.error('[Audis export:cancel Error]', err)
    throw err
  }
})

// ─── batch:openOutputFolder ───────────────────────────────────────────────
ipcMain.handle('batch:openOutputFolder', async (_event, { outputDir } = {}) => {
  try {
    const dir = outputDir || store.get('outputDir')
    if (dir && fs.existsSync(dir)) {
      await shell.openPath(dir)
    }
    return { ok: true }
  } catch (err) {
    console.error('[Audis batch:openOutputFolder Error]', err)
    throw err
  }
})

// ─── settings:get ─────────────────────────────────────────────────────────
ipcMain.handle('settings:get', () => {
  // Return all settings except the raw encrypted apiKey
  const all = { ...store.store }
  delete all.apiKey   // never send the encrypted blob to the renderer
  return all
})

// ─── settings:set ─────────────────────────────────────────────────────────
ipcMain.handle('settings:set', (_event, updates) => {
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'apiKey') {
      // Encrypt before storing
      if (typeof value === 'string' && value.length > 0 && safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(value).toString('base64')
        store.set('apiKey', encrypted)
      }
      continue
    }
    store.set(key, value)
  }
  const all = { ...store.store }
  delete all.apiKey
  return all
})

// ─── settings:getApiKey ───────────────────────────────────────────────────
ipcMain.handle('settings:getApiKey', () => {
  try {
    const encrypted = store.get('apiKey')
    if (!encrypted || !safeStorage.isEncryptionAvailable()) return ''
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch (err) {
    console.error('[Audis getApiKey Error]', err)
    return ''
  }
})
