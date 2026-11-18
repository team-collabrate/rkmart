import { emojiFor } from './itemVisual'

/**
 * The picture on an item card. Shows `imageUrl` when there is one; until the real photos are added
 * it shows a large emoji. Decorative: the item's name is always printed next to it.
 */
export function ItemArt({
  nameEn,
  category,
  imageUrl,
}: {
  nameEn: string
  category: string
  imageUrl?: string
}) {
  return (
    <div
      aria-hidden="true"
      className="mb-2 grid aspect-[5/4] place-items-center overflow-hidden rounded-2xl bg-white/55"
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <span className="text-5xl leading-none">{emojiFor(nameEn, category)}</span>
      )}
    </div>
  )
}
