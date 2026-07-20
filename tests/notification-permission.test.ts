import { describe, expect, it } from "vitest";
import {
  noticeForCurrentPermission,
  noticeForRequestOutcome,
} from "../lib/schedule/notification-permission";

describe("browser reminder permission notices", () => {
  it("only asks the browser when no decision exists yet", () => {
    expect(noticeForCurrentPermission("default")).toBeNull();
    expect(noticeForCurrentPermission("unsupported")).not.toBeNull();
    expect(noticeForCurrentPermission("granted")).not.toBeNull();
    expect(noticeForCurrentPermission("denied")).not.toBeNull();
  });

  it("points unsupported browsers at the calendar file instead of a dead end", () => {
    const notice = noticeForCurrentPermission("unsupported");
    expect(notice?.tone).toBe("blocked");
    expect(notice?.message).toMatch(/calendar file/i);
  });

  it("tells blocked learners where the browser setting lives, without re-prompting", () => {
    const notice = noticeForCurrentPermission("denied");
    expect(notice?.tone).toBe("blocked");
    expect(notice?.message).toMatch(/site settings/i);
    expect(notice?.message).toMatch(/calendar file/i);
  });

  it("is honest that granted reminders only fire while a tab is open", () => {
    expect(noticeForCurrentPermission("granted")?.message).toMatch(/open in a tab/i);
    expect(noticeForRequestOutcome("granted").message).toMatch(/open in a tab/i);
    expect(noticeForRequestOutcome("granted").tone).toBe("success");
  });

  it("distinguishes a refusal from a dismissed prompt", () => {
    const denied = noticeForRequestOutcome("denied");
    expect(denied.tone).toBe("blocked");
    expect(denied.message).toMatch(/site settings/i);

    const dismissed = noticeForRequestOutcome("default");
    expect(dismissed.tone).toBe("info");
    expect(dismissed.message).toMatch(/try again/i);
  });
});
