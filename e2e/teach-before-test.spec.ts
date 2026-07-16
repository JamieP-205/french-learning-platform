import { expect, test } from "./fixtures";

test("a fresh learner sees one just-in-time concept before each scored question", async ({ page }) => {
  await page.goto("/demo");

  await expect(page.getByText("Lesson 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Introduce yourself", exact: true })).toBeVisible();

  const firstScoredAnswer = page.getByRole("button", { name: /my name is jamie/i });
  await expect(firstScoredAnswer).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Learn this first", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Je m'appelle Jamie.", exact: true })).toHaveAttribute("lang", "fr");

  await expect(page.getByText("My name is Jamie.", { exact: true })).toBeVisible();
  await expect(page.getByText(/use it to introduce yourself in an everyday neutral conversation/i)).toBeVisible();
  const wordBreakdown = page.getByText("Word by word", { exact: true }).locator("..");
  await expect(wordBreakdown).toContainText("m'");
  await expect(wordBreakdown).toContainText("myself");
  await expect(wordBreakdown).toContainText("appelle");
  await expect(wordBreakdown).toContainText("call");

  // Later concepts must not be dumped onto the learner before question one.
  await expect(page.getByRole("heading", { name: "J'ai 20 ans.", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Je viens de Belfast.", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /aujourd'hui/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Moi, c'est Jamie.", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Try this question", exact: true }).click();
  await expect(page.getByTestId("lesson-step")).toBeFocused();
  await expect(firstScoredAnswer).toBeVisible();
  const firstPrompt = page.getByRole("heading", { name: /what does.*je m'appelle jamie.*mean/i });
  await expect(firstPrompt.locator('[lang="fr"]')).toHaveText("Je m'appelle Jamie");
  await expect(page.getByRole("heading", { name: "Learn this first", exact: true })).toHaveCount(0);

  await firstScoredAnswer.click();
  await expect(page.getByText("Correct", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("lesson-step")).toBeFocused();

  // The next concept arrives only when the learner reaches the age question.
  await expect(page.getByRole("heading", { name: "Learn this first", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "J'ai 20 ans.", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /fill the gap/i })).toHaveCount(0);
  await expect(page.getByLabel("Your answer")).toHaveCount(0);

  await page.getByRole("button", { name: "Try this question", exact: true }).click();
  await expect(page.getByRole("heading", { name: /fill the gap/i })).toBeVisible();
  await expect(page.getByLabel("Your answer")).toBeVisible();
});
