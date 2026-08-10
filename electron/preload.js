/**
 * electron/preload.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Audis — Electron Preload / Context Bridge
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { contextBridge, ipcRenderer } from 'electron'

// ─── Expose electronAPI to the renderer ────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {

  logToMain: (level, ...args) => ipcRenderer.send('log:renderer', level, ...args),

  // ── File dialogs ─────────────────────────────────────────────────────────
  openFileDialog: (options) =>
    ipcRenderer.invoke('dialog:openFile', options),

  openDirectoryDialog: (options) =>
    ipcRenderer.invoke('dialog:openDirectory', options),

  // ── File reading ─────────────────────────────────────────────────────────
  readFileBuffer: (filePath) =>
    ipcRenderer.invoke('file:readBuffer', filePath),

  // ── Audio processing ─────────────────────────────────────────────────────
  repairAudioFile: (filePath) =>
    ipcRenderer.invoke('audio:repairFile', filePath),

  processAudio: (payload) =>
    ipcRenderer.invoke('audio:process', payload),

  onProgressUpdate: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('audio:progress', handler)
    return () => ipcRenderer.removeListener('audio:progress', handler)
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),

  setSettings: (updates) =>
    ipcRenderer.invoke('settings:set', updates),

  // ── Resolve dropped file path via main process ────────────────────────────
  // webUtils cannot be safely imported as a named ESM export in this context.
  // Instead, the main process resolves the path using webUtils on its side.
  getDroppedFilePath: (fileName) =>
    ipcRenderer.invoke('file:getDroppedPath', fileName),
})
