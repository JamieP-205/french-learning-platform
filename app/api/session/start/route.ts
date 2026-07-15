import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/server";
import { getMissionPlan, getReviewPlan, getTodayPlan, startSession } from "@/lib/learning/service";

const payloadSchema = z.object({
  mode: z.enum(["normal", "short"]).optional(),
  focus: z.enum(["review"]).optional(),
  missionSlug: z.string().trim().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  let stage = "start";

  try {
    stage = "read-user";
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error: "Sign in to start this learning session.",
        },
        { status: 401 },
      );
    }

    stage = "parse-payload";
    const payload = payloadSchema.safeParse(await request.json().catch(() => ({})));

    if (!payload.success) {
      return NextResponse.json(
        {
          error: "Invalid session choice.",
        },
        { status: 400 },
      );
    }

    stage = payload.data.missionSlug ? "build-mission-plan" : payload.data.focus === "review" ? "build-review-plan" : "build-today-plan";
    const plan = payload.data.missionSlug
      ? await getMissionPlan(userId, payload.data.missionSlug, payload.data.mode)
      : payload.data.focus === "review"
        ? await getReviewPlan(userId)
        : await getTodayPlan(userId, payload.data.mode);

    if (!plan) {
      return NextResponse.json(
        {
          error: "Finish onboarding first.",
        },
        { status: 409 },
      );
    }

    stage = "start-session";
    const session = await startSession(userId, plan, { allowResume: payload.data.focus !== "review" });

    stage = "return-session";
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error("[api/session/start] failed", {
      stage,
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Learning storage is not configured correctly yet. Check the production Supabase environment variables."
            : "Today’s session could not start. Please try again.",
      },
      { status: 500 },
    );
  }
}
