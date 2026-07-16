import { expect, test } from "./fixtures";

test("development learner completes the mission with guarded tutor feedback", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByLabel(/what should we call you/i).fill("Jamie");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "travel", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/13 or older/i).check();
  await page.getByLabel(/privacy notice/i).check();
  await page.getByRole("button", { name: "Build my first session" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("dialog", { name: /quick app tour/i })).toHaveCount(0);

  await page.getByRole("button", { name: /start 10-minute session/i }).click();
  await expect(page).toHaveURL(/\/lesson\//);

  const firstScoredAnswer = page.getByRole("button", { name: /my name is jamie/i });
  await expect(firstScoredAnswer).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Learn this first" })).toBeVisible();
  await expect(page.getByText("My name is Jamie.", { exact: true })).toBeVisible();
  await expect(page.getByText(/use it to introduce yourself/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "J'ai 20 ans.", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Try this question" }).click();
  await expect(page.getByRole("button", { name: /my name is jamie/i })).toBeVisible();
  const firstPrompt = page.getByRole("heading", { name: /what does.*je m'appelle jamie.*mean/i });
  await expect(firstPrompt.locator('[lang="fr"]')).toHaveText("Je m'appelle Jamie");
  await page.route("**/api/activity/submit", (route) => route.abort("failed"), { times: 1 });
  await page.getByRole("button", { name: /my name is jamie/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: /couldn’t save that answer/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /my name is jamie/i })).toBeEnabled();
  await page.getByRole("button", { name: /my name is jamie/i }).click();
  await expect(page.getByText("Correct", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "J'ai 20 ans.", exact: true })).toBeVisible();
  await expect(page.getByLabel("Your answer")).toHaveCount(0);
  await page.getByRole("button", { name: "Try this question" }).click();
  await page.getByLabel("Your answer").fill("ai");
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const progressBeforeEscape = await page.evaluate(async () => (await fetch("/api/progress")).json());
  await page.getByLabel("Your answer").fill("Je suis 20 ans");
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Try once more", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your answer")).toHaveValue("Je suis 20 ans");
  await expect(page.getByText(/j'ai 20 ans/i)).toHaveCount(0);
  await expect(page.getByText(/French uses avoir for age/i)).toHaveCount(0);
  await expect(page.getByText("Tutor note").or(page.getByRole("button", { name: "More explanation" }))).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show me the answer" })).toBeVisible();

  const escapeResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/activity/submit") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Show me the answer" }).click();
  const escapePayload = await (await escapeResponsePromise).json();
  expect(escapePayload.attempt).toMatchObject({
    completed: true,
    correct: false,
    evidenceKind: "self-report",
    result: { isCorrect: false, shouldCreateReview: false },
  });
  await expect(page.getByText("Here’s the answer", { exact: true })).toBeVisible();
  await expect(page.getByText("J'ai 20 ans.", { exact: true })).toBeVisible();
  await expect(page.getByText(/French expresses age with avoir/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Show me the answer" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  const progressAfterEscape = await page.evaluate(async () => (await fetch("/api/progress")).json());
  expect({
    attemptsCount: progressAfterEscape.progress.attemptsCount,
    phrasesLearned: progressAfterEscape.progress.phrasesLearned,
    reviewsDue: progressAfterEscape.progress.reviewsDue,
    nextReviewAt: progressAfterEscape.progress.nextReviewAt,
    mistakesFixed: progressAfterEscape.progress.mistakesFixed,
    sessionsCompleted: progressAfterEscape.progress.sessionsCompleted,
    currentStreak: progressAfterEscape.progress.currentStreak,
  }).toEqual({
    attemptsCount: progressBeforeEscape.progress.attemptsCount,
    phrasesLearned: progressBeforeEscape.progress.phrasesLearned,
    reviewsDue: progressBeforeEscape.progress.reviewsDue,
    nextReviewAt: progressBeforeEscape.progress.nextReviewAt,
    mistakesFixed: progressBeforeEscape.progress.mistakesFixed,
    sessionsCompleted: progressBeforeEscape.progress.sessionsCompleted,
    currentStreak: progressBeforeEscape.progress.currentStreak,
  });
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
  await expect(page.getByRole("button", { name: "See your progress" })).toBeVisible();
  await page.getByRole("button", { name: "See your progress" }).click();
  await expect(page).toHaveURL(/\/progress\?complete=1$/);
  await expect(page.getByRole("heading", { name: /your learning evidence/i })).toBeVisible();

  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Nothing due right now" })).toBeVisible();
});

test("landing remains usable at a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /speak useful french/i })).toBeVisible();
  await page.getByRole("link", { name: /start a free 10-minute lesson/i }).focus();
  await expect(page.getByRole("link", { name: /start a free 10-minute lesson/i })).toBeFocused();
});

test("mobile navigation keeps three core destinations and a More menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/today");

  const navigation = page.getByRole("navigation", { name: "Primary" });
  await expect(navigation).toBeVisible();
  await expect(navigation.locator(":scope > a")).toHaveCount(3);
  await expect(navigation.getByRole("link", { name: "Today", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Learn", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Progress", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Review", exact: true })).toHaveCount(0);

  await navigation.locator("summary").click();
  await expect(navigation.getByRole("link", { name: "Review", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Friends", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Tutor", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
});

