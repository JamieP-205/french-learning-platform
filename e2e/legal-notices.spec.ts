import { expect, test } from "./fixtures";

test("privacy and terms notices are publicly reachable", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /clear choices/i })).toBeVisible();
  await expect(page.locator("main").getByText(/no-account demo/i)).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: /use the app as a learning tool/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Exercises use reviewed answers." })).toBeVisible();
  await expect(page.getByText(/tutor responses never become course material automatically/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /bundled french audio uses an attributed open dataset/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute(
    "href",
    "https://creativecommons.org/licenses/by/4.0/",
  );
});
