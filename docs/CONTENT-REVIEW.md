# Content review: publishing the cafe and travel missions

Two scored missions are written, verified by the tooling, and waiting on one
thing: a human read-through by the content owner. This file is that
read-through's checklist, and the exact procedure that publishes them once
approved. Nothing here weakens the standing rule from the project docs:
published content needs sources, canonical links, accepted-answer tests, and
recorded approval.

## What is waiting

| Mission | Slug | Activities | Status |
|---|---|---|---|
| Order cafe food politely | `cafe-food` | 6, all activity types | draft, needs review |
| Handle basic travel questions | `travel-basics` | 7, all activity types | draft, needs review |

Both live in `lib/content/scored-missions.ts`. The database refuses to serve
draft content regardless of what the code says (migration
`202607160005_require_verified_published_content.sql`), so nothing publishes
by accident.

## The reviewer's checklist

Read each mission top to bottom and confirm:

1. **The French is right.** Every `frenchText`, every choice label, every
   `targetText`, every accepted answer, and every corrected answer in a near
   miss. Accents, elisions, spacing before ? and !, capitalisation.
2. **The register notes are honest.** Where a phrase is marked formal,
   neutral, or casual, a French speaker would agree, and the usage context
   says when it fits.
3. **Accepted answers are neither too strict nor too loose.** Try the answers
   a real learner would type. Anything reasonable should pass; anything that
   teaches a wrong habit should not.
4. **Near misses catch real mistakes.** Each `nearMisses` entry is an error a
   learner plausibly makes, its mistake type is right, and the explanation
   names the rule rather than just the correction.
5. **Feedback sounds like this app.** Warm, specific, no lecture. Correct
   feedback says why; incorrect feedback gives the pattern back.
6. **Audio expectations hold.** Dictation and speaking activities reference
   phrases with bundled audio where available; browser speech remains the
   honest fallback.
7. **Coverage still passes.** `npm run verify:curriculum` and
   `npm run verify:coverage` both green (they check every scored segment
   against FLELex and the prerequisite graph).

## The publication procedure, once approved

1. In `lib/content/scored-missions.ts`, flip every content item of the
   approved mission to `verificationStatus: "verified"` and
   `publicationStatus: "published"`, and replace `reviewerNotes` with the
   review record: who reviewed, the date, and the decision.
2. Add the mission to `getPublicScoredMissionSlugs()` in the same file.
3. Write the database sync migration that inserts or updates the mission,
   its content items, and its activity payloads with the canonical code
   values, modelled on `202607190001_sync_verified_intro_curriculum.sql`.
   For activity payloads, `content-tools/generate-intro-sync.ts` shows the
   generator pattern; adapt it for the new mission rather than hand-writing
   JSON.
4. Update the topic preview status in `lib/content/topic-previews.ts` from
   practice preview to ready.
5. Run `npm run release:check` and deploy with the migration.

## Keeping published data in lockstep

When published copy changes in code (for example a copy pass), the database
payloads must follow, or production keeps serving the old strings. That is
what `202607210001_sync_intro_activity_copy.sql` does for the introduction
mission after the em-dash copy pass, and the generator exists so the next
sync is one command instead of an evening of hand-escaped JSON.
