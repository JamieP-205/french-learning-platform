import { expect, test } from "./fixtures";

test("landing page has one clear way to begin the first lesson", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Speak useful French, one short lesson at a time." }),
  ).toBeVisible();

  const lessonCta = page.getByRole("link", { name: "Start a free 10-minute lesson", exact: true });
  await expect(lessonCta).toBeVisible();
  await expect(lessonCta).toHaveAttribute("href", "/demo");
  await expect(page.locator("a.button-primary")).toHaveCount(1);

  const accountStatus = page.getByRole("link", { name: "Account availability", exact: true });
  await expect(accountStatus).toBeVisible();
  await expect(accountStatus).toHaveAttribute("href", "/status");
  await expect(accountStatus).not.toHaveClass(/button-primary|button-secondary/);

  await expect(
    page.getByRole("link", {
      name: /public status|preview (?:the )?first mission|start without account|open review|review with an account|see today|today with an account/i,
    }),
  ).toHaveCount(0);
});
