import { describe, expect, it } from "vitest";
import { loadFleLex, verifyCurriculumData, type VerificationData } from "../content-tools/verify-core";

const dataWithUnknownFrenchChoice = (declareRuntimeSegments: boolean): VerificationData => ({
  publicRootMissionIds: ["synthetic-root"],
  authoredLockedMissionIds: [],
  runtimeGatedConceptIdsByActivity: { "synthetic-choice": ["synthetic-concept"] },
  missions: [
    {
      id: "synthetic-root",
      activities: [
        {
          id: "synthetic-choice",
          type: "multiple_choice",
          prompt: "Choose the French response.",
          promptFrenchSegments: [],
          choices: [
            { id: "known", label: "Je", language: "fr" },
            { id: "unknown", label: "zorglup", language: "fr" },
          ],
          acceptedAnswers: [{ value: "known" }],
        },
      ],
    },
  ],
  curriculum: [
    {
      missionId: "synthetic-root",
      concepts: [
        {
          id: "synthetic-concept",
          prerequisiteConceptIds: [],
          teachingStep: {
            form: "Je suis",
            metalinguisticRule: "Je is the first-person subject pronoun.",
            positiveExamples: ["Je suis prêt."],
            contrastExamples: ["Tu parles."],
            function: "Refer to yourself as the subject.",
            inputSegment: {
              text: "Je suis",
              inlineGlosses: [
                { form: "Je", meaning: "I" },
                { form: "suis", meaning: "am" },
              ],
            },
          },
          vocabulary: [
            { form: "Je", lemma: "je", pos: "PRO", cefrLevel: "A1", meaning: "I" },
            { form: "suis", lemma: "être", pos: "VER", cefrLevel: "A1", meaning: "am" },
          ],
        },
      ],
      activities: [
        {
          activityId: "synthetic-choice",
          requiredConceptIds: ["synthetic-concept"],
          scoredSegments: declareRuntimeSegments
            ? [
                { source: "choice", text: "Je", inlineGlosses: [] },
                { source: "choice", text: "zorglup", inlineGlosses: [] },
              ]
            : [],
        },
      ],
    },
  ],
});

describe("curriculum verifier adversarial coverage", () => {
  const flelex = loadFleLex();

  it("does not let an explicitly French unknown choice disappear when declarations are empty", () => {
    const result = verifyCurriculumData(dataWithUnknownFrenchChoice(false), flelex);

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "RUNTIME_SEGMENT_UNDECLARED", exerciseId: "synthetic-choice" }),
        expect.objectContaining({ code: "SCORED_SEGMENT_TOKEN_UNKNOWN", token: "zorglup" }),
      ]),
    );
  });

  it("fails the unknown segment independently instead of diluting it with a known choice", () => {
    const result = verifyCurriculumData(dataWithUnknownFrenchChoice(true), flelex);
    const coverageFailures = result.violations.filter(
      (violation) => violation.code === "SCORED_SEGMENT_COVERAGE_BELOW_THRESHOLD",
    );

    expect(coverageFailures).toHaveLength(1);
    expect(coverageFailures[0]).toMatchObject({ lessonId: "synthetic-root", exerciseId: "synthetic-choice" });
    expect(coverageFailures[0].detail).toContain('choice "zorglup" is 0.00%');
  });

  it("does not credit a scored gloss that no scored UI renders", () => {
    const data = dataWithUnknownFrenchChoice(true);
    data.curriculum[0].activities[0].scoredSegments[1].inlineGlosses = [
      { form: "zorglup", meaning: "a fabricated answer" },
    ];

    const result = verifyCurriculumData(data, flelex);

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SCORED_GLOSS_NOT_RENDERED", exerciseId: "synthetic-choice" }),
        expect.objectContaining({ code: "SCORED_SEGMENT_TOKEN_UNKNOWN", token: "zorglup" }),
      ]),
    );
  });

  it("fails when FLELex-certified French prompt content is omitted from promptFrenchSegments", () => {
    const data = dataWithUnknownFrenchChoice(true);
    data.missions[0].activities[0].prompt = "Translate this: Je suis zorglup.";

    const result = verifyCurriculumData(data, flelex);

    expect(result.violations).toContainEqual({
      code: "PROMPT_FRENCH_METADATA_CONTRADICTION",
      lessonId: "synthetic-root",
      exerciseId: "synthetic-choice",
      token: "je suis",
      detail: 'FLELex-certified French content is omitted from promptFrenchSegments in "Je suis zorglup.".',
    });
  });

  it("fails when a FLELex-certified French choice is mislabelled as English", () => {
    const data = dataWithUnknownFrenchChoice(true);
    data.missions[0].activities[0].choices![1] = {
      id: "unknown",
      label: "Je suis zorglup",
      language: "en",
    };
    data.curriculum[0].activities[0].scoredSegments = [
      { source: "choice", text: "Je", inlineGlosses: [] },
    ];

    const result = verifyCurriculumData(data, flelex);

    expect(result.violations).toContainEqual({
      code: "CHOICE_LANGUAGE_METADATA_CONTRADICTION",
      lessonId: "synthetic-root",
      exerciseId: "synthetic-choice",
      token: "je suis",
      detail: 'Choice "unknown" is labelled English but its text is FLELex-certified French: "Je suis zorglup".',
    });
  });
});
