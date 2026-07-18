import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("browser security policy", () => {
  it("limits browser connections to the configured Supabase project", () => {
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

    expect(config).toContain("new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin");
    expect(config).not.toContain("https://*.supabase.co");
    expect(config).not.toContain("https://api.openai.com");
    expect(config).toContain("frame-ancestors 'none'");
  });
});
