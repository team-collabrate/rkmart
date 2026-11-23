# PIN security

Logins are a 10-digit mobile number and a 4-digit PIN. A PIN has only 10,000 possibilities, so two
protections stop guessing.

## 1. A secret that is never in the app (the "PIN pepper")

The password Supabase stores is the PIN plus a long random secret (`PIN_PEPPER`, 32 to 60
characters). The secret lives only in the functions' environment and in the scripts you run. Someone
who tries PINs straight against Supabase's own sign-in cannot succeed without it.

- Make one: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` (48 characters).
- Store it: `supabase secrets set PIN_PEPPER=<the secret>` and keep a copy somewhere safe.
- **Never change it once logins exist.** Changing it means every login needs a new PIN.
- The scripts (`bootstrap-admin`, `seed-demo-users`) read `PIN_PEPPER` from the environment too.

## 2. Lockout (the `sign-in` function)

The app signs in through `supabase/functions/sign-in`, never straight to Supabase. After 5 wrong
tries on one mobile number the number is locked for 15 minutes (table `login_attempts`, functions
`login_lock_seconds`, `login_failed`, `login_succeeded`; only the service role can reach them).
A correct PIN clears the count. A number that has no login gets the same "wrong PIN" answer, so
nobody can learn which numbers have logins.

Trade-off: someone who knows a shop's number can lock that shop out for 15 minutes by typing wrong
PINs. That is the price of stopping guessing. The shop can wait, or RK can reset the PIN from the
admin screen (a reset does not clear the lock; it clears itself after 15 minutes).

## Deploy

```bash
supabase db push
supabase secrets set PIN_PEPPER=<48-character secret>
supabase functions deploy sign-in --no-verify-jwt
supabase functions deploy admin-users
```

Existing logins made with the old (no secret) password do not work any more: reset each PIN from the
admin screen, or recreate them with the scripts.

The function calls Supabase's sign-in from the server, so Supabase's per-IP limit
(`auth.rate_limit.sign_in_sign_ups`, 30 per 5 minutes) is shared by everyone. That is plenty for
8 accounts; raise it if the number of users grows.

Not yet run against a live project (none exists yet): the SQL and the validation code are tested;
the function itself is first exercised on deploy.
