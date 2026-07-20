# French for Life: Evidence Base

**Purpose:** the research layer underneath the Codex audit/roadmap. Codex told you *what your code does*. This tells you *what the code should do, and why*, with named sources you can cite in `docs/` and in content review.

**How to use it:** this file lives at `docs/EVIDENCE-BASE.md`. When planning milestone work (M1–M5), read it alongside the roadmap. Section 5 is the diff against the prior audit's plan; that's the bit that changes what you build.

---

## 0. TL;DR: the ten things that matter

1. **"Teach before test" is the best-evidenced thing in your spec.** Three meta-analyses agree: explicit instruction beats implicit. Goo et al. (2015): explicit *g* = 1.29 vs implicit *g* = 0.77. M1 is correctly ranked #1.
2. **Your two thresholds (0.90 retention, 0.80 success) are different knobs and Codex blurred them.** 0.90 is FSRS *desired retention* for **reviews**. ~0.85 is the optimal-difficulty target for **new/challenge items** (Wilson et al., 2019). Keep both; don't let one drive the other.
3. **Recognition-based mastery is inflated mastery.** Every meta-analysis finds effect sizes are largest on selected-response, smaller on controlled, smallest on free production. If your garden unlocks on taps, you're measuring the easiest thing.
4. **The #1 complaint about every competitor is "I did X years and still can't speak."** Your `speak-check.tsx` recording `completed` regardless of recognition outcome is *literally that bug*. Fix it before anything cosmetic.
5. **Metalinguistic feedback beats recasts for retention** (Li, 2010). Your deterministic near-miss explanation is the right primitive. Expand it; don't replace it with an LLM.
6. **Users asked for exactly the reward model you're proposing.** The L@S '22 gamification-misuse study's top user suggestions were to make gamification optional, scale rewards by difficulty and importance, and reward cognitive engagement rather than tap-count. That's M2, validated by 30,618 forum comments + 15 interviews.
7. **The professional French curriculum sources exist and have names.** Council of Europe *Reference Level Descriptions for French* (Beacco et al., Didier), A1.1 → C2. Plus CEFR Companion Volume 2020 (free), DELF syllabuses (France Éducation international), FLELex/CEFRLex (CEFR-graded lexicon), Lexique 3 (frequency). Section 3.
8. **Legally-clean native audio exists.** Mozilla Common Voice is CC0. Lingua Libre is CC-BY-SA. Tatoeba sentences are CC-BY (audio is derivative, so CC-BY too). You do not need to ship browser TTS.
9. **Pronunciation diagnosis is buildable today** with wav2vec2 phoneme-CTC + espeak-ng G2P + GOP. Word-overlap scoring is not pronunciation feedback and never will be. Section 4.
10. **Don't trust growth-blog numbers.** "Streak freeze reduced churn 21%" is repeated everywhere. Duolingo's *own* blog says allowing two freezes changed relative daily actives by **+0.38%**. Build on the mechanism, not the marketing.

---

## 1. How to actually teach it (the pedagogy spine)

### 1.1 Explicit instruction wins: this is your teach-before-test invariant

Three large meta-analyses compared explicit vs implicit L2 instruction:

| Study | Finding |
|---|---|
| Norris & Ortega (2000), *Language Learning* 50(3), 417–528 | 49 studies. Explicit > implicit. Focus-on-form and focus-on-formS both large. Effects relatively durable. |
| Spada & Tomita (2010), *Language Learning* 60(2) | 41 studies. Explicit > implicit for **both** simple and complex features; explicit also helps spontaneous use. |
| Goo, Granena, Yilmaz & Novella (2015) | 34 studies. Explicit *g* = 1.29, implicit *g* = 0.77. |

**Consistent caveat across all three:** effect sizes shrink as measures get more productive; selected response (*g* ≈ 0.60) > controlled response (≈ 0.58) > **free production (≈ 0.45)**. Instruction works, but it works *least* on the thing learners actually want. Design implication: measure the hard thing, or you will systematically overstate what you taught.

**What "teaching" must contain (not just "show a rule"):**
- the form + a metalinguistic rule statement
- 2–3 contrasting examples (positive AND negative evidence)
- the *function* (what it's for, when a French speaker uses it)
- register note where relevant (tu/vous is not decoration; it's A1 pragmatics)
- a comprehensible-input segment (§1.2) before any scored prompt

### 1.2 Comprehensible input needs 95–98% known-word coverage

Consensus from vocabulary research (Laufer 1989; Nation 2006; Schmitt et al. 2011): **95% lexical coverage is the floor** for basic comprehension, **98% is optimal** for comprehension + incidental vocabulary pickup. Below that, learners aren't inferring, they're guessing.

Extensive reading works but modestly: Nakanishi (2015) meta-analysis, 34 studies; pre/post *d* = 0.71, vs control *d* = 0.46. Incidental vocabulary from **spoken** input is weaker still (Vos et al., 2018); listening alone has a low uptake rate.

**Design implications:**
- Your `verify:curriculum` gate must check **coverage**, not just "is this word declared". Compute the % of tokens in an activity prompt that are (a) already introduced, or (b) glossed in place. Reject anything under 95%.
- Use FLELex (§3.2) as the external oracle for "is this word plausibly A1?" rather than trusting your own content declarations.
- Input alone won't get you there. Input + explicit form-focus + retrieval is the combination the evidence supports.

### 1.3 Spacing, retrieval, and which scheduler

Two credible options, and they solve different problems:

**FSRS (Free Spaced Repetition Scheduler)**: models Difficulty, Stability, Retrievability per item; power-law forgetting curve; schedules when predicted recall drops to your `desiredRetention` (default 0.90). FSRS-6 has 21 trainable params, defaults fitted on ~700M reviews. Benchmarked on 500M+ real Anki reviews: ~20–30% fewer reviews for the same retention vs SM-2; more accurate recall prediction for ~99.5% of collections. Anki's default since 23.10.
→ *Caveat worth writing in your docs:* that efficiency figure comes from large-scale simulation on logged review data, not a controlled trial with live learners. And below ~1,000 reviews FSRS can't fit a personal model; it falls back to defaults.

**Half-Life Regression (Settles & Meeder, ACL 2016)**: Duolingo's own model. Estimates the half-life of a *lexeme* in a learner's memory; 45%+ error reduction over baselines on recall prediction; +12% daily engagement in a live A/B. Code + 13M learning traces are public (MIT, `github.com/duolingo/halflife-regression`).

**Recommendation:** ship FSRS via a pinned `ts-fsrs` adapter (Codex is right). But steal HLR's *feature design*: it conditions on lexeme identity, not just review history. Your cold-start prior for a new item should come from **FLELex CEFR band + Lexique 3 frequency**, not a constant. That's the single cheapest accuracy win in M3.

### 1.4 The 85% rule: and why it is NOT the same as 0.90 retention

Wilson, Shenhav, Straccia & Cohen (2019), *Nature Communications* 10:4646, "The Eighty Five Percent Rule for Optimal Learning." For a broad class of gradient-descent learners on binary classification, learning is fastest at ~**85% training accuracy** (error ≈ 15.87%). They frame it as putting the "zone of proximal difficulty" on a mathematical footing. Wilson himself cautions against literalism, and the result is derived on ML/perceptual tasks, not L2 grammar.

**The conflation to avoid:**

| Knob | Governs | Target | Source |
|---|---|---|---|
| `desiredRetention` | when a **known** item is re-shown | 0.90 | FSRS default |
| `targetSuccess` | which **new/challenge** item to select next | 0.80–0.85 | Wilson et al. 2019 |

Codex's spec says "target retention 0.90 … select items nearest predicted success 0.80." Those aren't contradictory; but only if you implement them as **two separate subsystems**: FSRS owns the review queue; the ability/difficulty model owns new-item selection. Document that split or a future you will "fix" one into the other.

### 1.5 Corrective feedback: which kind, and when

Li (2010), *Language Learning* 60, 309–365; meta-analysis of CF in SLA. Headline for you:

- **Recasts** (reformulating the learner's utterance) produce the most immediate correct *uptake*…
- …but **metalinguistic feedback** (naming the rule) produces the best **learning and retention**.
- Explicit CF is better for semantically/syntactically complex features. Implicit reformulation is fine for features close to the L1.
- Best practice from the literature: make corrective intent transparent; use a **hybrid package (prompt first, then recast)**; focused (not scattershot) feedback; combine with explicit instruction.

**Design implications:**
- Your deterministic near-miss explanation is the *right* mechanism. Give it a taxonomy that supports metalinguistic naming, not just "grammar/spelling/word order/register/listening/unknown". You need French-specific error codes (§4.3).
- Implement the hybrid: on a wrong answer, **prompt** ("Almost. What happens to *le* before a vowel?"), then on the second miss, **recast + rule**.
- Do not let an LLM be the primary feedback path. Bounded, source-ID-validated tutor as a *secondary* channel (which you already have) is the correct architecture.

### 1.6 Task-based teaching, and the honest caveat

TBLT (organise learning around real communicative tasks; order a coffee, report a lost bag) has broad support: systematic reviews report gains in accuracy, fluency, pragmatic competence and spontaneous grammar use, plus reduced speaking anxiety and increased willingness to communicate. Technology-mediated TBLT has been meta-analysed (Ziegler et al., *CALICO*, 1990–2024).

**The caveat you should know before betting the curriculum on it:** critics note "task" is under-defined in the literature, and that TBLT without negotiation of meaning can permit **fossilisation**: learners get fluent at being wrong. Task-based ≠ correction-free. Codex's M4 "task → concepts → teaching → guided production → free production → spaced assessment" pipeline is exactly the right shape *because* it sandwiches the task between explicit teaching and spaced assessment.

### 1.7 Pronunciation: explicit phonetics instruction works

Explicit articulatory instruction significantly improves specific phonetic features (Derwing, Munro & Wiebe 1997; Saito 2012). For **L2 French specifically**, semester-long explicit phonetics courses produce measurable improvement, and Sturm's work shows instruction increases liaison use.

The canonical anglophone French error inventory (this is your `PhonemeErrorCode` enum):

| Error | Example | Why it matters |
|---|---|---|
| /y/ ≠ /u/ | *russe* vs *rousse*; *beaucoup* vs *beau cul* | The single most cited English-L1 French error. Also the funniest way to fail. |
| Nasal vowels (4: an/en, in/ain, on, un) | *immense* (not nasal) vs *important* (nasal) | Absent from English. English speakers produce vowel + consonant [n]. |
| Uvular /ʁ/ | most common French consonant | English speakers keep it too far forward. |
| Front rounded /ø/, /œ/ | *deux*, *sœur* | No English equivalent; neither rounding nor frontness. |
| Liaison | *des œufs* → /de.z‿ø/ | Rule-governed, not optional; instruction demonstrably improves it. |
| Silent final consonants | *œuf* /œf/ vs *œufs* /ø/ | English speakers pronounce them. |
| é /e/ vs è /ɛ/ | *arrivés* | English speakers open the final vowel. |
| Final-group stress | French stresses the last syllable of the *group*, not the word | Makes everything sound anglophone even when segments are right. |

**Frame the goal as intelligibility, not native-likeness.** The CEFR Companion Volume 2020 deliberately re-centred the Phonological Control scale on **intelligibility** rather than native-speaker approximation (Piccardo's revision report). Your UI copy should say so.

---

## 2. What users enjoy, and what makes them leave

### 2.1 The best study on this, and what it actually found

Hadi Mogavi, Guo, Zhang, Haq, Hui & Ma (2022), **"When Gamification Spoils Your Learning"**, *ACM L@S '22*, 30,618 Duolingo forum comments (2012–2021) + 15 semi-structured interviews. It's the deepest published look at why gamified learning apps fail their users. Findings, condensed:

**Harms of gamification misuse (users' own words):**
- *Reduced learning*: loss of confidence, loss of interest, dropping out. One user described seeing real learning as an obstacle to gamification success.
- *Poor well-being*: disappointment, apprehension, self-recrimination, physical strain, disrupted routines.
- *Threatened ethics*: leaderboard cheating makes the environment feel unfair, driving honest users out.

**Why it happens:**
- *Active:* competitiveness, overindulgence in playfulness, challenging the system.
- *Passive:* **dark nudges** (demoting a user who hit their daily goal; random league assignment across different languages and levels), compulsion, herding ("everyone else is cheating so I did").

**What users asked for (this is your feature list, free):**
- **S1-2: Make gamification schemes optional.** Highest-frequency ask. Achievements and leagues can be disabled without touching learning.
- **S1-1: Leaderboards must compare comparable people.** Level-23 vs level-5 in the same league is corrosive.
- **S1-3: Support different learning cadences.** A weekend-only learner is *punished* by a daily streak. One interviewee explicitly wanted a **weekly streak**.
- **S2-1: Scale rewards by difficulty and importance.** Uniform XP creates farming loopholes ("repeating stories is the cheapest way to the top").
- **S2-2: Reward cognitive and emotional engagement, not just behavioural.** A user's line worth pinning above your desk: the notification system assumes you hate learning and are only here to compete.
- **S2-3: Decay the value of trivially repeatable content over time.**

Everything in Codex's M2 ("mastery events as the only reward currency") is a direct implementation of S2-1/S2-2. You can cite this study in your own docs as justification.

### 2.2 Streaks: forgiveness works; the numbers are smaller than the internet says

From Duolingo's **own** engineering/learning blog:
- Learners who reach a **7-day streak are 3.6× more likely to complete the course**.
- Allowing **two** streak freezes instead of one increased relative daily active learners by **+0.38%**: Duolingo explicitly notes this is small but meaningful at their scale, and importantly it did **not** cause people to slack off.

Meanwhile secondary blogs report "streak freeze reduced churn by 21%" and "widgets increased commitment 60%." **Treat those as unsourced.** The mechanism (forgiveness reduces at-risk churn) is well-supported; the magnitudes are not.

Also from the research: Duolingo appears on `deceptive.design`'s dark-patterns database for pushy reminders. Your existing "no loss messaging, automatic freezes, max two freezes" design is already ahead of them. Keep it and say so in your marketing.

### 2.3 The complaint that should shape the whole product

Across user discourse, review analysis and the Quora/Reddit corpus, one complaint dominates: **long streak, no ability.** Learners finish trees, hold multi-hundred-day streaks, then meet a French speaker and produce nothing. Sub-complaints:

- Courses are weighted toward reading and fill-in-the-blank; **speaking and listening (the skills people actually wanted) get the least coverage**, and what exists is tested artificially (say a sentence, ASR accepts or doesn't).
- Grammar goes unexplained; users go to Reddit/Discord for answers the app should have given.
- Synthetic voices at unnatural pace ≠ preparation for real connected speech.
- Rising resentment of AI-generated content replacing human-authored content.
- Hearts/lives = "pain-point monetisation": manufacture the anxiety, sell the cure.

**Read the Codex audit next to that list.** Your `speak-check.tsx:59-68` marks the activity `completed` regardless of recognition outcome, and `lib/speech/scoring.ts` compares word *sets*. That is the exact failure mode users are describing, implemented. Codex ranked it #7. **It's arguably #2**, because it's the one that makes the entire proposition ("you'll actually be able to speak French") false.

### 2.4 What actually keeps people (mechanism, not tactics)

Self-Determination Theory (autonomy / competence / relatedness) is the frame the HCI literature uses, and the misuse study explicitly attributes gamification misuse to *frustration* of those three needs. Practical translation:

| Need | Break it by… | Serve it by… |
|---|---|---|
| **Autonomy** | forced daily streaks, forced leagues, notifications framed as obligation | opt-out gamification; weekly/flexible cadence; learner-chosen goals and topics |
| **Competence** | rewarding taps; showing a fake fluency % | mastery events; honest can-do evidence; "you can now do X" |
| **Relatedness** | random leaderboards against strangers at other levels | opt-in friends; co-op goals; human feedback on production |

Also from the retention literature, the boring but true part: **streaks only work on top of a product that already delivers value.** Streaks can't rescue a weak core loop; they just make people feel bad about leaving one.

### 2.5 AI conversation practice: real, but evidence is affective-first

Recent systematic reviews (2024–2025) of LLM chatbots for L2 speaking find **consistent, robust reduction in foreign-language speaking anxiety and increased willingness to communicate**: the judgment-free partner effect is the reliable finding. **Speaking-*performance* gains are mixed**: several studies (incl. Fathi et al. and the *Computer Assisted Language Learning* 2025 chatbot comparison) found no significant pre/post difference in speaking test scores across conditions, and short study durations may just be measuring novelty.

**Implication:** an AI roleplay partner is legitimately valuable as an *anxiety-reduction and practice-volume* feature, and you should market it that way. Do not claim it teaches. Your deterministic register-aware roleplay (which already gives explicit formal/neutral/too-blunt feedback) is arguably *more* defensible than an open LLM chat, because it teaches something specific.

---

## 3. Professional, reliable sources for the French itself

This is the section that closes your `verify:content` gate and your "OPEN QUESTION: which qualified French reviewer owns publication approval?"

### 3.1 Authoritative curriculum specifications (what to teach, per level)

**The answer to "what should A1 contain?" is not a blog post. It's this:**

- **Council of Europe Reference Level Descriptions (RLDs) for French**: the official, DGLFLF-supported series, published by Éditions Didier. This is the French equivalent of the Spanish *Plan curricular del Instituto Cervantes* and German *Profile deutsch*:
  - *Niveau A1.1 pour le français*; Beacco, de Ferrari, Lhote & Tagliante (2005)
  - *Niveau A1 pour le français*; Beacco & Porquier (2007), with audio CD
  - *Niveau A2 pour le français*; Beacco & Lepage (2008)
  - *Niveau B1 pour le français*; Beacco, Blin, Houles, Lepage & Riba (2011)
  - *Niveau B2 pour le français*; Beacco et al.
  - *Niveaux C1/C2 pour le français*; Riba (2016)
  - Index: `coe.int/en/web/common-european-framework-reference-languages/reference-level-descriptions-rlds-developed-so-far`
  - **These are commercial books.** Budget ~£150–250 for A1–B2. This is the cheapest possible way to make "source-backed" true. Buy them.

- **CEFR Companion Volume (2020)**: Council of Europe, North/Piccardo/Goodier. Free PDF from coe.int, including a **French version**. Contains the complete extended illustrative descriptor set (replacing 2001), incl. mediation, online interaction, and the revised Phonological Control scale (intelligibility-based). **This is the source of your `CanDoDescriptor` table.** Do not hand-write can-dos.

- **DELF syllabuses**: France Éducation international (issuing body for the French Ministry of Education). Per-level exam specs, sample papers ("exemples de sujets"), candidate manuals, and the four-skill structure (CO / CE / PE / PO, 25 points each, 50/100 to pass, <5/25 in any skill = fail). `france-education-international.fr`. Use these to define what a "task" at each level looks like, and to sanity-check your placement bands.

### 3.2 Graded lexicon and frequency (which words, at which level)

- **FLELex / CEFRLex** (UCLouvain CENTAL), `cental.uclouvain.be/cefrlex/flelex/`. A CEFR-graded lexicon for **French as a foreign language**: ~13–17k entries (simple + multiword lemmas) with POS and **normalised frequency per CEFR level**, derived from a 777k-word corpus of FLE textbooks and graded readers. Available as tab-separated CSV. A "Beacco version" adds a derived CEFR level column.
  → *This is your `vocabulary availability` oracle.* François, Gala, Watrin & Fairon, LREC 2014.
- **Lexique 3** (New, Pallier, Ferrand, Matos), 130k+ entries, French frequency database, includes film-subtitle frequencies (closer to spoken French than book corpora). FLELex validates against it at *r* = 0.84.
- **Manulex**: French frequency from school textbooks (native-child oriented; useful as a cross-check, not a primary).
- **ReSyf**: French synonyms ranked by reading difficulty. Directly useful for your "unseen synonyms are rejected" bug (Codex finding: `answer-validation.ts:28-35`).

### 3.3 Native audio you can legally ship

Your listening feature is five hardcoded phrases through browser TTS. You don't have to live like this.

| Source | Licence | What you get | Catch |
|---|---|---|---|
| **Mozilla Common Voice** | **CC0** | Tens of thousands of validated hours, 129 languages incl. French; multiple voices/accents; community-validated | Read speech, variable quality; you must curate |
| **Lingua Libre** (Wikimedia) | CC-BY-SA | Word- and phrase-level recordings by identified native speakers | Coverage is patchy; SA is viral |
| **Tatoeba** | **CC-BY** (some sentences CC0) | 1M+ sentences with audio, cross-linked translations | Audio is a *derivative* of the sentence, so it inherits CC-BY; you cannot relicense as CC0. Tatoeba explicitly warns recordings are not professionally checked for fidelity or clarity |
| **LibriVox / MLS** | Public domain | Long-form French audiobooks | 19th-century register; useless for "order a coffee" |
| **RFI *Journal en français facile*, TV5Monde *Apprendre le français*** | ©, **do not scrape** | Excellent graded material | Link out to it; don't ingest it |

**Recommended pipeline:** curate a Common Voice (CC0) subset for A1–A2 target sentences → record a small number of gap-filling phrases yourself with a native speaker under a written licence → store **normal + slow** versions, voice/accent metadata, transcript, and IPA. That satisfies Codex's M5 acceptance criteria and is legally clean.

### 3.4 Governance: what "source-backed" has to mean

Codex flagged that your canonical mission cites only an internal "content-owner source record." That's a fig leaf. Replace it with a `ContentSource` type that requires:

```ts
type ContentSource = {
  kind: 'rld' | 'cefr-cv' | 'delf-spec' | 'lexicon' | 'corpus' | 'native-informant';
  citation: string;          // "Beacco & Porquier (2007), Niveau A1 pour le français, p.84"
  url?: string;              // inspectable where one exists
  retrievedAt: string;
};

type ReviewRecord = {
  reviewerId: string;
  reviewerQualification: 'DAEFLE' | 'Master FLE' | 'DELF-DALF examinateur habilité' | 'native-informant';
  reviewedAt: string;
  decision: 'approved' | 'rejected' | 'changes-requested';
  notes: string;
};
```

**Who can be the reviewer** (your open question): the recognised FLE credentials are **DAEFLE** (Alliance Française/CNED diploma), a **Master FLE**, or **habilitation as a DELF/DALF examinateur-correcteur**. A university language-department postgrad or an Alliance Française teacher qualifies. Budget for a few hours per mission. `publicationStatus` must be `draft` until a `ReviewRecord` with `decision: 'approved'` exists; enforced in `verify:content`, not by policy.

**AI drafts:** Codex is right to keep them unpublished. Note the user-sentiment context: Duolingo has taken sustained public damage over perceived AI-generated course content. "Every scored sentence in this app was approved by a qualified French teacher" is a *marketing asset*, not just a quality gate. Say it on the landing page.

---

## 4. Speech: what's actually buildable

### 4.1 Why your current approach cannot work

`lib/speech/scoring.ts` compares **sets of recognised words**. The Web Speech API gives you an ASR hypothesis, which is a *lexical* judgment shaped by a language model. It will happily "recognise" *rousse* when you said *russe*, and it will never tell you your /y/ was wrong; because it doesn't know about /y/. A word that is recognised is (weakly) evidence of intelligibility; it is **not** evidence of pronunciation.

### 4.2 The buildable pipeline

The standard CAPT (Computer-Assisted Pronunciation Training) architecture, and the open components for each stage:

1. **G2P**: text → canonical French phoneme sequence. `espeak-ng` (GPL) is the standard, used in current forced-alignment research. Gives you IPA for any French string.
2. **Acoustic model / phoneme recognition**: `facebook/wav2vec2-xlsr-53-espeak-cv-ft` on HuggingFace: cross-lingual wav2vec2 fine-tuned for **phoneme** sequence prediction with CTC. Open weights. Used as the base in multiple recent MDD papers.
3. **Alignment**: Montreal Forced Aligner (Kaldi-based, pretrained French acoustic + G2P models), *or* modern CTC-segmentation / self-alignment approaches (GOP-SA / GOP-SF) which avoid MFA's pre-segmentation requirement entirely.
4. **Scoring**: **GOP (Goodness of Pronunciation)**, Witt & Young (2000): ratio of the log posterior of the canonical phone to the highest-posterior phone. Phone-dependent thresholds.
5. **Diagnosis (not just detection)**: GOP alone gives you a *score*, not "you said /u/ instead of /y/". For that you need free-phone recognition + alignment against the canonical sequence, i.e. MDD proper.

**Known limitations to design around (all from the 2024–2025 literature):**
- GOP-DNN has **high recall, low precision**: it over-flags. If you surface every flag, you will demoralise learners.
- GOP is **segmental**. It says nothing about liaison, rhythm, or final-group stress; which for French are the difference between comprehensible and not.
- Logit-based GOP correlates better with human raters than posterior-based.

### 4.3 The pragmatic design

Don't build a general MDD system. Build a **closed-set French error detector** over the eight errors in §1.7, each with a hand-tuned threshold validated against fixture audio (which is exactly Codex's `test:speech-fixtures` gate; good instinct, now you know what to put in it).

```ts
type PronunciationFinding = {
  code: 'y-vs-u' | 'nasal-denasalised' | 'nasal-plus-n' | 'r-anterior'
      | 'front-rounded-unrounded' | 'liaison-missing' | 'final-consonant-voiced'
      | 'e-open-vs-closed' | 'stress-misplaced';
  wordIndex: number;
  expectedPhoneme: string;   // IPA
  detectedPhoneme?: string;  // IPA, if diagnosable
  confidence: number;        // suppress below threshold
  coaching: string;          // articulatory, e.g. "round your lips as for /u/, but push your tongue forward as for /i/"
};
```

**Rules:** never block progression on a pronunciation finding. Never surface more than one finding per attempt. Always offer "I couldn't hear that clearly" as an honest outcome. Keep a self-check fallback where the browser/mic can't support it; but **stop recording `completed` on a failed attempt**. `completed` and `correct` are different fields.

**Frame it as intelligibility** (per CEFR CV 2020), and the low-precision problem becomes tolerable: "a French speaker might hear *rousse* here" is a defensible thing to say on a noisy signal. "Your /y/ is wrong" is not.

---

## 5. What this changes in the Codex plan

Codex's plan is good. It's structurally right and the milestone ordering is defensible. Here's the diff.

| # | Codex says | Evidence says | Do this |
|---|---|---|---|
| 1 | M1 teach-before-test first | Correct; best-evidenced item in the whole spec (Goo *g*=1.29 vs 0.77) | **Keep, unchanged.** Add the SLA citations to `docs/` so it survives future refactors. |
| 2 | Curriculum verifier checks "requirements are available" | Under-specified. Availability ≠ comprehensibility | Verifier must compute **≥95% known-or-glossed token coverage** per prompt, using **FLELex** as an external oracle, not just internal declarations. |
| 3 | "Target retention 0.90 … select nearest 0.80 predicted success" | Two different constructs (FSRS review scheduling vs Wilson optimal difficulty) | Implement as **two subsystems** with two named constants. Document the distinction in `lib/learning/README.md` or someone will "unify" them. |
| 4 | FSRS + Elo/IRT with `learner += 0.15×(o−p)`, `item −= 0.05×(o−p)` | Fine, but **cold start is unspecified** | Seed item difficulty from **FLELex CEFR band + Lexique 3 log-frequency**, not a constant. Cite Settles & Meeder (HLR) as precedent for lexeme-conditioned memory. |
| 5 | Mastery = "independent productive success on a due item, or 2 productive successes in separate sessions" | Well-aligned with the effect-size gradient (free production is the hard, honest measure) | **Keep.** Add: recognition-only evidence may *never* raise a displayed level. Add `evidenceKind: 'recognition' \| 'controlled' \| 'free-production'` and make free-production a *required* component of any can-do claim. |
| 6 | Error taxonomy = grammar/spelling/word-order/register/listening/unknown | Too coarse for metalinguistic feedback, which is what actually drives retention (Li 2010) | Expand to French-specific codes: gender-agreement, article-elision, partitive, tu/vous, past-tense aspect (PC vs imparfait), subjunctive trigger, liaison, silent-final, faux-ami, plus the 8 phoneme codes in §4.3. |
| 7 | Feedback = deterministic near-miss explanation + bounded tutor | Right primitive, wrong sequencing | Implement the **hybrid CF package**: prompt (elicit self-correction) → on second miss, recast + metalinguistic rule. This is the specific pattern the meta-analyses recommend. |
| 8 | Pronunciation ranked #7 | The "can't actually speak" complaint is the **defining** competitor failure, and your code marks failed speech as `completed` | **Promote to #2.** The one-line fix (stop writing `completed` on a failed recognition) ships this week; the wav2vec2+GOP pipeline is M5. |
| 9 | Listening: "licensed/native recordings" | Vague; reads like a blocker | It isn't. **Common Voice is CC0.** Name it. Curate a French subset, add normal+slow, transcript, IPA, voice/accent metadata. |
| 10 | Content review by "a qualified French reviewer" (open question) | Answerable | **DAEFLE / Master FLE / DELF-DALF examinateur habilité.** Sources = CoE RLDs (Beacco et al., Didier) + CEFR CV 2020 + DELF specs. Encode as `ContentSource` + `ReviewRecord` types (§3.4). |

### Missing from the plan entirely

**A. Comprehensible-input engine.** There is no reading or listening *input* path; only exercises. Extensive reading/listening has meta-analytic support (*d* ≈ 0.46 vs control) and, critically, it is **the part learners describe as enjoyable**. A graded-reader / story mode built on Tatoeba (CC-BY) + FLELex-filtered vocabulary is a small feature with a large learning and retention payoff. Consider it **M4.5**.

**B. Opt-out gamification.** The single most-requested item in the L@S study. `settings.gamification: 'full' | 'quiet' | 'off'`, where `off` still tracks mastery but shows no streak, no garden, no co-op. One afternoon of work.

**C. Flexible streak cadence.** Weekly streak as a first-class option (`streakMode: 'daily' | 'weekly'`), because daily streaks *actively punish* weekend-only learners and are the documented trigger for cheating and churn.

**D. Reward decay on trivial repetition.** S2-3 from the study. Repeating an already-mastered A1 activity should be worth progressively less. Otherwise you've rebuilt the XP farm you're trying to avoid.

**E. Enjoyment model: you have the spec now.** Codex scored it 0/5 and CLAIMED-ONLY. Instrument:
```ts
type EnjoymentSignal = {
  activityType: string; topicId: string;
  completed: boolean;          // did they finish it
  abandonedAtMs?: number;      // where did they bail
  returnedWithin24h: boolean;  // the only retention metric that matters
  selfRating?: 1|2|3|4|5;      // optional, one tap, never mandatory
};
```
Then: enjoyment adjusts *selection weight* within the eligible set; it never overrides prerequisite or coverage constraints (Codex's 30% floor is the right guardrail). Autonomy/competence/relatedness (SDT) is the frame to report against.

**F. Human feedback, cheap version.** Busuu's community-correction model is the single most-praised differentiator in competitor reviews ("a real person can tell you *that's grammatically correct but sounds weird*"). Codex defers this pending safeguarding; correct. But scope it now: async, text-only, native-speaker corrections on free-production submissions, with report/block already built (you have the social schema). It's a v2 headline feature.

---

## 6. Verification gates this adds

Extend Codex's §7 table:

| Gate | Command | Proves |
|---|---|---|
| Lexical coverage | `npm run verify:coverage` | Every scored prompt is ≥95% known-or-glossed tokens, checked against FLELex |
| Source traceability | `npm run verify:content` | Every published mission has a `ContentSource` with an inspectable citation and an approved `ReviewRecord` |
| Evidence integrity | `npm test -- tests/evidence-kinds.test.ts` | No can-do claim, level display, or garden unlock is backed by `recognition`-only evidence |
| Phoneme fixtures | `npm run test:speech-fixtures` | The 8 French error codes each fire on their fixture audio and stay silent on clean audio |
| Threshold separation | `npm test -- tests/scheduling-vs-selection.test.ts` | `desiredRetention` (0.90) and `targetSuccess` (0.80–0.85) are read from separate constants by separate modules |
| WCAG 2.2 AA | `npm run test:a11y` | axe + manual: target size ≥24×24 CSS px (2.5.8), non-drag alternatives (2.5.7), focus not obscured (2.4.11), accessible auth; no cognitive-function test (3.3.8), redundant entry (3.3.7), consistent help (3.2.6). Note 4.1.1 Parsing was **removed** in 2.2. Automated tools catch ~30–40% of issues; the a11y gate must include manual keyboard + 200% zoom scenarios or it's theatre. |

---

## 7. Source list

**Instructed SLA**
- Norris & Ortega (2000). Effectiveness of L2 Instruction: A Research Synthesis and Quantitative Meta-analysis. *Language Learning* 50(3), 417–528.
- Spada & Tomita (2010). Interactions Between Type of Instruction and Type of Language Feature. *Language Learning* 60(2). doi:10.1111/j.1467-9922.2010.00562.x
- Goo, Granena, Yilmaz & Novella (2015). Norris & Ortega (2000) revisited and updated. In *Implicit and Explicit Learning of Languages*, Benjamins.
- Li, S. (2010). The Effectiveness of Corrective Feedback in SLA: A Meta-Analysis. *Language Learning* 60, 309–365.
- Nakanishi (2015). A Meta-Analysis of Extensive Reading Research. *TESOL Quarterly*. doi:10.1002/tesq.157
- Vos et al. (2018). Incidental L2 Word Learning from Spoken Input: meta-analysis. *Language Learning*. doi:10.1111/lang.12296
- Ziegler et al. (2024). Technology-Mediated Task-Based Language Teaching: A Meta-Analysis. *CALICO Journal*.

**Memory & difficulty**
- Wilson, Shenhav, Straccia & Cohen (2019). The Eighty Five Percent Rule for Optimal Learning. *Nature Communications* 10:4646. doi:10.1038/s41467-019-12552-4
- Settles & Meeder (2016). A Trainable Spaced Repetition Model for Language Learning. *ACL*, 1848–1858. Code+data: `github.com/duolingo/halflife-regression`
- FSRS / open-spaced-repetition benchmark: `github.com/open-spaced-repetition` (FSRS-6; benchmark over 500M+ reviews)

**Gamification & motivation**
- Hadi Mogavi, Guo, Zhang, Haq, Hui & Ma (2022). When Gamification Spoils Your Learning. *ACM L@S '22*. arXiv:2203.16175
- Toda, Valle & Isotani (2018). The Dark Side of Gamification. Springer CCIS.
- Duolingo blog, *The Duolingo Streak Uses Habit Research to Keep You Motivated* (the +0.38% / 3.6× figures)
- Deci, Koestner & Ryan (1999): extrinsic rewards can undermine intrinsic motivation (the overjustification risk your garden must avoid)

**Efficacy (read the caveats)**
- Vesselinov & Grego (2012, 2016a/b, 2018): Duolingo/Babbel/Busuu/italki efficacy white papers. **Company-funded, WebCAPE-based, criticised in the literature for unwarranted claims.** Cite only with that caveat.
- Jiang, Rollinson, Plonsky & Pajak (2021). Evaluating the reading and listening outcomes of beginning-level Duolingo courses. *Foreign Language Annals*.
- Loewen, Isbell & Sporn (2020): app-based instruction and oral communicative ability.

**French: curriculum & lexicon**
- Beacco et al. (2005–2016). *Niveaux A1.1 / A1 / A2 / B1 / B2 / C1-C2 pour le français*. Didier. (Council of Europe RLDs)
- Council of Europe (2020). *CEFR Companion Volume*. North, Piccardo, Goodier. Free PDF, incl. French version.
- France Éducation international; DELF/DALF specs, sample papers, candidate manuals.
- François, Gala, Watrin & Fairon (2014). FLELex: a graded lexical resource for French foreign learners. *LREC 2014*. `cental.uclouvain.be/cefrlex/flelex/`
- New, Pallier, Ferrand & Matos (2001). Lexique 3. *L'Année Psychologique* 101, 447–462.

**Speech**
- Witt & Young (2000). Phone-level pronunciation scoring and assessment. *Speech Communication* 30(2-3), 95–108. (GOP, the original)
- Cao, Fan, Svendsen & Salvi (2025). Segmentation-free Goodness of Pronunciation. arXiv:2507.16838
- `facebook/wav2vec2-xlsr-53-espeak-cv-ft` (HuggingFace); cross-lingual phoneme CTC model
- Montreal Forced Aligner; pretrained French acoustic + G2P models
- Sturm, J., *Liaison in L2 French: The Effects of Instruction* (PSLLT proceedings)

**Content sources**
- Mozilla Common Voice: CC0, `commonvoice.mozilla.org`
- Tatoeba: CC-BY (some CC0); audio inherits sentence licence. `tatoeba.org/en/terms_of_use`
- Lingua Libre (Wikimedia): CC-BY-SA

**Accessibility**
- W3C, *What's New in WCAG 2.2*, `w3.org/WAI/standards-guidelines/wcag/new-in-22/`
