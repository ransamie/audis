/**
 * electron/preload.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Audis — Electron Preload / Context Bridge
 *
 * This script runs in the renderer process BEFORE the page loads, with access
 * to both DOM APIs and Node.js. It exposes a tightly-scoped `window.electronAPI`
 * object to the renderer via contextBridge — this is the ONLY way the React
 * frontend communicates with the Electron main process.
 *
 * Security note: contextIsolation=true + nodeIntegration=false in main.js
 * ensures the renderer cannot access Node.js APIs directly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { contextBridge, ipcRenderer } from 'electron'

// ─── Expose electronAPI to the renderer ────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {

  /**
   * Forwards renderer logs to main process.
   */
  logToMain: (level, ...args) => ipcRenderer.send('log:renderer', level, ...args),

  /**
   * Gets the absolute path of a dropped File object.
   */
  getPathForFile: (file) => {
    return file.path || ''
  },

  // ── File dialog ──────────────────────────────────────────────────────────
  /**
   * Opens a native OS file picker dialog.
   * @param {Object} options - Optional dialog configuration
   * @returns {Promise<string|null>} Absolute file path, or null if cancelled
   */
  openFileDialog: (options) =>
    ipcRenderer.invoke('dialog:openFile', options),

  /**
   * Opens a native OS directory picker dialog for output folder selection.
   * @param {Object} options - Optional dialog configuration
   * @returns {Promise<string|null>} Absolute folder path, or null if cancelled
   */
  openDirectoryDialog: (options) =>
    ipcRenderer.invoke('dialog:openDirectory', options),

  /**
   * Reads a local file into a Uint8Array buffer for fast WaveSurfer decoding.
   * @param {string} filePath - Absolute path to file
   * @returns {Promise<Uint8Array>}
   */
  readFileBuffer: (filePath) =>
    ipcRenderer.invoke('file:readBuffer', filePath),

  /**
   * Repairs and transcodes broken audio files (like AAC/M4A disguised as MP3) using FFmpeg.
   * @param {string} filePath - Absolute path to file
   * @returns {Promise<{ repairedPath: string, format: string }>}
   */
  repairAudioFile: (filePath) =>
    ipcRenderer.invoke('audio:repairFile', filePath),

  // ── Audio processing ─────────────────────────────────────────────────────
  /**
   * Triggers the full FFmpeg audio processing pipeline in the main process.
   * @param {Object} payload
   * @param {string} payload.mainPath   - Path to the main audio file
   * @param {number} payload.startTime  - Crop start in seconds
   * @param {number} payload.endTime    - Crop end   in seconds
   * @param {string} [payload.introPath] - Optional override for intro path
   * @param {string} [payload.outroPath] - Optional override for outro path
   * @returns {Promise<{ success: boolean, outputPath: string }>}
   */
  processAudio: (payload) =>
    ipcRenderer.invoke('audio:process', payload),

  /**
   * Registers a listener for real-time processing progress updates.
   * Called repeatedly during FFmpeg encoding.
   * @param {Function} callback - Receives { percent: number, timemark: string }
   * @returns {Function} Cleanup function — call it to remove the listener
   */
  onProgressUpdate: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('audio:progress', handler)
    // Return cleanup so React can unsubscribe in useEffect cleanup
    return () => ipcRenderer.removeListener('audio:progress', handler)
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  /**
   * Retrieves all stored app settings (introPath, outroPath, etc.)
   * @returns {Promise<Object>} Settings store object
   */
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),

  /**
   * Persists one or more settings values.
   * @param {Object} updates - Key-value pairs to merge into the settings store
   * @returns {Promise<Object>} Updated settings store object
   */
  setSettings: (updates) =>
    ipcRenderer.invoke('settings:set', updates),
})

// ── Intercept Drop Events for webUtils path extraction ──
// When a File object crosses the contextBridge into React, it loses its hidden
// internal path data. To fix this, we capture the drop event in the preload
// script (which has access to webUtils), extract the path, and store it.
window.addEventListener('drop', (e) => {
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    try {
      const file = e.dataTransfer.files[0]
      // In the preload context, the file object still has its path property intact.
      window.__lastDroppedFilePath = file.path || ''
    } catch (err) {
      console.warn('[Preload] Failed to get dropped file path:', err)
    }
  }
}, true) // Use capture phase so we get it before React does
