# Deployment Handoff

## Safe Vercel Deployment

1. Import the GitHub repository into Vercel or run `npx vercel` after signing in.
2. Set `NEXT_PUBLIC_APP_URL` to the deployed URL.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment settings. Keep the service-role value server-only.
4. Add `OPENAI_API_KEY` and `OPENAI_MODEL_TUTOR` only when the guarded tutor provider is ready. Without them, the server returns the deterministic source-bound tutor fallback.
5. Apply every Supabase migration in timestamp order:
   - `202606200001_initial_learning_platform.sql`
   - `202607050001_onboarding_profile_updates.sql`
   - `202607050002_streak_freezes.sql`
   - `202607050003_social_features.sql`
   - `202607060001_harden_authenticated_client_writes.sql`
   - `202607130001_attempt_evidence.sql`
6. Run `supabase/seed.sql` after the source-backed A1 mission content is reviewed.
7. Keep `NEXT_PUBLIC_ACCOUNT_SYNC_READY=false` while configuring account delivery. In Supabase Auth, keep email confirmation enabled, configure a custom SMTP sender, set the Site URL to `NEXT_PUBLIC_APP_URL`, and allow the exact production and local `/auth/callback` URLs. Supabase's default email service is not a production delivery channel and may refuse recipients outside the project team.
8. Run the RLS checklist in `supabase/tests/rls-checklist.sql` with two test users. It must return only `ok=true` rows and confirms direct authenticated-client writes are denied.
9. Use a non-public preview deployment for the delivery test. Configure that preview with the intended production Supabase project and `NEXT_PUBLIC_ACCOUNT_SYNC_READY=true`, then create a fresh account using an address outside the project team. Verify the first confirmation email arrives, the resend control delivers a second email, both links return through the preview's `/auth/callback`, and the confirmed account can complete the 13+ onboarding declaration and reach Today. Record the date and tester; a UI success message alone is not delivery evidence. Keep the production flag false throughout this test.
10. Only after step 9 passes, set `NEXT_PUBLIC_ACCOUNT_SYNC_READY=true` in the production environment and redeploy. The production status page must then show Account sync as Open and `/auth/sign-in` must expose the account form. If delivery later fails, set the flag back to `false` before investigating; the auth entry point and callback will then fail closed.
11. Deploy a preview first. A deployment without Supabase variables, or with the readiness flag unset/false, safely reports Account sync as setup required while preserving no-account browser learning.

Supabase email-delivery references: [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [Troubleshoot missing auth emails](https://supabase.com/docs/guides/troubleshooting/not-receiving-auth-emails-from-the-supabase-project-OFSNzw).

## Production Release Gate

The current onboarding gate is a 13+ self-declaration plus required terms, privacy, and tutor consents. Do not market the site as broadly public or globally available until qualified review approves the privacy notice, consent language, retention policy, youth safeguards, support process, and regional requirements. The legacy `country_age_policies` table remains in the initial schema but is not used by current onboarding.

## Local verification

Run `npm run release:check`. It expands to lint, typecheck, unit tests, production build, Playwright E2E, and `npm audit`. If the browser runtime is absent, first run `npx playwright install chromium`.
