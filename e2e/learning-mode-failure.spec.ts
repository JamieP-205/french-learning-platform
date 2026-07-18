import { expect, test } from "./fixtures";

test("an unknown learning mode never falls back to browser-only account data", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("bonjour:public-demo-progress-v1", JSON.stringify({
      sessionsCompleted: 99,
      preferences: { displayName: "Local learner" },
    }));
  });
  await page.route("**/api/learning-mode", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporarily unavailable." }),
    }),
  );

  await page.goto("/settings");

  await expect(page.getByRole("alert").filter({
    hasText: /couldn't confirm where to save your learning/i,
  })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personalise your learning plan." })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Export or reset browser-only progress." })).toHaveCount(0);
});

test("account settings keep browser-only progress visibly separate", async ({ page }) => {
  let accountDeletionCalls = 0;
  await page.addInitScript(() => {
    window.localStorage.setItem("bonjour:public-demo-progress-v1", JSON.stringify({
      sessionsCompleted: 4,
      attemptsCount: 11,
      mistakePrompts: [],
      topicPreviewStats: {},
      skillSignals: {},
      activeDates: [],
      preferences: { displayName: "Browser learner" },
    }));
  });
  await page.route("**/api/learning-mode", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "account", developmentDemo: false }),
    }),
  );
  await page.route("**/api/profile", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          userId: "11111111-1111-4111-8111-111111111111",
          displayName: "Account learner",
          currentLevel: "A1",
          learningGoals: ["travel"],
          interests: [],
          dailyMinutes: 8,
          preferredMode: "normal",
          focusPreferences: [],
          speakingConfidence: "medium",
          policyVersion: "test",
          completedSessions: 2,
          currentStreak: 1,
        },
      }),
    }),
  );
  await page.route("**/api/privacy/delete", (route) => {
    accountDeletionCalls += 1;
    return route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Change your learning plan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personalise your learning plan." })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Export or reset browser-only progress." })).toBeVisible();
  await expect(page.getByText("4", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Reset data on this device" }).click();
  await page.getByRole("button", { name: "Confirm reset device data" }).click();

  await expect(page.getByLabel("Name")).toHaveValue("Account learner");
  await expect(page.getByText("Data saved only on this device has been reset.")).toBeVisible();
  expect(accountDeletionCalls).toBe(0);
});
