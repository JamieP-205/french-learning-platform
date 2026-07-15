# Supabase Setup

1. Create a Supabase project and set the Site URL plus the approved authentication redirect URLs.
   - Site URL: the deployed `NEXT_PUBLIC_APP_URL`
   - Production redirect URLs:
     - `<deployed-url>/auth/callback`
     - `<deployed-url>/**`
   - Local development redirect URLs:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/**`
2. Apply every file in `supabase/migrations` in timestamp order through the Supabase CLI or SQL editor.
3. Have the content owner review the source record, then run `supabase/seed.sql`. It creates the complete verified A1 mission: canonical content, versions, activities, content links, and accepted-answer sets.
4. Leave `country_age_policies` empty unless a future legal design reintroduces per-country signup rules. Current onboarding does not query that table; it stores a 13+ self-declaration on `profiles.age_confirmed` and records required consents in `privacy_consents`.
5. Generate database types after migrations with `npx supabase gen types typescript --project-id <project-id> > lib/data/database.types.ts`, then replace the adapter's temporary generic row casts with those generated types.
6. Add the public URL and anon key to local/browser settings. Keep the service-role key server-only. Leave `NEXT_PUBLIC_ACCOUNT_SYNC_READY=false` until the production confirmation flow passes the checks below.
7. Run the RLS checklist in `supabase/tests/rls-checklist.sql` before public deployment.

## Email confirmation checks

If signup says to check email but no email arrives, check Supabase Authentication email settings before changing app code:

- For quick private testing, temporarily disable email confirmation in Supabase Auth.
- Never treat disabled confirmation as production verification. For production, keep confirmation enabled and configure custom SMTP; Supabase's default sender may refuse recipients outside the project team and is rate-limited.
- Use the resend confirmation button on `/auth/sign-in`; a success message means Supabase accepted the request, not that the inbox received it.
- Make sure the confirmation link redirects to `/auth/callback`; the app then sends confirmed learners to onboarding.
- Test on a non-public preview deployment with a fresh address outside the Supabase project team. Set `NEXT_PUBLIC_ACCOUNT_SYNC_READY=true` only for that preview, then verify initial delivery, resend delivery, the preview `/auth/callback` return, and successful sign-in after confirmation.
- Set `NEXT_PUBLIC_ACCOUNT_SYNC_READY=true` in production only after that end-to-end test passes. Leave or restore it to `false` whenever delivery is unverified; the public auth entry point and callback are disabled while it is false.

Official guidance: [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [missing auth emails](https://supabase.com/docs/guides/troubleshooting/not-receiving-auth-emails-from-the-supabase-project-OFSNzw).

The app defaults to development demo mode only when no Supabase environment is present and `NODE_ENV` is not production.
