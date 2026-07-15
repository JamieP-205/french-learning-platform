import { NextResponse } from "next/server";
import { getLearningRepository } from "@/lib/data";
import { getCurrentUserId } from "@/lib/auth/server";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to load reviews." }, { status: 401 });
    }

    const reviews = await getLearningRepository().getDueReviews(userId);
    return NextResponse.json({ reviews: reviews.filter((review) => new Date(review.dueAt) <= new Date()) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Learning storage is not configured correctly yet. Check the production Supabase environment variables."
            : "Unable to load reviews.",
      },
      { status: 500 },
    );
  }
}
