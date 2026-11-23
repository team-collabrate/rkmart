# End-to-end tests

Real-browser tests (Playwright, Chromium, phone size) that click through the app the way people do.
They live in `apps/web/e2e/`.

Run them:

```bash
npm run e2e
```

This builds the demo app, serves it, and runs the stories. Each story starts the demo with fresh
data and never reloads the page (the demo keeps its data in memory):

1. **Login protects against guessing.** Wrong PIN message, lockout after 5 wrong tries, only digits in the PIN box.
2. **A day's order.** The shop owner orders, the admin makes the bill, the delivery person delivers it.
3. **Money.** The admin records a payment; the reports (by shop, by item, dues) and the shop owner's
   statement show it.
4. **Tamil.** The language switch works on the login page and after sign in.

CI runs them after the normal checks (job "End to end").

## What these tests are, and are not

They test the real screens in a real browser against the **demo backend**, so they prove the screens
and the flow work. They do **not** talk to a real Supabase project: the database rules are tested
separately (`npm run test:db`, an in-memory Postgres running the real migrations), and the sign-in
and user-creation functions are first exercised when they are deployed.

When a Supabase test project exists, the next step is a second set of stories against it
(`supabase start` in CI, the migrations and `seed.sql`, the functions served locally). That needs
Docker, which this computer does not have.

## Using a browser you already have

If `npx playwright install chromium` is not possible, point `E2E_CHROME` at a Chromium executable:

```bash
E2E_CHROME="C:/path/to/chrome-headless-shell.exe" npm run e2e
```
