import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'toolsx/shared': fileURLToPath(new URL('../../shared/index.ts', import.meta.url)),
      'toolsx/utils': fileURLToPath(new URL('../../utils/index.ts', import.meta.url))
    }
  }
})
