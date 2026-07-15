# MVP Implementation Plan

## Outcome

Deliver a 13+ French-learning web app vertical slice: onboarding, one adaptive A1 mission, deterministic correction, mistake-driven review, progress, browser listening/speaking practice, retention rewards, private friend-code co-op, deterministic roleplay, and a source-bound tutor fallback. Production uses Next.js, Supabase, Vercel, and server-only OpenAI access; local development uses a clearly development-only mock repository when credentials are absent.

## Architecture

- Next.js App Router, TypeScript, Tailwind, Zod, Supabase Auth/Postgres/RLS, Vitest, and Playwright.
- Canonical content is versioned, sourced, register-aware, and publication-gated. Generated material remains unverified and cannot teach learners.
- The learning engine owns answer validation, session planning, learner state, mistakes, and SRS. AI receives compact context packs and returns validated JSON only.
- Routes cover landing, auth, onboarding, Today, Learn, lesson player, review, progress, listen, speak, roleplay, friends, tutor, settings, privacy, terms, and status.

## MVP Learning Loop

The mission teaches introductions and a short day description through multiple choice, fill blanks, typing, sentence construction, dictation, listening, and speaking self-check/recognition flows. Answers are normalized and matched against configured variants; known near-misses create mistake events and review items. Reviews follow a 1/3/7/14/30 day ladder, with slower or recognition-only answers retained at shorter intervals. The Today planner schedules due work first, then mission progress, output, repair, and a confidence-building finish. Retention rewards track streak state without guilt, and social co-op rewards completed practice instead of exposing private mistakes.

## Guardrails And Release Conditions

- Published content needs sources, canonical links, accepted-answer tests, and content-owner approval.
- RLS isolates learner records; service credentials remain server-only.
- AI cannot write canonical content, scores, or learner state. Unsupported or invalid outputs receive safe, learner-friendly deterministic copy.
- Onboarding requires a 13+ self-declaration and required terms/privacy/tutor consents. A broad public launch still needs qualified review of privacy, consent, retention, youth safeguards, support, and regional requirements.

## Validation

Unit tests cover validation, SRS, session planning, context packs, unsafe AI rejection, retention rewards, social state, and roleplay scoring. E2E covers onboarding through completion, a wrong `Je suis 20 ans` answer becoming review, mobile usability, keyboard navigation, friends, and roleplay. `npm run release:check` runs lint, typecheck, unit tests, production build, Playwright E2E, and `npm audit`.
