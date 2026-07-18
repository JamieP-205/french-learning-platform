import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/server";
import { getLearningRepository } from "@/lib/data";
import { buildTutorContextPack, getTutorFeedback } from "@/lib/ai/tutor";
import { rejectUntrustedMutation } from "@/lib/security/request-origin";

const payloadSchema = z.object({
  sessionId: z.string().uuid(),
  activityId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
}).strict();

const DAILY_TUTOR_LIMIT = 20;
const TUTOR_QUOTA_WINDOW_SECONDS = 24 * 60 * 60;

export async function POST(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to use the tutor for this activity." }, { status: 401 });
    }

    const parsed = payloadSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return NextResponse.json({ error: "I need the current activity to explain it safely." }, { status: 400 });
    const contextPack = await buildTutorContextPack({ userId, ...parsed.data });
    const repository = getLearningRepository();
    let cached = await repository.getTutorInteractionForAttempt(userId, contextPack.attemptId);
    if (cached) return NextResponse.json({ ...cached, cached: true });

    const quotaAvailable = await repository.consumeRateLimit(userId, "tutor-explanation", {
      limit: DAILY_TUTOR_LIMIT,
      windowSeconds: TUTOR_QUOTA_WINDOW_SECONDS,
    }, contextPack.attemptId);
    if (!quotaAvailable) {
      return NextResponse.json(
        { error: "You have used today’s tutor explanations. The built-in lesson feedback is still available." },
        { status: 429, headers: { "Retry-After": String(TUTOR_QUOTA_WINDOW_SECONDS) } },
      );
    }

    const claimed = await repository.claimTutorInteraction(userId, contextPack);
    if (!claimed) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        cached = await repository.getTutorInteractionForAttempt(userId, contextPack.attemptId);
        if (cached) return NextResponse.json({ ...cached, cached: true });
      }
      return NextResponse.json(
        { error: "That explanation is already being prepared. Try again in a moment." },
        { status: 409, headers: { "Retry-After": "1" } },
      );
    }

    const { feedback, provider } = await getTutorFeedback(contextPack);
    await repository.logTutorInteraction({ userId, contextPack, feedback, provider });
    return NextResponse.json({ feedback, provider });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "The tutor is available only for the answer you just completed."
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 },
      );
    }

    console.error("[api/tutor/message] failed", {
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      {
        error: "Tutor help is temporarily unavailable. The lesson feedback is still available.",
      },
      { status: 500 },
    );
  }
}
