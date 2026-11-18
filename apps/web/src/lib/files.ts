import { Capacitor } from '@capacitor/core'

// Getting a file to the person: a normal download in the browser, the phone's share sheet in the
// Android app (where there is no downloads bar). From the share sheet they can save it, open it in
// a PDF viewer, or send it to a printer app or WhatsApp.

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function shareFromApp(blob: Blob, filename: string, title: string): Promise<void> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const written = await Filesystem.writeFile({
    path: filename,
    data: await toBase64(blob),
    directory: Directory.Cache,
  })
  await Share.share({ title, url: written.uri, dialogTitle: title })
}

function downloadInBrowser(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Saves a file (browser download) or opens the share sheet (Android app). */
export async function saveFile(blob: Blob, filename: string, title: string): Promise<void> {
  if (Capacitor.isNativePlatform()) return shareFromApp(blob, filename, title)
  downloadInBrowser(blob, filename)
}

/**
 * Opens a PDF so it can be printed. In the browser it opens the PDF viewer in a new tab (which has
 * a print button); in the Android app it opens the share sheet, where a print or PDF app can take it.
 */
export async function openForPrint(blob: Blob, filename: string, title: string): Promise<void> {
  if (Capacitor.isNativePlatform()) return shareFromApp(blob, filename, title)
  const url = URL.createObjectURL(blob)
  const opened = window.open(url, '_blank')
  // A blocked pop-up falls back to a normal download, so the person is never left with nothing.
  if (!opened) downloadInBrowser(blob, filename)
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)
}
