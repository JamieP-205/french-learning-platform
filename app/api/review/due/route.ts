import { NextResponse } from "next/server";
import { getLearningRepository } from "@/lib/data";
import { getCurrentUserId } from "@/lib/auth/server";
import { getResumableSession } from "@/lib/learning/service";
import { presentReviewForLearner } from "@/lib/learning/presentation";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to load reviews." }, { status: 401 });
    }

    const now = new Date();
    const [reviews, activeReview] = await Promise.all([
      getLearningRepository().getDueReviews(userId),
      getResumableSession(userId, { intent: "focused_review" }, now),
    ]);
    return NextResponse.json({
      reviews: reviews
        .filter((review) => new Date(review.dueAt) <= now)
        .map(presentReviewForLearner),
      activeSessionId: activeReview?.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Your learning data is temporarily unavailable. Please try again."
            : "Unable to load reviews.",
      },
      { status: 500 },
    );
  }
}
