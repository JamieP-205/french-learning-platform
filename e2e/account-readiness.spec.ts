import { expect, test } from "@playwright/test";

test("account sync fails closed while production email delivery is unverified", async ({ page }) => {
  await page.goto("/status");

  const accountCard = page.getByRole("heading", { name: "Account sync", exact: true }).locator("..");
  await expect(accountCard.getByText("Setup required", { exact: true })).toBeVisible();
  await expect(accountCard).toContainText(/not publicly available until confirmation emails/i);
  await expect(accountCard.getByRole("link", { name: "Continue without an account" })).toHaveAttribute("href", "/demo");

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Account sync status" })).toHaveAttribute("href", "/status");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
});
