# Stage 2: app shell

Status: built and tested. Login against a real Supabase project is written but not yet run, because no project exists yet. A demo mode makes the whole shell usable today.

## What was built

- **Login** by mobile number and password (`features/auth/LoginPage.tsx`): validation, show/hide password, clear error messages in English and Tamil, large touch targets.
- **Auth layer** (`features/auth/`): one `AuthService` interface with two implementations.
  - `supabaseAuth.ts`: real sign-in against Supabase, loads the user's profile, treats a missing or deactivated profile as no access, saves the language choice to the profile.
  - `mockAuth.ts`: demo mode, used only in development or in a build made with `--mode demo`. A real release with no Supabase settings refuses to sign anyone in ("The app is not set up yet").
- **Route guards** (`app/RequireRole.tsx`): signed-out visitors go to login; a user who opens another role's area is sent to their own.
- **App shell** (`components/AppShell.tsx`): header with logo, role badge, language switch, sign out. Navigation is a bottom bar on phones and a left sidebar on laptops. Offline banner and a crash screen with a reload button.
- **Role areas and tabs** (screens are placeholders that name the stage that builds them):
  - Shop owner: Home, Order, Orders, Payments
  - Admin: Orders, Rates, Bills, Balances, More
  - Distributor: Deliveries, History
- **Language**: English and Tamil, a switch on every screen, saved on the user's profile and on the device.
- **Android**: the phone's back button goes back inside the app (and closes it from the first screen); black status bar.
- **PWA**: manifest, icons and service worker from Stage 0; the app now installs as a normal app.

## Try it without a server

Run `npm run dev` and open http://localhost:5173. The login page lists the demo accounts:

| Role        | Mobile number | PIN  |
| ----------- | ------------- | ---- |
| Admin       | 9000000001    | 1234 |
| Shop owner  | 9100000001    | 1234 |
| Distributor | 9200000001    | 1234 |

`npm run build:demo -w apps/web` makes a build with the demo login, for testing the APK on a phone.
Never ship that build to the client as the real app.

## Build modes

| Command                            | Demo login | Spike pages | Use                        |
| ---------------------------------- | ---------- | ----------- | -------------------------- |
| `npm run dev`                      | yes        | yes         | Development                |
| `npm run build`                    | no         | no          | Real release               |
| `npm run build:demo -w apps/web`   | yes        | yes         | Phone and APK testing      |
| `npm run build:spikes -w apps/web` | no         | yes         | Stage 0 PDF and PWA checks |

## Tests

- 36 web tests: login screen (validation, wrong password, role routing, Tamil), route guards, tab lists per role, demo auth, phone number handling, Stage 0 helpers.
- 39 database tests (Stage 1).

## Still to do for login

- Create the Supabase projects and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `apps/web/.env.example`).
- Run the admin bootstrap script, then sign in for real and check the Supabase path end to end.
