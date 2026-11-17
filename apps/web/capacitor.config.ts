import type { CapacitorConfig } from '@capacitor/cli'

// appId is the app's permanent identity on a phone. Confirm it with the client BEFORE the first
// release: changing it later makes Android treat the app as a different app.
const config: CapacitorConfig = {
  appId: 'com.rkgrocery.app',
  appName: 'RK Grocery',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
}

export default config
