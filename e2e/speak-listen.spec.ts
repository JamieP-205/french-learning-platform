import { expect, test } from "./fixtures";
import { localLearningStorageKey } from "../lib/local-learning/progress";

test("listening uses bundled audio first and reports when both playback paths fail", async ({ page }) => {
  await page.addInitScript(() => {
    const testWindow = window as typeof window & {
      __speechCalls: Array<{ text: string; lang: string; rate: number }>;
      __mediaCalls: Array<{ source: string; rate: number }>;
      __speechShouldFail: boolean;
      __mediaShouldFail: boolean;
    };
    testWindow.__speechCalls = [];
    testWindow.__mediaCalls = [];
    testWindow.__speechShouldFail = false;
    testWindow.__mediaShouldFail = false;

    class TestAudio {
      preload = "";
      playbackRate = 1;
      defaultPlaybackRate = 1;
      preservesPitch = false;
      currentTime = 0;
      onended?: () => void;
      onerror?: () => void;
      onabort?: () => void;

      constructor(readonly src: string) {}

      play() {
        testWindow.__mediaCalls.push({ source: this.src, rate: this.playbackRate });
        window.setTimeout(() => {
          if (testWindow.__mediaShouldFail) this.onerror?.();
          else this.onended?.();
        }, 50);
        return Promise.resolve();
      }

      pause() {}
    }

    class TestUtterance {
      lang = "";
      rate = 1;
      voice?: { lang: string };
      onend?: () => void;
      onerror?: (event: { error: string }) => void;

      constructor(readonly text: string) {}
    }

    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: TestUtterance,
    });
    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: TestAudio,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        paused: false,
        getVoices: () => [{ lang: "fr-FR" }, { lang: "en-GB" }],
        addEventListener: () => undefined,
        cancel: () => undefined,
        resume: () => undefined,
        speak: (utterance: TestUtterance) => {
          testWindow.__speechCalls.push({ text: utterance.text, lang: utterance.lang, rate: utterance.rate });
          window.setTimeout(() => {
            if (testWindow.__speechShouldFail) utterance.onerror?.({ error: "synthesis-failed" });
            else utterance.onend?.();
          }, 50);
        },
      },
    });
  });

  await page.goto("/listen");
  await page.getByRole("button", { name: "Start listening check" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Playing…" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __mediaCalls: unknown[] }).__mediaCalls)).toEqual([
    { source: "/audio/french/bonjour-je-mappelle-jamie.mp3", rate: 1 },
  ]);
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __speechCalls: unknown[] }).__speechCalls)).toEqual([]);

  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __mediaShouldFail: boolean;
      __speechShouldFail: boolean;
    };
    testWindow.__mediaShouldFail = true;
    testWindow.__speechShouldFail = true;
  });
  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /bundled audio could not play.*not muted/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again: Play" })).toBeVisible();
});

test("listening keeps a no-credit fallback when bundled and browser audio are unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    class FailedAudio {
      currentTime = 0;
      onended?: () => void;
      onerror?: () => void;
      onabort?: () => void;

      play() {
        window.setTimeout(() => this.onerror?.(), 0);
        return Promise.resolve();
      }

      pause() {}
    }
    Object.defineProperty(window, "Audio", { configurable: true, value: FailedAudio });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: undefined });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined });
  });

  await page.goto("/listen");
  await page.getByRole("button", { name: "Start listening check" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /bundled audio could not play/i })).toBeVisible();
  await page.getByRole("button", { name: "Reveal text without credit" }).click();
  await expect(page.getByText("Bonjour, je m'appelle Jamie.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Your answer")).toHaveCount(0);
});

test("bundled French audio is served as media", async ({ request }) => {
  const response = await request.get("/audio/french/bonjour-je-mappelle-jamie.mp3");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("audio/mpeg");
  expect((await response.body()).byteLength).toBeGreaterThan(4_000);
});

test("bundled French audio decodes without browser speech synthesis", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: undefined });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined });
  });

  await page.goto("/listen");
  await page.getByRole("button", { name: "Start listening check" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();

  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("alert").filter({ hasText: /audio|speech|playback/i })).toHaveCount(0);
});

test("speak practice page works and degrades honestly", async ({ page }) => {
  await page.goto("/speak");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: /say french out loud/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Learn this first" })).toBeVisible();
  await expect(page.getByTestId("speaking-scored-check")).toHaveCount(0);
  await page.getByRole("button", { name: "Start speaking check" }).click();
  await expect(page.getByTestId("speaking-scored-check")).toBeVisible();
  await expect(page.getByText("Bonjour, je m'appelle Jamie.").first()).toBeVisible();
  await page.getByRole("button", { name: "Next phrase" }).click();
  await expect(page.getByTestId("speaking-scored-check")).toHaveCount(0);
  await page.getByRole("button", { name: "Start speaking check" }).click();
  await expect(page.getByText("Je voudrais un café, s'il vous plaît.").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /u vs ou/i })).toBeVisible();
  await page.getByRole("button", { name: "Next contrast" }).click();
});

test("listen dictation checks typed answers", async ({ page }) => {
  await page.goto("/listen");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Build confidence understanding spoken French." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Learn this first" })).toBeVisible();
  await expect(page.getByLabel("Your answer")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Start listening check" }).click();
  await expect(page.getByLabel("Your answer")).toBeVisible();
  await page.getByLabel("Your answer").fill("Bonjour, je m'appelle Jamie.");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText(/excellent ear/i)).toBeVisible();

  await page.getByRole("button", { name: "Next phrase" }).click();
  await page.getByRole("button", { name: "Start listening check" }).click();
  await page.getByLabel("Your answer").fill("je voudrais un cafe s'il vous plait");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText(/only accents differ/i)).toBeVisible();

  await page.getByRole("button", { name: "Next phrase" }).click();
  await page.getByRole("button", { name: "Start listening check" }).click();
  await page.getByLabel("Your answer").fill("je suis perdu");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText(/j'ai vingt ans/i)).toHaveCount(0);
  await expect(page.getByText(/almost.*try once more/i)).toBeVisible();
  await page.getByRole("button", { name: "Show me the answer" }).click();
  await expect(page.getByText(/j'ai vingt ans/i)).toBeVisible();
  await page.getByRole("button", { name: "Next phrase" }).click();
  await page.getByRole("button", { name: "Start listening check" }).click();
  await page.getByRole("button", { name: "Reveal text without credit" }).click();
  await expect(page.getByLabel("Your answer")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check", exact: true })).toHaveCount(0);
});

test("revealing a lesson dictation records no controlled evidence", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Try this question" }).click();
  await page.getByRole("button", { name: /my name is jamie/i }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Try this question" }).click();
  await page.getByLabel("Your answer").fill("ai");
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Your answer").fill("J'ai 20 ans");
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Try this question" }).click();
  for (const token of ["Je", "viens", "de", "Belfast"]) {
    await page.getByRole("button", { name: token, exact: true }).click();
  }
  await page.getByRole("button", { name: "Check sentence" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const progressBeforeReveal = await page.evaluate((key) => window.localStorage.getItem(key), localLearningStorageKey);
  await page.getByRole("button", { name: "Show the written answer" }).click();
  await expect(page.getByText("Here’s the answer", { exact: true })).toBeVisible();
  await expect(page.getByText("Je m'appelle Jamie", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your answer")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check answer" })).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), localLearningStorageKey))
    .toBe(progressBeforeReveal);
});
