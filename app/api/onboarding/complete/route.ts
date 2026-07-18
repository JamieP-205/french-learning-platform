import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/server";
import { completeOnboarding, OnboardingEligibilityError, onboardingSchema } from "@/lib/learning/service";
import { rejectUntrustedMutation } from "@/lib/security/request-origin";

export async function POST(request: Request) {
  const originError = rejectUntrustedMutation(request);
  if (originError) return originError;

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in before finishing onboarding." }, { status: 401 });
    }

    const parsed = onboardingSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return NextResponse.json({ error: "Please check the onboarding details." }, { status: 400 });
    const profile = await completeOnboarding(userId, parsed.data);
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    const isSetupError = error instanceof Error && /supabase/i.test(error.message);

    return NextResponse.json(
      {
        error: isSetupError
            ? "Your learning data is temporarily unavailable. Please try again."
          : error instanceof OnboardingEligibilityError
            ? "This account is not eligible to complete onboarding."
            : "Unable to complete onboarding. Please try again.",
      },
      { status: error instanceof OnboardingEligibilityError ? 403 : 500 },
    );
  }
}
