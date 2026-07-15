import { expect, test } from "@playwright/test";

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
    .toBe(progressBeforeFirstMiss);

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
  await expect(page.getByText("Public local progress")).toBeVisible();
  await expect(page.getByText(/adaptive loop unlocked/i)).toBeVisible();
  await expect(page.getByText(/start with the thing that tripped you up/i)).toBeVisible();

  await page.goto("/review");
  await expect(page.getByText("Public local review")).toBeVisible();
  await expect(page.getByRole("heading", { name: /review target ready/i })).toBeVisible();
  await expect(page.getByText(/sign in to load reviews/i)).toHaveCount(0);
  await expect(page.getByText(/authentication is required/i)).toHaveCount(0);

  await page.goto("/today");
  await expect(page.getByText("Public learner mode")).toBeVisible();
  await expect(page.getByText(/sign in to start/i)).toHaveCount(0);
  await expect(page.getByText(/authentication is required/i)).toHaveCount(0);
});
