import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/server";
import { getLearningRepository } from "@/lib/data";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send_request"),
    friendCode: z.string().trim().min(4).max(24),
  }),
  z.object({
    action: z.literal("respond_request"),
    requestId: z.string().trim().min(1).max(120),
    decision: z.enum(["accepted", "declined"]),
  }),
  z.object({
    action: z.literal("block"),
    targetUserId: z.string().trim().min(1).max(120),
  }),
  z.object({
    action: z.literal("report"),
    targetUserId: z.string().trim().min(1).max(120),
    reason: z.enum(["spam", "harassment", "unsafe_content", "other"]),
    details: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("start_challenge"),
    friendUserId: z.string().trim().min(1).max(120),
  }),
]);

function socialError(error: unknown) {
  if (error instanceof Error && /supabase/i.test(error.message)) {
    return NextResponse.json(
      { error: "Social storage is not configured correctly yet. Check the production Supabase environment variables." },
      { status: 500 },
    );
  }

  return NextResponse.json({ error: error instanceof Error ? error.message : "Social action failed." }, { status: 400 });
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
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to use friends." }, { status: 401 });
    const payload = actionSchema.safeParse(await request.json());
    if (!payload.success) return NextResponse.json({ error: "That social action was not valid." }, { status: 400 });

    const repository = getLearningRepository();
    if (payload.data.action === "send_request") {
      return NextResponse.json({ social: await repository.sendFriendRequestByCode(userId, payload.data.friendCode) });
    }
    if (payload.data.action === "respond_request") {
      return NextResponse.json({ social: await repository.respondFriendRequest(userId, payload.data.requestId, payload.data.decision) });
    }
    if (payload.data.action === "block") {
      return NextResponse.json({ social: await repository.blockSocialUser(userId, payload.data.targetUserId) });
    }
    if (payload.data.action === "report") {
      return NextResponse.json({
        social: await repository.reportSocialUser(userId, payload.data.targetUserId, payload.data.reason, payload.data.details),
      });
    }
    return NextResponse.json({ social: await repository.startCoopChallenge(userId, payload.data.friendUserId) });
  } catch (error) {
    return socialError(error);
  }
}
