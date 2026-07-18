import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/server";
import { getLearningRepository } from "@/lib/data";
import { profileUpdateSchema, updateProfile } from "@/lib/learning/service";
import { rejectUntrustedMutation } from "@/lib/security/request-origin";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to view your settings." }, { status: 401 });
    const profile = await getLearningRepository().getProfile(userId);
    if (!profile) return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Your learning data is temporarily unavailable. Please try again."
            : "Your settings could not load. Please try again.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to change your settings." }, { status: 401 });
    const parsed = profileUpdateSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return NextResponse.json({ error: "Please check the settings values." }, { status: 400 });
    const profile = await updateProfile(userId, parsed.data);
    if (!profile) return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /supabase/i.test(error.message)
            ? "Your learning data is temporarily unavailable. Please try again."
            : "Your settings could not be saved. Please try again.",
      },
      { status: 500 },
    );
  }
}
