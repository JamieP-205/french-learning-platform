import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

export const COVERAGE_PERCENT = 95;
export const COVERAGE_THRESHOLD = COVERAGE_PERCENT / 100;
export const FLELEX_SOURCE_SHA256 = "E0CBDB672FA4F83155ACEC4C8F01F179B30BE08CB3D2D6CF0D9F25042B01E3D4";
export const FLELEX_CSV_SHA256 = "610F4668AF7F8E897CC0A8C9E17A83357ED823A25A1599CB81EF02CC8EF1C6B3";

type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

type InlineGloss = {
  form: string;
  meaning: string;
};

type VocabularyEntry = {
  form: string;
  lemma: string;
  pos: string;
  cefrLevel: CefrLevel;
  meaning: string;
};

type TeachingStep = {
  form: string;
  metalinguisticRule: string;
  positiveExamples: string[];
  contrastExamples: string[];
  function: string;
  registerNote?: string;
  inputSegment: {
    text: string;
    inlineGlosses: InlineGloss[];
  };
};

type ConceptDefinition = {
  id: string;
  prerequisiteConceptIds: string[];
  teachingStep: TeachingStep;
  vocabulary: VocabularyEntry[];
};

type ScoredSegment = {
  source: "prompt" | "choice" | "target" | "token" | "accepted-answer";
  text: string;
  inlineGlosses: InlineGloss[];
};

type ActivityCurriculumRequirement = {
  activityId: string;
  requiredConceptIds: string[];
  scoredSegments: ScoredSegment[];
};

type MissionCurriculum = {
  missionId: string;
  concepts: ConceptDefinition[];
  activities: ActivityCurriculumRequirement[];
};

type RuntimeActivity = {
  id: string;
  type: string;
  prompt: string;
  promptFrenchSegments?: unknown;
  choices?: { id: string; label: string; language?: unknown }[];
  targetText?: string;
  tokens?: string[];
  acceptedAnswers: { value: string }[];
};

type RuntimeMission = {
  id: string;
  activities: RuntimeActivity[];
};

export type VerificationData = {
  missions: RuntimeMission[];
  curriculum: MissionCurriculum[];
  publicRootMissionIds?: string[];
  authoredLockedMissionIds?: string[];
  runtimeGatedConceptIdsByActivity?: Record<string, string[]>;
};

export type Violation = {
  code: string;
  lessonId?: string;
  exerciseId?: string;
  conceptId?: string;
  token?: string;
  detail: string;
};

export type VerificationSummary = {
  missionCount: number;
  activityCount: number;
  conceptCount: number;
  vocabularyCount: number;
  scoredCoverageCount: number;
  teachingCoverageCount: number;
  minimumCoverage: number;
  violations: Violation[];
};

type FleLex = {
  words: Set<string>;
  tagsByWord: Map<string, Set<string>>;
  levelsByLemmaAndPos: Map<string, Set<CefrLevel>>;
  digest: string;
};

const expectedHeader = [
  "word",
  "tag",
  "freq_A1",
  "freq_A2",
  "freq_B1",
  "freq_B2",
  "freq_C1",
  "freq_C2",
  "freq_total",
  "level",
];

export function canonicalTextSha256(value: Uint8Array | string) {
  const text = typeof value === "string" ? value : Buffer.from(value).toString("utf8");
  const canonicalBytes = Buffer.from(text.replace(/\r\n?/g, "\n"), "utf8");
  return createHash("sha256").update(canonicalBytes).digest("hex").toUpperCase();
}

const normalise = (value: string) =>
  value.normalize("NFC").toLocaleLowerCase("fr").replaceAll("’", "'").trim();

export const tokeniseFrench = (text: string) => {
  const rawTokens = text.normalize("NFC").match(/\p{L}+(?:(?:[’']\p{L}+)|[’'])?(?:-\p{L}+)*|\p{N}+/gu) ?? [];
  return rawTokens.flatMap((rawToken) => {
    const token = normalise(rawToken);
    if (token.endsWith("'")) return [token];
    const elision = token.match(/^((?:[cdjlmnst]|qu)')(.+)$/u);
    if (elision) return [elision[1], ...elision[2].split("-")];
    return token.split("-");
  });
};

const keyForLexeme = (lemma: string, pos: string) => `${normalise(lemma)}\u0000${pos}`;

export function loadFleLex(root = process.cwd()): FleLex {
  const sourcePath = resolve(root, "content-tools", "FleLex_TT_Beacco.tsv.gz");
  const sourceBytes = gunzipSync(readFileSync(sourcePath));
  const sourceDigest = createHash("sha256").update(sourceBytes).digest("hex").toUpperCase();
  if (sourceDigest !== FLELEX_SOURCE_SHA256) {
    throw new Error(`FLELex source integrity failure: expected SHA-256 ${FLELEX_SOURCE_SHA256}, received ${sourceDigest}`);
  }
  const path = resolve(root, "content-tools", "FleLex_TT_Beacco.csv");
  const bytes = readFileSync(path);
  const digest = canonicalTextSha256(bytes);
  if (digest !== FLELEX_CSV_SHA256) {
    throw new Error(`FLELex CSV integrity failure: expected SHA-256 ${FLELEX_CSV_SHA256}, received ${digest}`);
  }

  const lines = bytes.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = lines.shift()?.split(",") ?? [];
  if (header.length !== expectedHeader.length || header.some((value, index) => value !== expectedHeader[index])) {
    throw new Error(`FLELex schema failure: expected ${expectedHeader.join(",")}, received ${header.join(",")}`);
  }

  const words = new Set<string>();
  const tagsByWord = new Map<string, Set<string>>();
  const levelsByLemmaAndPos = new Map<string, Set<CefrLevel>>();
  for (const line of lines) {
    if (!line) continue;
    const columns = line.split(",");
    if (columns.length !== expectedHeader.length) {
      throw new Error(`FLELex row has ${columns.length} columns instead of ${expectedHeader.length}: ${line.slice(0, 80)}`);
    }
    const lemma = normalise(columns[0]);
    const pos = columns[1];
    const level = columns[9] as CefrLevel;
    words.add(lemma);
    const tags = tagsByWord.get(lemma) ?? new Set<string>();
    tags.add(pos);
    tagsByWord.set(lemma, tags);
    const key = keyForLexeme(lemma, pos);
    const levels = levelsByLemmaAndPos.get(key) ?? new Set<CefrLevel>();
    levels.add(level);
    levelsByLemmaAndPos.set(key, levels);
  }
  return { words, tagsByWord, levelsByLemmaAndPos, digest };
}

function uniqueSegments(segments: ScoredSegment[]) {
  const seen = new Set<string>();
  return segments.filter((segment) => {
    const key = `${segment.source}\u0000${segment.text.normalize("NFC")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const hasFrenchOrthographicEvidence = (token: string) =>
  /[àâæçéèêëîïôœùûüÿ]/u.test(token) || /^(?:[cdjlmnst]|qu)'$/u.test(token);

const isFrenchStructuralTag = (tag: string) =>
  tag === "PRO" || tag === "KON" || tag === "PRP" || tag.startsWith("DET:") || tag.startsWith("PRP:");

function certifiedFrenchRun(
  text: string,
  frenchOracleTokens: Set<string>,
  distinctiveFrenchTokens: Set<string>,
) {
  const tokens = tokeniseFrench(text);
  if (tokens.length === 0) return undefined;
  let run: string[] = [];
  let longest: string[] = [];
  for (const token of tokens) {
    if (frenchOracleTokens.has(token)) {
      run.push(token);
      if (run.length > longest.length) longest = [...run];
    } else {
      run = [];
    }
  }
  const allCertified = tokens.every((token) => frenchOracleTokens.has(token));
  const candidate = allCertified ? tokens : longest;
  const hasDistinctiveFrenchEvidence = candidate.some(
    (token) => distinctiveFrenchTokens.has(token) || hasFrenchOrthographicEvidence(token),
  );
  return (allCertified || longest.length >= 2) && hasDistinctiveFrenchEvidence ? candidate : undefined;
}

function undeclaredPromptContradiction(
  prompt: string,
  declaredSegments: string[],
  frenchOracleTokens: Set<string>,
  distinctiveFrenchTokens: Set<string>,
) {
  const candidates: string[] = [];
  for (const match of prompt.matchAll(/[“«"]([^”»"]+)[”»"]/gu)) candidates.push(match[1]);
  const colonIndex = prompt.indexOf(":");
  if (colonIndex >= 0) candidates.push(prompt.slice(colonIndex + 1));
  if (candidates.length === 0) candidates.push(prompt);

  for (const candidate of candidates) {
    let undeclared = candidate.normalize("NFC");
    for (const declared of declaredSegments) {
      undeclared = undeclared.replaceAll(declared.normalize("NFC"), " ");
    }
    const run = certifiedFrenchRun(undeclared, frenchOracleTokens, distinctiveFrenchTokens);
    if (run) return { candidate: candidate.trim(), run };
  }
  return undefined;
}

export function deriveRuntimeScoredSegments(
  activity: RuntimeActivity,
  {
    lessonId,
    violations,
    frenchOracleTokens,
    distinctiveFrenchTokens,
  }: {
    lessonId: string;
    violations: Violation[];
    frenchOracleTokens: Set<string>;
    distinctiveFrenchTokens: Set<string>;
  },
): ScoredSegment[] {
  const segments: ScoredSegment[] = [];
  if (!Array.isArray(activity.promptFrenchSegments)) {
    violations.push({
      code: "PROMPT_LANGUAGE_METADATA_MISSING",
      lessonId,
      exerciseId: activity.id,
      detail: "Scored runtime activity must explicitly declare promptFrenchSegments, including [] when the prompt is English-only.",
    });
  } else {
    for (const candidate of activity.promptFrenchSegments) {
      if (typeof candidate !== "string" || !candidate.trim()) {
        violations.push({
          code: "PROMPT_FRENCH_SEGMENT_INVALID",
          lessonId,
          exerciseId: activity.id,
          detail: "Each promptFrenchSegments entry must be a non-empty string.",
        });
        continue;
      }
      if (!activity.prompt.normalize("NFC").includes(candidate.normalize("NFC"))) {
        violations.push({
          code: "PROMPT_FRENCH_SEGMENT_NOT_RUNTIME",
          lessonId,
          exerciseId: activity.id,
          detail: `Declared French segment is not an exact substring of the runtime prompt: ${JSON.stringify(candidate)}.`,
        });
      }
      segments.push({ source: "prompt", text: candidate, inlineGlosses: [] });
    }
    const contradiction = undeclaredPromptContradiction(
      activity.prompt,
      activity.promptFrenchSegments.filter((candidate): candidate is string => typeof candidate === "string"),
      frenchOracleTokens,
      distinctiveFrenchTokens,
    );
    if (contradiction) {
      violations.push({
        code: "PROMPT_FRENCH_METADATA_CONTRADICTION",
        lessonId,
        exerciseId: activity.id,
        token: contradiction.run.join(" "),
        detail: `FLELex-certified French content is omitted from promptFrenchSegments in ${JSON.stringify(contradiction.candidate)}.`,
      });
    }
  }

  for (const choice of activity.choices ?? []) {
    if (choice.language === "fr") {
      segments.push({ source: "choice", text: choice.label, inlineGlosses: [] });
    } else if (choice.language === "en") {
      const contradiction = certifiedFrenchRun(choice.label, frenchOracleTokens, distinctiveFrenchTokens);
      if (contradiction) {
        violations.push({
          code: "CHOICE_LANGUAGE_METADATA_CONTRADICTION",
          lessonId,
          exerciseId: activity.id,
          token: contradiction.join(" "),
          detail: `Choice ${JSON.stringify(choice.id)} is labelled English but its text is FLELex-certified French: ${JSON.stringify(choice.label)}.`,
        });
      }
    } else {
      violations.push({
        code: "CHOICE_LANGUAGE_METADATA_MISSING",
        lessonId,
        exerciseId: activity.id,
        detail: `Choice ${JSON.stringify(choice.id)} must explicitly declare language "fr" or "en"; unlabelled choices are audited as French.`,
      });
      // Fail closed: an unlabelled choice remains subject to parity and lexical
      // coverage instead of disappearing from the audit.
      segments.push({ source: "choice", text: choice.label, inlineGlosses: [] });
    }
  }

  if (activity.targetText) {
    segments.push({ source: "target", text: activity.targetText, inlineGlosses: [] });
  }
  for (const token of activity.tokens ?? []) {
    segments.push({ source: "token", text: token, inlineGlosses: [] });
  }

  const choiceIds = new Set((activity.choices ?? []).map((choice) => choice.id));
  for (const answer of activity.acceptedAnswers) {
    if (!choiceIds.has(answer.value) && normalise(answer.value) !== "completed") {
      segments.push({ source: "accepted-answer", text: answer.value, inlineGlosses: [] });
    }
  }
  return uniqueSegments(segments);
}

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const meetsCoverageThreshold = (total: number, uncovered: number) =>
  total === 0 || (total - uncovered) * 100 >= total * COVERAGE_PERCENT;

const coverageFor = (text: string, known: Set<string>, glosses: InlineGloss[]) => {
  const tokens = tokeniseFrench(text);
  const glossed = new Set(glosses.flatMap((gloss) => tokeniseFrench(gloss.form)));
  const uncovered = tokens.filter((token) => !known.has(token) && !glossed.has(token));
  return {
    tokens,
    uncovered,
    ratio: tokens.length === 0 ? 1 : (tokens.length - uncovered.length) / tokens.length,
  };
};

function validateTeachingStep(
  step: TeachingStep,
  lessonId: string,
  conceptId: string,
  violations: Violation[],
) {
  const scalarFields: [keyof Pick<TeachingStep, "form" | "metalinguisticRule" | "function">, string][] = [
    ["form", step?.form],
    ["metalinguisticRule", step?.metalinguisticRule],
    ["function", step?.function],
  ];
  for (const [field, value] of scalarFields) {
    if (typeof value !== "string" || value.trim().length === 0) {
      violations.push({
        code: "TEACHING_STEP_FIELD_EMPTY",
        lessonId,
        conceptId,
        detail: `TeachingStep.${field} must be a non-empty string.`,
      });
    }
  }
  for (const [field, values] of [
    ["positiveExamples", step?.positiveExamples],
    ["contrastExamples", step?.contrastExamples],
  ] as const) {
    if (!Array.isArray(values) || values.length === 0 || values.some((value) => !value.trim())) {
      violations.push({
        code: "TEACHING_STEP_EXAMPLES_EMPTY",
        lessonId,
        conceptId,
        detail: `TeachingStep.${field} must contain at least one non-empty example.`,
      });
    }
  }
  if (!step?.inputSegment || typeof step.inputSegment.text !== "string" || !step.inputSegment.text.trim()) {
    violations.push({
      code: "TEACHING_INPUT_EMPTY",
      lessonId,
      conceptId,
      detail: "TeachingStep.inputSegment.text must be a non-empty string.",
    });
  }
}

function validInlineGlosses({
  text,
  glosses,
  lessonId,
  exerciseId,
  conceptId,
  violations,
}: {
  text: string;
  glosses: InlineGloss[];
  lessonId: string;
  exerciseId?: string;
  conceptId?: string;
  violations: Violation[];
}) {
  const segmentTokens = tokeniseFrench(text);
  return glosses.filter((gloss) => {
    const glossTokens = tokeniseFrench(gloss.form);
    if (!gloss.meaning.trim()) {
      violations.push({
        code: "INLINE_GLOSS_MEANING_EMPTY",
        lessonId,
        exerciseId,
        conceptId,
        token: gloss.form,
        detail: "An inline gloss must give the learner a non-empty meaning.",
      });
      return false;
    }
    if (!containsTokenSequence(segmentTokens, glossTokens)) {
      violations.push({
        code: "INLINE_GLOSS_NOT_IN_SEGMENT",
        lessonId,
        exerciseId,
        conceptId,
        token: gloss.form,
        detail: `Glossed form does not occur in the exact runtime/teaching segment ${JSON.stringify(text)}.`,
      });
      return false;
    }
    return true;
  });
}

function containsTokenSequence(haystack: string[], needle: string[]) {
  if (needle.length === 0) return false;
  return haystack.some((_, start) => needle.every((token, offset) => haystack[start + offset] === token));
}

function ancestorsOf(conceptId: string, concepts: Map<string, { concept: ConceptDefinition; missionIndex: number }>) {
  const ancestors = new Set<string>();
  const visit = (id: string) => {
    const entry = concepts.get(id);
    if (!entry) return;
    for (const prerequisite of entry.concept.prerequisiteConceptIds) {
      if (!ancestors.has(prerequisite)) {
        ancestors.add(prerequisite);
        visit(prerequisite);
      }
    }
  };
  visit(conceptId);
  return ancestors;
}

function collectKnownTokens(
  conceptIds: Iterable<string>,
  validVocabulary: Map<string, VocabularyEntry[]>,
  concepts: Map<string, { concept: ConceptDefinition }>,
) {
  const known = new Set<string>();
  for (const conceptId of conceptIds) {
    for (const entry of validVocabulary.get(conceptId) ?? []) {
      for (const token of tokeniseFrench(entry.form)) known.add(token);
    }
    for (const gloss of concepts.get(conceptId)?.concept.teachingStep.inputSegment.inlineGlosses ?? []) {
      for (const token of tokeniseFrench(gloss.form)) known.add(token);
    }
  }
  return known;
}

function compareRuntimeSegments(
  lessonId: string,
  exerciseId: string,
  runtimeSegments: ScoredSegment[],
  declaredSegments: ScoredSegment[],
  violations: Violation[],
) {
  const key = (segment: ScoredSegment) => `${segment.source}\u0000${segment.text.normalize("NFC")}`;
  const runtimeByKey = new Map(runtimeSegments.map((segment) => [key(segment), segment]));
  const declaredByKey = new Map(declaredSegments.map((segment) => [key(segment), segment]));
  for (const [segmentKey, segment] of runtimeByKey) {
    if (!declaredByKey.has(segmentKey)) {
      violations.push({
        code: "RUNTIME_SEGMENT_UNDECLARED",
        lessonId,
        exerciseId,
        detail: `${segment.source} French is rendered/scored at runtime but absent from the coverage declaration: ${JSON.stringify(segment.text)}`,
      });
    }
  }
  for (const [segmentKey, segment] of declaredByKey) {
    if (segment.inlineGlosses.length > 0) {
      violations.push({
        code: "SCORED_GLOSS_NOT_RENDERED",
        lessonId,
        exerciseId,
        detail: `${segment.source} ${JSON.stringify(segment.text)} declares inline glosses, but scored UIs do not render them. Teach the tokens before the scored surface instead.`,
      });
    }
    if (!runtimeByKey.has(segmentKey)) {
      violations.push({
        code: "DECLARED_SEGMENT_NOT_RUNTIME",
        lessonId,
        exerciseId,
        detail: `${segment.source} coverage text is not an exact runtime surface: ${JSON.stringify(segment.text)}`,
      });
    }
  }
}

export function verifyCurriculumData(data: VerificationData, flelex: FleLex): VerificationSummary {
  const violations: Violation[] = [];
  const curriculumByMission = new Map<string, MissionCurriculum>();
  const concepts = new Map<string, { concept: ConceptDefinition; missionId: string; missionIndex: number }>();
  const validVocabulary = new Map<string, VocabularyEntry[]>();
  let vocabularyCount = 0;

  data.curriculum.forEach((mission, missionIndex) => {
    if (curriculumByMission.has(mission.missionId)) {
      violations.push({
        code: "DUPLICATE_CURRICULUM_MISSION",
        lessonId: mission.missionId,
        detail: "Mission appears more than once in the curriculum manifest.",
      });
    }
    curriculumByMission.set(mission.missionId, mission);
    for (const concept of mission.concepts) {
      if (concepts.has(concept.id)) {
        violations.push({
          code: "DUPLICATE_CONCEPT",
          lessonId: mission.missionId,
          conceptId: concept.id,
          detail: "Concept IDs must be globally unique.",
        });
      }
      concepts.set(concept.id, { concept, missionId: mission.missionId, missionIndex });
      validateTeachingStep(concept.teachingStep, mission.missionId, concept.id, violations);
      const valid: VocabularyEntry[] = [];
      for (const vocabulary of concept.vocabulary) {
        vocabularyCount += 1;
        if (!vocabulary.form.trim() || !vocabulary.meaning.trim()) {
          violations.push({
            code: "VOCABULARY_DISPLAY_FIELD_EMPTY",
            lessonId: mission.missionId,
            conceptId: concept.id,
            token: vocabulary.form,
            detail: "Vocabulary form and meaning must both be non-empty because the teaching gate renders both before scoring.",
          });
          continue;
        }
        const levels = flelex.levelsByLemmaAndPos.get(keyForLexeme(vocabulary.lemma, vocabulary.pos));
        if (!levels) {
          violations.push({
            code: "FLELEX_LEXEME_MISSING",
            lessonId: mission.missionId,
            conceptId: concept.id,
            token: vocabulary.form,
            detail: `FLELex has no exact lemma/POS row for ${JSON.stringify(vocabulary.lemma)} + ${JSON.stringify(vocabulary.pos)}.`,
          });
        } else if (!levels.has(vocabulary.cefrLevel)) {
          violations.push({
            code: "FLELEX_LEVEL_MISMATCH",
            lessonId: mission.missionId,
            conceptId: concept.id,
            token: vocabulary.form,
            detail: `Declared ${vocabulary.cefrLevel}; FLELex ${vocabulary.lemma}/${vocabulary.pos} is ${[...levels].sort().join(" or ")}.`,
          });
        } else {
          valid.push(vocabulary);
        }
      }
      validVocabulary.set(concept.id, valid);
    }
  });

  for (const [conceptId, entry] of concepts) {
    for (const prerequisiteId of entry.concept.prerequisiteConceptIds) {
      const prerequisite = concepts.get(prerequisiteId);
      if (!prerequisite) {
        violations.push({
          code: "CONCEPT_PREREQUISITE_MISSING",
          lessonId: entry.missionId,
          conceptId,
          detail: `Prerequisite concept ${JSON.stringify(prerequisiteId)} is not defined.`,
        });
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (conceptId: string, path: string[]) => {
    if (visiting.has(conceptId)) {
      violations.push({
        code: "CONCEPT_GRAPH_CYCLE",
        conceptId,
        detail: `Concept prerequisite cycle: ${[...path, conceptId].join(" -> ")}.`,
      });
      return;
    }
    if (visited.has(conceptId)) return;
    visiting.add(conceptId);
    for (const prerequisite of concepts.get(conceptId)?.concept.prerequisiteConceptIds ?? []) {
      if (concepts.has(prerequisite)) visit(prerequisite, [...path, conceptId]);
    }
    visiting.delete(conceptId);
    visited.add(conceptId);
  };
  for (const conceptId of concepts.keys()) visit(conceptId, []);

  let teachingCoverageCount = 0;
  let scoredCoverageCount = 0;
  let minimumCoverage = 1;
  for (const [conceptId, entry] of concepts) {
    if (!entry.concept.teachingStep?.inputSegment?.text) continue;
    const prerequisiteIds = ancestorsOf(conceptId, concepts);
    const known = collectKnownTokens(prerequisiteIds, validVocabulary, concepts);
    const inputGlosses = validInlineGlosses({
      text: entry.concept.teachingStep.inputSegment.text,
      glosses: entry.concept.teachingStep.inputSegment.inlineGlosses ?? [],
      lessonId: entry.missionId,
      conceptId,
      violations,
    });
    const coverage = coverageFor(entry.concept.teachingStep.inputSegment.text, known, inputGlosses);
    teachingCoverageCount += 1;
    minimumCoverage = Math.min(minimumCoverage, coverage.ratio);
    if (!meetsCoverageThreshold(coverage.tokens.length, coverage.uncovered.length)) {
      violations.push({
        code: "TEACHING_INPUT_COVERAGE_BELOW_THRESHOLD",
        lessonId: entry.missionId,
        conceptId,
        detail: `${formatPercent(coverage.ratio)} known-or-glossed (${coverage.tokens.length - coverage.uncovered.length}/${coverage.tokens.length}); required ${formatPercent(COVERAGE_THRESHOLD)}.`,
      });
      for (const token of [...new Set(coverage.uncovered)]) {
        violations.push({
          code: "TEACHING_INPUT_TOKEN_UNKNOWN",
          lessonId: entry.missionId,
          conceptId,
          token,
          detail: "Token is neither introduced by a prerequisite concept nor glossed in the input segment.",
        });
      }
    }
  }

  const runtimeMissionIds = new Set(data.missions.map((mission) => mission.id));
  const frenchOracleTokens = new Set(flelex.words);
  const distinctiveFrenchTokens = new Set<string>();
  for (const [word, tags] of flelex.tagsByWord) {
    if ([...tags].some(isFrenchStructuralTag)) distinctiveFrenchTokens.add(word);
  }
  for (const entries of validVocabulary.values()) {
    for (const entry of entries) {
      const lemmaTokens = new Set(tokeniseFrench(entry.lemma));
      for (const token of tokeniseFrench(entry.form)) {
        frenchOracleTokens.add(token);
        if (isFrenchStructuralTag(entry.pos) || !lemmaTokens.has(token)) distinctiveFrenchTokens.add(token);
      }
    }
  }
  const publicRoots = new Set(data.publicRootMissionIds ?? []);
  const authoredLocked = new Set(data.authoredLockedMissionIds ?? []);
  if (!data.publicRootMissionIds) {
    violations.push({
      code: "PUBLIC_ROOTS_UNDECLARED",
      detail: "Verifier input must explicitly declare independently reachable public root missions.",
    });
  }
  if ((data.publicRootMissionIds?.length ?? 0) !== publicRoots.size) {
    violations.push({
      code: "PUBLIC_ROOT_DUPLICATE",
      detail: "Public root mission IDs must be unique.",
    });
  }
  for (const rootId of publicRoots) {
    if (!runtimeMissionIds.has(rootId)) {
      violations.push({
        code: "PUBLIC_ROOT_RUNTIME_MISSING",
        lessonId: rootId,
        detail: "Declared public root has no runtime surface adapter.",
      });
    }
    if (!curriculumByMission.has(rootId)) {
      violations.push({
        code: "PUBLIC_ROOT_CURRICULUM_MISSING",
        lessonId: rootId,
        detail: "Declared public root has no curriculum graph entry.",
      });
    }
  }
  for (const mission of data.missions) {
    const classifications = Number(publicRoots.has(mission.id)) + Number(authoredLocked.has(mission.id));
    if (classifications !== 1) {
      violations.push({
        code: "MISSION_REACHABILITY_UNCLASSIFIED",
        lessonId: mission.id,
        detail: "Every runtime mission must be classified exactly once as a public root or authored-but-locked content.",
      });
    }
  }
  for (const curriculumMission of data.curriculum) {
    if (!runtimeMissionIds.has(curriculumMission.missionId)) {
      violations.push({
        code: "CURRICULUM_MISSION_NOT_RUNTIME",
        lessonId: curriculumMission.missionId,
        detail: "Curriculum lesson has no scored runtime mission.",
      });
    }
  }

  for (const mission of data.missions) {
    const curriculum = curriculumByMission.get(mission.id);
    if (!curriculum) {
      violations.push({
        code: "RUNTIME_MISSION_UNDECLARED",
        lessonId: mission.id,
        detail: "Reachable scored mission has no curriculum declaration.",
      });
      continue;
    }
    const activityRequirements = new Map<string, ActivityCurriculumRequirement>();
    for (const requirement of curriculum.activities) {
      if (activityRequirements.has(requirement.activityId)) {
        violations.push({
          code: "DUPLICATE_ACTIVITY_REQUIREMENT",
          lessonId: mission.id,
          exerciseId: requirement.activityId,
          detail: "Activity appears more than once in the curriculum manifest.",
        });
      }
      activityRequirements.set(requirement.activityId, requirement);
    }
    const runtimeActivityIds = new Set(mission.activities.map((activity) => activity.id));
    for (const requirement of curriculum.activities) {
      if (!runtimeActivityIds.has(requirement.activityId)) {
        violations.push({
          code: "CURRICULUM_ACTIVITY_NOT_RUNTIME",
          lessonId: mission.id,
          exerciseId: requirement.activityId,
          detail: "Curriculum activity has no scored runtime exercise.",
        });
      }
    }

    for (const activity of mission.activities) {
      const requirement = activityRequirements.get(activity.id);
      if (!requirement) {
        violations.push({
          code: "RUNTIME_ACTIVITY_UNDECLARED",
          lessonId: mission.id,
          exerciseId: activity.id,
          detail: "Reachable scored exercise has no concept or coverage declaration.",
        });
        continue;
      }
      if (requirement.requiredConceptIds.length === 0) {
        violations.push({
          code: "ACTIVITY_REQUIRES_NO_CONCEPT",
          lessonId: mission.id,
          exerciseId: activity.id,
          detail: "Every scored exercise must declare at least one required concept.",
        });
      }
      const availableConceptIds = new Set<string>();
      const includeRuntimeGateConcept = (conceptId: string) => {
        if (availableConceptIds.has(conceptId)) return;
        const concept = concepts.get(conceptId)?.concept;
        if (!concept) return;
        // Mark before recursion so a malformed cycle is reported by the graph
        // audit rather than overflowing while this activity is inspected.
        availableConceptIds.add(conceptId);
        for (const prerequisiteId of concept.prerequisiteConceptIds) includeRuntimeGateConcept(prerequisiteId);
      };
      requirement.requiredConceptIds.forEach(includeRuntimeGateConcept);
      const runtimeGateConceptIds = data.runtimeGatedConceptIdsByActivity?.[activity.id];
      if (!runtimeGateConceptIds) {
        violations.push({
          code: "RUNTIME_GATE_CLOSURE_MISSING",
          lessonId: mission.id,
          exerciseId: activity.id,
          detail: "No explicit runtime teaching-gate concept closure was provided for this scored activity.",
        });
      } else {
        const runtimeGateSet = new Set(runtimeGateConceptIds);
        for (const conceptId of availableConceptIds) {
          if (!runtimeGateSet.has(conceptId)) {
            violations.push({
              code: "RUNTIME_GATE_CONCEPT_OMITTED",
              lessonId: mission.id,
              exerciseId: activity.id,
              conceptId,
              detail: "Required/prerequisite concept is absent from the runtime teaching gate.",
            });
          }
        }
        for (const conceptId of runtimeGateSet) {
          if (!availableConceptIds.has(conceptId)) {
            violations.push({
              code: "RUNTIME_GATE_CONCEPT_UNDECLARED",
              lessonId: mission.id,
              exerciseId: activity.id,
              conceptId,
              detail: "Runtime teaching gate includes a concept outside this activity's declared prerequisite closure.",
            });
          }
        }
      }
      for (const requiredConceptId of requirement.requiredConceptIds) {
        if (!concepts.has(requiredConceptId)) {
          violations.push({
            code: "ACTIVITY_CONCEPT_MISSING",
            lessonId: mission.id,
            exerciseId: activity.id,
            conceptId: requiredConceptId,
            detail: "Required concept is not defined in the concept graph.",
          });
        }
      }

      const runtimeSegments = deriveRuntimeScoredSegments(activity, {
        lessonId: mission.id,
        violations,
        frenchOracleTokens,
        distinctiveFrenchTokens,
      });
      compareRuntimeSegments(mission.id, activity.id, runtimeSegments, requirement.scoredSegments, violations);
      const known = collectKnownTokens(availableConceptIds, validVocabulary, concepts);
      const choiceIds = new Set((activity.choices ?? []).map((choice) => choice.id));
      const canonicalExpectedAnswer = activity.acceptedAnswers.find(
        (answer) => !choiceIds.has(answer.value) && normalise(answer.value) !== "completed",
      )?.value;
      const coverageSegments = runtimeSegments.filter(
        (segment) => segment.source !== "accepted-answer" || segment.text === canonicalExpectedAnswer,
      );
      for (const segment of coverageSegments) {
        const coverage = coverageFor(segment.text, known, []);
        scoredCoverageCount += 1;
        minimumCoverage = Math.min(minimumCoverage, coverage.ratio);
        if (!meetsCoverageThreshold(coverage.tokens.length, coverage.uncovered.length)) {
          violations.push({
            code: "SCORED_SEGMENT_COVERAGE_BELOW_THRESHOLD",
            lessonId: mission.id,
            exerciseId: activity.id,
            detail: `${segment.source} ${JSON.stringify(segment.text)} is ${formatPercent(coverage.ratio)} known-or-glossed (${coverage.tokens.length - coverage.uncovered.length}/${coverage.tokens.length}); required ${formatPercent(COVERAGE_THRESHOLD)}.`,
          });
          for (const token of [...new Set(coverage.uncovered)]) {
            violations.push({
              code: "SCORED_SEGMENT_TOKEN_UNKNOWN",
              lessonId: mission.id,
              exerciseId: activity.id,
              token,
              detail: `Token is neither introduced nor glossed in place in ${segment.source} ${JSON.stringify(segment.text)}.`,
            });
          }
        }
      }
    }
  }

  return {
    missionCount: data.missions.length,
    activityCount: data.missions.reduce((total, mission) => total + mission.activities.length, 0),
    conceptCount: concepts.size,
    vocabularyCount,
    scoredCoverageCount,
    teachingCoverageCount,
    minimumCoverage,
    violations: violations.sort((left, right) =>
      [left.lessonId ?? "", left.exerciseId ?? "", left.conceptId ?? "", left.token ?? "", left.code].join("\u0000")
        .localeCompare([right.lessonId ?? "", right.exerciseId ?? "", right.conceptId ?? "", right.token ?? "", right.code].join("\u0000")),
    ),
  };
}

export function formatViolation(violation: Violation) {
  return `[${violation.code}] lesson=${violation.lessonId ?? "-"} exercise=${violation.exerciseId ?? "-"} concept=${violation.conceptId ?? "-"} token=${violation.token ?? "-"} :: ${violation.detail}`;
}

export function readFixture(path: string): VerificationData {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as VerificationData;
}
