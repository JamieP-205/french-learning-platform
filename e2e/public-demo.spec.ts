import { expect, test } from "./fixtures";

test("saved device progress loads without hydration or duplicate-key errors", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem("bonjour:public-demo-progress-v1", JSON.stringify({
      sessionsCompleted: 1,
      attemptsCount: 2,
      correctCount: 1,
      mistakesCaptured: 1,
      repairsCompleted: 0,
      mistakePrompts: ["Write: I am 20 years old."],
      weakActivityIds: ["act-age-typing-v1", "act-age-typing-v1"],
      topicPreviewStats: {},
      skillSignals: {},
      activeDates: [],
      preferences: {
        displayName: "Jamie",
        currentLevel: "A1",
        primaryGoal: "travel",
        dailyMinutes: 8,
        sessionEnergy: "normal",
      },
    }));
  });

  await page.goto("/demo");

  await expect(page.getByRole("heading", { name: "Introduce yourself", exact: true })).toBeVisible();
  await expect(page.getByText(/moved a question you found difficult nearer the start/i)).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "0 of 7 questions complete" })).toBeVisible();
  expect(browserErrors.filter((error) => /hydration|same key|unique "key"/i.test(error))).toEqual([]);
});

test("multiple-choice repair shows the answer text, not its internal key", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Try this question" }).click();
  await page.getByRole("button", { name: "I am from Jamie." }).click();
  await page.getByRole("button", { name: "I like Jamie." }).click();

  const feedback = page.getByText("Here’s the answer", { exact: true }).locator("..");
  await expect(feedback.getByText("My name is Jamie.", { exact: true })).toBeVisible();
  await expect(feedback.getByText("a", { exact: true })).toHaveCount(0);
});

test("guest completes a clear just-in-time lesson without an account", async ({ page }) => {
  await page.goto("/demo");

  await expect(page.getByRole("heading", { name: "Introduce yourself", exact: true })).toBeVisible();
  await expect(page.getByText(/public local|deterministic|scored controls|review pull/i)).toHaveCount(0);
  const firstScoredAnswer = page.getByRole("button", { name: /my name is jamie/i });
  await expect(firstScoredAnswer).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Learn this first" })).toBeVisible();
  await expect(page.getByText("My name is Jamie.", { exact: true })).toBeVisible();
  await expect(page.getByText(/use it to introduce yourself/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "J'ai 20 ans.", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Try this question" }).click();
  await expect(page.getByRole("button", { name: /my name is jamie/i })).toBeVisible();
  await page.getByRole("button", { name: /my name is jamie/i }).click();
  await expect(page.getByText("Correct", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "J'ai 20 ans.", exact: true })).toBeVisible();
  await expect(page.getByLabel("Your answer")).toHaveCount(0);
  await page.getByRole("button", { name: "Try this question" }).click();
  await page.getByLabel("Your answer").fill("ai");
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const progressBeforeFirstMiss = await page.evaluate(() => window.localStorage.getItem("bonjour:public-demo-progress-v1"));
  await page.getByLabel("Your answer").fill("Je suis 20 ans");
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Try once more", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your answer")).toHaveValue("Je suis 20 ans");
  await expect(page.getByText(/j'ai 20 ans/i)).toHaveCount(0);
  await expect(page.getByText(/French uses avoir for age/i)).toHaveCount(0);
  await expect(page.getByText(/demo tutor note/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show me the answer" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("bonjour:public-demo-progress-v1")))
    .not.toBe(progressBeforeFirstMiss);
  const progressAfterFirstMiss = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("bonjour:public-demo-progress-v1") ?? "{}") as {
      weakActivityIds?: string[];
      mistakesCaptured?: number;
    },
  );
  expect(progressAfterFirstMiss.weakActivityIds).toContain("act-age-typing-v1");
  expect(progressAfterFirstMiss.mistakesCaptured).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Here’s the answer", { exact: true })).toBeVisible();
  await expect(page.getByText("J'ai 20 ans.", { exact: true })).toBeVisible();
  await expect(page.getByText(/French expresses age with avoir/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show me the answer" })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Je viens de Belfast.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try this question" }).click();
  for (const token of ["Je", "viens", "de", "Belfast"]) {
    await page.getByRole("button", { name: token, exact: true }).click();
  }
  await page.getByRole("button", { name: "Check sentence" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Your answer").fill("Je m'appelle Jamie");
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: /aujourd'hui, j'étudie le français/i })).toBeVisible();
  await page.getByRole("button", { name: "Try this question" }).click();
  await page.getByRole("button", { name: "I did the speaking self-check" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Moi, c'est Jamie.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try this question" }).click();
  await page.getByRole("button", { name: /moi, c'est jamie/i }).click();
  await page.getByRole("button", { name: "Finish lesson" }).click();

  await expect(page.getByRole("heading", { name: "Lesson finished" })).toBeVisible();
  await expect(page.getByText("You can introduce yourself", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/anything you missed will.*return/i)).toHaveCount(0);
  await expect(page.getByText(/checked mistakes are saved on this device/i)).toBeVisible();
  await page.getByRole("button", { name: "Practise again" }).click();
  await expect(page.getByText(/moved a question you found difficult nearer the start/i)).toBeVisible();

  await page.goto("/progress");
  await expect(page.getByText("Progress on this device")).toBeVisible();
  await expect(page.getByRole("heading", { name: "The app adapts from what you actually do." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start with what tripped you up." })).toBeVisible();

  await page.goto("/review");
  await expect(page.getByText("Review on this device")).toBeVisible();
  await expect(page.getByRole("heading", { name: /item ready to review/i })).toBeVisible();
  await expect(page.getByText(/sign in to load reviews/i)).toHaveCount(0);
  await expect(page.getByText(/authentication is required/i)).toHaveCount(0);

  await page.goto("/today");
  await expect(page.getByText("Learning on this device")).toBeVisible();
  await expect(page.getByText(/sign in to start/i)).toHaveCount(0);
  await expect(page.getByText(/authentication is required/i)).toHaveCount(0);
});

test("the short public lesson is an honest two-step session", async ({ page }) => {
  await page.goto("/demo?mode=short");

  await expect(page.getByText("About 2 minutes · 2 steps", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "0 of 2 questions complete" })).toBeVisible();

  await page.getByRole("button", { name: "Try this question" }).click();
  await page.getByRole("button", { name: /my name is jamie/i }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Try this question" }).click();
  await page.getByLabel("Your answer").fill("ai");
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Finish lesson" }).click();

  await expect(page.getByRole("heading", { name: "Lesson finished" })).toBeVisible();

  await page.goto("/demo");
  await expect(page.getByText("About 10 minutes · 7 steps", { exact: true })).toBeVisible();
});
