import { expect, test } from "./fixtures";

test("privacy controls explain when a fresh password check is required", async ({ page }) => {
  await page.route("**/api/privacy/export", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "Sign in again before exporting your learning data." }),
    }),
  );
  await page.route("**/api/privacy/delete", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "Sign in again before deleting your learning data." }),
    }),
  );

  await page.goto("/privacy");
  await page.getByRole("button", { name: "Export my data" }).click();

  await expect(page.getByRole("alert").filter({
    hasText: "Sign in again before exporting your learning data.",
  })).toHaveText("Sign in again before exporting your learning data.");
  await expect(page.getByRole("link", { name: "Sign in again" })).toHaveAttribute(
    "href",
    "/auth/sign-in?reauth=1&redirectTo=/privacy",
  );

  await page.getByRole("button", { name: "Delete my learner data" }).click();
  await page.getByRole("button", { name: "Yes, delete my learner data" }).click();

  await expect(page.getByRole("alert").filter({
    hasText: "Sign in again before deleting your learning data.",
  })).toHaveText("Sign in again before deleting your learning data.");
});
