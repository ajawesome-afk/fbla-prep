import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When hosting on a subdomain like fbla.aahanjain.com, the base should be '/'
// because the app is served from the root of that subdomain.
export default defineConfig({
  plugins: [react()],
  base: '/', 
})