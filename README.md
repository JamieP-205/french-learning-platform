# French for Life

A practical, adaptive, accuracy-first French-learning web app. The current release includes a source-backed A1 mission, deterministic answer checks, mistake-driven spaced review, browser listening/speaking practice, streak and garden retention rewards, private friend-code co-op challenges, deterministic real-French roleplay, learner progress, and a guarded tutor fallback.

## Local Development

1. Copy `.env.example` to `.env.local` and add Supabase/OpenAI values when available.
2. Run `npm install` and `npm run dev`, then open `http://localhost:3000`.
3. Without Supabase credentials, development uses a clearly labelled in-memory demo learner. It is blocked in production.
4. For persistent storage, apply every SQL file in `supabase/migrations` in timestamp order, then run `supabase/seed.sql`.
5. Current onboarding uses a 13+ self-declaration plus required terms/privacy/tutor consents. No country-policy seed is required for this MVP.
6. `OPENAI_API_KEY` and `OPENAI_MODEL_TUTOR` are optional. Without them, tutor help uses the deterministic source-bound fallback.

## Checks

Run `npm run release:check`. It expands to lint, typecheck, unit tests, production build, Playwright E2E, and `npm audit`. If Playwright has not been installed on the machine yet, run `npx playwright install chromium` once first.

## Deployment

Deploy the Next.js app to Vercel and apply the SQL files in `supabase/migrations` to a Supabase project. Configure the variables in `.env.example`; never expose the service-role or OpenAI key. A deployment without Supabase configuration presents a setup-required screen instead of exposing demo persistence.

Before marketing a broad public account launch, complete the RLS checklist plus qualified review of privacy, consent language, retention, and youth-safeguard requirements. The current app-level gate is the 13+ self-declaration recorded during onboarding, not the legacy `country_age_policies` table.

## Third-party data

The curriculum verifier vendors FLELex / Beacco under CC BY-NC-SA 4.0. Attribution, transformation details and the non-commercial restriction are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
