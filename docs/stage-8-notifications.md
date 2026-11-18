# Stage 8: alerts (notifications)

Status: the database part is built and tested (132 database-side tests pass). The app part is built and tested on the demo backend. **Nothing has been sent to a real phone or browser yet**, because there is no Supabase project and no Firebase project. The send-push function and the Android and browser registration are written but not run live. The steps to switch it on are at the end of this page.

## Who gets which alert

| When                         | Who gets it                           | Text (English)                                                         |
| ---------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| A shop places an order       | Every active admin                    | "New order" / "Sri Murugan Cafe placed an order."                      |
| An order is marked delivered | The shop's logins                     | "Order delivered" / "Bill RK/2627/0007 delivered. Payment due: ₹1200." |
| A payment is recorded        | The shop's logins                     | "Payment received" / "RK received ₹500. Still due: ₹700."              |
| Every day at 6 pm India time | Shop logins of a shop that owes money | "Payment reminder" / "Please pay ₹700 to RK."                          |

Each alert is written in the language of the person who reads it (English or Tamil, from their profile). Tapping an alert opens the right screen: the new order, or the shop's Payments screen. Distributors get no alerts for now.

The daily reminder skips a login that already got one in the last 20 hours, so running it twice in a day sends nothing extra. Switched-off logins get nothing.

## How it works

```
order placed / delivered / payment recorded
   -> database trigger writes a row in `notifications` (title and body already in the reader's language)
   -> a database webhook calls the send-push edge function
   -> send-push sends each row to that person's phones (Firebase) and browsers (Web Push)
   -> the row is marked sent, or retried later (up to 5 tries). Dead phones and browsers are forgotten.
```

- Migration `20261122100000_notifications.sql`: the `notifications` table (a person can read only their own), the triggers, `enqueue_payment_reminders()` and its daily schedule (pg_cron, only on a real project). The app cannot write, change or delete alerts.
- Migration `20261122100100_push_token_functions.sql`: `register_push_token` and `forget_push_token`. A phone shared by two people moves to whoever signs in; nobody can remove someone else's phone.
- Edge function `send-push` (`supabase/functions/send-push/index.ts`) with its testable logic in `_shared/push.ts`: message shapes, which failures mean "this phone is gone" and which mean "try again", and what to record after a send. It only answers calls that carry the secret header `x-push-secret`.

## In the app

- **Alerts card** on the shop owner's Home screen and the admin's "More" screen: turn alerts on or off for this phone or browser. It says plainly when alerts are blocked, when the browser cannot show them (an iPhone needs the app added to the Home screen first), or when this build has no alerts set up. It is not shown to distributors.
- **Android app:** uses `@capacitor/push-notifications` (Firebase). Creates an alert channel, asks permission, registers. Tapping an alert opens its screen. An alert that arrives while the app is open refreshes the screens.
- **Browser / installed web app:** Web Push with a service worker (`public/push-sw.js`, loaded into the app's service worker).
- **Shared phones:** alerts follow whoever is signed in. Until the next person signs in, a phone can still get the previous person's alerts.
- **Demo builds** have no push server, so "Turn on alerts" there registers a made-up device just to show the screens.
- Text: `alerts.*` in `i18n/en.json` and `i18n/ta.json`.

## Tests

- Database: 14 new tests (who gets each alert and in which language, no alert for other shops or distributors or switched-off logins, nothing due vs due, reminders once a day, reminders not callable from the app, who can read or write alerts, tokens moving to the signed-in person, forgetting only your own). 132 database-side tests in total, counting the 16 send-push logic tests below.
- send-push logic: message shapes, browser subscription checks, failure handling and retry rules, Google sign-in pieces (`supabase/tests/push.test.ts`).
- Web: the alerts card (on, off, blocked, unsupported, not set up, server refuses, admin text, hidden for distributors, Tamil), key conversion and the demo device.

## Switching it on (needs Supabase and Firebase accounts)

1. **Supabase:** create the project, link it, `supabase db push`. Run the function with `supabase functions deploy send-push --no-verify-jwt`.
2. **Secrets:** `supabase secrets set PUSH_WEBHOOK_SECRET=<long random text> VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:<owner email> FCM_SERVICE_ACCOUNT="$(cat service-account.json)"`. Make the VAPID pair with `npx web-push generate-vapid-keys`.
3. **Webhook:** in the Supabase dashboard, Database > Webhooks: on INSERT into `public.notifications`, call the send-push URL with the HTTP header `x-push-secret: <same secret>`. Also add a schedule (every 5 minutes, same URL and header) so failed sends are retried.
4. **Firebase (Android):** create a Firebase project, add the Android app (`com.rkgrocery.app` is a placeholder until the real ID is chosen), download `google-services.json` into `apps/web/android/app/`, and make a service account key for the `FCM_SERVICE_ACCOUNT` secret. The file is not committed.
5. **Browser:** put the public key in `apps/web/.env.local` as `VITE_VAPID_PUBLIC_KEY=...` before building.
6. **Check:** place an order as a shop; the admin phone should buzz within seconds. Mark it delivered; the shop phone should buzz with the amount due.

## To confirm with RK

- Is 6 pm the right time for the daily reminder, and should it be every day or only on certain days?
- Should distributors get an alert when a bill is ready to deliver?
- Should the admin also get an alert when a payment is recorded, or when a delivery is marked done?

## Not in this stage

- A list of past alerts inside the app (they are saved, but only shown as phone alerts).
- Sales and dues reports (Stage 9).
