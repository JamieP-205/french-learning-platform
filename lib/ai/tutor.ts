import { z } from "zod";
import { getLearningRepository } from "@/lib/data";
import type { TutorContextPackV1, TutorFeedbackV1 } from "@/lib/domain/types";
import { validateActivityAnswer } from "@/lib/learning/answer-validation";

const tutorFeedbackSchema = z.object({
  status: z.enum(["supported", "safe_standard", "out_of_scope"]),
  headline: z.string().min(1).max(120),
  explanation: z.string().min(1).max(700),
  sourceIds: z.array(z.string()).min(1).max(8),
  followUp: z.string().min(1).max(200),
});

const ruleText = (ruleId: string) => {
  if (ruleId === "rule-age-avoir-v1") {
    return { id: ruleId, text: "French uses avoir, not être, to express age.", examples: ["J'ai 20 ans.", "Elle a 30 ans."] };
  }
  return { id: ruleId, text: "Use the verified phrase pattern shown in this lesson.", examples: [] };
};

export async function buildTutorContextPack({
  userId,
  sessionId,
  activityId,
  submittedAnswer,
}: {
  userId: string;
  sessionId: string;
  activityId: string;
  submittedAnswer: string;
}): Promise<TutorContextPackV1> {
  const repository = getLearningRepository();
  const [session, profile, mission, mistakes] = await Promise.all([
    repository.getSession(userId, sessionId),
    repository.getProfile(userId),
    repository.getMission(),
    repository.getOpenMistakes(userId),
  ]);
  const planned = session?.plan.activities.find((entry) => entry.activity.id === activityId);
  if (!session || !profile || !planned) throw new Error("The requested tutor context is unavailable.");

  const result = validateActivityAnswer(planned.activity, submittedAnswer);
  const verifiedContent = mission.contentItems.filter((item) => planned.activity.contentItemIds.includes(item.id));
  const ruleIds = result.ruleIds.length > 0 ? result.ruleIds : planned.activity.grammarRuleIds;
  return {
    task: result.isCorrect ? "safe_standard" : "explain_mistake",
    learner: {
      level: profile.currentLevel,
      goal: profile.learningGoals[0] ?? "practical French",
      weakRuleIds: mistakes.filter((mistake) => !mistake.resolved).map((mistake) => mistake.ruleId).slice(0, 3),
    },
    activity: { id: planned.activity.id, prompt: planned.activity.prompt, type: planned.activity.type },
    submittedAnswer,
    deterministicResult: result,
    verifiedContent: verifiedContent.map(({ id, frenchText, englishMeaning, register, usageContext }) => ({ id, frenchText, englishMeaning, register, usageContext })),
    ruleNotes: ruleIds.map(ruleText),
    allowedSourceIds: [...new Set(verifiedContent.flatMap((item) => item.sourceIds))],
  };
}

function fallbackFeedback(contextPack: TutorContextPackV1): TutorFeedbackV1 {
  const result = contextPack.deterministicResult;
  if (result.isCorrect) {
    return {
      status: "supported",
      headline: "That works.",
      explanation: "You used the verified pattern from this lesson correctly.",
      sourceIds: contextPack.allowedSourceIds,
      followUp: "Say the complete sentence once more without looking.",
    };
  }
  if (result.ruleIds.includes("rule-age-avoir-v1")) {
    return {
      status: "supported",
      headline: "Almost—French uses avoir for age.",
      explanation: "French uses avoir, meaning “to have”, for age. Say “J'ai 20 ans.” French literally says “I have 20 years,” so “Je suis 20 ans” is not the standard pattern.",
      sourceIds: contextPack.allowedSourceIds,
      followUp: "Try: J'___ 20 ans.",
    };
  }
  return {
    status: "safe_standard",
    headline: "Here’s the safest standard French version to use.",
    explanation: `Use: ${result.correctAnswer}. This follows the verified pattern in the current lesson.`,
    sourceIds: contextPack.allowedSourceIds,
    followUp: "Repeat the verified sentence once, then continue.",
  };
}

async function requestOpenAIFeedback(contextPack: TutorContextPackV1): Promise<TutorFeedbackV1 | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL_TUTOR;
  if (!apiKey || !model) return null;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: "You are a concise French tutor. Use only the verified content supplied in the context. Do not invent rules, examples, register claims, or source IDs. Return JSON only.",
        },
        { role: "user", content: JSON.stringify(contextPack) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "tutor_feedback_v1",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["status", "headline", "explanation", "sourceIds", "followUp"],
            properties: {
              status: { type: "string", enum: ["supported", "safe_standard", "out_of_scope"] },
              headline: { type: "string" }, explanation: { type: "string" },
              sourceIds: { type: "array", items: { type: "string" } }, followUp: { type: "string" },
            },
          },
        },
      },
    }),
  });
  if (!response.ok) return null;
  // The REST payload nests text in output[].content[]; output_text only exists in SDK clients.
  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText =
    payload.output_text?.trim() ||
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((part) => part.type === "output_text" && part.text?.trim())?.text;
  if (!outputText) return null;
  const parsed = tutorFeedbackSchema.safeParse(JSON.parse(outputText));
  if (!parsed.success || parsed.data.sourceIds.some((id) => !contextPack.allowedSourceIds.includes(id))) return null;
  return parsed.data;
}

export async function getTutorFeedback(contextPack: TutorContextPackV1): Promise<{ feedback: TutorFeedbackV1; provider: "fallback" | "openai" }> {
  try {
    const feedback = await requestOpenAIFeedback(contextPack);
    if (feedback) return { feedback, provider: "openai" };
  } catch {
    // A deterministic source-bound response is safer than surfacing a provider failure to the learner.
  }
  return { feedback: fallbackFeedback(contextPack), provider: "fallback" };
}
