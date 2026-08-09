import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // ─── Electron Main Process ───────────────────────────────────────────────
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'electron/main.js')
        }
      }
    }
  },

  // ─── Electron Preload Script ──────────────────────────────────────────────
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'electron/preload.js')
        }
      }
    }
  },

  // ─── React Renderer Process ───────────────────────────────────────────────
  renderer: {
    root: 'src',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/index.html')
        }
      }
    }
  }
})
