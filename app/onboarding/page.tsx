import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/server";
import { getLearningRepository } from "@/lib/data";
import { OnboardingFlow } from "./onboarding-flow";

// Returning learners already have a saved profile, so the questionnaire
// would only ask them things they have answered before. Send them to their
// dashboard instead. Signed-out visitors and brand-new accounts fall through
// to the flow, which handles its own sign-in prompt.
export default async function OnboardingPage() {
  const userId = await getCurrentUserId();
  if (userId) {
    const profile = await getLearningRepository()
      .getProfile(userId)
      .catch(() => undefined);
    if (profile) redirect("/today");
  }

  return <OnboardingFlow />;
}
