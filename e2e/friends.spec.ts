import { expect, test } from "./fixtures";

test("friends page exposes friend code and safe social controls", async ({ page }) => {
  await page.goto("/friends");
  await expect(page.getByRole("heading", { name: /learn beside someone/i })).toBeVisible();
  await expect(page.getByText(/your friend code/i)).toBeVisible();
  await expect(page.getByLabel("Add by friend code")).toBeVisible();
  await expect(page.getByRole("button", { name: /send request/i })).toBeDisabled();
  await expect(page.getByText(/no friends added yet/i)).toBeVisible();
});
