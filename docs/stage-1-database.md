# Stage 1: database, login and roles

Status: built and tested locally (39 tests). Not yet applied to a Supabase cloud project, because no project exists yet.

## What was built

- `supabase/migrations/` (5 files, run in order):
  1. types
  2. shops, profiles, products, daily rates, settings
  3. orders, order items, invoices, invoice lines, payments, daily PDFs, push tokens, audit log
  4. role helpers and guards on issued bills
  5. privileges, row level security (RLS) and the shop balance view
- `supabase/functions/admin-users/`: the only way logins are created, reset or switched off.
- `supabase/seed.sql`: 5 sample shops, 15 sample items with Tamil names, HSN codes and today's rates.
- `scripts/`: `bootstrap-admin.mjs` (first admin) and `seed-demo-users.mjs` (dev only).
- `supabase/config.toml`: public sign-up is switched off and passwords need 8 or more characters.

## Who can see and do what (as enforced by the database)

| Table or view                        | Shop owner            | Distributor                 | Admin                 |
| ------------------------------------ | --------------------- | --------------------------- | --------------------- |
| shops                                | own shop              | all shops (for addresses)   | all, can edit         |
| profiles                             | own row, own language | own row                     | all                   |
| products                             | read                  | read                        | read, edit            |
| daily_rates                          | read                  | none                        | read, edit            |
| orders                               | own                   | billed or delivered, 7 days | all                   |
| order_items                          | own                   | none                        | all                   |
| invoices                             | own                   | totals for visible orders   | all                   |
| invoice_items                        | own                   | none                        | all                   |
| payments                             | own                   | none                        | all                   |
| shop_balances (view)                 | own                   | none                        | all                   |
| settings, audit_log, daily_bill_pdfs | none                  | none                        | read (settings: edit) |

Nobody, including the admin, writes orders, invoices or payments directly. Those writes go through
database functions added in Stages 4 to 7. The balance is calculated (invoices minus payments), never stored.

## Protections on bills

- An issued invoice cannot be edited or deleted. The only change allowed is cancelling it; the number stays.
- Invoice lines are frozen.
- Item names, prices and shop details are copied onto the invoice, so later changes never alter an old bill.

## Logins

- A login is a mobile number plus a password. Supabase needs an email, so each phone maps to `<phone>@rk.local`.
- There is no public sign-up. The admin creates every login through `admin-users`, which keeps the
  service-role key on the server side only.
- A deactivated user sees no data and cannot sign in.

## Decisions to confirm

- Distributors see every shop's name and address and the totals of bills out for delivery, but never items or prices.
- Rates are stored before GST. Switch `settings.rates_include_gst` if the client prefers GST-inclusive rates (changes Stage 5).
- Invoice numbers use the form `RK/2627/0042` (prefix, financial year, serial). The accountant should confirm.

## How to run the tests

```bash
npm run test:db
```

This runs the real migrations in an in-process Postgres (PGlite), so no Docker is needed.

## Next: bring it up on a Supabase project (needs your login)

1. Create two projects: `rkmart-dev` and `rkmart-prod`.
2. Apply the migrations (`supabase link`, then `supabase db push`), then run `seed.sql` on dev only.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your terminal (never in a file), then run
   `node scripts/bootstrap-admin.mjs`.
4. Deploy the function: `supabase functions deploy admin-users`.
5. Check the real project with the Supabase security advisor.

The `admin-users` function has not been run against a live project yet.
