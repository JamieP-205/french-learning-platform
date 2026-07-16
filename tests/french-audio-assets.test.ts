import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  audioSourceForFrench,
  FRENCH_AUDIO_BY_TEXT,
} from "../lib/content/french-audio";
import { SHADOWING_PHRASES } from "../lib/content/pronunciation";
import { SCORED_MISSIONS } from "../lib/content/scored-missions";

const publicRoot = join(process.cwd(), "public");

describe("bundled French audio assets", () => {
  it("ships every declared clip as a non-empty MP3 and no undeclared clips", () => {
    const declaredFiles = Object.values(FRENCH_AUDIO_BY_TEXT)
      .map((source) => source.replace(/^\//, ""))
      .sort();
    const shippedFiles = readdirSync(join(publicRoot, "audio", "french"))
      .filter((name) => name.endsWith(".mp3"))
      .map((name) => `audio/french/${name}`)
      .sort();

    expect(shippedFiles).toEqual(declaredFiles);
    for (const relativePath of declaredFiles) {
      const absolutePath = join(publicRoot, relativePath);
      expect(existsSync(absolutePath), relativePath).toBe(true);
      expect(statSync(absolutePath).size, relativePath).toBeGreaterThan(4_000);
      expect(readFileSync(absolutePath).subarray(0, 3).toString("ascii"), relativePath).toBe("ID3");
    }
  });

  it("covers every fixed listening, dictation and repeat-after-me target", () => {
    const requiredTexts = [
      ...SHADOWING_PHRASES.map((phrase) => phrase.french),
      ...SCORED_MISSIONS.flatMap((mission) =>
        mission.activities.flatMap((activity) =>
          (activity.type === "dictation" || activity.type === "speak_repeat") &&
          activity.targetText
            ? [activity.targetText]
            : [],
        ),
      ),
    ];

    for (const text of requiredTexts) {
      expect(audioSourceForFrench(text), text).toMatch(/^\/audio\/french\/[a-z0-9-]+\.mp3$/);
    }
  });
});
