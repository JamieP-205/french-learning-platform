import { expect, test } from "./fixtures";

test("development learner completes the mission with guarded tutor feedback", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByLabel(/what should we call you/i).fill("Jamie");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "travel", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Current French level")).toHaveValue("A1");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "music", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Daily time").selectOption("8");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/13 or older/i).check();
  await page.getByLabel(/privacy notice/i).check();
  await page.getByRole("button", { name: "Build my first session" }).click();
  await expect(page).toHaveURL(/\/today\?tour=1$/);
  await expect(page.getByRole("dialog", { name: /quick app tour/i })).toBeVisible();
  await page.getByRole("button", { name: "Skip tour" }).click();

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
  let interruptedRequestId: string | undefined;
  await page.route("**/api/activity/submit", (route) => {
    interruptedRequestId = route.request().postDataJSON().requestId;
    return route.abort("failed");
  }, { times: 1 });
  await page.getByRole("button", { name: /my name is jamie/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: /couldn’t save that answer/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /my name is jamie/i })).toBeEnabled();
  const retryResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/activity/submit") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /my name is jamie/i }).click();
  expect((await retryResponse).request().postDataJSON().requestId).toBe(interruptedRequestId);
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
  const progressAfterMiss = await page.evaluate(async () => (await fetch("/api/progress")).json());
  expect(progressAfterMiss.progress.attemptsCount).toBe(progressBeforeEscape.progress.attemptsCount + 1);
  expect(progressBeforeEscape.progress.nextReviewAt).toBeUndefined();
  expect(progressAfterMiss.progress.nextReviewAt).toEqual(expect.any(String));

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
    mistakesFixed: progressAfterEscape.progress.mistakesFixed,
    sessionsCompleted: progressAfterEscape.progress.sessionsCompleted,
    currentStreak: progressAfterEscape.progress.currentStreak,
  }).toEqual({
    attemptsCount: progressAfterMiss.progress.attemptsCount,
    phrasesLearned: progressAfterMiss.progress.phrasesLearned,
    reviewsDue: progressAfterMiss.progress.reviewsDue,
    mistakesFixed: progressAfterMiss.progress.mistakesFixed,
    sessionsCompleted: progressAfterMiss.progress.sessionsCompleted,
    currentStreak: progressAfterMiss.progress.currentStreak,
  });
  expect(progressAfterEscape.progress.nextReviewAt).toBe(progressAfterMiss.progress.nextReviewAt);
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
  await expect(page.getByRole("dialog", { name: /real step|real piece of progress/i })).toBeVisible();
  await page.getByRole("button", { name: "See what grew" }).click();
  await expect(page).toHaveURL(/\/progress\?complete=1$/);
  await expect(page.getByRole("heading", { name: "Your progress.", exact: true })).toBeVisible();

  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Nothing due right now" })).toBeVisible();
});

test("landing remains usable at a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /speak useful french/i })).toBeVisible();
  await page.getByRole("link", { name: /pick up where you left off/i }).focus();
  await expect(page.getByRole("link", { name: /pick up where you left off/i })).toBeFocused();
});

test("mobile navigation keeps five labelled tabs with review in the bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/today");

  const navigation = page.getByRole("navigation", { name: "Primary" });
  await expect(navigation).toBeVisible();
  await expect(navigation.locator(":scope > a")).toHaveCount(4);
  await expect(navigation.getByRole("link", { name: "Today", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Learn", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Review", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Progress", exact: true })).toBeVisible();

  const moreButton = navigation.getByRole("button", { name: "More" });
  await expect(moreButton).toHaveAttribute("aria-expanded", "false");
  await moreButton.click();
  await expect(moreButton).toHaveAttribute("aria-expanded", "true");
  await expect(navigation.getByRole("link", { name: "Friends", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Tutor", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Settings", exact: true })).toBeVisible();

  await page.getByRole("heading", { name: /your french for today/i }).click();
  await expect(moreButton).toHaveAttribute("aria-expanded", "false");
  await expect(navigation.getByRole("link", { name: "Settings", exact: true })).toHaveCount(0);
});

