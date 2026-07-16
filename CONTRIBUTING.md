# Contributing

French for Life is built around evidence and teaching order, so a feature is not
finished when the screen works.

## Before changing code

1. Start from the latest `main`.
2. Read the relevant content, learning and repository code together.
3. Run the narrow unit test while working.
4. Run `npm run release:check` before opening a pull request.

## Project rules

- Teach every required concept before a scored prompt can use it.
- Keep recognition, controlled answers, free production and self-report
  evidence distinct.
- Never turn answer reveal or a speaking self-check into a correct score.
- Keep the deterministic answer checker in control of correctness. Tutor output
  may explain a result but must not replace it.
- Add a source and curriculum declaration for new French content.
- Keep the local and Supabase repositories behaviourally aligned.
- Fail closed when authentication, email delivery or production storage is not
  ready.
- Do not commit learner data, credentials, local environment files or generated
  browser traces.

## Pull requests

Explain the learner problem, the teaching or evidence rule affected, the main
implementation choice, migrations or privacy impact, and the checks run. Include
screenshots only when they do not expose learner or account information.

This repository is a public snapshot. Substantial product changes should be
reviewed in the private working source and copied only after its release gate
passes.
