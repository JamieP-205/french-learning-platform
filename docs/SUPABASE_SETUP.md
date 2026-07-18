# Supabase Setup

1. Create a Supabase project and set the Site URL plus the approved authentication redirect URLs.
   - Site URL: the deployed `NEXT_PUBLIC_APP_URL`
   - Production redirect URLs:
     - `<deployed-url>/auth/callback`
     - `<deployed-url>/**`
   - Local development redirect URLs:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/**`
2. Apply every file in `supabase/migrations` in timestamp order through the Supabase CLI or SQL editor, including migration 014 (`202607180001_release_integrity_and_answer_privacy.sql`). The current server expects its private session-start ledger, answer-bearing table restrictions, retry-aware quota function, tutor claim, progress aggregation, and social-unblock functions.
3. Have the content owner review the source record, then run `supabase/seed.sql`. It creates the complete verified A1 mission: canonical content, versions, activities, content links, and accepted-answer sets.
4. Leave `country_age_policies` empty unless a future legal design reintroduces per-country signup rules. Current onboarding does not query that table; it stores a 13+ self-declaration on `profiles.age_confirmed` and records required consents in `privacy_consents`.
5. Generate database types after migrations with `npx supabase gen types typescript --project-id <project-id> > lib/data/database.types.ts`, then replace the adapter's temporary generic row casts with those generated types.
6. Add the public URL and anon key to local/browser settings. Keep the service-role key server-only. Leave `NEXT_PUBLIC_ACCOUNT_SYNC_READY=false` and disable provider-side new-user signup until the confirmation, database, and qualified-review gates in `docs/DEPLOYMENT.md` have passed.
7. Run the RLS checklist in `supabase/tests/rls-checklist.sql` before public deployment. It must confirm that session plans, attempts, review answers, answer-bearing activities, internal social tables, and all service-only RPCs are inaccessible to an authenticated browser client.

## Email confirmation checks

If signup says to check email but no email arrives, check Supabase Authentication email settings before changing app code:

- For quick private testing, temporarily disable email confirmation in Supabase Auth.
- Never treat disabled confirmation as production verification. For production, keep confirmation enabled and configure custom SMTP; Supabase's default sender may refuse recipients outside the project team and is rate-limited.
- While account access is closed, disable **Allow new users to sign up** in Supabase Auth. Hiding the app form does not prevent direct requests to Supabase's public signup endpoint. Keep password sign-in available so existing learners can export or delete their account learning data.
- Use the resend confirmation button on `/auth/sign-in`; a success message means Supabase accepted the request, not that the inbox received it.
- Make sure the confirmation link redirects to `/auth/callback`; the app then sends confirmed learners to onboarding.
- For the controlled non-public preview test, temporarily enable provider-side signup and use a fresh address outside the Supabase project team. Set `NEXT_PUBLIC_ACCOUNT_SYNC_READY=true` only for that preview, then verify initial delivery, resend delivery, the preview `/auth/callback` return, and successful sign-in after confirmation. Disable provider-side signup again when the test finishes.
- Enable provider-side signup and set `NEXT_PUBLIC_ACCOUNT_SYNC_READY=true` in production only after that end-to-end test and every release gate in `docs/DEPLOYMENT.md` pass. Disable signup and restore the flag to `false` whenever delivery or release readiness is unverified.

Official guidance: [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [missing auth emails](https://supabase.com/docs/guides/troubleshooting/not-receiving-auth-emails-from-the-supabase-project-OFSNzw).

The app defaults to development demo mode only when no Supabase environment is present and `NODE_ENV` is not production.
