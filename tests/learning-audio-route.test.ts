import { describe, expect, it } from "vitest";
import { GET } from "../app/api/learning-audio/[clipId]/route";

describe("learner audio route", () => {
  it("streams an allowlisted activity clip without exposing its written answer", async () => {
    const response = await GET(
      new Request("http://localhost/api/learning-audio/act-dictation-v1"),
      { params: Promise.resolve({ clipId: "act-dictation-v1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("does not expose arbitrary files or non-audio activities", async () => {
    for (const clipId of ["..%2F.env", "act-name-meaning-v1", "missing-clip"]) {
      const response = await GET(
        new Request(`http://localhost/api/learning-audio/${clipId}`),
        { params: Promise.resolve({ clipId }) },
      );
      expect(response.status).toBe(404);
    }
  });
});
