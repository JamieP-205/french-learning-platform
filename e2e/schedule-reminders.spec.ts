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
