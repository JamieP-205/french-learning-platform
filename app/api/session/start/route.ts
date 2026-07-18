import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/server";
import {
  getMissionPlan,
  getResumableSession,
  getReviewPlan,
  getTodayPlan,
  isFocusedReviewPlan,
  startSession,
} from "@/lib/learning/service";
import { getLearningRepository } from "@/lib/data";
import {
  getMissionById,
  getMissionBySlug,
  isPublicScoredMissionSlug,
} from "@/lib/content/scored-missions";
import { isSameCalendarDay } from "@/lib/time/calendar-day";
import { presentSessionForLearner } from "@/lib/learning/presentation";
import { rejectUntrustedMutation } from "@/lib/security/request-origin";

const payloadSchema = z.object({
  requestId: z.string().uuid(),
  mode: z.enum(["normal", "short"]).optional(),
  focus: z.enum(["review"]).optional(),
  missionSlug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).optional(),
  restartSessionId: z.string().uuid().optional(),
  resumeSessionId: z.string().uuid().optional(),
}).strict().refine((payload) => !(payload.restartSessionId && payload.resumeSessionId));

export async function POST(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

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
    const payload = payloadSchema.safeParse(await request.json().catch(() => undefined));

    if (!payload.success) {
      return NextResponse.json(
        {
          error: "Invalid session choice.",
        },
        { status: 400 },
      );
    }

    const repository = getLearningRepository();
    if (payload.data.resumeSessionId) {
      stage = "verify-resume";
      const [activeSession, profile] = await Promise.all([
        repository.getSession(userId, payload.data.resumeSessionId),
        repository.getProfile(userId),
      ]);
      const sameDay = activeSession
        ? isSameCalendarDay(activeSession.startedAt, new Date(), profile?.timeZone)
        : false;
      const expectsFocusedReview = payload.data.focus === "review";
      const intentMatches = activeSession
        ? isFocusedReviewPlan(activeSession.plan) === expectsFocusedReview
        : false;
      if (!activeSession || activeSession.completedAt || !sameDay || !intentMatches) {
        return NextResponse.json({ error: "That lesson is no longer available to resume." }, { status: 409 });
      }
      return NextResponse.json({ session: presentSessionForLearner(activeSession) });
    }

    let missionSlug = payload.data.missionSlug;
    if (payload.data.restartSessionId) {
      stage = "verify-restart";
      const completedSession = await repository.getSession(userId, payload.data.restartSessionId);
      const completedMission = completedSession ? getMissionById(completedSession.plan.missionId) : undefined;
      if (!completedSession?.completedAt || !completedMission || !isPublicScoredMissionSlug(completedMission.slug)) {
        return NextResponse.json({ error: "That completed lesson cannot be restarted." }, { status: 400 });
      }
      missionSlug = completedMission.slug;
    }

    if (missionSlug) {
      const mission = getMissionBySlug(missionSlug);
      if (!mission) {
        return NextResponse.json({ error: "That lesson is not available." }, { status: 404 });
      }
      if (!isPublicScoredMissionSlug(mission.slug)) {
        return NextResponse.json(
          { error: "That lesson is still in content review. Its unscored preview is available instead." },
          { status: 409 },
        );
      }
    }

    stage = missionSlug ? "build-mission-plan" : payload.data.focus === "review" ? "build-review-plan" : "build-today-plan";
    const plan = missionSlug
      ? await getMissionPlan(userId, missionSlug, payload.data.mode)
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

    if (!payload.data.restartSessionId) {
      stage = "find-resumable-session";
      const resumable = await getResumableSession(userId, {
        intent: isFocusedReviewPlan(plan) ? "focused_review" : "lesson",
        missionId: plan.missionId,
        mode: plan.mode,
      });
      if (resumable) {
        return NextResponse.json({ session: presentSessionForLearner(resumable) });
      }
    }

    const sessionStartWindowSeconds = 60 * 60;
    const quotaAvailable = await repository.consumeRateLimit(userId, "session-start", {
      limit: 30,
      windowSeconds: sessionStartWindowSeconds,
    }, payload.data.requestId);
    if (!quotaAvailable) {
      return NextResponse.json(
        { error: "Too many sessions were started recently. Continue an open lesson or try again later." },
        { status: 429, headers: { "Retry-After": String(sessionStartWindowSeconds) } },
      );
    }

    stage = "start-session";
    const session = await startSession(userId, plan, {
      allowResume: !payload.data.restartSessionId,
      requestId: payload.data.requestId,
    });

    stage = "return-session";
    return NextResponse.json({ session: presentSessionForLearner(session) }, { status: 201 });
  } catch (error) {
    console.error("[api/session/start] failed", {
      stage,
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Your learning data is temporarily unavailable. Please try again."
            : "Today’s session could not start. Please try again.",
      },
      { status: 500 },
    );
  }
}
