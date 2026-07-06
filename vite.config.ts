import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "node:path"

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: resolve(__dirname, "../dist/client"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "public/NeuroDesk.html"),
    },
  },
})
