import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173
  },
  resolve: {
    alias: {
      // Use locally-built packages so our latest changes are reflected
      '@daltonr/pathwrite-vue':        resolve(__dirname, '../../packages/vue-adapter/dist/index.js'),
      '@daltonr/pathwrite-store-http': resolve(__dirname, '../../packages/store-http/dist/index.js'),
      '@daltonr/pathwrite-core':       resolve(__dirname, '../../packages/core/dist/index.js'),
    }
  }
})


