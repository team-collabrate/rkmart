# Stage 5: admin orders and GST billing

Status: built and tested on the demo backend and in the database tests. The Supabase version of the admin screens is written but not yet run, because no Supabase project exists yet.

## What the admin can do now

| Screen        | Path                     | What it does                                                                                                           |
| ------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Orders inbox  | `/admin/orders`          | The day's orders, day arrows, counts per status as filters, "Generate bills for all new orders" (asks first)           |
| Order details | `/admin/orders/:id`      | Shop details, note, quantities (change or remove an item before billing), "Save changes", "Generate bill"              |
| Bill          | `/admin/orders/:id/bill` | The GST bill: company, shop, lines, CGST+SGST or IGST, round-off, previous balance, total due, amount in words, cancel |

- New orders show up by themselves (live updates from the server, plus a refresh every 30 seconds as a back-up).
- Quantities can only be changed while the order is "New". The shop's rate is kept. Save the changes first, then make the bill.
- "Generate bills for all new orders" makes the bills one by one in the order the orders arrived, so invoice numbers follow arrival.
- A bill can be cancelled with a reason. The number is never used again, the order goes back to "New", and the new bill gets a new number.
- A bill cannot be cancelled after delivery or once a payment is recorded against it.
- A warning shows on the bill screen while the company GSTIN is empty in Settings.

English and Tamil, on a phone and a laptop. Printing the day's bills as one PDF is Stage 6.

## The database functions

Migration `20261119100000_billing.sql`. The app role cannot write orders or invoices directly: these functions are the only way.

| Function                       | Who   | What it does                                                                                                                        |
| ------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `finalize_bill(order)`         | admin | Takes the next number of the financial year, copies names and prices, works out GST per line, round-off, previous balance, locks it |
| `cancel_bill(invoice, reason)` | admin | Marks the bill cancelled (number stays used), puts the order back to "New", writes an audit record                                  |
| `adjust_order(order, lines)`   | admin | Changes quantities or removes items while the order is "New". An empty order or an item not in the order is refused                 |

Errors the screens turn into plain words: `not_placed`, `empty_order`, `not_found`, `already_cancelled`, `already_delivered`, `has_payments`, `reason_required`, `bad_quantity`, `not_in_order`.

## GST rules built in

- Rates are stored before GST by default. A setting switches to GST-inclusive rates, and then the tax is taken out of the rate.
- Same state as the company: CGST and SGST (half each). Another state: IGST.
- Each line is rounded to the paisa (half up). CGST is half of the line's tax rounded, SGST is the rest, so the two always add up to the tax.
- The bill total is rounded to a whole rupee and the round-off is shown.
- Invoice number: `PREFIX/FY/0001`, for example `RK/2627/0001`. The financial year runs April to March. The counter is per year and has no gaps, even when two bills are made at once.
- Previous balance on a bill = earlier issued bills minus payments for that shop. Total due = bill total + previous balance.
- An issued bill cannot be edited (a database guard stops it). Only cancelling is allowed.
- The same 11 test cases (`supabase/tests/fixtures/gst-cases.json`) run against the SQL function and the TypeScript preview, so the two cannot drift apart.

## How it is built

- `lib/gst.ts`: GST maths in whole paise (no floating point). `lib/words.ts`: amount in words (Indian system).
- `data/adminApi.ts`: the interface (`listOrders`, `getOrderDetail`, `adjustOrder`, `generateBill`, `cancelBill`, `onOrdersChanged`). `data/mockAdminApi.ts` and `data/mockBilling.ts` repeat the server's rules for the demo. `data/supabaseAdminApi.ts` is the real version.
- `features/admin/`: `OrdersInbox.tsx`, `OrderDetail.tsx`, `BillPage.tsx`, order queries in `queries.ts`.
- Text: `i18n/admin.en.json` and `i18n/admin.ta.json` (`admin.orders.*`, `admin.bill.*`).

## Tests

- Database: 21 billing tests (numbering, GST split, previous balance, cancel and reissue, locks, permissions) and the GST fixtures. 82 database tests in total.
- Web: GST maths against the fixtures, demo billing rules, and every new screen in English and Tamil. 155 web tests in total.

## Decisions to confirm with RK's accountant before real use

- The invoice number format (`RK/2627/0001`) and whether one series is enough.
- Rounding to a whole rupee, and how the round-off line should look on the printed bill.
- How a wrong bill is corrected: today it is cancelled and a new one made with a new number. Some businesses need a credit note instead once the bill has been handed over.
- Whether e-invoicing applies to RK's turnover. It is not built.
- Rates before or after GST. This changes the cart total and the bill.
- Item GST rates and HSN codes. The demo values are samples.

## Not in this stage

- The day's PDF with two half-A4 bills per page (Stage 6).
- Delivery, signed copy and payments (Stage 7). Until then a bill can only be "billed", not "delivered", in the real app.
- Alerts when an order arrives while the app is closed (Stage 8).
