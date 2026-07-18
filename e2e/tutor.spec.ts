import { expect, test } from "./fixtures";

test("public tutor gives source-bound help without account chat", async ({ page }) => {
  await page.goto("/tutor");

  await expect(page.getByRole("heading", { name: "Ask why an answer was right or wrong." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This tutor works inside your lesson." })).toBeVisible();

  await page.getByText(/Why is .*Je suis 20 ans.* wrong/).click();
  await expect(page.getByRole("heading", { name: "French uses avoir for age." })).toBeVisible();
  await expect(page.getByText(/J.ai 20 ans/)).toBeVisible();

  await page.getByText("How do I order without sounding blunt?").click();
  await expect(page.getByRole("heading", { name: /Use je voudrais/i })).toBeVisible();
  await expect(page.getByText(/je voudrais un caf/i)).toBeVisible();
});
