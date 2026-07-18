import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/server";
import { submitActivity } from "@/lib/learning/service";
import { presentSessionForLearner } from "@/lib/learning/presentation";
import { rejectUntrustedMutation } from "@/lib/security/request-origin";

const payloadSchema = z.object({
  requestId: z.string().uuid(),
  sessionId: z.string().uuid(),
  activityId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
  submittedAnswer: z.string().max(500),
  latencyMs: z.number().int().min(0).max(30 * 60 * 1000),
  evidenceKind: z.literal("self-report").optional(),
}).strict();

export async function POST(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to save this answer." }, { status: 401 });
    }

    const payload = payloadSchema.safeParse(await request.json().catch(() => undefined));
    if (!payload.success) return NextResponse.json({ error: "That answer could not be checked." }, { status: 400 });
    const outcome = await submitActivity({ userId, ...payload.data });
    if (!outcome.session) {
      return NextResponse.json(
        { error: "This learning session is unavailable." },
        { status: 409 },
      );
    }
    return NextResponse.json({
      attempt: outcome.attempt,
      session: presentSessionForLearner(outcome.session),
    });
  } catch (error) {
    const errorCode = typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined;
    if (errorCode === "40001") {
      return NextResponse.json(
        { error: "Your lesson changed while that answer was saving. Try it once more." },
        { status: 409 },
      );
    }
    const safeDomainMessage = error instanceof Error && [
      "This learning session is unavailable.",
      "That activity is not the current session step.",
      "This request ID was already used for another answer.",
      "Learning session step changed before submission.",
    ].includes(error.message)
      ? error.message
      : undefined;
    if (safeDomainMessage) {
      return NextResponse.json({ error: safeDomainMessage }, { status: 409 });
    }

    console.error("[api/activity/submit] failed", {
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      { error: "Your answer could not be saved right now. Please try again." },
      { status: 500 },
    );
  }
}
