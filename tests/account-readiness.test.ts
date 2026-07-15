import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "../lib/auth/messages";
import { isAccountSyncReady } from "../lib/auth/readiness";
import { buildLaunchStatus } from "../lib/launch/status";

const root = process.cwd();

describe("account-sync release gate", () => {
  it("fails closed unless the explicit readiness flag and both public Supabase values are present", () => {
    expect(isAccountSyncReady({})).toBe(false);
    expect(
      isAccountSyncReady({
        NEXT_PUBLIC_ACCOUNT_SYNC_READY: "true",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      }),
    ).toBe(false);
    expect(
      isAccountSyncReady({
        NEXT_PUBLIC_ACCOUNT_SYNC_READY: "false",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toBe(false);
    expect(
      isAccountSyncReady({
        NEXT_PUBLIC_ACCOUNT_SYNC_READY: "true",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toBe(true);
  });

  it("does not expose an unknown provider error to the learner", () => {
    const providerMessage = "smtp.internal.example refused recipient ID 49281";

    expect(friendlyAuthError({ message: providerMessage })).toBe(
      "We couldn’t complete that account request. Try again, or continue learning without an account.",
    );
    expect(friendlyAuthError({ message: providerMessage })).not.toContain(providerMessage);
  });

  it("reports unverified account delivery as a launch blocker", () => {
    const status = buildLaunchStatus({});

    expect(status.publicSignupEnabled).toBe(false);
    expect(status.blockers).toContain(
      "Account sync stays unavailable until production SMTP and a real email-confirmation round trip have been verified.",
    );
  });

  it("does not enable the auth entry point merely because Supabase is configured", () => {
    const configuredButUnverified = {
      NEXT_PUBLIC_ACCOUNT_SYNC_READY: "false",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    };

    expect(isAccountSyncReady(configuredButUnverified)).toBe(false);

    const signInPage = readFileSync(join(root, "app/auth/sign-in/page.tsx"), "utf8");
    const callbackRoute = readFileSync(join(root, "app/auth/callback/route.ts"), "utf8");
    expect(signInPage).toContain("{accountSyncReady ? (");
    expect(callbackRoute).toContain("if (!isAccountSyncReady()");
  });

  it("allowlists exact production and local callback routes", () => {
    const config = readFileSync(join(root, "supabase/config.toml"), "utf8");

    expect(config).toContain('"https://french-learning-platform-one.vercel.app/auth/callback"');
    expect(config).toContain('"http://localhost:3000/auth/callback"');
    expect(config).toContain('"http://127.0.0.1:3000/auth/callback"');
    expect(config).not.toContain('"https://french-learning-platform-one.vercel.app/onboarding"');
  });

  it("documents the fail-closed production switch", () => {
    const exampleEnvironment = readFileSync(join(root, ".env.example"), "utf8");
    const deployment = readFileSync(join(root, "docs/DEPLOYMENT.md"), "utf8");

    expect(exampleEnvironment).toContain("NEXT_PUBLIC_ACCOUNT_SYNC_READY=false");
    expect(deployment).toContain("NEXT_PUBLIC_ACCOUNT_SYNC_READY=true");
    expect(deployment).toMatch(/fresh account using an address outside the project team/i);
  });
});
