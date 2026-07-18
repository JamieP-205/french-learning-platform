import { NextResponse } from "next/server";
import { getLearningRepository } from "@/lib/data";
import { getCurrentUserId } from "@/lib/auth/server";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to view progress." }, { status: 401 });
    }

    return NextResponse.json({ progress: await getLearningRepository().getProgress(userId) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Your learning data is temporarily unavailable. Please try again."
            : "Unable to load progress.",
      },
      { status: 500 },
    );
  }
}
