// electron.vite.config.js
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import path from "path";
var __electron_vite_injected_dirname = "E:\\Users\\Ransom\\Documents\\GitHub\\Audis";
var electron_vite_config_default = defineConfig({
  // ─── Electron Main Process ───────────────────────────────────────────────
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__electron_vite_injected_dirname, "electron/main.js")
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
          index: path.resolve(__electron_vite_injected_dirname, "electron/preload.js")
        }
      }
    }
  },
  // ─── React Renderer Process ───────────────────────────────────────────────
  renderer: {
    root: "src",
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__electron_vite_injected_dirname, "src")
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__electron_vite_injected_dirname, "src/index.html")
        }
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
