export const E2E_LEARNER_COOKIE = "french-e2e-learner";

const isolatedLearnerPattern = /^e2e-[a-f0-9]{12}-\d+$/;

export function resolveDevelopmentLearnerId(candidate: string | undefined, fallback: string) {
  return candidate && isolatedLearnerPattern.test(candidate) ? candidate : fallback;
}
