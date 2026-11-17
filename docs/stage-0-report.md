# Stage 0 report: foundations and spikes

Date: 17 Nov 2026

## Done

| Item             | Result                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo and tooling | npm workspaces, Vite 8, React 19, TypeScript 7 (strict), Tailwind 4, oxlint, Prettier, Vitest. Lint, typecheck, 12 unit tests and the production build all pass |
| Design tokens    | Black and white palette, fonts and role badges (shape plus border style) from the approved sheets, in `apps/web/src/index.css`                                  |
| Language         | English and Tamil with a switch, saved on the device. Fonts are bundled, so they work offline                                                                   |
| CI               | `.github/workflows/ci.yml`: web job (format, lint, typecheck, test, build) and an Android debug build job                                                       |
| Supabase         | `supabase/` folder with config, migrations, functions and tests folders. No cloud project created yet                                                           |
| Money helpers    | Indian digit grouping, paise rounding, amount in words, all unit tested                                                                                         |

## Spike 1: Tamil PDF (passed)

- pdfmake 0.3 with Inter (Latin, digits) and Noto Sans Tamil (Tamil, rupee sign) makes the half-A4 GST bills in the browser. No server needed.
- Tamil letters and joined forms render correctly (checked at high zoom): ஸ்ரீ, ஸ்டோர்ஸ், மொத்த, பொன்னி, சர்க்கரை.
- 5 sample bills became 3 A4 pages, two bills per page, 39 KB, 0.7 seconds.
- pdfmake does not switch fonts itself, so text is split into runs by script (`lib/pdf/runs.ts`).
- Capacity: a bill with 7 two-line (English plus Tamil) items just fits one half page. Stage 6 must use one-line rows above 6 items (about 12 fit), and a continuation page beyond that.
- Decision: use client-side pdfmake. The Chromium fallback is not needed.

## Spike 2: PWA (passed on desktop, phone install pending)

- Production build has a valid manifest, 4 icons, and a service worker that registers in Edge on a secure origin.
- The Claude app's built-in browser blocks service workers, so test PWA behaviour in a normal browser.
- Still to confirm: "Add to home screen" on a real Android phone. That needs an HTTPS address, so it is checked after the first Cloudflare Pages deploy.

## Spike 3: Android APK (blocked, needs JDK 21)

- Capacitor 8 Android project was created and synced (minSdk 24, target API 36).
- The first Gradle build failed: the only Java on this PC is version 25 (inside Android Studio), and Gradle 8.14 for this project needs Java 21 or older.
- Fix: install JDK 21 (Temurin), then run `./gradlew assembleDebug`.
- Push alerts need a Firebase project and a real phone. Those wait for the Firebase account step.

## Decisions to confirm

- App ID `com.rkgrocery.app` is a placeholder. It is the app's permanent identity, so confirm it before the first release.
- The logo is a placeholder "RK" mark until the client has branding.
- The GitHub repo `team-collabrate/rkmart` is PUBLIC. A client billing app should normally be private.

## Needs from the owner

1. OK to install JDK 21 (about 200 MB, via winget) to finish the APK build.
2. A Supabase account login for the dev and production projects (Stage 1).
3. A Google login for the Firebase project (push alerts).
4. Decide whether the GitHub repo should be made private.

## Notes

- `npm audit` shows 4 moderate warnings in build-time tools (glob and minimatch, pulled in by the PWA plugin). They are not part of the app that runs on phones.
