import { afterEach, describe, expect, it, vi } from "vitest";
import { rejectUntrustedMutation } from "../lib/security/request-origin";

describe("mutation origin guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects cookie-style production mutations without the configured origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://french.example");

    const rejected = rejectUntrustedMutation(
      new Request("https://french.example/api/privacy/delete", { method: "POST" }),
    );

    expect(rejected?.status).toBe(403);
  });

  it("accepts the configured origin or an explicit bearer token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://french.example");

    expect(rejectUntrustedMutation(new Request(
      "https://french.example/api/profile",
      { method: "PATCH", headers: { Origin: "https://french.example" } },
    ))).toBeNull();
    expect(rejectUntrustedMutation(new Request(
      "https://french.example/api/profile",
      {
        method: "PATCH",
        headers: {
          Origin: "https://untrusted.example",
          Authorization: "Bearer signed-user-token",
        },
      },
    ))).toBeNull();
  });

  it("keeps local and test API clients usable without an Origin header", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(rejectUntrustedMutation(
      new Request("http://localhost/api/profile", { method: "PATCH" }),
    )).toBeNull();
  });
});
