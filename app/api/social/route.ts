import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/server";
import { getLearningRepository } from "@/lib/data";
import { rejectUntrustedMutation } from "@/lib/security/request-origin";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rotate_code"),
    requestId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("send_request"),
    friendCode: z.string().trim().min(4).max(32),
  }),
  z.object({
    action: z.literal("respond_request"),
    requestId: z.string().uuid(),
    decision: z.enum(["accepted", "declined"]),
  }),
  z.object({
    action: z.literal("block"),
    targetUserId: z.string().uuid(),
    requestId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("unblock"),
    targetUserId: z.string().uuid(),
    requestId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("report"),
    requestId: z.string().uuid(),
    targetUserId: z.string().uuid(),
    reason: z.enum(["spam", "harassment", "unsafe_content", "other"]),
    details: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("start_challenge"),
    friendUserId: z.string().uuid(),
  }),
]);

function socialError(error: unknown) {
  const errorMessage = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : undefined;
  if (errorMessage && /supabase|fetch failed|network/i.test(errorMessage)) {
    return NextResponse.json(
      { error: "Friends are temporarily unavailable. Please try again." },
      { status: 500 },
    );
  }

  const safeMessages = new Set([
    "That friend code could not be added.",
    "That friend request is not available.",
    "That learner has too many pending friend requests.",
    "Wait 7 days before sending another request to this learner.",
    "Add this learner as a friend before starting a challenge.",
    "Finish your active co-op challenge before starting another.",
    "Complete your profile before adding friends.",
    "Finish onboarding before using friends.",
    "You cannot start a co-op challenge with yourself.",
    "You cannot block yourself.",
    "You cannot report yourself.",
    "That social action could not be completed.",
  ]);
  if (errorMessage && safeMessages.has(errorMessage)) {
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  console.error("[api/social] failed", {
    error: errorMessage ?? error,
  });
  return NextResponse.json(
    { error: "Friends are temporarily unavailable. Please try again." },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to use friends." }, { status: 401 });
    return NextResponse.json({ social: await getLearningRepository().getSocialSnapshot(userId) });
  } catch (error) {
    return socialError(error);
  }
}

export async function POST(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to use friends." }, { status: 401 });
    const payload = actionSchema.safeParse(await request.json().catch(() => undefined));
    if (!payload.success) return NextResponse.json({ error: "That social action was not valid." }, { status: 400 });

    const repository = getLearningRepository();
    const actionLimits: Record<typeof payload.data.action, { limit: number; windowSeconds: number }> = {
      rotate_code: { limit: 3, windowSeconds: 24 * 60 * 60 },
      send_request: { limit: 10, windowSeconds: 60 * 60 },
      respond_request: { limit: 30, windowSeconds: 60 * 60 },
      block: { limit: 30, windowSeconds: 60 * 60 },
      unblock: { limit: 30, windowSeconds: 60 * 60 },
      report: { limit: 10, windowSeconds: 24 * 60 * 60 },
      start_challenge: { limit: 10, windowSeconds: 60 * 60 },
    };
    const quotaRequestId = "requestId" in payload.data
      ? payload.data.requestId
      : undefined;
    const quotaAvailable = await repository.consumeRateLimit(
      userId,
      `social-${payload.data.action}`,
      actionLimits[payload.data.action],
      quotaRequestId,
    );
    if (!quotaAvailable) {
      const retryAfter = String(actionLimits[payload.data.action].windowSeconds);
      return NextResponse.json(
        { error: "Too many social actions were attempted. Try again later." },
        { status: 429, headers: { "Retry-After": retryAfter } },
      );
    }
    if (payload.data.action === "rotate_code") {
      return NextResponse.json({ social: await repository.rotateFriendCode(userId, payload.data.requestId) });
    }
    if (payload.data.action === "send_request") {
      return NextResponse.json({ social: await repository.sendFriendRequestByCode(userId, payload.data.friendCode) });
    }
    if (payload.data.action === "respond_request") {
      return NextResponse.json({ social: await repository.respondFriendRequest(userId, payload.data.requestId, payload.data.decision) });
    }
    if (payload.data.action === "block") {
      return NextResponse.json({ social: await repository.blockSocialUser(userId, payload.data.targetUserId) });
    }
    if (payload.data.action === "unblock") {
      return NextResponse.json({ social: await repository.unblockSocialUser(userId, payload.data.targetUserId) });
    }
    if (payload.data.action === "report") {
      return NextResponse.json({
        social: await repository.reportSocialUser(
          userId,
          payload.data.targetUserId,
          payload.data.reason,
          payload.data.details,
          payload.data.requestId,
        ),
      });
    }
    return NextResponse.json({ social: await repository.startCoopChallenge(userId, payload.data.friendUserId) });
  } catch (error) {
    return socialError(error);
  }
}
