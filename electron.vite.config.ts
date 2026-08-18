import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/** Prefer source over stale tsc .js siblings (default Vite order puts .js first). */
const tsFirst = ['.tsx', '.ts', '.jsx', '.mts', '.mjs', '.js', '.json']

export default defineConfig({
  main: {
    resolve: { extensions: tsFirst },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    resolve: { extensions: tsFirst },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          recorder: resolve('src/preload/recorder.ts'),
          hud: resolve('src/preload/hud.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      },
      extensions: tsFirst
    },
    plugins: [react()]
  }
})
