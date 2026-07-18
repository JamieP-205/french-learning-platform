import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/server";
import { getResumableSession, getTodayPlan } from "@/lib/learning/service";
import { presentSessionPlanForLearner } from "@/lib/learning/presentation";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to build today’s session." }, { status: 401 });
    }

    const mode = new URL(request.url).searchParams.get("mode");
    const requestedMode = mode === "short" || mode === "normal" ? mode : undefined;
    const requestedPlanMode = requestedMode === "short" ? "two_minute" : requestedMode;
    const active = await getResumableSession(userId, {
      intent: "lesson",
      mode: requestedPlanMode,
    });
    const canResume = Boolean(active);
    const plan = canResume ? active!.plan : await getTodayPlan(userId, requestedMode);

    if (!plan) {
      return NextResponse.json({ error: "Finish onboarding to build your first session." }, { status: 409 });
    }

    // Let the UI say "Resume" honestly when a same-day session is unfinished.
    const activeSessionId = canResume ? active?.id : undefined;

    return NextResponse.json({
      plan: presentSessionPlanForLearner(plan),
      activeSessionId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Your learning data is temporarily unavailable. Please try again."
            : "Unable to plan today’s session.",
      },
      { status: 500 },
    );
  }
}
