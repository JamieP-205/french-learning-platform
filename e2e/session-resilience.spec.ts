import { expect, test } from "./fixtures";

type ApiSession = {
  id: string;
  completedAt?: string;
  currentIndex: number;
  plan: {
    activities: { activity: { id: string; type: string } }[];
  };
};

const correctAnswers: Record<string, string> = {
  "act-name-meaning-v1": "a",
  "act-age-fill-v1": "ai",
  "act-speak-repeat-v1": "completed",
};

test("a completed lesson reopens with its saved stats and can restart", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  const malformedOnboarding = await page.request.post("/api/onboarding/complete", {
    data: "{",
    headers: { "Content-Type": "application/json" },
  });
  expect(malformedOnboarding.status()).toBe(400);

  const onboarding = await page.request.post("/api/onboarding/complete", {
    data: {
      displayName: "Session tester",
      currentLevel: "A1",
      learningGoals: ["travel"],
      interests: [],
      dailyMinutes: 3,
      preferredMode: "short",
      focusPreferences: [],
      speakingConfidence: "medium",
      ageConfirmed: true,
      acceptedRequiredPolicies: true,
    },
  });
  expect(onboarding.ok()).toBeTruthy();

  const malformedProfile = await page.request.patch("/api/profile", {
    data: "{",
    headers: { "Content-Type": "application/json" },
  });
  expect(malformedProfile.status()).toBe(400);

  const malformedStart = await page.request.post("/api/session/start", {
    data: "{",
    headers: { "Content-Type": "application/json" },
  });
  expect(malformedStart.status()).toBe(400);

  const start = await page.request.post("/api/session/start", {
    data: { requestId: crypto.randomUUID(), mode: "short" },
  });
  expect(start.status()).toBe(201);
  let session = (await start.json()).session as ApiSession;
  const completedSessionId = session.id;

  const implicitResume = await page.request.post("/api/session/start", {
    data: { requestId: crypto.randomUUID(), mode: "short" },
  });
  expect(implicitResume.status()).toBe(200);
  expect(((await implicitResume.json()).session as ApiSession).id).toBe(completedSessionId);

  while (!session.completedAt) {
    const activity = session.plan.activities[session.currentIndex]?.activity;
    expect(activity).toBeDefined();
    const answer = correctAnswers[activity.id];
    expect(answer).toBeDefined();
    const submit = await page.request.post("/api/activity/submit", {
      data: {
        requestId: crypto.randomUUID(),
        sessionId: session.id,
        activityId: activity.id,
        submittedAnswer: answer,
        latencyMs: 1_500 + session.currentIndex * 500,
      },
    });
    expect(submit.ok()).toBeTruthy();
    session = (await submit.json()).session as ApiSession;
  }

  await page.goto("/progress?complete=1");
  await expect(
    page.getByRole("heading", { name: "You finished today's French practice." }),
  ).toBeVisible();
  expect(browserErrors.filter((error) => /hydration|server rendered HTML/i.test(error))).toEqual([]);

  // A separate unfinished session must not hijack an explicit restart of the
  // completed lesson.
  const activeStart = await page.request.post("/api/session/start", {
    data: { requestId: crypto.randomUUID(), mode: "short" },
  });
  expect(activeStart.ok()).toBeTruthy();
  const activeSessionId = ((await activeStart.json()).session as ApiSession).id;

  const crossIntentResume = await page.request.post("/api/session/start", {
    data: {
      requestId: crypto.randomUUID(),
      focus: "review",
      resumeSessionId: activeSessionId,
    },
  });
  expect(crossIntentResume.status()).toBe(409);
  await expect(crossIntentResume.json()).resolves.toMatchObject({
    error: "That lesson is no longer available to resume.",
  });

  await page.goto("/today");
  await expect(page.getByRole("button", { name: "Resume where you left off" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "That counts. One useful session is enough." })).toHaveCount(0);

  await page.goto(`/lesson/${completedSessionId}`);

  await expect(page.getByRole("heading", { name: "This lesson is finished and saved." })).toBeVisible();
  await expect(page.getByText("2/2", { exact: true })).toBeVisible();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await expect(page.getByText("2s", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Practise this lesson again" }).click();
  await expect(page).toHaveURL(/\/lesson\//);
  await expect(page).not.toHaveURL(new RegExp(`/lesson/${completedSessionId}$`));
  await expect(page).not.toHaveURL(new RegExp(`/lesson/${activeSessionId}$`));
  await expect(page.getByRole("heading", { name: "Learn this first" })).toBeVisible();
});
