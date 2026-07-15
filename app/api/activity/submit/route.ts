import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/server";
import { submitActivity } from "@/lib/learning/service";

const payloadSchema = z.object({
  sessionId: z.string().min(1),
  activityId: z.string().min(1),
  submittedAnswer: z.string().max(500),
  latencyMs: z.number().int().min(0).max(30 * 60 * 1000),
  completed: z.boolean().optional(),
  correct: z.boolean().optional(),
  evidenceKind: z.enum(["recognition", "controlled", "free-production", "self-report"]).optional(),
});

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to save this answer." }, { status: 401 });
    }

    const payload = payloadSchema.safeParse(await request.json());
    if (!payload.success) return NextResponse.json({ error: "That answer could not be checked." }, { status: 400 });
    const outcome = await submitActivity({ userId, ...payload.data });
    return NextResponse.json(outcome);
  } catch (error) {
    const isSetupError = error instanceof Error && /supabase/i.test(error.message);

    return NextResponse.json(
      {
        error: isSetupError
          ? "Learning storage is not configured correctly yet. Check the production Supabase environment variables."
          : error instanceof Error
            ? error.message
            : "Unable to save this answer.",
      },
      { status: isSetupError ? 500 : 400 },
    );
  }
}
