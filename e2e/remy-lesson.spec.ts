import { expect, test } from "./fixtures";

// Reaches the first scored question of a fresh session, answers wrongly, and
// checks Remy's help contract: he asks first, restates only taught material,
// never shows the answer, and respects both Not now and the quiet setting.

async function reachFirstScoredQuestion(page: import("@playwright/test").Page) {
  await page.goto("/onboarding");
  await page.getByLabel(/what should we call you/i).fill("Robin");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "travel", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/13 or older/i).check();
  await page.getByLabel(/privacy notice/i).check();
  await page.getByRole("button", { name: "Build my first session" }).click();
  await expect(page).toHaveURL(/\/today\?tour=1$/);
  await page.getByRole("button", { name: "Skip tour" }).click();

  await page.getByRole("button", { name: /start 10-minute session/i }).click();
  await expect(page).toHaveURL(/\/lesson\//);
  await page.getByRole("button", { name: "Try this question" }).click();
}

test("Remy asks before helping and never reveals the answer", async ({ page }) => {
  await reachFirstScoredQuestion(page);

  await expect(page.getByRole("complementary", { name: "Remy offers help" })).toHaveCount(0);

  await page.getByRole("button", { name: "I like Jamie.", exact: true }).click();
  const remy = page.getByRole("complementary", { name: "Remy offers help" });
  await expect(remy.getByText("Want a hint from Remy?")).toBeVisible();

  await remy.getByRole("button", { name: "Yes, help me" }).click();
  await expect(remy.getByText(/the pattern/i)).toBeVisible();
  await expect(remy.getByText("My name is Jamie.", { exact: true })).toHaveCount(0);

  await remy.getByRole("button", { name: "Another nudge" }).click();
  await expect(remy.getByText(/say it like/i)).toBeVisible();
  await expect(remy.getByRole("link", { name: "Practise a real exchange" })).toHaveAttribute("href", "/roleplay");
  await expect(remy.getByText("My name is Jamie.", { exact: true })).toHaveCount(0);

  await remy.getByRole("button", { name: "Merci, Remy" }).click();
  await expect(page.getByRole("complementary", { name: "Remy offers help" })).toHaveCount(0);

  await page.getByRole("button", { name: /my name is jamie/i }).click();
  await expect(page.getByText("Correct", { exact: true })).toBeVisible();
});

test("the quiet setting keeps Remy from offering at all", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("french-for-life:companion-quiet:v1", "true");
  });
  await reachFirstScoredQuestion(page);

  await page.getByRole("button", { name: "I like Jamie.", exact: true }).click();
  await expect(page.getByText(/almost/i).first()).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Remy offers help" })).toHaveCount(0);
});
