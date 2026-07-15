# Curriculum verification

The two release gates inspect the same canonical curriculum from different CI
entry points:

```text
npm run verify:curriculum
npm run verify:coverage
```

Both commands audit every authored scored mission plus the reachable standalone
roleplay and listening exercises. They print the publicly reachable roots
separately, so draft missions cannot disappear from the content audit.

For each activity, the only vocabulary considered taught is the transitive
closure of that activity's `requiredConceptIds`. This is the same closure the
runtime teaching gate renders. A session containing one isolated adaptive item
therefore cannot borrow knowledge from an unrelated mission or activity.

The gate checks that:

- every runtime scored activity has a curriculum declaration and vice versa;
- every activity explicitly annotates French prompt substrings and every choice
  declares `language: "fr" | "en"`; missing metadata fails closed and is never
  replaced by accent- or dictionary-based language guessing;
- every runtime French prompt, choice, target, token and accepted-answer variant
  has an exact declaration, so detached audit strings cannot substitute for
  runtime content;
- every required concept and prerequisite exists and the graph is acyclic;
- every activity's runtime teaching gate contains exactly its required-concept
  transitive closure, whose vocabulary form and meaning are both rendered;
- each vocabulary lemma has an exact FLELex POS and CEFR-level match;
- every teaching input, individual rendered scored segment and canonical expected
  answer has at least 95% introduced-or-inline-glossed tokens, using integer
  arithmetic: `covered * 100 >= total * 95`.

All accepted-answer variants remain in the exact runtime-to-manifest parity
audit. Lexical coverage applies only to the first canonical expected answer:
alternative learner inputs (for example, an accentless answer accepted by the
answer validator) are not content presented to or demanded from the learner.
This distinction does not fold accents or widen coverage matching.

Scored-segment gloss declarations are forbidden and receive no coverage credit:
the current scored controls do not render them. Unknown words must be taught by
the preceding concept gate. Teaching input glosses are validated against the
exact input text and must provide a non-empty meaning.

There is no accent folding, tolerance, token allowlist or activity-ID exception.
French elision clitics are tokenised explicitly (`j'` + `ai`, `s'` + `il`) so
the content cannot hide an unknown lexical remainder inside an apostrophe chunk.

Any complete verifier input can be supplied through the generic fixture flag.
The seeded invalid fixture demonstrates the exact diagnostic shape and must exit
non-zero:

```text
npx tsx content-tools/verify-curriculum.ts --fixture content-tools/fixtures/invalid-curriculum.json
npx tsx content-tools/verify-coverage.ts --fixture content-tools/fixtures/invalid-curriculum.json
```

Each violation names `lesson`, `exercise`, `concept` and `token`; `-` means that
dimension does not apply to that violation.
