import { expect, test } from "./fixtures";

test("the first lesson makes learn, answer and feedback stages explicit", async ({ page }) => {
  await page.goto("/demo");

  const stageList = page.getByRole("list", { name: "Current step" });
  const progress = page.getByRole("progressbar", { name: "0 of 7 questions complete" });

  await expect(page.getByText("Step 1 of 7", { exact: true })).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await expect(stageList.locator('[aria-current="step"]')).toHaveText("1. Learn");
  await expect(page.getByText(/the question comes next/i)).toBeVisible();
  await expect(page.getByText(/^What to do:/)).toHaveCount(0);

  await page.getByRole("button", { name: "Try this question" }).click();

  await expect(stageList.locator('[aria-current="step"]')).toHaveText("2. Answer");
  await expect(page.getByText(/What to do: Choose the one answer/i)).toBeVisible();
  await page.getByRole("button", { name: /my name is jamie/i }).click();

  await expect(stageList.locator('[aria-current="step"]')).toHaveText("3. Feedback");
  await expect(page.getByRole("progressbar", { name: "1 of 7 questions complete" })).toHaveAttribute(
    "aria-valuenow",
    "14",
  );
  await expect(page.getByText("Correct", { exact: true })).toBeVisible();
});

test("the simplified landing page has no horizontal overflow on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator("a.button-primary")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Introduce yourself" })).toBeVisible();
  const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});
