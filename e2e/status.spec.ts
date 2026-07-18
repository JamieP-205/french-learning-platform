import { expect, test } from "./fixtures";

test("public status page explains current public readiness", async ({ page }) => {
  await page.goto("/status");

  await expect(page.getByRole("heading", { name: "What you can use today." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Learning without an account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Accounts", exact: true })).toBeVisible();
  await expect(page.getByText("Still growing", { exact: true })).toBeVisible();
});
