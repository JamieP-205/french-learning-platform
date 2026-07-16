import { expect, test } from "./fixtures";

test("no-account learner preferences personalize the public path", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: /your learning controls/i })).toBeVisible();

  await page.getByLabel("Name").fill("Sam");
  await page.getByLabel("Current level").selectOption("B1");
  await page.getByLabel("Main goal").selectOption("work");
  await page.getByLabel("Daily minutes").fill("12");
  await page.getByLabel("Session feel").selectOption("low");
  await page.getByRole("button", { name: "Save local setup" }).click();
  await expect(page.getByText(/saved/i)).toBeVisible();

  await page.goto("/today");
  await expect(page.getByText(/Calibrate your B1 French safely/i)).toBeVisible();
  await expect(page.getByText(/B1 · work · 12 min/i)).toBeVisible();
  await expect(page.getByText("Adaptive plan")).toBeVisible();
  await expect(page.getByText("Work basics")).toBeVisible();

  await page.goto("/progress");
  await expect(page.getByText(/B1 · work · 12 min/i)).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText("Browser progress", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset browser progress" }).click();
  await expect(page.getByText(/click reset once more/i)).toBeVisible();
  await page.getByRole("button", { name: "Confirm reset browser progress" }).click();
  await expect(page.getByText("Browser-only progress has been reset.")).toBeVisible();
});
