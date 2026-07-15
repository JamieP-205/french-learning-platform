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

describe("public deploy readiness", () => {
  it("documents and applies the final RLS hardening migration", () => {
    expect(deploymentDoc).toContain("202607060001_harden_authenticated_client_writes.sql");
    expect(hardeningMigration).toContain('drop policy if exists "users update own profile"');
    expect(hardeningMigration).toContain('drop policy if exists "users own sessions"');
    expect(hardeningMigration).toContain('drop policy if exists "friends create own friendships"');
    expect(hardeningMigration).toContain('create policy "users read own sessions"');
    expect(hardeningMigration).toContain('create policy "users see own blocks"');
  });

  it("keeps the RLS checklist focused on public-client write denial", () => {
    expect(rlsChecklist).toContain("direct profile mutation is denied");
    expect(rlsChecklist).toContain("direct session creation is denied");
    expect(rlsChecklist).toContain("direct friend request creation is denied");
    expect(rlsChecklist).toContain("direct friendship creation is denied");
    expect(rlsChecklist).toContain("direct co-op challenge creation is denied");
  });
});
