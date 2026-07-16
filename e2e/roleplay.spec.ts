import { expect, test } from "./fixtures";

test("roleplay gives deterministic register feedback", async ({ page }) => {
  await page.goto("/roleplay");
  await expect(page.getByRole("heading", { name: /practise the social judgement/i })).toBeVisible();
  const firstScoredChoice = page.getByRole("button", { name: /Bonjour, je voudrais un café/i });
  await expect(page.getByRole("heading", { name: "Learn this first" })).toBeVisible();
  await expect(firstScoredChoice).toHaveCount(0);
  await page.getByRole("button", { name: "Start roleplay" }).click();
  await expect(firstScoredChoice).toBeVisible();
  await page.getByRole("button", { name: /Bonjour, je voudrais un café/i }).click();
  await expect(page.getByText(/best choice/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "C'est combien ?" })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue roleplay" }).click();
  await page.getByRole("button", { name: "C'est combien ?" }).click();
  await expect(page.getByText(/short and normal/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Merci, bonne journée/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue roleplay" }).click();
  await page.getByRole("button", { name: /Merci, bonne journée/i }).click();
  await expect(page.getByRole("heading", { name: /ready for the real exchange/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue roleplay" }).click();
  await expect(page.getByText(/ready for the real exchange/i)).toBeVisible();
});

test("roleplay keeps recast and self-report escape visible until the learner continues", async ({ page }) => {
  await page.goto("/roleplay");
  await page.getByRole("button", { name: "Start roleplay" }).click();

  await page.getByRole("button", { name: "Je veux un café." }).click();
  await expect(page.getByText("Almost — try once more", { exact: true })).toBeVisible();
  await expect(page.getByText(/Bonjour, je voudrais un café, s'il vous plaît\./i)).toHaveCount(0);
  await expect(page.getByText("Je voudrais un café, s'il vous plaît.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByRole("button", { name: "Je veux un café." }).click();
  await expect(page.getByText(/correct answer: bonjour, je voudrais un café/i)).toBeVisible();
  await expect(page.getByText("Je voudrais un café, s'il vous plaît.", { exact: true })).toBeVisible();
  await expect(page.getByText(/rule:/i)).toBeVisible();
  await page.waitForTimeout(1_600);
  await expect(page.getByText(/correct answer: bonjour, je voudrais un café/i)).toBeVisible();
  await page.getByRole("button", { name: "Continue roleplay" }).click();

  await page.getByRole("button", { name: "Combien café ?" }).click();
  await page.getByRole("button", { name: "Show me the answer" }).click();
  await expect(page.getByText(/shown as self-report evidence with no score credit/i)).toBeVisible();
  await page.waitForTimeout(1_600);
  await expect(page.getByText(/shown as self-report evidence with no score credit/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue roleplay" })).toBeVisible();
});
