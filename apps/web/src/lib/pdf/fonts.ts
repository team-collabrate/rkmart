import pdfMake from 'pdfmake/build/pdfmake'
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff?url'
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff?url'
import tamil400 from '@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-400-normal.woff?url'
import tamil700 from '@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-700-normal.woff?url'

// Fonts ship inside the app, so PDFs can be made offline, in the PWA and in the APK.

async function toBase64(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load font ${url}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

let ready: Promise<void> | null = null

async function load(): Promise<void> {
  const [i4, i7, t4, t7] = await Promise.all([inter400, inter700, tamil400, tamil700].map(toBase64))
  pdfMake.addVirtualFileSystem({
    'inter-400.woff': i4,
    'inter-700.woff': i7,
    'tamil-400.woff': t4,
    'tamil-700.woff': t7,
  })
  pdfMake.addFonts({
    Inter: {
      normal: 'inter-400.woff',
      bold: 'inter-700.woff',
      italics: 'inter-400.woff',
      bolditalics: 'inter-700.woff',
    },
    NotoTamil: {
      normal: 'tamil-400.woff',
      bold: 'tamil-700.woff',
      italics: 'tamil-400.woff',
      bolditalics: 'tamil-700.woff',
    },
  })
}

export function ensurePdfFonts(): Promise<void> {
  ready ??= load().catch((error: unknown) => {
    ready = null
    throw error
  })
  return ready
}
