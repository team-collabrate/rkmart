# Stage 7: delivery and payments

Status: built and tested on the demo backend and in the database tests. The Supabase versions of the new calls and the photo upload are written but not yet run, because no Supabase project exists yet. The phone camera for the signed-copy photo is not yet tried on a phone.

## What each person can do now

**Distributor (delivery person)** - `Deliveries` and `History` tabs

- Deliveries: bills out for delivery, with shop name, address, a tap-to-call phone number and the bill amount. They never see items or prices.
- "Mark delivered" asks to confirm first, with an optional photo of the signed paper copy (opens the phone camera). The bill then moves to "Delivered today".
- History: deliveries of the last 7 days, grouped by day.

**Admin**

- Can mark a bill delivered from its order screen (when they deliver it themselves).
- **Balances** tab: every shop, biggest balance first, total to collect, date of the last payment.
- Tap a shop for its statement: balance now, billed and paid totals, every bill and payment in date order with the balance after each line.
- **Record a payment**: amount, cash / UPI / bank / other, date (today or earlier), optional bill it is for, optional note. A payment can be larger than the balance (an advance); the balance then shows as "Paid in advance".
- **Remove payment** for a wrongly entered one. It needs a reason, the balance goes back up, and the details stay in the audit log.

**Shop owner**

- **Payments** tab: what they owe (with the reminder text "please pay ₹x to RK"), billed and paid totals, and every bill and payment with the balance after each.
- A "Payment due" card on the home screen when something is owed.
- Payment alerts on the phone are Stage 8; for now the reminder is on these screens.

English and Tamil on all of them.

## The database functions

Migration `20261121100000_delivery_payments.sql`. The app cannot write orders or payments directly: these functions are the only way. All are audited.

| Function                                                    | Who                  | What it does                                                                                                                                      |
| ----------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mark_delivered(order, proof_path)`                         | admin or distributor | A billed order becomes delivered; records who, when and the photo path. A distributor can only reach bills of the last 7 days                     |
| `record_payment(shop, amount, method, date, invoice, note)` | admin                | Adds a payment. Amount above 0, at most 2 decimals; date today or within the last year; the bill (if named) must be this shop's and not cancelled |
| `void_payment(payment, reason)`                             | admin                | Deletes a wrong payment (reason of 3+ letters). The audit record keeps shop, amount, method, date, bill and reason                                |

Errors the screens turn into plain words: `not_allowed`, `not_billed`, `already_delivered`, `bad_amount`, `bad_date`, `invoice_mismatch`, `reason_required`, `not_found`, `not_admin`.

- A delivered bill cannot be cancelled, and neither can a bill with a payment against it (rules already in `cancel_bill`).
- A shop's balance = issued bills minus payments. It is calculated by the `shop_balances` view, never stored. The next bill shows it as "Previous balance".
- Photos go to a private storage bucket `delivery-proofs` (JPEG, PNG or WebP, 5 MB). Admin and distributors can add one; only the admin can read them. A failed photo upload never blocks the delivery.

## Decisions taken (change any of them)

- Any distributor can deliver any bill. The system records who did. There is no per-distributor assignment, so the printed bill does not carry a "Delivered by" name (the PDF is printed before delivery anyway).
- Only the admin records payments. Distributors do not collect or record cash in the app. If RK wants that, a "record payment" action for distributors is a small addition.
- The signed-copy photo is optional.
- Delivery cannot be undone in the app. A mistake is fixed by the admin through the database for now.
- Bank, UPI and cash are labels only; the app does not take payments.

## How it is built

- `data/payments.ts`: payment types, `buildStatement`, and the payment checks shared with the demo backend. `data/deliveryApi.ts`: the delivery interface (new). `data/mockPayments.ts`, `mockDeliveryApi.ts`: demo versions. `data/supabaseDeliveryApi.ts`, `supabaseStatement.ts` and additions to `supabaseAdminApi.ts` and `supabaseShopApi.ts`: real versions.
- `features/delivery/`: Deliveries, History, and the mark-delivered panel (also used by the admin order screen). `features/admin/BalancesPages.tsx`. `features/shop/PaymentsPage.tsx`.
- Text: `i18n/delivery.en.json` and `.ta.json` (new), `admin.pay.*`, `shop.payments.*`.
- The demo now starts with one delivered bill and one part payment for the first shop.

## Tests

- Database: 15 new tests for delivery and payments (who may call what, 7-day reach, photo path, locks, bad amounts and dates, wrong-shop bill, advance payments, void with audit, no direct writes). 102 database tests in total.
- Web: statement and payment checks, the demo delivery and payment backend, and every new screen (distributor list, confirm, photo, history, admin order delivery, balances, record, void, statement, shop payments and home card, Tamil).

## To check with RK

- Do distributors collect cash? If yes, add a payment action for them.
- Is a photo of the signed copy wanted, or is the tick enough?
- Should a bill be assigned to one distributor? Today either of the two can deliver any bill.
- Do shops pay by cash, UPI or bank? The list can be shortened.

## Not in this stage

- Phone alerts for a new order, a delivery, or a payment reminder (Stage 8).
- Sales and dues reports with CSV export (Stage 9).
