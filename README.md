# French for Life

French for Life is a practical French-learning app I built around one rule:
teach language before asking the learner to produce it. It starts with useful A1
French, checks answers deterministically and keeps completion separate from
actual evidence of learning.

This repository is a reviewed public source snapshot of the project I develop
privately. It contains the application, curriculum tooling, migrations and test
suite needed to inspect the engineering. It does not contain deployment
credentials, learner records or unfinished private environment notes.

The snapshot is published for portfolio and technical-review purposes. No
permission to copy, redistribute or create derivative works is granted; see
[LICENSE](LICENSE). Third-party curriculum data remains under the licences
listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## What works now

- A no-account route that keeps preferences and progress in the browser
- A source-backed A1 starter curriculum with explicit concept prerequisites
- Just-in-time teaching before every scored prompt
- Deterministic answer checks, near-miss feedback and mistake-driven review
- Bundled French audio with honest browser fallbacks
- Listening checks and speaking practice that distinguish scored evidence from
  self-report
- Streaks, a learning garden and private friend-code challenges
- Deterministic roleplay with register feedback
- Optional account persistence behind Supabase
- A deterministic source-bound tutor fallback, with optional OpenAI explanations
  disabled by default until the configured model and prompt pass safety evals

## The part I care about most

Every scored activity declares the concepts it needs. The curriculum verifier
walks those prerequisites, checks the French against the vendored FLELex source
and fails the release if an exercise can appear before its teaching.

The evidence model follows the same idea:

- recognition, controlled answers and free production are kept separate
- revealing an answer records completion, not correctness
- a speaking self-check does not create pronunciation evidence
- review items come from recorded mistakes, not a generic difficulty label

## Project shape

- `app/` routes, pages and server endpoints
- `components/` lesson, speech, onboarding and settings interfaces
- `lib/content/` authored curriculum, roleplay and audio metadata
- `lib/learning/` planning, answer transitions, review and progress rules
- `lib/data/` the repository boundary, local development store and Supabase
  implementation
- `content-tools/` curriculum provenance and coverage checks
- `supabase/` migrations, seed data and the RLS checklist
- `tests/` deterministic domain and boundary tests
- `e2e/` the browser journeys used by the release gate

## Run it locally

```bash
npm ci
npx playwright install chromium
npm run dev
```

Open `http://localhost:3000`. Without Supabase credentials, development uses
the in-memory learner store. That store is blocked in production.

Copy `.env.example` to `.env.local` only when testing a real integration.
Never put the Supabase service-role key or OpenAI key in a public browser
variable.

## Checks

```bash
npm run release:check
```

The gate verifies curriculum provenance and coverage, runs ESLint and
TypeScript, executes the unit suite, builds the production app, runs the full
Playwright suite and audits the dependency tree.

Browser tests use a separate development learner per test. That matters because
the first version shared one demo learner across parallel workers and could
resume another test's session.

Production responses set CSP, clickjacking, MIME-sniffing, referrer,
permissions and transport-security headers. The Playwright release gate checks
the expected policy so a hosting change cannot silently remove it.

## AI-assisted development

I use AI tooling as implementation and review support, particularly around the
source-bounded tutor, the Supabase boundary, security headers and the release
checks. Generated French is never accepted as course content. I review and
simplify code before keeping it, and the deterministic curriculum, unit,
browser, build and dependency checks are the evidence for what is released.

## Current limits

- The authored curriculum is still A1-sized rather than a complete French
  course.
- Speaking practice can use browser recognition as feedback, but an unverified
  self-check never becomes a pronunciation score.
- Browser speech support and voice quality vary by device.
- Production account sync remains closed until confirmation-email delivery and
  launch safeguards are verified.
- FLELex / Beacco is CC BY-NC-SA 4.0, so its non-commercial restriction matters
  to any future use of the curriculum tooling.

## Snapshot boundary

[SNAPSHOT.md](SNAPSHOT.md) explains what is copied from the private working
repository and what is deliberately maintained here. Code changes should start
in the working source, pass the complete release gate and then be checked against
this repository before publication.

## Third-party data

FLELex / Beacco attribution, transformations, checksums and licence terms are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and
[content-tools/FLELEX_PROVENANCE.md](content-tools/FLELEX_PROVENANCE.md).
