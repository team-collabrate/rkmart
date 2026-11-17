# Stage 4: shop ordering

Status: built and tested on the demo backend and in the database tests. The Supabase version of the shop screens is written but not yet run, because no Supabase project exists yet.

## What the shop owner can do now

| Screen        | Path                 | What it does                                                                                               |
| ------------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Home          | `/shop`              | Whether today's rates are ready, "Order now", the last order with "Repeat last order", recent orders       |
| Order         | `/shop/order`        | Items with today's rate, search, Add and quantity (minus, plus, or type like 2.5), running total, cart bar |
| Review        | `/shop/order/review` | Change quantities, note for RK, total, "Place order". Items that lost their rate are named and left out    |
| My orders     | `/shop/orders`       | All orders, newest first, with a status label                                                              |
| Order details | `/shop/orders/:id`   | Items, rates of that day, total, note, "Repeat this order"                                                 |

English and Tamil, on a phone and a laptop. The cart is kept on the phone (so it survives closing the app) and is emptied when someone else signs in on the same phone or after an order is placed.

## The database function: `place_order`

Migration `20261118100000_place_order.sql`. It is the only way an order is created.

- Only an active shop owner of an active shop can call it. Admin, distributors, deactivated users and visitors are refused.
- Every item must be active and have a rate for today (Indian calendar day). One bad line saves nothing.
- Quantities must be above 0, at most 100,000, with at most 3 decimals. The same item listed twice becomes one line.
- The saved rate is the server's rate. A rate sent by the app is ignored.
- A note of up to 500 characters is saved, and an audit record is written.
- The `orders` table is added to Supabase realtime, so the admin's screen can update live (the admin orders screen is built in Stage 5).

## Order status labels (shop's view)

| Status    | English    | Tamil        | Look           |
| --------- | ---------- | ------------ | -------------- |
| placed    | Placed     | போடப்பட்டது    | dashed outline |
| billed    | Bill ready | பில் தயார்     | double outline |
| delivered | Delivered  | டெலிவரி ஆச்சு | solid black    |
| cancelled | Cancelled  | ரத்து         | struck through |

## How it is built

- `data/shopApi.ts`: the interface. `data/mockShopApi.ts` repeats the server's checks for the demo. `data/supabaseShopApi.ts` is the real version (reads orders under row level security, creates orders with `place_order`).
- `data/mockState.ts`: one demo "server" shared by the admin and shop demo APIs, so a rate the admin sets is what the shop sees. A fresh demo starts with today's rates set and two past orders for the first shop.
- `features/shop/`: screens, `cart.ts` (pure cart maths), `cartStore.ts` (Zustand, saved on the phone).
- Text: `i18n/shop.en.json` and `i18n/shop.ta.json`.

## Tests

- 60+ new tests. Database: 12 `place_order` tests (permissions, rates, quantities, rollback, audit). Web: cart maths, the demo shop backend, and every shop screen including the full cart to placed order flow, repeat order, an item losing its rate, and Tamil.
- Totals: 112 web tests and 51 database tests.

## Decisions to confirm with the client

- Can a shop change or cancel an order after placing it? Not built yet: orders are final once placed (the admin can handle changes by phone until a rule is agreed).
- Is there a cut-off time for orders (for example 9 pm for next-morning delivery)?
- Quantities for items sold by weight accept decimals (2.5 kg). Does any item need whole numbers only?
- The shop sees today's rate before GST. The final amount with tax is on the bill (Stage 5).

## Not in this stage

- The admin's orders inbox, live alert and "Generate bill" (Stage 5).
- The shop's payments screen and delivered status updates (Stage 7).
