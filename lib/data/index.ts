import type { LearningRepository } from "@/lib/data/repository";
import { MockLearningRepository } from "@/lib/data/mock-repository";
import { SupabaseLearningRepository } from "@/lib/data/supabase-repository";

const mockRepository = new MockLearningRepository();

export const hasSupabaseAuthConfiguration = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const hasSupabaseConfiguration = Boolean(
  hasSupabaseAuthConfiguration && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export function getLearningRepository(): LearningRepository {
  if (hasSupabaseConfiguration) {
    // This class is instantiated only by server-side learning routes after the credentials check.
    return new SupabaseLearningRepository();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Supabase configuration is required in production. Demo learning data is development-only.");
  }
  return mockRepository;
}

export const DEMO_USER_ID = "demo-learner";
