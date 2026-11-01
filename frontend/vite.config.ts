import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the React app runs on :5173 and proxies /api to the Spring Boot API on :8080,
// so there are no CORS headaches. In production set VITE_API_URL to your API's public URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8081', changeOrigin: true } },
  },
})
