import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/server";
import { getLearningRepository } from "@/lib/data";
import { buildTutorContextPack, getTutorFeedback } from "@/lib/ai/tutor";

const payloadSchema = z.object({
  sessionId: z.string().min(1),
  activityId: z.string().min(1),
  submittedAnswer: z.string().max(500),
});

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to use the tutor for this activity." }, { status: 401 });
    }

    const parsed = payloadSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "I need the current activity to explain it safely." }, { status: 400 });
    const contextPack = await buildTutorContextPack({ userId, ...parsed.data });
    const { feedback, provider } = await getTutorFeedback(contextPack);
    await getLearningRepository().logTutorInteraction({ userId, contextPack, feedback, provider });
    return NextResponse.json({ feedback, provider });
  } catch (error) {
    const isSetupError = error instanceof Error && /supabase/i.test(error.message);

    return NextResponse.json(
      {
        error: isSetupError
          ? "Learning storage is not configured correctly yet. The lesson feedback is still available."
          : error instanceof Error
            ? error.message
            : "The tutor is temporarily unavailable. The lesson feedback is still available.",
      },
      { status: isSetupError ? 500 : 400 },
    );
  }
}
