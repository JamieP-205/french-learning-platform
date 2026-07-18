# Deployment Handoff

## Safe Vercel Deployment

1. Import the GitHub repository into Vercel or run `npx vercel` after signing in.
2. Set `NEXT_PUBLIC_APP_URL` to the deployed URL.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment settings. Keep the service-role value server-only.
4. Keep `ENABLE_GENERATIVE_TUTOR=false` so the server returns the deterministic source-bound tutor fallback. Set `OPENAI_API_KEY`, `OPENAI_MODEL_TUTOR`, and then `ENABLE_GENERATIVE_TUTOR=true` only after prompt-injection, unsupported-claim, latency, and provider-failure evaluations pass for the exact model and prompt being deployed.
5. Before migrating an existing account-enabled environment, set `NEXT_PUBLIC_ACCOUNT_SYNC_READY=false`, redeploy, and wait for in-flight account API requests to drain. Migrations 008 and 009 replace older multi-statement writes with transactional RPCs; old and new writers must not overlap the reconciliation and constraint work.
6. Apply the complete `supabase/migrations/*.sql` directory in filename order while account access remains closed. Do not maintain or follow a partial hand-written migration list; a fresh environment must reach the latest schema before seeding. Confirm the `prune-expired-api-rate-events` Cron job exists after migration 010, migration 013 created the active co-op participant reservation table, and migration 014 created the private session-start ledger plus both eight-day ledger-retention jobs.
7. Deploy this application version before reopening account access. Its runtime depends on the complete migration chain, including onboarding and time-zone support in migration 003, atomic learning and social RPCs in migrations 008 and 009, retry-safe friend-code rotation in migration 011, the privacy, time-zone, and social hardening in migration 013, and the answer-privacy, retry, tutor-claim, progress-aggregation, and display-name boundary in migration 014.
8. Run `supabase/seed.sql` only after the full migration chain has completed and the source-backed A1 mission content is reviewed. For a new or disposable local project, `supabase db reset` is the preferred migration-and-seed check.
9. Keep `NEXT_PUBLIC_ACCOUNT_SYNC_READY=false` while configuring account delivery. In Supabase Auth, disable **Allow new users to sign up** while the gate is closed; the app UI cannot prevent direct calls to Supabase's public signup endpoint. Keep password sign-in available for existing learners' privacy requests. Keep email confirmation enabled, configure a custom SMTP sender, set the Site URL to `NEXT_PUBLIC_APP_URL`, and allow the exact production and local `/auth/callback` URLs. Supabase's default email service is not a production delivery channel and may refuse recipients outside the project team.
10. Run the RLS checklist in `supabase/tests/rls-checklist.sql` with two test users. It must return only `ok=true` rows and confirms direct authenticated-client writes are denied. Also run `supabase/tests/time-zone-checklist.sql` to verify learner-local day conversion across daylight-saving boundaries.
11. Use a non-public preview deployment for the delivery test. Temporarily enable provider-side signup, configure that preview with the intended production Supabase project and `NEXT_PUBLIC_ACCOUNT_SYNC_READY=true`, then create a fresh account using an address outside the project team. Verify the first confirmation email arrives, the resend control delivers a second email, both links return through the preview's `/auth/callback`, and the confirmed account can complete the 13+ onboarding declaration and reach Today. Record the date and tester; a UI success message alone is not delivery evidence. Keep the production flag false throughout this test and disable provider-side signup again when the test finishes.
12. Enable provider-side signup and set `NEXT_PUBLIC_ACCOUNT_SYNC_READY=true` in production only after step 11 passes, the qualified privacy, consent, retention, youth-safeguard, support, and regional review below is approved, and the complete disposable database gate below passes. Redeploy, then confirm the production status page shows Accounts as Open and `/auth/sign-in` exposes the account form. If delivery or any release safeguard later fails, disable provider-side signup and restore the flag to `false` before investigating.
13. Deploy a preview first. A deployment without Supabase variables, or with the readiness flag unset/false, safely reports Account sync as setup required while preserving no-account browser learning.

Supabase email-delivery references: [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [Troubleshoot missing auth emails](https://supabase.com/docs/guides/troubleshooting/not-receiving-auth-emails-from-the-supabase-project-OFSNzw).

## Production Release Gate

The current onboarding gate is a 13+ self-declaration plus required terms, privacy, and tutor consents. Do not market the site as broadly public or globally available until qualified review approves the privacy notice, consent language, retention policy, youth safeguards, support process, and regional requirements. The legacy `country_age_policies` table remains in the initial schema but is not used by current onboarding.

## Production Database Gate

Before production account access opens:

- Reset a disposable Supabase project from empty and apply the complete migration chain in filename order.
- Run the reviewed seed and complete one signed-in lesson through the deployed application.
- Run both SQL checklists in `supabase/tests`, and verify that `anon` and `authenticated` cannot execute service-role-only RPCs or write the internal co-op reservation and idempotency tables.
- Exercise the profile time-zone validation and learner-local streak trigger with real profile updates across daylight-saving and local-midnight boundaries.
- Run concurrent overlapping co-op starts and a concurrent challenge-start versus block scenario; confirm one active reservation per participant, no deadlock, and correct cleanup when a challenge completes or a learner blocks the other participant.
- Retry friend-code rotation and social reporting with the same request IDs and confirm the original results are returned without duplicate mutations.
- Retry implicit resume and explicit lesson restart with the same request ID; confirm each retry returns the original session and consumes start quota only once.
- Race two tutor claims for one saved attempt and confirm only one claim succeeds; repeat after the documented stale-claim interval to verify abandoned-work recovery.
- Fill a learner's inbound pending-request allowance and confirm the database rejects the next request without affecting decline, accept, delete, or block cleanup paths.
- Load-test a lifetime privacy export at the maximum supported retention volume on the target hosting tier. If it cannot complete within the response-time and memory limits, deploy a streamed or asynchronous archive flow before opening account access.

## Local verification

Run `npm run release:check`. It expands to lint, typecheck, unit tests, production build, Playwright E2E, and `npm audit`. If the browser runtime is absent, first run `npx playwright install chromium`.

The in-memory test repository cannot validate PostgreSQL constraints, transactions, row-level security, triggers, or concurrency. Passing `npm run release:check` does not replace the production database gate above.
