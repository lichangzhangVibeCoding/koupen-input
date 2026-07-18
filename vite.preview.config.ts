import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 仅用于本地浏览器预览 UI 主题（非 Electron 运行）
export default defineConfig({
  root: resolve('src/renderer'),
  resolve: {
    alias: { '@renderer': resolve('src/renderer/src') }
  },
  plugins: [react()],
  server: { port: 5199 }
})
