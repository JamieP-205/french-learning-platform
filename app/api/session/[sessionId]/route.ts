import { NextResponse } from "next/server";
import { getLearningRepository } from "@/lib/data";
import { getCurrentUserId } from "@/lib/auth/server";

export async function GET(_: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const [userId, { sessionId }] = await Promise.all([getCurrentUserId(), params]);
    if (!userId) {
      return NextResponse.json({ error: "Sign in to continue this session." }, { status: 401 });
    }

    const session = await getLearningRepository().getSession(userId, sessionId);
    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Learning storage is not configured correctly yet. Check the production Supabase environment variables."
            : "Unable to load session.",
      },
      { status: 500 },
    );
  }
}
