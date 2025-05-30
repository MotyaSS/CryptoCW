// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': {
        target: 'http://localhost:8080', // Your Go backend address
        ws: true,
        changeOrigin: true
      },
      '/add_room': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/delete_room': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})