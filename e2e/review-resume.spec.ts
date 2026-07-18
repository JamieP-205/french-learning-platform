import { expect, test } from "./fixtures";

test("an unfinished focused review is labelled and resumed explicitly", async ({ page }) => {
  await page.route("**/api/review/due", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        activeSessionId: "focused-review-session",
        reviews: [{
          id: "review-age",
          userId: "review-resume-learner",
          contentItemId: "content-age",
          activityId: "act-age-typing-v1",
          ruleId: "rule-age-avoir-v1",
          prompt: "Write your age",
          expectedAnswers: [{ value: "J'ai 20 ans." }],
          stage: 0,
          dueAt: new Date(0).toISOString(),
          successCount: 0,
          failureCount: 1,
          priority: 2,
        }],
      }),
    }),
  );
  await page.route("**/api/progress", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ progress: {} }),
    }),
  );

  let startPayload: Record<string, unknown> | undefined;
  await page.route("**/api/session/start", async (route) => {
    startPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ session: { id: "focused-review-session" } }),
    });
  });

  await page.goto("/review");

  await expect(page.getByRole("heading", { name: "Your focused review is ready to continue" })).toBeVisible();
  await page.getByRole("button", { name: "Resume focused review" }).click();

  await expect(page).toHaveURL(/\/lesson\/focused-review-session$/);
  expect(startPayload).toMatchObject({
    focus: "review",
    resumeSessionId: "focused-review-session",
  });
  expect(startPayload?.requestId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});
