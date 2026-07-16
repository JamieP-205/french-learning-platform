import { expect, test } from "./fixtures";
import { localLearningStorageKey } from "../lib/local-learning/progress";

test("an unverified speech self-check creates no local learning evidence", async ({ page }) => {
  await page.goto("/demo");

  const firstScoredAnswer = page.getByRole("button", { name: /my name is jamie/i });
  await expect(page.getByRole("heading", { name: "Learn this first" })).toBeVisible();
  await expect(firstScoredAnswer).toHaveCount(0);
  await page.getByRole("button", { name: "Try this question" }).click();
  await expect(firstScoredAnswer).toBeVisible();
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

  await page.getByLabel("Your answer").fill("Je m'appelle Jamie");
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const progressBeforeSpeech = await page.evaluate((key) => window.localStorage.getItem(key), localLearningStorageKey);
  await page.getByRole("button", { name: "Try this question" }).click();
  await page.getByRole("button", { name: "I did the speaking self-check" }).click();

  await expect(page.getByText("Practice saved", { exact: true })).toBeVisible();
  await expect(page.getByText("This self-check does not affect your progress.", { exact: true })).toBeVisible();
  await expect(page.getByText(/mastery credit/i)).toHaveCount(0);
  await expect(page.getByText(/correct answer:/i)).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), localLearningStorageKey))
    .toBe(progressBeforeSpeech);
});
