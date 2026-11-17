import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Generates favicon, PWA icons and the Apple touch icon from public/logo.svg.
// Run: npm run icons -w apps/web
export default defineConfig({
  preset,
  images: ['public/logo.svg'],
})
