# Security review

Done 24 Nov 2026 by reading the code and running checks. Nothing has been tested against a live
Supabase project yet (none exists), so the items marked "check on deploy" must be confirmed then.

## What was checked, and the result

| Area                                          | Result                                                                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependencies (`npm audit --omit=dev`)         | 0 known vulnerabilities                                                                                                                                               |
| Secrets in the repository                     | No keys or tokens. `.env`, keystores and `google-services.json` are ignored; the tracked `.env.*` files are empty examples                                            |
| Service-role key in the app                   | Not present anywhere in `apps/web/src` or in the built app. Only the functions and the scripts use it, from their environment                                         |
| Demo mode in a real release                   | The release build contains no demo data, no demo accounts and no mock sign-in. Only two harmless text strings (the demo hint) remain, never shown                     |
| Row-level security                            | On for every table. A test (`security_audit.test.ts`) fails if a new table has none                                                                                   |
| Signed-out visitors (anon)                    | No table access. No function could be run by them (fixed, see below). Tested                                                                                          |
| Functions that run with owner rights          | All pin their search path (prevents a classic privilege trick). Tested                                                                                                |
| Roles                                         | Shop owners see only their own shop's rows; distributors see only deliveries and no money; admin sees all. Covered by the existing role tests                         |
| Storage buckets (day's PDFs, delivery photos) | Private. Only the admin can read; the distributor can add a photo but not read any. No update or delete policy, so files cannot be changed or removed through the app |
| Bills                                         | Locked once made; a cancelled bill keeps its number; corrections get a new number; every money action goes to an audit log                                            |
| PIN guessing                                  | Fixed: server-side sign-in with a secret and a 5-try lockout (see `pin-security.md`)                                                                                  |

## Found and fixed

1. **Helper and trigger functions could be run by the public.** `gst_line`, `india_today`,
   `invoice_fy`, `money_text` and the three `notify_*` triggers had Postgres's default "anyone can run"
   permission. Harmless (they expose no data) but unnecessary. Migration `20261124120000_lock_down_helpers.sql`
   removes it; the audit test keeps it that way.
2. **Android app backup was switched on.** Android could copy the app's saved data (including the
   signed-in session) into the phone owner's cloud backup. Now `allowBackup="false"`.
3. **No security headers for the web app.** Added `apps/web/public/_headers` (no framing, no content
   sniffing, HTTPS only, no object embeds, restricted camera, microphone and location).
4. **PINs could be guessed without limit.** Fixed as above.

## Known and accepted

- **A 4-digit PIN is weak by nature.** With the lockout, one number gets 4 tries per 15 minutes, so
  guessing one PIN would take weeks and would show as constant "locked" messages. Someone who knows a
  shop's number can also lock that shop out for 15 minutes. Both are the price of 4-digit PINs. If
  this worries you, move to 6 digits (one setting plus the screens) or add a per-IP limit.
- **The functions allow requests from any website** (`Access-Control-Allow-Origin: *`). The
  functions check the caller themselves (a login token, or the PIN), so this is fine; tighten it to
  your own web address once there is one.
- **The security headers do not include a full Content-Security-Policy** (which scripts and
  connections are allowed). A strict one can break the app if written blind; add it in report-only
  mode on the live site first, then enforce.
- **The sign-in function shares Supabase's per-IP sign-in limit** (30 per 5 minutes) between all
  users, because it calls Supabase from the server. Plenty for 8 accounts.

## Check on deploy

- `PIN_PEPPER` is set (32 to 60 random characters) and is the same one the scripts use.
- `sign-in` is deployed with `--no-verify-jwt`; `admin-users` is deployed with the default.
- Public sign-up is off (`config.toml` has it off; confirm in the project's Authentication settings).
- Email confirmation off is fine (logins are `<phone>@rk.local`, nobody can read that mail).
- The two storage buckets exist and are private (the migration creates them on a real project only).
- Turn on Supabase backups (see `backup-restore.md`) and do the restore drill once.
- Add the live web address to the allowed redirect list, and tighten the functions' CORS.
