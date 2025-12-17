import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    port: 8000,
    strictPort: true,
    host: true,
  },
  build: {
    outDir: 'dist-overview',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'overview.html')
      }
    }
  },
})
