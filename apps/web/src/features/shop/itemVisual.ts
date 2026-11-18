// Colours and placeholder art for item cards. The soft tint comes from the item's category, so a
// whole category looks like a family. The picture is a placeholder (an emoji) until real photos of
// the items are added: `ItemArt` already takes an `imageUrl` for that day.

export type Tint = 'green' | 'yellow' | 'peach' | 'pink' | 'blue' | 'lilac'

const TINTS: Tint[] = ['green', 'yellow', 'peach', 'pink', 'blue', 'lilac']

/** Full class names, so Tailwind can see them. */
export const TINT_BG: Record<Tint, string> = {
  green: 'bg-tint-green',
  yellow: 'bg-tint-yellow',
  peach: 'bg-tint-peach',
  pink: 'bg-tint-pink',
  blue: 'bg-tint-blue',
  lilac: 'bg-tint-lilac',
}

/** The same category always gets the same tint, on every phone and every day. */
export function tintFor(category: string): Tint {
  let hash = 0
  for (const ch of category.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return TINTS[hash % TINTS.length]
}

// First match wins, so more specific words come first.
const EMOJI: [RegExp, string][] = [
  [/rice|biryani|poha|aval/, '🍚'],
  [/wheat|atta|flour|rava|semolina|maida|ragi|millet/, '🌾'],
  [/dal|pulse|gram|lentil|peas|beans/, '🥣'],
  [/sugar|jaggery|sweet/, '🍬'],
  [/salt/, '🧂'],
  [/tea/, '🍵'],
  [/coffee/, '☕'],
  [/oil|ghee/, '🧴'],
  [/chilli|chili|pepper|masala/, '🌶️'],
  [/turmeric|coriander|cumin|mustard|fenugreek|spice/, '🌿'],
  [/tamarind/, '🍂'],
  [/milk|curd|butter|paneer/, '🥛'],
  [/onion/, '🧅'],
  [/potato/, '🥔'],
  [/tomato/, '🍅'],
  [/coconut/, '🥥'],
  [/egg/, '🥚'],
  [/biscuit|snack/, '🍪'],
]

/** A placeholder picture for an item, from its name and then its category. */
export function emojiFor(nameEn: string, category: string): string {
  const find = (text: string) => EMOJI.find(([pattern]) => pattern.test(text.toLowerCase()))?.[1]
  return find(nameEn) ?? find(category) ?? (nameEn.trim().charAt(0).toUpperCase() || '•')
}
