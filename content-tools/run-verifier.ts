import {
  CURRICULUM_MISSIONS,
  getConceptDefinitionsForActivity,
  getListeningActivityId,
  getRoleplayActivityId,
  getSpeakingActivityId,
  getTopicPreviewActivityId,
} from "../lib/content/curriculum";
import { SHADOWING_PHRASES } from "../lib/content/pronunciation";
import { roleplayScenarios } from "../lib/content/roleplay";
import { SCORED_MISSIONS, getPublicScoredMissionSlugs } from "../lib/content/scored-missions";
import { topicPreviews } from "../lib/content/topic-previews";
import {
  COVERAGE_THRESHOLD,
  FLELEX_CSV_SHA256,
  FLELEX_SOURCE_SHA256,
  formatViolation,
  loadFleLex,
  readFixture,
  verifyCurriculumData,
  type VerificationData,
} from "./verify-core";

function valueAfter(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function productionData(): VerificationData {
  const publicSlugs = new Set(getPublicScoredMissionSlugs());
  const roleplayMission = {
    id: "standalone-roleplay",
    activities: roleplayScenarios.flatMap((scenario) =>
      scenario.turns.map((turn) => ({
        id: getRoleplayActivityId(scenario.id, turn.id),
        type: "multiple_choice",
        prompt: turn.npcLine,
        promptFrenchSegments: turn.npcLineLanguage === "fr" ? [turn.npcLine] : [],
        choices: turn.choices.map((choice) => ({ id: choice.id, label: choice.text, language: choice.language })),
        acceptedAnswers: turn.choices.map((choice) => ({ value: choice.id })),
      })),
    ),
  };
  const listeningMission = {
    id: "standalone-listening",
    activities: SHADOWING_PHRASES.map((phrase) => ({
      id: getListeningActivityId(phrase.id),
      type: "dictation",
      prompt: "Type what you hear.",
      promptFrenchSegments: [],
      targetText: phrase.french,
      acceptedAnswers: [],
    })),
  };
  const speakingMission = {
    id: "standalone-speaking",
    activities: SHADOWING_PHRASES.map((phrase) => ({
      id: getSpeakingActivityId(phrase.id),
      type: "speaking",
      prompt: "Repeat after me.",
      promptFrenchSegments: [],
      targetText: phrase.french,
      acceptedAnswers: [],
    })),
  };
  const topicPreviewMission = {
    id: "standalone-topic-previews",
    activities: topicPreviews
      .filter((topic) => topic.status !== "planned")
      .flatMap((topic) =>
        topic.selfChecks.map((check, index) => ({
          id: getTopicPreviewActivityId(topic.slug, index),
          type: "typing",
          prompt: check.prompt,
          promptFrenchSegments: check.promptFrenchSegments,
          acceptedAnswers: (check.acceptedAnswers?.length ? check.acceptedAnswers : [check.answer]).map((value) => ({ value })),
        })),
      ),
  };
  const authoredMissions = [
    ...SCORED_MISSIONS,
    roleplayMission,
    listeningMission,
    speakingMission,
    topicPreviewMission,
  ];
  const runtimeGatedConceptIdsByActivity = Object.fromEntries(
    authoredMissions.flatMap((mission) =>
      mission.activities.map((activity) => [
        activity.id,
        getConceptDefinitionsForActivity(activity.id).map((concept) => concept.id),
      ]),
    ),
  );
  return {
    missions: authoredMissions,
    curriculum: CURRICULUM_MISSIONS,
    publicRootMissionIds: [
      ...SCORED_MISSIONS.filter((mission) => publicSlugs.has(mission.slug)).map((mission) => mission.id),
      roleplayMission.id,
      listeningMission.id,
      speakingMission.id,
      topicPreviewMission.id,
    ],
    authoredLockedMissionIds: SCORED_MISSIONS.filter((mission) => !publicSlugs.has(mission.slug)).map((mission) => mission.id),
    runtimeGatedConceptIdsByActivity,
  };
}

export function runVerifier(command: "verify:curriculum" | "verify:coverage") {
  const fixturePath = valueAfter("--fixture");
  try {
    const data = fixturePath ? readFixture(fixturePath) : productionData();
    const flelex = loadFleLex();
    const summary = verifyCurriculumData(data, flelex);
    const roots = data.publicRootMissionIds ?? [];
    console.log(`${command} roots: ${roots.length > 0 ? roots.join(", ") : "none declared"}`);
    console.log(`${command} authored scored missions audited: ${summary.missionCount}`);
    console.log(`${command} FLELex source SHA-256: ${FLELEX_SOURCE_SHA256}`);
    console.log(`${command} FLELex CSV SHA-256: ${FLELEX_CSV_SHA256}`);
    console.log(
      `${command} coverage: ${summary.scoredCoverageCount} rendered/canonical scored segments + ${summary.teachingCoverageCount} teaching inputs; threshold ${(COVERAGE_THRESHOLD * 100).toFixed(0)}%; minimum ${(summary.minimumCoverage * 100).toFixed(2)}%`,
    );
    console.log(
      `${command} declarations: ${summary.activityCount} exercises, ${summary.conceptCount} concepts, ${summary.vocabularyCount} FLELex-checked lexemes`,
    );
    if (summary.violations.length > 0) {
      console.error(`${command} FAIL: ${summary.violations.length} violation(s)`);
      for (const violation of summary.violations) console.error(formatViolation(violation));
      process.exitCode = 1;
      return;
    }
    console.log(`${command} PASS`);
  } catch (error) {
    console.error(`${command} FAIL: verifier could not run`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
