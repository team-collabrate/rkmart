import { describe, expect, it } from 'vitest'
import { emojiFor, tintFor } from './itemVisual'

describe('item card colours', () => {
  it('gives the same category the same tint every time', () => {
    expect(tintFor('Pulses')).toBe(tintFor('pulses'))
    expect(tintFor('Pulses')).toBe(tintFor('Pulses'))
  })

  it('spreads categories over the tints', () => {
    const tints = new Set(['Rice and flour', 'Pulses', 'Staples', 'Oil', 'Spices'].map(tintFor))
    expect(tints.size).toBeGreaterThanOrEqual(3)
  })
})

describe('placeholder pictures', () => {
  it('picks a picture from the item name first, then its category', () => {
    expect(emojiFor('Ponni rice', 'Rice and flour')).toBe('🍚')
    expect(emojiFor('Rava', 'Rice and flour')).toBe('🌾')
    expect(emojiFor('Toor dal', 'Pulses')).toBe('🥣')
    expect(emojiFor('Sugar', 'Staples')).toBe('🍬')
    expect(emojiFor('Sunflower oil', 'Oil')).toBe('🧴')
    expect(emojiFor('Mystery item', 'Spices')).toBe('🌿')
  })

  it('falls back to the first letter, never to nothing', () => {
    expect(emojiFor('Kalonji', 'Misc')).toBe('K')
    expect(emojiFor('', '')).toBe('•')
  })
})
