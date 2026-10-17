import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Read website/.env (wherever vite is started from).
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)))
  return {
    plugins: [react()],
    // `npm run build` puts the finished site in server/site, where the Flask server
    // serves it. It's committed, so `git pull` on the Pi gets the latest website too.
    build: {
      outDir: '../server/site',
      emptyOutDir: true,
    },
    server: {
      // The app calls /api/... on its own address. While developing, Vite forwards those
      // calls to the Flask server set in .env.
      proxy: {
        '/api': { target: env.VITE_API_TARGET, changeOrigin: true },
      },
    },
  }
})
