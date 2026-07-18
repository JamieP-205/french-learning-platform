import { afterEach, describe, expect, it, vi } from "vitest";
import { getTutorFeedback } from "../lib/ai/tutor";
import { MockLearningRepository } from "../lib/data/mock-repository";
import type { TutorContextPackV1 } from "../lib/domain/types";

const context: TutorContextPackV1 = {
  attemptId: "attempt-1", sessionId: "session-1",
  task: "explain_mistake", learner: { level: "A1", goal: "travel", weakRuleIds: ["rule-age-avoir-v1"] },
  activity: { id: "act-age-typing-v1", prompt: "Write: I am 20 years old.", type: "typing" }, submittedAnswer: "Je suis 20 ans",
  deterministicResult: { isCorrect: false, isNearMiss: true, normalizedAnswer: "je suis 20 ans", feedback: "French uses avoir for age, not être.", correctAnswer: "J'ai 20 ans.", mistakeType: "grammar", ruleIds: ["rule-age-avoir-v1"], shouldCreateReview: true },
  verifiedContent: [{ id: "rule-age-avoir-v1", frenchText: "J'ai 20 ans.", englishMeaning: "I am 20 years old.", register: "neutral", usageContext: "Age" }],
  ruleNotes: [{ id: "rule-age-avoir-v1", text: "French uses avoir for age.", examples: ["J'ai 20 ans."] }], allowedSourceIds: ["00000000-0000-0000-0000-000000000001"],
};

describe("tutor guardrails", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the deterministic source-bound fallback when no provider is configured", async () => {
    const { feedback, provider } = await getTutorFeedback(context);
    expect(provider).toBe("fallback");
    expect(feedback.sourceIds).toEqual(["00000000-0000-0000-0000-000000000001"]);
    expect(feedback.explanation).toContain("avoir");
    expect(feedback.explanation).toContain("J'ai 20 ans");
  });

  it("parses provider feedback from the raw Responses API payload shape", async () => {
    vi.stubEnv("ENABLE_GENERATIVE_TUTOR", "true");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL_TUTOR", "test-model");
    const providerFeedback = {
      status: "supported", headline: "Use avoir for age.", explanation: "French uses avoir to express age, so say J'ai 20 ans.",
      sourceIds: ["00000000-0000-0000-0000-000000000001"], followUp: "Try: J'___ 20 ans.",
    };
    // The raw REST payload nests text in output[].content[]; there is no top-level output_text field.
    const providerFetch = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(providerFeedback) }] }],
    })));
    vi.stubGlobal("fetch", providerFetch);
    const { feedback, provider } = await getTutorFeedback(context);
    expect(provider).toBe("openai");
    expect(feedback.headline).toBe("Use avoir for age.");
    const requestBody = JSON.parse(String(providerFetch.mock.calls[0]?.[1]?.body));
    const providerContext = JSON.parse(requestBody.input[1].content);
    expect(requestBody.store).toBe(false);
    expect(providerContext).not.toHaveProperty("attemptId");
    expect(providerContext).not.toHaveProperty("sessionId");
    expect(providerContext.activity).not.toHaveProperty("id");
  });

  it("rejects provider feedback that cites unapproved sources", async () => {
    vi.stubEnv("ENABLE_GENERATIVE_TUTOR", "true");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL_TUTOR", "test-model");
    const providerFeedback = {
      status: "supported", headline: "Use avoir for age.", explanation: "French uses avoir to express age.",
      sourceIds: ["not-an-approved-source"], followUp: "Try again.",
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(providerFeedback) }] }],
    }))));
    const { provider } = await getTutorFeedback(context);
    expect(provider).toBe("fallback");
  });

  it("allows only one active explanation claim per learner attempt", async () => {
    const repository = new MockLearningRepository();

    await expect(repository.claimTutorInteraction("tutor-claim-user", context)).resolves.toBe(true);
    await expect(repository.claimTutorInteraction("tutor-claim-user", context)).resolves.toBe(false);

    const { feedback, provider } = await getTutorFeedback(context);
    await repository.logTutorInteraction({
      userId: "tutor-claim-user",
      contextPack: context,
      feedback,
      provider,
    });

    await expect(repository.claimTutorInteraction("tutor-claim-user", context)).resolves.toBe(false);
    await expect(
      repository.getTutorInteractionForAttempt("tutor-claim-user", context.attemptId),
    ).resolves.toMatchObject({ provider: "fallback" });
  });
});
