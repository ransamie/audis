/**
 * electron/preload.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Audis — Electron Preload / Context Bridge
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron'

// ─── Expose electronAPI to the renderer ────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {

  // ── Logging ──────────────────────────────────────────────────────────────
  logToMain: (level, ...args) => ipcRenderer.send('log:renderer', level, ...args),

  // ── File dialogs ─────────────────────────────────────────────────────────
  /** Legacy single-file picker → string | null */
  openFileDialog: (options) =>
    ipcRenderer.invoke('dialog:openFile', options),

  /** Multi-file picker → string[] | null */
  openFilesDialog: (options) =>
    ipcRenderer.invoke('dialog:openFiles', options),

  /** Folder picker (scans for audio files) → string[] | null */
  openFolderDialog: (options) =>
    ipcRenderer.invoke('dialog:openFolder', options),

  /** Legacy directory picker → string | null */
  openDirectoryDialog: (options) =>
    ipcRenderer.invoke('dialog:openDirectory', options),

  // ── File path resolution (Electron 31+, webUtils) ─────────────────────
  /**
   * Resolve a drag-and-dropped File object to its absolute file-system path.
   * Uses webUtils.getPathForFile directly in the preload context (safe because
   * this code runs in the main world bridge, not inside the sandbox).
   * @param {File} file  — the browser File object from a drop event
   * @returns {string}
   */
  getPathForFile: (file) => webUtils.getPathForFile(file),

  /** @deprecated Use getPathForFile(file) instead — kept for backward compat */
  getDroppedFilePath: (fileName) =>
    ipcRenderer.invoke('file:getDroppedPath', fileName),

  // ── File reading ─────────────────────────────────────────────────────────
  readFileBuffer: (filePath) =>
    ipcRenderer.invoke('file:readBuffer', filePath),

  // ── Audio processing (legacy single-file) ────────────────────────────────
  repairAudioFile: (filePath) =>
    ipcRenderer.invoke('audio:repairFile', filePath),

  processAudio: (payload) =>
    ipcRenderer.invoke('audio:process', payload),

  onProgressUpdate: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('audio:progress', handler)
    return () => ipcRenderer.removeListener('audio:progress', handler)
  },

  // ── Analysis queue ───────────────────────────────────────────────────────
  /**
   * @param {{ id: string, filePath: string, priority?: number }} payload
   */
  enqueueAnalysis: (payload) =>
    ipcRenderer.invoke('analysis:enqueue', payload),

  prioritizeAnalysis: (id) =>
    ipcRenderer.invoke('analysis:prioritize', { id }),

  /** Subscribe to analysis:start events. Returns an unsubscribe function. */
  onAnalysisStart: (cb) => {
    const h = (_, d) => cb(d)
    ipcRenderer.on('analysis:start', h)
    return () => ipcRenderer.removeListener('analysis:start', h)
  },

  /** Subscribe to analysis:result events. Returns an unsubscribe function. */
  onAnalysisResult: (cb) => {
    const h = (_, d) => cb(d)
    ipcRenderer.on('analysis:result', h)
    return () => ipcRenderer.removeListener('analysis:result', h)
  },

  /** Subscribe to analysis:error events. Returns an unsubscribe function. */
  onAnalysisError: (cb) => {
    const h = (_, d) => cb(d)
    ipcRenderer.on('analysis:error', h)
    return () => ipcRenderer.removeListener('analysis:error', h)
  },

  // ── Export queue ─────────────────────────────────────────────────────────
  /**
   * @param {{ id: string, payload: object }} args
   */
  enqueueExport: (payload) =>
    ipcRenderer.invoke('export:enqueue', payload),

  cancelExport: (id) =>
    ipcRenderer.invoke('export:cancel', { id }),

  /** Subscribe to export:start events. Returns an unsubscribe function. */
  onExportStart: (cb) => {
    const h = (_, d) => cb(d)
    ipcRenderer.on('export:start', h)
    return () => ipcRenderer.removeListener('export:start', h)
  },

  /** Subscribe to export:progress events. Returns an unsubscribe function. */
  onExportProgress: (cb) => {
    const h = (_, d) => cb(d)
    ipcRenderer.on('export:progress', h)
    return () => ipcRenderer.removeListener('export:progress', h)
  },

  /** Subscribe to export:done events. Returns an unsubscribe function. */
  onExportDone: (cb) => {
    const h = (_, d) => cb(d)
    ipcRenderer.on('export:done', h)
    return () => ipcRenderer.removeListener('export:done', h)
  },

  /** Subscribe to export:error events. Returns an unsubscribe function. */
  onExportError: (cb) => {
    const h = (_, d) => cb(d)
    ipcRenderer.on('export:error', h)
    return () => ipcRenderer.removeListener('export:error', h)
  },

  /** Subscribe to batch:complete events. Returns an unsubscribe function. */
  onBatchComplete: (cb) => {
    const h = (_, d) => cb(d)
    ipcRenderer.on('batch:complete', h)
    return () => ipcRenderer.removeListener('batch:complete', h)
  },

  /** Open the output folder in the OS file manager. */
  openOutputFolder: (outputDir) =>
    ipcRenderer.invoke('batch:openOutputFolder', { outputDir }),

  // ── Settings ─────────────────────────────────────────────────────────────
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),

  setSettings: (updates) =>
    ipcRenderer.invoke('settings:set', updates),

  /** Securely retrieve the decrypted API key (never stored in plain text). */
  getApiKey: () =>
    ipcRenderer.invoke('settings:getApiKey'),
})
