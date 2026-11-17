import { Capacitor } from '@capacitor/core'

/** Android-only behaviour. Does nothing in a browser, so the PWA is unaffected. */
export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const [{ App }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
  ])

  // The phone's back button goes back inside the app, and closes the app from the first screen.
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void App.exitApp()
  })

  // Black status bar with light icons, matching the app header.
  await StatusBar.setOverlaysWebView({ overlay: false })
  await StatusBar.setBackgroundColor({ color: '#000000' })
  await StatusBar.setStyle({ style: Style.Dark })
}
