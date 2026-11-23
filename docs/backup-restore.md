# Backup and restore

The money data (bills, payments, balances) is the part that cannot be lost. This page says how it
is protected and how to prove it can be brought back.

## What protects the data

- **Supabase backups.** The Pro plan takes a daily backup and keeps 7 days (point-in-time recovery
  is an extra). Turn it on in the project's Database settings and note the plan. The free plan has
  no usable backup.
- **Bills are never deleted or edited.** A wrong bill is cancelled (its number stays used) and a
  corrected one gets a new number. Every money action is in the audit log.
- **A second copy you control.** Once a week the admin can export the day's bills and the reports
  (Reports, "Export CSV") and keep them in Google Drive. This is not a full backup, but it means the
  books can be rebuilt on paper if everything else fails.
- **The day's bill PDFs** are saved in a private storage bucket and in the app. They are separate
  from the database backup.

## The restore drill (do it once before going live, then twice a year)

Prove a backup really comes back, on a test project, never on the live one:

1. Make a **second Supabase project** called "rk-restore-test".
2. In the live project: Database, Backups, pick the latest daily backup. Download it (or use
   `supabase db dump --linked -f backup.sql` for a schema-and-data copy).
3. Restore it into the test project (Supabase restores a backup into the same project; for another
   project load the dump with `psql <test connection string> -f backup.sql`).
4. Compare the two. Run the same checks in both and look for equal answers:

   ```sql
   select count(*) from public.invoices;
   select max(seq) from public.invoices;                          -- last bill number
   select sum(grand_total) from public.invoices where status = 'issued';
   select sum(amount) from public.payments;
   select count(*) from public.orders;
   ```

5. Sign in to the test project's app as the admin (set `VITE_SUPABASE_URL` for a build that points
   at it) and open Balances and Reports. The numbers must match what the live app shows.
6. Place a test order and make a bill in the restored project. The new bill must carry the **next**
   number, not a repeat.
7. Write the date and the result at the bottom of this file. Delete the test project.

Also restore the two **storage buckets** (`daily-bills`, `delivery-proofs`): database backups do not
include their files. Download them from the live project's Storage page and upload them to the test
project, then open one PDF.

## What has been tested already

`supabase/tests/backup_restore.test.ts` copies a whole test database as a backup file, restores it
as a new database and checks that every table has the same rows, the bills and payments match to
the paisa, the access rules (row-level security and policies) are all still there, and the bill
number counter carries on. That proves the data model restores cleanly. It is **not** a substitute
for the drill above, which tests Supabase's own backup on your real project.

## Drill log

| Date           | Done by | Result |
| -------------- | ------- | ------ |
| (not done yet) |         |        |
