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
      return NextResponse.json({ error: "Sign in to delete your learning data." }, { status: 401 });
    }
    if (!auth.recentlyAuthenticated) {
      return NextResponse.json(
        { error: "Sign in again before deleting your learning data." },
        { status: 403 },
      );
    }

    await getLearningRepository().deleteLearnerData(auth.userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Your privacy request could not be completed right now. Please try again."
            : "Unable to delete data.",
      },
      { status: 500 },
    );
  }
}
