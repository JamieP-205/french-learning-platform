import { expect, test } from "./fixtures";

test("public status page explains current public readiness", async ({ page }) => {
  await page.goto("/status");

  await expect(page.getByRole("heading", { name: /public learning is open/i })).toBeVisible();
  await expect(page.getByText("Public browser learning")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Account sync" })).toBeVisible();
  await expect(page.getByText("Still growing", { exact: true })).toBeVisible();
});
