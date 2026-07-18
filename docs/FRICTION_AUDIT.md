# Friction audit

Every struggle, glitch, annoyance, or confusing moment found by walking the full app, with where it gets fixed. Status: `open`, `fixed`, or `planned (phase X)`.

## Session flow

| # | Issue | Impact | Status |
| --- | --- | --- | --- |
| 1 | Leaving a lesson mid-session and pressing Start again silently creates a brand-new session; the half-finished one is orphaned and its progress ignored. | Lost work, confusing "why am I starting over?" | fixed — `startSession` now resumes today's incomplete session |
| 2 | No way to leave a session from inside the lesson player except browser back. | Users feel trapped mid-lesson | fixed — "Save & exit" link; progress is already saved per answer |
| 3 | "Why does this work?" tutor button has no loading state and can be double-clicked, firing duplicate requests. | Feels broken on slow connections | fixed — loading state + disabled while pending |
| 4 | After answering, focus stays on the (now removed) input; screen-reader and keyboard users don't land on the feedback. | A11y and keyboard flow | fixed — feedback panel receives focus |
| 5 | Session-complete moment is a small aside, not a rewarding moment. | Weak end-of-loop payoff | fixed — completion panel now shows session accuracy, fastest answer, streak, and freezes |
| 6 | No skip/"too hard" escape on an activity; repeated failure repeats the same activity type. | Frustration spiral | fixed — repair switches to an activity format the learner has not failed |

## Onboarding

| # | Issue | Impact | Status |
| --- | --- | --- | --- |
| 7 | Users can fill in the whole onboarding form and only discover they need an account when submit fails. | Highest-friction moment in the app | fixed — onboarding checks the account first and offers the demo |
| 8 | One long single-page form; spec asks for a quick multi-step feel. | Overwhelming first impression | fixed — six quick steps with progress dots |
| 9 | Display name defaults to "Jamie" and birth date to 2000-01-01 — placeholder data gets silently submitted. | Bad data, impersonal | fixed — empty name field, no placeholder birth date collected |
| 10 | No placement check, focus preferences, or speaking-confidence question, so the first session can't adapt much. | Weak personalisation from day one | fixed — optional 60-second placement check, focus preferences, speaking confidence |
| 11 | Country/birth-date launch gate blocks all signup until per-country policies are seeded; heavy for the product's actual needs. | Blocks the public deploy | fixed — 13+ self-declaration replaces the country gate (migration 202607050001) |
| 12 | Interests list is six fixed chips; spec wants interests to shape content. | Personalisation ceiling | fixed — 12 interest chips plus free-text additions |

## Navigation / shell

| # | Issue | Impact | Status |
| --- | --- | --- | --- |
| 13 | "Demo" and "Status" sit first in the main nav; meta pages outrank the actual product. | Confusing hierarchy | fixed — product sections lead; demo/status moved to the footer |
| 14 | No active-page indicator in the nav. | Where am I? | fixed — aria-current + highlight on the active section |
| 15 | No mobile tab bar; nav wraps into a link soup on phones. | Mobile usability | fixed — mobile bottom tab bar |
| 16 | No sign-in/sign-out affordance anywhere in the shell. | Users can't tell if they're signed in | fixed — sign in/out button in the header |
| 17 | No first-run guidance; new users land on Today with no idea what does what. | Onboarding cliff | fixed — post-onboarding quick tour plus a first-lesson hint |

## Today

| # | Issue | Impact | Status |
| --- | --- | --- | --- |
| 18 | Mission headline is hardcoded ("Introduce yourself and talk about your day") regardless of the planned mission. | Wrong info once more missions exist | fixed — planner now emits `missionTitle` |
| 19 | Start button doesn't indicate when it will resume rather than restart. | Trust | fixed — button says "Resume where you left off" when a session is open |
| 20 | "Completed today" state depends on localStorage; a second device shows the wrong state. | Cross-device confusion | fixed — completion state comes from the server habit signal; localStorage is only an optimistic hint |

## Review / Progress / Tutor / Settings

| # | Issue | Impact | Status |
| --- | --- | --- | --- |
| 21 | Review items are a read-only list — you can't actually practise from the review page; the button just starts Today's session. | Core loop gap | fixed — Review starts a focused due-items-only session |
| 22 | Progress skill scores derive from activity-id keywords, not real per-skill scoring. | Progress can mislead | fixed — scores now use checked evidence by activity skill, separate recognition from productive work, and explain what the figures mean |
| 23 | Settings page is explanatory text only — none of the promised controls (session energy, notifications, strictness) are real controls. | Broken promise | fixed — live controls for name, daily minutes, session feel, focus areas, speaking confidence |
| 24 | Tutor page exists but free-question tutor is thin outside lesson context. | Feature feels stubby | fixed — the tutor page now includes a reviewed question library, while lesson help remains bound to the answer and source material actually in context |

## Speech / audio

| # | Issue | Impact | Status |
| --- | --- | --- | --- |
| 25 | Speaking is self-check only; no recognition even where the browser supports it. | Headline feature missing | fixed — browser speech recognition scores repeat-after-me with gentle feedback; honest self-check fallback elsewhere |
| 26 | Dictation audio has one speed; no slow replay. | Listening pedagogy | fixed — Play and Play-slowly buttons in dictation, plus a dedicated Listen trainer |
| 27 | speechSynthesis voice loading is lazy; first "Play the phrase" click can use a non-French voice on some browsers. | Wrong-language audio | fixed — voices warm up on first use and prefer an fr-FR voice |

## Friends / social

| # | Issue | Impact | Status |
| --- | --- | --- | --- |
| 30 | No opt-in friend layer or co-op loop despite the retention brief. | Motivation is entirely solo; no safe shared accountability. | fixed — account friends use private codes, accepted requests, co-op challenges, block/report controls, and Supabase RLS tables |

## Content

| # | Issue | Impact | Status |
| --- | --- | --- | --- |
| 28 | Only one full mission; scored missions exist but are shallow (few activity types each). | Thin product | fixed in code, publication gated — Introductions is the public scored mission; cafe and travel now have complete multi-stage definitions but remain unavailable until content review and database publication checks pass. Three further topic guides add unscored practice without overstating course coverage. |
| 29 | No Real French register section despite seed data carrying register labels. | Spec gap | fixed — roleplay page compares formal, neutral, casual, and too-blunt choices in cafe/travel scenarios |
| 31 | No deterministic roleplay despite the brief asking for natural, real-life practice. | Learners cannot rehearse judgement before a real exchange. | fixed — `/roleplay` adds source-bound cafe and travel roleplay with explicit register feedback |

## Regression checks

- Mobile 390px navigation and core-flow pass
- Reduced-motion, focus visibility, and contrast pass
- Brand-new learner empty states on Progress and Review
- Error, retry, and offline copy consistency
