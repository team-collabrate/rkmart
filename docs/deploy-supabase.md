# Putting RK Grocery live on Supabase

What goes where:

| Piece                                                            | Where it lives                                                                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Database, logins, rules, functions, private file storage         | **Supabase** (the project you create below)                                                                                               |
| The web app (what shops, the admin and the delivery person open) | A static web host. **Cloudflare Pages** is recommended (free, fast in India, installs as an app). Supabase itself does not host web apps. |
| The Android app (APK)                                            | Built on a computer, sent to the 8 phones                                                                                                 |

You do the steps that need your accounts or passwords. Nothing here asks you to share a password or
key with anyone; paste the keys only into your own terminal or into the host's settings page.

## 1. Create the Supabase project (10 minutes)

1. Sign up at supabase.com with the owner's email.
2. New project. Name `rk-grocery`, region **South Asia (Mumbai)**, a long database password (save it
   in a password manager). Choose the **Pro plan** (about $25 a month): it gives daily backups.
3. From the project's **Project Settings > API**, note the **Project URL** and the **anon public
   key** (safe to put in the app) and the **service_role key** (secret: only for the steps below).

## 2. Put the code on your computer

```bash
git clone https://github.com/team-collabrate/rkmart.git
cd rkmart
npm install
npm install -g supabase            # the Supabase command line
supabase login
supabase link --project-ref <the project reference, the code in the project URL>
```

## 3. Create the database and the secret

```bash
supabase db push                                    # builds every table, rule and function
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"   # prints a 48-character secret: the PIN pepper
supabase secrets set PIN_PEPPER=<paste the secret>
```

Keep a copy of the pepper somewhere safe and **never change it** (see `docs/pin-security.md`).

## 4. Deploy the functions

```bash
supabase functions deploy sign-in --no-verify-jwt
supabase functions deploy admin-users
supabase functions deploy send-push --no-verify-jwt     # alerts; needs the push secrets in docs/stage-8-notifications.md
```

## 5. Settings in the Supabase dashboard

- **Authentication > Providers > Email**: sign-ups **off**. Email confirmation can stay off.
- **Authentication > Rate limits**: leave the defaults.
- **Database > Backups**: confirm daily backups are on.
- **Storage**: the two private buckets `daily-bills` and `delivery-proofs` were created by the
  migrations; confirm both say "private".

## 6. The first logins and the products

```bash
# the admin (you)
SUPABASE_URL=<Project URL> SUPABASE_SERVICE_ROLE_KEY=<service_role key> PIN_PEPPER=<the secret> \
ADMIN_PHONE=<your 10-digit mobile> ADMIN_PIN=<a 4-digit PIN> ADMIN_NAME="RK Owner" \
node scripts/bootstrap-admin.mjs
```

Then load the 46 products (HSN and GST are samples for the accountant to confirm):
open the SQL editor in the dashboard and paste `supabase/prod-catalog.sql`.

Everything else is done inside the app as the admin: **More > Settings** (company name, address,
GSTIN, bank details), **More > Shops** (the real shops), **More > Logins** (a login and PIN for each
shop owner and the two delivery people), **Rates** (today's rates).

## 7. Build and host the web app

```bash
VITE_SUPABASE_URL=<Project URL> VITE_SUPABASE_ANON_KEY=<anon key> npm run build
```

Then either:

- **Cloudflare Pages** (recommended): create a Pages project from the GitHub repository, build
  command `npm run build`, output folder `apps/web/dist`, and add the two `VITE_` values under
  Settings > Environment variables. Every push to `main` then updates the site. The security headers
  file is already in `apps/web/public/_headers`.
- Or upload `apps/web/dist` to any static host.

The app's link will look like `https://rk-grocery.pages.dev`. Open it on a phone and choose "Add to
Home screen" to install it.

## 8. The Android app

```bash
VITE_SUPABASE_URL=<Project URL> VITE_SUPABASE_ANON_KEY=<anon key> npm run build
cd apps/web && npx cap sync android && cd android && ./gradlew assembleRelease
```

A release APK must be signed with RK's own key (see `docs/stage-2-app-shell.md`). Send the file to
the phones (WhatsApp or a download link) and allow "install from this source" once.

## 9. Check that it works (15 minutes)

1. Open the live link, sign in as the admin with the PIN. Wrong PIN five times locks the number.
2. In Rates set today's rates. Add one real shop and its login.
3. Sign in as that shop (private window), place an order. The admin sees it, makes the bill.
4. Sign in as a delivery person, mark it delivered. Record a payment. Look at Reports.
5. Open Balances and the day's PDF and print one bill on your printer next to the approved sheet.
6. Do the backup restore drill in `docs/backup-restore.md`.

## What we learned doing it for real (24 Nov 2026)

- **Key names.** Supabase now calls the keys _publishable_ (`sb_publishable_…`, goes in the web app as `VITE_SUPABASE_ANON_KEY`) and _secret_ (`sb_secret_…`, used as `SUPABASE_SERVICE_ROLE_KEY` in your own terminal only).
- **Deploy from GitHub.** With the GitHub integration on (production branch `main`, directory `supabase`), a push to `main` applies new migrations and deploys the functions listed in `supabase/config.toml`. A function with no `[functions.name]` entry there is not deployed.
- **The server role needs explicit table access** on new projects. Migration `20261124130000_service_role_grants.sql` does this; without it the admin script says "permission denied for table profiles".
- **The PIN secret is hidden after saving.** Keep the value in a password manager. The terminal and the dashboard must hold exactly the same value.

## What can go wrong

- "Sign in does not work": the `PIN_PEPPER` secret is missing or differs from the one used when
  the admin was created. Check `supabase secrets list`.
- "Not configured" on the login page: the two `VITE_` values were missing when the app was built.
- Alerts do not arrive: they need the Firebase and VAPID keys from `docs/stage-8-notifications.md`.
