// Pure decision table for the browser-reminder button, so every permission
// state has an honest, tested message. The component supplies the browser
// state and renders whatever comes back; nothing here touches the DOM.

export type ReminderPermissionState = "unsupported" | "default" | "granted" | "denied";

export type ReminderNotice = {
  tone: "success" | "info" | "blocked";
  message: string;
};

// What to say before asking. Returning null means the browser has not been
// asked yet and the component should call requestPermission().
export function noticeForCurrentPermission(state: ReminderPermissionState): ReminderNotice | null {
  if (state === "unsupported") {
    return {
      tone: "blocked",
      message:
        "This browser cannot show notifications. The calendar file is the reliable way to get reminders.",
    };
  }
  if (state === "granted") {
    return {
      tone: "success",
      message:
        "Reminders are already on. They appear while this site is open in a tab; the calendar file covers you when it is closed.",
    };
  }
  if (state === "denied") {
    return {
      tone: "blocked",
      message:
        "Your browser is blocking notifications for this site. You can change that in the site settings, usually behind the icon next to the address bar. The calendar file works either way.",
    };
  }
  return null;
}

// What to say after requestPermission() resolves. Browsers can return
// "default" when the person dismisses the prompt without deciding.
export function noticeForRequestOutcome(outcome: ReminderPermissionState): ReminderNotice {
  if (outcome === "granted") {
    return {
      tone: "success",
      message:
        "Reminders are on while this site is open in a tab. Add the calendar file too, so you still get an alert when it is closed.",
    };
  }
  if (outcome === "denied") {
    return {
      tone: "blocked",
      message:
        "Notifications stayed off. If that was not what you wanted, look in the site settings next to the address bar. The calendar file can still remind you.",
    };
  }
  return {
    tone: "info",
    message: "No decision saved. You can try again whenever you like.",
  };
}
