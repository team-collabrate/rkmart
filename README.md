# RK Grocery (rkmart)

Wholesale ordering, GST billing and payment tracking for RK Agency, a grocery distributor.
One React app, delivered as a PWA and as an Android APK, on a Supabase backend.

- Roles: admin, distributor, shop owner (8 accounts, created by admin only).
- Languages: English and Tamil.
- Bills: GST invoice, half A4, two per page in one daily PDF.

## Layout

```
apps/web/        React + TypeScript + Vite app, PWA config, Capacitor Android project
supabase/        Database migrations, edge functions, tests, config
docs/            Stage reports and the approved print sheets
.github/         CI
```

## Getting started

Requires Node 22 or newer.

```bash
npm install
npm run dev          # web app at http://localhost:5173
npm run test         # web unit tests
npm run test:db      # database access-rule tests (no Docker needed)
npm run lint
npm run typecheck
npm run build        # production build (no spike pages)
npm run build:demo -w apps/web     # demo build: demo login and Stage 0 spike pages (for phone tests)
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the Supabase values once the
project exists. Only the public anon key goes in the app. Never put the service-role key, a
keystore or `google-services.json` in the repository.

## Android

Building the APK needs JDK 21 and the Android SDK.

```bash
npm run build:demo -w apps/web
cd apps/web && npx cap sync android
cd android && ./gradlew assembleDebug
```

## Status

Stages 0 (foundations), 1 (database, roles) and 2 (app shell) are built. See the notes in `docs/`. The development plan has 12 stages (0 to 11).
