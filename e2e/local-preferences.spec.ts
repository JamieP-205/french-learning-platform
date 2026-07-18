import { expect, test } from "./fixtures";

test("no-account learner preferences personalize the public path", async ({ page }) => {
  await page.goto("/settings?mode=local");
  await expect(page.getByRole("heading", { name: /your profile and learning controls/i })).toBeVisible();

  await page.getByLabel("Name").fill("Sam");
  await page.getByLabel("Current level").selectOption("B1");
  await page.getByLabel("Main goal").selectOption("work");
  await page.getByLabel("Daily minutes").fill("12");
  await page.getByLabel("Session feel").selectOption("low");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText(/today and progress now use these settings/i)).toBeVisible();

  await page.goto("/today");
  await expect(page.getByRole("heading", {
    level: 2,
    name: "Use the A1 introduction as a foundation check.",
    exact: true,
  })).toBeVisible();
  await expect(page.getByText(/B1 · work · 12 min/i)).toBeVisible();
  await expect(page.getByText("Today's plan", { exact: true })).toBeVisible();
  await expect(page.getByText("Work basics")).toBeVisible();

  await page.goto("/progress");
  await expect(page.getByText(/B1 · work · 12 min/i)).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Export or reset browser-only progress." })).toBeVisible();
  await page.getByRole("button", { name: "Reset data on this device" }).click();
  await expect(page.getByText(/clears every lesson attempt/i)).toBeVisible();
  await page.getByRole("button", { name: "Confirm reset device data" }).click();
  await expect(page.getByText("Data saved only on this device has been reset.")).toBeVisible();
});
