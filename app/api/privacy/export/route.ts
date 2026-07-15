import { NextResponse } from "next/server";
import { getLearningRepository } from "@/lib/data";
import { getCurrentUserId } from "@/lib/auth/server";

export async function POST() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to export your learning data." }, { status: 401 });
    }

    const exportData = await getLearningRepository().exportLearnerData(userId);
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=learning-data.json" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Learning storage is not configured correctly yet. Check the production Supabase environment variables."
            : "Unable to export data.",
      },
      { status: 500 },
    );
  }
}
