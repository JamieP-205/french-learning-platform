import { expect, test } from "./fixtures";

test("the optional A1 check never overwrites a learner's selected level", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByLabel(/what should we call you/i).fill("Alex");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "travel", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Current French level").selectOption("B2");
  await page.getByRole("button", { name: /take a 60-second check/i }).click();
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: "Show answer without placement credit" }).click();
    await page.getByRole("button", { name: "Continue placement check" }).click();
  }

  await expect(page.getByLabel("Current French level")).toHaveValue("B2");
  await expect(page.getByText(/your selection remains B2/i)).toBeVisible();
  await expect(page.getByText(/never changes your selected level automatically/i)).toBeVisible();
});
