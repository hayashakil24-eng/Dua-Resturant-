import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

// NO_ELECTRON=1 skips auto-launching the Electron shell so `vite` just serves
// the renderer as a plain browser page — for environments where Electron's
// own window can't be driven directly (e.g. WSLg forwarding a GUI window back
// to Windows, which has been unstable for this app's GPU/print paths).
const skipElectron = process.env.NO_ELECTRON === '1'

export default defineConfig({
  plugins: [
    react(),
    ...(skipElectron
      ? []
      : [
          electron({
            main: { entry: 'electron/main.js' },
            preload: { input: 'electron/preload.js' },
          }),
        ]),
  ],
  server: {
    port: 5173,
    // Electron opens its own window against this dev server — no need to
    // also pop a browser tab. (Still fine to leave false when NO_ELECTRON=1;
    // just open the printed URL yourself.)
    open: false,
  },
})
