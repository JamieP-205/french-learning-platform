import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/server";
import { completeOnboarding, OnboardingEligibilityError, onboardingSchema } from "@/lib/learning/service";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in before finishing onboarding." }, { status: 401 });
    }

    const parsed = onboardingSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please check the onboarding details." }, { status: 400 });
    const profile = await completeOnboarding(userId, parsed.data);
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    const isSetupError = error instanceof Error && /supabase/i.test(error.message);

    return NextResponse.json(
      {
        error: isSetupError
          ? "Learning storage is not configured correctly yet. Check the production Supabase environment variables."
          : error instanceof Error
            ? error.message
            : "Unable to complete onboarding.",
      },
      { status: error instanceof OnboardingEligibilityError ? 403 : 500 },
    );
  }
}
