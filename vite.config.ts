import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Native filesystem events are unreliable for this Windows-mounted
      // workspace when Vite is running inside WSL.
      usePolling: true,
      interval: 250,
    },
  },
})
