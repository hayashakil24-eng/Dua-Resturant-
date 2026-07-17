import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: { entry: 'electron/main.js' },
      preload: { input: 'electron/preload.js' },
    }),
  ],
  server: {
    port: 5173,
    // Electron opens its own window against this dev server — no need to
    // also pop a browser tab.
    open: false,
  },
})
