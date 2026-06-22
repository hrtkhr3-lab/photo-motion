import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' → 相対パス出力。GitHub Pages のサブパス配信でもそのまま動く。
export default defineConfig({
  base: './',
  plugins: [react()],
})
