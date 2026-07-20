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

test("the theme toggle switches to lantern light and the choice survives a reload", async ({ page }) => {
  await page.goto("/today");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();

  const bodyColors = await page.evaluate(() => {
    const styles = getComputedStyle(document.body);
    return { background: styles.backgroundColor, text: styles.color };
  });
  expect(bodyColors.background).toBe("rgb(21, 29, 43)");
  expect(bodyColors.text).toBe("rgb(236, 229, 211)");
});

test("the simplified landing page has no horizontal overflow on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator("a.button-primary")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Introduce yourself" })).toBeVisible();
  const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});
