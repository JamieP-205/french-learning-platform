import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const hardeningMigration = readFileSync(
  join(root, "supabase/migrations/202607060001_harden_authenticated_client_writes.sql"),
  "utf8",
);
const rlsChecklist = readFileSync(join(root, "supabase/tests/rls-checklist.sql"), "utf8");
const deploymentDoc = readFileSync(join(root, "docs/DEPLOYMENT.md"), "utf8");
const atomicSubmissionMigration = readFileSync(
  join(root, "supabase/migrations/202607160008_atomic_activity_submission.sql"),
  "utf8",
);
const atomicSocialMigration = readFileSync(
  join(root, "supabase/migrations/202607160009_atomic_social_operations.sql"),
  "utf8",
);
const finalIntegrityMigration = readFileSync(
  join(root, "supabase/migrations/202607160013_social_privacy_timezone_hardening.sql"),
  "utf8",
);
const releaseIntegrityMigration = readFileSync(
  join(root, "supabase/migrations/202607180001_release_integrity_and_answer_privacy.sql"),
  "utf8",
);
const rateLimitMigration = readFileSync(
  join(root, "supabase/migrations/202607160007_api_rate_limits.sql"),
  "utf8",
);
const timeZoneChecklist = readFileSync(
  join(root, "supabase/tests/time-zone-checklist.sql"),
  "utf8",
);
const supabaseRepository = readFileSync(join(root, "lib/data/supabase-repository.ts"), "utf8");

describe("public deploy readiness", () => {
  it("documents the complete migration chain and applies RLS hardening", () => {
    expect(deploymentDoc).toContain("supabase/migrations/*.sql");
    expect(deploymentDoc).toContain("full migration chain");
    expect(hardeningMigration).toContain('drop policy if exists "users update own profile"');
    expect(hardeningMigration).toContain('drop policy if exists "users own sessions"');
    expect(hardeningMigration).toContain('drop policy if exists "friends create own friendships"');
    expect(hardeningMigration).toContain('create policy "users read own sessions"');
    expect(hardeningMigration).toContain('create policy "users see own blocks"');
    expect(releaseIntegrityMigration).toContain(
      'drop policy if exists "users read own sessions"',
    );
    expect(releaseIntegrityMigration).toContain(
      'drop policy if exists "users see own blocks"',
    );
  });

  it("keeps the RLS checklist focused on public-client write denial", () => {
    expect(rlsChecklist).toContain("direct profile mutation is denied");
    expect(rlsChecklist).toContain("direct session creation is denied");
    expect(rlsChecklist).toContain("direct friend request creation is denied");
    expect(rlsChecklist).toContain("direct friendship creation is denied");
    expect(rlsChecklist).toContain("direct co-op challenge creation is denied");
    expect(rlsChecklist).toContain("blocked learner cannot identify the blocker");
    expect(rlsChecklist).toContain("session plans are server-only");
    expect(rlsChecklist).toContain("review answers are server-only");
    expect(rlsChecklist).toContain("activity payloads are server-only");
    expect(rlsChecklist).toContain("friend requests are API-only");
    expect(rlsChecklist).toContain("social blocks are API-only");
    expect(rlsChecklist).toContain("plan_json");
    expect(rlsChecklist).not.toContain("mission_id, plan, current_index");
  });

  it("ships transactional account writes and a quiesced migration sequence", () => {
    expect(atomicSubmissionMigration).toContain("submit_activity_attempt(");
    expect(atomicSubmissionMigration).toContain("activity_attempts_user_request_key");
    expect(atomicSubmissionMigration).toContain("pg_advisory_xact_lock");
    expect(atomicSubmissionMigration).toContain("transition_revision");
    expect(atomicSocialMigration).toContain("send_friend_request_by_code(");
    expect(atomicSocialMigration).toContain("respond_friend_request(");
    expect(atomicSocialMigration).toContain("block_social_user(");
    expect(atomicSocialMigration).toContain("start_coop_challenge(");
    expect(supabaseRepository).toContain('rpc("submit_activity_attempt"');
    expect(supabaseRepository).toContain('rpc("send_friend_request_by_code"');
    expect(supabaseRepository).toContain('rpc("create_or_resume_learning_session"');
    expect(deploymentDoc).toContain("wait for in-flight account API requests to drain");
    expect(deploymentDoc).toContain("Deploy this application version before reopening account access");
  });

  it("enforces the final privacy, time-zone, and social concurrency invariants", () => {
    expect(finalIntegrityMigration).toContain("get_learner_export_cutoff()");
    expect(finalIntegrityMigration).toContain("prevent_mistake_pattern_created_at_update");
    expect(finalIntegrityMigration).toContain("profiles_apply_local_streak");
    expect(finalIntegrityMigration).toContain("active_coop_challenge_participants");
    expect(finalIntegrityMigration).toContain("coop_challenges_sync_active_participants");
    expect(finalIntegrityMigration).toContain("report_social_user(");
    expect(finalIntegrityMigration).toContain("rotate_friend_code(");
    expect(timeZoneChecklist).toContain("Europe/London");
    expect(timeZoneChecklist).toContain("America/New_York");
  });

  it("ships the final private-data, retry, and bounded-read database boundary", () => {
    expect(releaseIntegrityMigration).toContain("profiles_display_name_integrity");
    expect(releaseIntegrityMigration).toContain("session_start_requests");
    expect(releaseIntegrityMigration).toContain("create_or_resume_learning_session(");
    expect(releaseIntegrityMigration).toContain("claim_tutor_interaction(");
    expect(releaseIntegrityMigration).toContain("get_progress_attempt_signals(");
    expect(releaseIntegrityMigration).toContain("get_progress_mistake_signals(");
    expect(releaseIntegrityMigration).toContain("unblock_social_user(");
    expect(releaseIntegrityMigration).toContain(
      "enforce_pending_friend_request_recipient_cap",
    );
    expect(rateLimitMigration).toContain("p_request_id uuid");
    expect(rateLimitMigration).toContain("api_rate_events_user_action_request_key");
    expect(rlsChecklist).toContain("session creation RPC is service-role only");
    expect(rlsChecklist).toContain("quota RPC is service-role only");
    expect(rlsChecklist).toContain("tutor claim RPC is service-role only");
    expect(rlsChecklist).toContain("progress aggregation RPCs are service-role only");
  });
});
