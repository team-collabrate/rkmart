# Stage 3: admin setup screens

Status: built and tested against the demo data source. The Supabase version is written but not yet run, because no Supabase project exists yet.

## What the admin can now do (More tab and Rates tab)

| Screen           | Path                   | What it does                                                                                                           |
| ---------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Today's rates    | `/admin/rates`         | One box per item, "Same as yesterday" fills the empty ones, change shown against yesterday, save, missing-rate warning |
| Setup menu       | `/admin/more`          | Links to the four areas below                                                                                          |
| Items            | `/admin/more/items`    | List with search; add, edit, switch off. English and Tamil name, category, unit, HSN code, GST rate, position          |
| Shops            | `/admin/more/shops`    | List; add, edit, switch off. English and Tamil name, owner, phone, address, GST state code, GSTIN                      |
| Logins           | `/admin/more/users`    | List; create a login (shop owner, distributor or admin); reset a password; switch a login off or on                    |
| Company settings | `/admin/more/settings` | RK name, address, phone, GSTIN, state code, bank details, invoice prefix, rates include GST or not                     |

All screens work in English and Tamil, on a phone and on a laptop.

## Rules built in

- Items and shops are switched off, never deleted, so old bills keep them.
- A shop cannot order an item that has no rate for today. The rates screen counts those items.
- Rates are saved per Indian calendar day (time zone Asia/Kolkata), whatever the phone's time zone is.
- "Same as yesterday" fills only empty boxes and keeps anything already typed. It copies the most recent earlier rate of each item.
- Rate boxes accept numbers like `1350`, `1,350` or `46.50`. Text, negatives and three decimals are refused.
- Form checks: GSTIN format, HSN 4 to 8 digits, GST slab from the list (0, 0.25, 3, 5, 12, 18, 28), 10-digit mobile number, 8 to 72 character password, invoice prefix of 1 to 6 capital letters or digits.
- The admin cannot switch off their own login. A login for a shop owner must be linked to a shop.
- Logins are created through the `admin-users` function from Stage 1, so the service-role key never reaches the app.

## How it is built

- `data/adminApi.ts`: the one interface the screens use.
- `data/mockAdminApi.ts`: in-memory demo version (development, tests, demo builds).
- `data/supabaseAdminApi.ts`: real version using Supabase tables and the `admin-users` function. Not yet run against a live project.
- `data/ApiProvider.tsx` and `data/apiContext.ts`: pick the version and provide a TanStack Query cache.
- `features/admin/`: screens, `rates.ts` (rates logic), `schemas.ts` (form checks, Zod).
- Text: `i18n/admin.en.json` and `i18n/admin.ta.json`.

A release with no server configured reads and writes nothing ("The app is not set up yet").

## Tests

85 web tests (49 new): rates logic, form checks, the demo data source, and every screen (rates, items, shops, logins, settings, menu) in English, with a Tamil check on the rates screen. Plus the 39 database tests.

## Needed from the client before real use

- RK GSTIN, address and bank details (company settings).
- The real item list with HSN codes and GST rates, confirmed by their accountant.
- The shop list with phone numbers and GSTINs.

## Left for later

- Real Supabase run: create projects, apply migrations, check each call end to end (including `admin-users`).
- Items and shops cannot be bulk-imported yet. A spreadsheet import could be added if the list is long.
