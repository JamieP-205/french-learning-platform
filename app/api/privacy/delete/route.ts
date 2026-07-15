import { NextResponse } from "next/server";
import { getLearningRepository } from "@/lib/data";
import { getCurrentUserId } from "@/lib/auth/server";

export async function POST() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to delete your learning data." }, { status: 401 });
    }

    await getLearningRepository().deleteLearnerData(userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Learning storage is not configured correctly yet. Check the production Supabase environment variables."
            : "Unable to delete data.",
      },
      { status: 500 },
    );
  }
}
