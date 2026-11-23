# Redesign handoff

Branch: `redesign` (pushed to `team-collabrate/rkmart`). `main` still has the earlier version. Merge only when the owner says so.
Figma file: https://www.figma.com/design/77wW10eWSJ4K9LpRqZnXKP ("RK Grocery – Mobile UI": style sheet and the redesigned screens).

## The process used for every page (repeat it)

1. **Design in Figma first** (style sheet already there). One phone frame, 390 wide. Take a screenshot and check it.
2. **Build from the design** in `apps/web/src/features/...`. Reuse the shared pieces below.
3. **Make it static** (the owner's rules):
   - Phone width only (the app is one column, max 30rem).
   - Fixed heights, one line of text per element, cut with "…" if long. No animation, no press-down effects, no sliding.
   - Grey placeholder shapes while loading, never "Loading…". Counters show "–" until data arrives.
   - Fewer words: icons and numbers carry the meaning. Keep the full sentence as `sr-only` text or `aria-label` so tests and screen readers still work.
   - Show only the chosen language's name (no second-language line). Shorten Tamil text so it stays on one line.
4. **Check English against Tamil in the browser**: switch language and compare every element's top and height (script below). Anything that moves or wraps is a bug.
5. `npm run typecheck`, `npm run lint`, `npm run test` (223 pass), `npm run format:check`, rebuild the demo, commit, push `redesign`.

Stability check (run in the browser pane on the page, signed in as admin):

```js
const click = (l) =>
  [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === l).click()
const snap = () =>
  [...document.querySelectorAll('main section *, nav[aria-label=Main] *')].map((e) => {
    const r = e.getBoundingClientRect()
    return [Math.round(r.top), Math.round(r.height)]
  })
click('English')
await new Promise((r) => setTimeout(r, 800))
const en = snap()
click('தமிழ்')
await new Promise((r) => setTimeout(r, 800))
const ta = snap()
en.filter((a, i) => a[0] !== ta[i][0] || a[1] !== ta[i][1]).length // must be 0
```

## Design system (already in code)

- Tokens: `apps/web/src/index.css` (`brand` green #16a34a, `brand-soft`, `line`, `page`, status colours `amber`/`blue`/`red` with `-soft`, item tints `tint-*`). Components: `components.css` (`.btn`, `.btn-outline`, `.field`).
- Tamil font is bundled as "Noto Sans Tamil Fit" (size-adjust 90%) and loaded at start-up in `main.tsx`, so switching language never jumps.
- Shared pieces in `apps/web/src/components/`: `TopBar` (logo placeholder, EN | தமிழ், sign out), `BrandLogo` (set `LOGO_SRC` for the real logo), `BottomNav` (floating glass pill), `Avatar`, `StatusSteps`, `QuantityCapsule`, `ReceiptEdge`, `LanguageSwitch` (`compact`), `AppShell`.
- Item pictures are emoji placeholders (`features/shop/itemVisual.ts`, `ItemArt.tsx`). `ItemArt` already accepts an `imageUrl`; the owner will supply generated images once the item list is final.
- Full-bleed page pattern: `<section className="-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page pb-28">` with a white rounded header (`TopBar`, title, date pill) and `px-4` body. `AppShell` hides its own top bar for the pages listed in `ownHeader`.
- Floating action bars sit at `fixed bottom-[6.25rem]` (above the nav).

## Done on `redesign`

Admin: Orders, order detail, bill, Balances and shop statement (payment form), Bills (day's PDF), Rates, More (2x2 icon cards with counts, Alerts card), and the Items, Shops and Users lists (card lists, round + buttons, avatars/emoji tiles; shared `PageHeader` and `StatusPill` in `components/ui.tsx`). English and Tamil layouts were measured identical on More and Items.

**New feature: admin places an order for a shop** (for clients who phone or visit). `orders/new` (`NewOrderPage.tsx`, the + on Orders), DB function `admin_place_order` (migration 20261123100000, tests in `supabase/tests/admin_place_order.test.ts`), `AdminApi.placeOrderForShop`. The order then opens like any other: bill it, mark delivered. The shop does not get a new-order alert for it; other admins do. Also: floating bottom nav, shared top bar, status pills, green theme, phone-only layout, Tamil font fit.

**Shop owner (done):** Home, Order (list rows, category chips), Review, My orders, Order detail, Payments, all built from Figma frames `Shop / ...` and using `ShopPage` (header + grey page). English and Tamil measured identical. Language switch is the one-letter pill A | அ. Pack-size rules per product are still to come.

**Distributor (done, built without Figma frames because the Figma tool limit was reached):** Deliveries, mark-delivered panel, History, using the shared `components/PhonePage.tsx`. English and Tamil measured identical. Make Figma frames later if wanted.

## Still to do (in this order of value)

1. **Admin forms**: Settings, Item/Shop/New user forms and User detail only inherit the new header and colours. Redesign them Figma-first, then run the stability check. Also run the English vs Tamil check on Shops, Users and New order.
2. **Shop owner screens**: `features/shop/` (home, order grid is closest to the reference but not Figma-first, review, my orders, order detail, payments).
3. **Distributor screens**: `features/delivery/DeliveryPages.tsx`, `MarkDeliveredPanel.tsx`.
4. **Login page**: `features/auth/LoginPage.tsx`.
5. Replace emoji with real item images; replace the logo placeholder.
6. Decide when to merge `redesign` into `main`.

## Gotchas learned

- When a page gets its own header, update tests that used it as the "page with the shared top bar" (e.g. `app/RequireRole.test.tsx` now uses `/admin/more`).
- Keep full sentences as `sr-only` or `aria-label`; tests rely on them.
- The browser pane's phone-size screenshots crop the right edge; use the desktop view (the app is a centred phone column) and JS measurements.
- 21st.dev: free tier allows 2 component downloads per day; search is free. Components used so far: Steps and Quantity (adapted, not copied); the nav was built from the descriptions of Floating Nav, LumaBar and Bottom Nav Bar.
- Windows: heredocs in the shell are unreliable; use the Write tool or small node scripts. Do not `rm -rf` build folders (a safety check blocks it).

## Running it

```bash
npm run build:demo -w apps/web          # demo build (demo logins, in-memory data)
cd apps/web && npx vite preview --port 3000 --host 127.0.0.1
```

Demo logins (PIN `1234`): admin `9000000001`, shop owner `9100000001`, distributor `9200000001`.

Open items from earlier stages are in `docs/stage-*.md` (Supabase and Firebase accounts, client questions, accountant checks).
