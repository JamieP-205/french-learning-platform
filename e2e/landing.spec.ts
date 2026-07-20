import { expect, test as signedOutTest } from "@playwright/test";
import { expect as expectWithLearner, test as learnerTest } from "./fixtures";

// The raw Playwright test carries no dev-learner cookie, so the landing page
// renders its public signed-out view.
signedOutTest("landing page has one clear way to begin the first lesson", async ({ page }) => {
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

learnerTest("landing recognises a signed-in learner and points them at Today", async ({ page }) => {
  await page.goto("/");

  const continueLink = page.getByRole("link", { name: "Continue to Today", exact: true });
  await expectWithLearner(continueLink).toBeVisible();
  await expectWithLearner(continueLink).toHaveAttribute("href", "/today");

  const resumeCta = page.getByRole("link", { name: "Pick up where you left off", exact: true });
  await expectWithLearner(resumeCta).toBeVisible();
  await expectWithLearner(resumeCta).toHaveAttribute("href", "/today");
  await expectWithLearner(page.locator("a.button-primary")).toHaveCount(1);

  await expectWithLearner(page.getByRole("link", { name: "Start a free 10-minute lesson" })).toHaveCount(0);
  await expectWithLearner(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
});
