import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FRIEND_CODE_LENGTH,
  formatFriendCode,
  generateFriendCode,
  normalizeFriendCode,
} from "../lib/social/friend-code";
import {
  FRIEND_REQUEST_RETRY_COOLDOWN_MS,
  coopChallengeProgress,
  isFriendRequestRetryCoolingDown,
} from "../lib/social/integrity";

describe("social integrity helpers", () => {
  it("generates a private 80-bit friend code and formats it for people", () => {
    const code = generateFriendCode();

    expect(code).toMatch(/^FR[A-F0-9]{20}$/);
    expect(code).toHaveLength(FRIEND_CODE_LENGTH);
    expect(formatFriendCode(code)).toMatch(/^FR(?:-[A-F0-9]{4}){5}$/);
    expect(normalizeFriendCode(formatFriendCode(code))).toBe(code);
  });

  it("ships the friend-code rotation and transactional challenge completion", () => {
    const integrityMigration = readFileSync(
      join(process.cwd(), "supabase/migrations/202607160006_social_integrity.sql"),
      "utf8",
    );
    const randomCodeMigration = readFileSync(
      join(process.cwd(), "supabase/migrations/202607160011_random_friend_codes.sql"),
      "utf8",
    );
    const atomicSocialMigration = readFileSync(
      join(process.cwd(), "supabase/migrations/202607160009_atomic_social_operations.sql"),
      "utf8",
    );
    const finalIntegrityMigration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/202607160013_social_privacy_timezone_hardening.sql",
      ),
      "utf8",
    );

    expect(randomCodeMigration).toContain("gen_random_bytes(10)");
    expect(randomCodeMigration).toContain("rotate_friend_code");
    expect(randomCodeMigration).toContain("friend_code_rotation_requests");
    expect(integrityMigration).toContain("assign_strong_friend_code_on_profile");
    expect(integrityMigration).toContain("complete_reached_coop_challenges_on_profile");
    expect(integrityMigration).toContain(") >= challenge.target_sessions");
    expect(atomicSocialMigration).toContain("coop_starting_session_count");
    expect(atomicSocialMigration).toContain("for update;");
    expect(atomicSocialMigration).toContain("social_blocks_keep_pair_on_update");
    expect(atomicSocialMigration).not.toContain("A co-op challenge cannot be started across a block.");
    expect(finalIntegrityMigration).toContain("active_coop_challenge_participants");
    expect(finalIntegrityMigration).toContain("sync_active_coop_challenge_participants");
    expect(finalIntegrityMigration).toContain("report_social_user");
  });

  it("does not repeat generated codes", () => {
    expect(generateFriendCode()).not.toBe(generateFriendCode());
    expect(generateFriendCode()).toMatch(/^FR[A-F0-9]{20}$/);
  });

  it("enforces the declined-request cooldown boundary", () => {
    const now = Date.parse("2026-07-16T12:00:00.000Z");
    const recent = new Date(now - FRIEND_REQUEST_RETRY_COOLDOWN_MS + 1).toISOString();
    const elapsed = new Date(now - FRIEND_REQUEST_RETRY_COOLDOWN_MS).toISOString();

    expect(isFriendRequestRetryCoolingDown(recent, now)).toBe(true);
    expect(isFriendRequestRetryCoolingDown(elapsed, now)).toBe(false);
  });

  it("counts only sessions completed after a challenge starts", () => {
    expect(
      coopChallengeProgress({
        yourStartingSessions: 5,
        friendStartingSessions: 8,
        yourCompletedSessions: 7,
        friendCompletedSessions: 7,
      }),
    ).toEqual({ yourProgress: 2, friendProgress: 0, combinedProgress: 2 });
  });
});
