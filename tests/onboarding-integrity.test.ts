import { describe, expect, it } from "vitest";
import { MockLearningRepository } from "../lib/data/mock-repository";
import { onboardingSchema, profileUpdateSchema } from "../lib/learning/service";
import { CURRENT_REQUIRED_POLICY_VERSION } from "../lib/privacy/policy";
import { DEFAULT_TIME_ZONE } from "../lib/time/calendar-day";

const onboardingInput = {
  displayName: "Camille",
  currentLevel: "A1" as const,
  learningGoals: ["conversation"],
  interests: ["music"],
  dailyMinutes: 8,
  preferredMode: "normal" as const,
  focusPreferences: ["speaking" as const],
  speakingConfidence: "medium" as const,
  ageConfirmed: true as const,
  acceptedRequiredPolicies: true as const,
};

describe("onboarding integrity", () => {
  it("rejects a client-supplied policy version", () => {
    expect(
      onboardingSchema.safeParse({ ...onboardingInput, policyVersion: "attacker-selected" }).success,
    ).toBe(false);
  });

  it("defaults missing time zones to UTC and validates supplied IANA zones", () => {
    expect(onboardingSchema.parse(onboardingInput).timeZone).toBe(DEFAULT_TIME_ZONE);
    expect(onboardingSchema.parse({ ...onboardingInput, timeZone: " Europe/London " }).timeZone)
      .toBe("Europe/London");
    expect(onboardingSchema.safeParse({ ...onboardingInput, timeZone: "Not/A_Time_Zone" }).success)
      .toBe(false);
  });

  it("normalizes visible name spacing and rejects deceptive formatting", () => {
    expect(onboardingSchema.parse({
      ...onboardingInput,
      displayName: "  Camille   Martin  ",
    }).displayName).toBe("Camille Martin");
    expect(onboardingSchema.safeParse({
      ...onboardingInput,
      displayName: "Camille\u202EnimdA",
    }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({
      displayName: "Camille\nAdmin",
    }).success).toBe(false);
  });

  it("is idempotent and preserves established progress", async () => {
    const repository = new MockLearningRepository();
    const userId = `onboarding-${Date.now()}`;
    await repository.saveProfile({
      userId,
      ...onboardingInput,
      policyVersion: "older-policy",
      completedSessions: 7,
      currentStreak: 4,
      streakFreezes: 1,
      lastCompletedAt: "2026-07-15T10:00:00.000Z",
    });

    const update = {
      userId,
      ...onboardingInput,
      displayName: "Camille R.",
      policyVersion: CURRENT_REQUIRED_POLICY_VERSION,
      completedSessions: 0,
      currentStreak: 0,
      streakFreezes: 0,
    };
    await repository.completeOnboardingProfile(update);
    const saved = await repository.completeOnboardingProfile(update);
    const exported = await repository.exportLearnerData(userId);

    expect(saved).toMatchObject({
      displayName: "Camille R.",
      completedSessions: 7,
      currentStreak: 4,
      streakFreezes: 1,
      policyVersion: CURRENT_REQUIRED_POLICY_VERSION,
    });
    expect(exported.privacyConsents).toHaveLength(3);
  });
});
