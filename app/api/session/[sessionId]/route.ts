import { NextResponse } from "next/server";
import { z } from "zod";
import { getLearningRepository } from "@/lib/data";
import { getCurrentUserId } from "@/lib/auth/server";
import { buildSessionStats } from "@/lib/learning/session-stats";
import { getMissionById, isPublicScoredMissionSlug } from "@/lib/content/scored-missions";
import { presentSessionForLearner } from "@/lib/learning/presentation";

export async function GET(_: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const [userId, { sessionId }] = await Promise.all([getCurrentUserId(), params]);
    if (!userId) {
      return NextResponse.json({ error: "Sign in to continue this session." }, { status: 401 });
    }
    if (!z.string().uuid().safeParse(sessionId).success) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const repository = getLearningRepository();
    const session = await repository.getSession(userId, sessionId);
    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    const attempts = await repository.getSessionAttempts(userId, sessionId);
    const mission = getMissionById(session.plan.missionId);
    const restartable = mission && isPublicScoredMissionSlug(mission.slug);
    return NextResponse.json({
      session: presentSessionForLearner(session),
      sessionStats: buildSessionStats(attempts, sessionId),
      restartRequest: restartable
        ? {
            restartSessionId: session.id,
            mode: session.plan.mode === "normal" ? "normal" : "short",
            missionSlug: mission.slug,
          }
        : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Your learning data is temporarily unavailable. Please try again."
            : "Unable to load session.",
      },
      { status: 500 },
    );
  }
}
