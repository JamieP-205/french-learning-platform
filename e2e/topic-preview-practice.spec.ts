import { expect, test } from "./fixtures";

test("practice preview self-checks feed the local adaptive path", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/learn/cafe-food");
  await expect(page.getByRole("heading", { name: /cafe and food/i })).toBeVisible();
  await expect(page.getByText("Preview practice", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Learn this first" })).toBeVisible();
  await expect(page.getByLabel("Your answer")).toHaveCount(0);
  await page.getByRole("button", { name: "Start preview check" }).click();
  await expect(page.getByLabel("Your answer")).toBeVisible();

  await page.getByLabel("Your answer").fill("Je veux un café");
  await page.getByRole("button", { name: "Check preview answer" }).click();
  await expect(page.getByTestId("preview-practice-feedback")).toContainText(/almost.*try once more/i);
  await expect(page.getByTestId("preview-practice-answer")).toHaveCount(0);
  await expect(page.getByText(/Je voudrais un café, s'il vous plaît\./i)).toHaveCount(0);
  await expect(page.getByTestId("preview-practice-review-count")).toHaveText("0");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show me the answer" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByLabel("Your answer").fill("Je veux un café");
  await page.getByRole("button", { name: "Check preview answer" }).click();
  await expect(page.getByText("Added to Review.")).toBeVisible();
  await expect(page.getByTestId("preview-practice-answer")).toContainText("Je voudrais");
  await expect(page.getByTestId("preview-practice-review-count")).toHaveText("1");

  await page.reload();
  await expect(page.getByTestId("preview-practice-review-count")).toHaveText("1");
  expect(browserErrors.filter((error) => /hydration|server rendered HTML/i.test(error))).toEqual([]);

  await page.goto("/progress");
  await expect(page.getByText("Preview practice")).toBeVisible();
  await expect(page.getByText(/cafe food/i)).toBeVisible();
  await expect(page.getByText(/0 confident .* 1 to revisit/i)).toBeVisible();
  await expect(page.getByText("Preview recall")).toBeVisible();

  await page.goto("/review");
  await expect(page.getByRole("heading", { name: /1 item ready to review/i })).toBeVisible();
  await expect(page.getByText("Preview phrases to revisit")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Learn this first" })).toHaveCount(0);
  await expect(page.getByText(/Je voudrais un café, s'il vous plaît\./i)).toHaveCount(0);
  await expect(page.getByLabel("Your answer")).toBeVisible();
  await page.getByLabel("Your answer").fill("Je voudrais un café, s'il vous plaît.");
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByRole("status")).toContainText(/completed in this review session/i);
  await expect(page.getByRole("status")).toContainText(/safer café phrase/i);

  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Begin with the introduction lesson." })).toBeVisible();
});
