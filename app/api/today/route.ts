import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/server";
import { getLearningRepository } from "@/lib/data";
import { getTodayPlan } from "@/lib/learning/service";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to build today’s session." }, { status: 401 });
    }

    const mode = new URL(request.url).searchParams.get("mode");
    const plan = await getTodayPlan(userId, mode === "short" ? "short" : "normal");

    if (!plan) {
      return NextResponse.json({ error: "Finish onboarding to build your first session." }, { status: 409 });
    }

    // Let the UI say "Resume" honestly when a same-day session is unfinished.
    const active = await getLearningRepository().getActiveSession(userId);
    const activeSessionId =
      active && active.startedAt.slice(0, 10) === new Date().toISOString().slice(0, 10) ? active.id : undefined;

    return NextResponse.json({ plan, activeSessionId });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Learning storage is not configured correctly yet. Check the production Supabase environment variables."
            : "Unable to plan today’s session.",
      },
      { status: 500 },
    );
  }
}
