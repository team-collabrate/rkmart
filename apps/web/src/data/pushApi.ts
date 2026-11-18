export type PushPlatform = 'android' | 'web'

/** Saving this phone or browser as a place to send the signed-in person's alerts. */
export interface PushApi {
  /** Moves the device to the signed-in person (a shared phone follows whoever signs in). */
  registerToken(platform: PushPlatform, token: string): Promise<void>
  /** Stops alerts to this device. Only works for a token that belongs to the signed-in person. */
  forgetToken(token: string): Promise<void>
}
