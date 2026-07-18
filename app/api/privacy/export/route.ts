import { NextResponse } from "next/server";
import { getLearningRepository } from "@/lib/data";
import { getCurrentPrivacyUserAuthContext } from "@/lib/auth/server";
import { rejectUntrustedMutation } from "@/lib/security/request-origin";

export async function POST(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  try {
    const auth = await getCurrentPrivacyUserAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Sign in to export your learning data." }, { status: 401 });
    }
    if (!auth.recentlyAuthenticated) {
      return NextResponse.json(
        { error: "Sign in again before exporting your learning data." },
        { status: 403 },
      );
    }

    const repository = getLearningRepository();
    const quotaAvailable = await repository.consumeRateLimit(auth.userId, "privacy-export", {
      limit: 5,
      windowSeconds: 60 * 60,
    });
    if (!quotaAvailable) {
      return NextResponse.json(
        { error: "Too many export requests. Try again later." },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }

    const exportData = await repository.exportLearnerData(auth.userId);
    return new NextResponse(JSON.stringify(exportData), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=learning-data.json",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Your privacy request could not be completed right now. Please try again."
            : "Unable to export data.",
      },
      { status: 500 },
    );
  }
}
