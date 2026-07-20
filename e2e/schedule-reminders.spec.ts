import { expect, test } from "./fixtures";

test("the calendar download explains what to do with the file", async ({ page }) => {
  await page.goto("/today");

  const routineToggle = page.getByLabel("Keep this routine");
  await routineToggle.check();

  const downloadButton = page.getByRole("button", { name: "Add repeating calendar reminder" });
  const downloadEvent = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("french-for-life-schedule.ics");

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Your calendar file is downloaded." })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Google Calendar" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Apple Calendar" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Outlook" })).toBeVisible();

  await page.keyboard.press("Tab");
  const focusStaysInside = await page.evaluate(() => {
    const openDialog = document.querySelector("dialog[open]");
    return Boolean(openDialog && openDialog.contains(document.activeElement));
  });
  expect(focusStaysInside).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(downloadButton).toBeFocused();
});

test("the reminder button works without the routine toggle and confirms a granted permission", async ({ page }) => {
  // Headless browsers report notification permission as denied no matter
  // what, so the granted path uses a faithful stub of the Notification API.
  await page.addInitScript(() => {
    class GrantedNotification {
      static permission: NotificationPermission = "granted";
      static requestPermission = async (): Promise<NotificationPermission> => "granted";
    }
    Object.defineProperty(window, "Notification", { value: GrantedNotification, configurable: true });
  });
  await page.goto("/today");

  const reminderButton = page.getByRole("button", { name: "Enable browser reminder" });
  await expect(reminderButton).toBeEnabled();
  await reminderButton.click();

  const notice = page.getByRole("status").filter({ hasText: /reminders are/i });
  await expect(notice).toContainText(/open in a tab/i);
  await expect(notice).toContainText(/keep this routine/i);
});

test("a refused permission gets honest guidance instead of silence", async ({ page }) => {
  // Headless Chromium auto-refuses permission prompts, which is exactly the
  // hardened-browser behaviour the button used to swallow.
  await page.goto("/today");

  await page.getByRole("button", { name: "Enable browser reminder" }).click();

  const notice = page.getByRole("status").filter({ hasText: /notifications/i });
  await expect(notice).toContainText(/site settings|try again/i);
  await expect(notice).toContainText(/calendar file|whenever you like/i);
});
