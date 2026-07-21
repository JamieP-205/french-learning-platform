import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "../app/auth/sign-in/sign-in-form";
import { friendlyAuthError, requiresEmailConfirmation } from "../lib/auth/messages";
import { buildConfirmationRedirectUrl, getSafeAuthDestination, NEW_ACCOUNT_DESTINATION } from "../lib/auth/redirects";
import { requestSignupConfirmation } from "../lib/auth/resend-confirmation";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("confirmation-email recovery", () => {
  it("recognises Supabase's stable error code as well as its legacy message", () => {
    expect(requiresEmailConfirmation({ code: "email_not_confirmed", message: "opaque" })).toBe(true);
    expect(requiresEmailConfirmation({ message: "Email not confirmed" })).toBe(true);
    expect(requiresEmailConfirmation({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe(false);
  });

  it("gives an unconfirmed learner a direct recovery instruction", () => {
    expect(friendlyAuthError({ code: "email_not_confirmed", message: "Email not confirmed" })).toMatch(
      /resend the confirmation email below/i,
    );

    expect(
      friendlyAuthError({ code: "email_address_not_authorized", message: "Email address not authorized" }),
    ).toMatch(/email service cannot send.*continue learning without an account/i);
  });

  it("renders the resend action in sign-in mode before an error occurs", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("NEXT_PUBLIC_ACCOUNT_SYNC_READY", "true");

    const html = renderToStaticMarkup(createElement(SignInForm, {
      accountSyncReady: true,
      privacySignInReady: true,
      reauthRequested: false,
    }));

    expect(html).toContain("Resend confirmation email");
    expect(html).toContain("Sign in");
    expect(html).toContain("Continue without an account");
  });

  it("hides account controls when provider configuration exists but delivery is unverified", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("NEXT_PUBLIC_ACCOUNT_SYNC_READY", "false");

    const html = renderToStaticMarkup(createElement(SignInForm, {
      accountSyncReady: false,
      privacySignInReady: false,
      reauthRequested: false,
    }));

    expect(html).toContain("Accounts are temporarily unavailable while email confirmation is being tested");
    expect(html).toContain("Continue without an account");
    expect(html).not.toContain("Resend confirmation email");
    expect(html).not.toContain("<form");
  });

  it("allows existing learners to sign in for privacy actions while signup is paused", () => {
    const html = renderToStaticMarkup(createElement(SignInForm, {
      accountSyncReady: false,
      privacySignInReady: true,
      reauthRequested: true,
    }));

    expect(html).toContain("Confirm it’s you");
    expect(html).toContain("<form");
    expect(html).toContain("Sign in");
    expect(html).not.toContain("Create account");
    expect(html).not.toContain("I need an account");
    expect(html).not.toContain("Resend confirmation email");
    expect(html).not.toContain('minLength="8"');
    expect(html).not.toContain('minlength="8"');
  });

  it("sends the Supabase signup-resend request and reports a privacy-safe success", async () => {
    const resend = vi.fn().mockResolvedValue({ error: null });

    const result = await requestSignupConfirmation(
      resend,
      "learner@example.com",
      "https://learn.example.com/auth/callback?next=%2Fonboarding",
    );

    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: "learner@example.com",
      options: { emailRedirectTo: "https://learn.example.com/auth/callback?next=%2Fonboarding" },
    });
    expect(result).toEqual({
      kind: "success",
      message: "Confirmation email requested. If this address has an unconfirmed account, check its inbox and spam folder.",
    });
  });

  it("reports Supabase and network failures without leaving the action unresolved", async () => {
    await expect(
      requestSignupConfirmation(
        vi.fn().mockResolvedValue({ error: { code: "over_request_rate_limit", message: "rate limit" } }),
        "learner@example.com",
        "https://learn.example.com/auth/callback",
      ),
    ).resolves.toEqual({
      kind: "error",
      message: "Too many attempts too quickly. Wait a minute, then try again.",
    });

    await expect(
      requestSignupConfirmation(
        vi.fn().mockRejectedValue(new Error("offline")),
        "learner@example.com",
        "https://learn.example.com/auth/callback",
      ),
    ).resolves.toEqual({
      kind: "error",
      message: "We couldn’t request a confirmation email. Check your connection and try again.",
    });
  });
});

describe("auth redirects", () => {
  it("keeps normal in-app destinations and rejects external or auth-loop destinations", () => {
    expect(getSafeAuthDestination("/today?from=signin#lesson")).toBe("/today?from=signin#lesson");
    expect(getSafeAuthDestination("https://attacker.example/steal")).toBe("/today");
    expect(getSafeAuthDestination("//attacker.example/steal")).toBe("/today");
    expect(getSafeAuthDestination("/\\attacker.example/steal")).toBe("/today");
    expect(getSafeAuthDestination("/auth/callback?next=/today")).toBe("/today");
  });

  it("sends returning sign-ins to the dashboard and keeps onboarding reachable for new accounts", () => {
    expect(getSafeAuthDestination(null)).toBe("/today");
    expect(getSafeAuthDestination(NEW_ACCOUNT_DESTINATION)).toBe("/onboarding");
    expect(NEW_ACCOUNT_DESTINATION).toBe("/onboarding");
  });

  it("uses a valid configured app origin for confirmation links", () => {
    expect(
      buildConfirmationRedirectUrl({
        configuredAppUrl: "https://learn.example.com/",
        browserOrigin: "https://preview.example.com",
        next: "/today?source=email",
      }),
    ).toBe("https://learn.example.com/auth/callback?next=%2Ftoday%3Fsource%3Demail");
  });

  it("falls back to the current origin when the configured URL is unsafe", () => {
    expect(
      buildConfirmationRedirectUrl({
        configuredAppUrl: "javascript:alert(1)",
        browserOrigin: "https://learn.example.com",
        next: "//attacker.example",
      }),
    ).toBe("https://learn.example.com/auth/callback?next=%2Ftoday");

    expect(
      buildConfirmationRedirectUrl({
        configuredAppUrl: "http://insecure.example.com",
        browserOrigin: "http://127.0.0.1:3000",
      }),
    ).toBe("http://127.0.0.1:3000/auth/callback?next=%2Ftoday");
  });
});
