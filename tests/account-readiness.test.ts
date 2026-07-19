import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "../lib/auth/messages";
import {
  isAccountSyncReady,
  isServerAccountSyncReady,
  isServerPrivacyAccessReady,
} from "../lib/auth/readiness";
import { hasRecentAuthenticationMethod } from "../lib/auth/server";
import { buildLaunchStatus } from "../lib/launch/status";

const root = process.cwd();

describe("account-sync release gate", () => {
  it("requires a recent method timestamp from the requesting session for destructive actions", () => {
    const now = Date.parse("2026-07-16T15:00:00.000Z");

    expect(hasRecentAuthenticationMethod({
      amr: [{ method: "password", timestamp: (now - 5 * 60 * 1000) / 1000 }],
    }, now)).toBe(true);
    expect(hasRecentAuthenticationMethod({
      amr: [{ method: "password", timestamp: (now - 16 * 60 * 1000) / 1000 }],
    }, now)).toBe(false);
    expect(hasRecentAuthenticationMethod({ amr: ["password"] }, now)).toBe(false);
    expect(hasRecentAuthenticationMethod({
      amr: [{ timestamp: (now - 5 * 60 * 1000) / 1000 }],
    }, now)).toBe(false);
    expect(hasRecentAuthenticationMethod({
      amr: [{ method: "token_refresh", timestamp: (now - 5 * 60 * 1000) / 1000 }],
    }, now)).toBe(false);
    expect(hasRecentAuthenticationMethod({
      amr: [{ method: "otp", timestamp: (now - 5 * 60 * 1000) / 1000 }],
    }, now)).toBe(false);
    expect(hasRecentAuthenticationMethod({
      amr: [
        { method: "password", timestamp: (now - 24 * 60 * 60 * 1000) / 1000 },
        { method: "token_refresh", timestamp: (now - 60 * 1000) / 1000 },
      ],
    }, now)).toBe(false);
    expect(hasRecentAuthenticationMethod({
      amr: [{ method: "password", timestamp: (now + 2 * 60 * 1000) / 1000 }],
    }, now)).toBe(false);
  });

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
      "Accounts are temporarily unavailable while email confirmation is being tested.",
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
    const signInForm = readFileSync(join(root, "app/auth/sign-in/sign-in-form.tsx"), "utf8");
    const callbackRoute = readFileSync(join(root, "app/auth/callback/route.ts"), "utf8");
    const serverAuth = readFileSync(join(root, "lib/auth/server.ts"), "utf8");
    expect(signInPage).toContain("accountSyncReady={isServerAccountSyncReady()}");
    expect(signInPage).toContain("privacySignInReady={isServerPrivacyAccessReady()}");
    expect(signInForm).toContain(
      "const showAccountForm = accountSyncReady || (reauthRequested && privacySignInReady)",
    );
    expect(signInForm).toContain("{showAccountForm ? (");
    expect(callbackRoute).toContain("if (!isServerAccountSyncReady()");
    expect(serverAuth).toContain("if (requireAccountSyncReady && !isServerAccountSyncReady()) return null");
    expect(serverAuth).toContain("data.user.email_confirmed_at");
    expect(serverAuth).toContain("RECENT_AUTHENTICATION_WINDOW_MS");
    expect(serverAuth).toContain("resolveCurrentUserAuthContext(true, false)");
    expect(serverAuth).toContain("resolveCurrentUserAuthContext(false, true)");
    expect(serverAuth).toContain("if (!requireRecentAuthentication)");
    expect(serverAuth).toContain("Routine learning never depends on");
    const deleteRoute = readFileSync(join(root, "app/api/privacy/delete/route.ts"), "utf8");
    const exportRoute = readFileSync(join(root, "app/api/privacy/export/route.ts"), "utf8");
    expect(deleteRoute).toContain("getCurrentPrivacyUserAuthContext");
    expect(exportRoute).toContain("getCurrentPrivacyUserAuthContext");
    expect(deleteRoute).toContain("auth.recentlyAuthenticated");
    expect(exportRoute).toContain("auth.recentlyAuthenticated");
  });

  it("keeps server account routes closed without durable storage credentials", () => {
    const publicConfiguration = {
      NEXT_PUBLIC_ACCOUNT_SYNC_READY: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    };

    expect(isAccountSyncReady(publicConfiguration)).toBe(true);
    expect(isServerPrivacyAccessReady(publicConfiguration)).toBe(false);
    expect(isServerAccountSyncReady(publicConfiguration)).toBe(false);
    expect(isServerPrivacyAccessReady({ ...publicConfiguration, SUPABASE_SERVICE_ROLE_KEY: "service-key" })).toBe(true);
    expect(isServerAccountSyncReady({ ...publicConfiguration, SUPABASE_SERVICE_ROLE_KEY: "service-key" })).toBe(true);
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
