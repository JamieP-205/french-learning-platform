"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  defaultLearningSchedule,
  learningScheduleCalendar,
  learningScheduleStorageKey,
  nextScheduledSession,
  normalizeLearningSchedule,
  type LearningSchedule,
} from "@/lib/schedule/learning-schedule";

const calendarImportSteps = [
  {
    platform: "Google Calendar",
    steps: [
      "Open calendar.google.com on a computer.",
      "Click the gear icon, then Settings.",
      "Choose Import and export, pick the downloaded file, and click Import.",
    ],
  },
  {
    platform: "Apple Calendar",
    steps: [
      "Find french-for-life-schedule.ics in your Downloads folder.",
      "Double-click it, or drag it onto the Calendar app.",
      "Confirm which calendar it should join.",
    ],
  },
  {
    platform: "Outlook",
    steps: [
      "In Outlook, go to File, then Open and Export, then Import/Export.",
      "Choose to import an iCalendar (.ics) file and pick the downloaded file.",
      "Or simply drag the file onto your Outlook calendar.",
    ],
  },
];

const days = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

function readSchedule() {
  try {
    const stored = window.localStorage.getItem(learningScheduleStorageKey);
    return stored ? normalizeLearningSchedule(JSON.parse(stored)) : defaultLearningSchedule;
  } catch {
    return defaultLearningSchedule;
  }
}

function formatNext(date?: Date) {
  if (!date) return "Choose your days and turn the schedule on.";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatScheduleSummary(schedule: LearningSchedule) {
  const mondayFirst = (value: number) => (value + 6) % 7;
  const dayNames = [...schedule.days]
    .sort((a, b) => mondayFirst(a) - mondayFirst(b))
    .map((value) => days.find((day) => day.value === value)?.label)
    .filter((label): label is (typeof days)[number]["label"] => Boolean(label));
  const list =
    dayNames.length > 1
      ? `${dayNames.slice(0, -1).join(", ")} and ${dayNames[dayNames.length - 1]}`
      : dayNames[0] ?? "your chosen days";
  return `every ${list} at ${schedule.time}`;
}

export function LearningScheduleCard() {
  const [schedule, setSchedule] = useState<LearningSchedule>(defaultLearningSchedule);
  const [now, setNow] = useState(() => new Date());
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [importHelpOpen, setImportHelpOpen] = useState(false);
  const nextSession = useMemo(() => nextScheduledSession(schedule, now), [schedule, now]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSchedule(readSchedule());
      setReady(true);
    });
    const clock = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      active = false;
      window.clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(learningScheduleStorageKey, JSON.stringify(schedule));
  }, [ready, schedule]);

  useEffect(() => {
    if (!schedule.enabled || !nextSession || typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }
    const delay = nextSession.getTime() - Date.now();
    if (delay <= 0 || delay > 2_147_000_000) return;
    const reminder = window.setTimeout(() => {
      new Notification("A few minutes of French?", {
        body: "Your planned French for Life session is ready.",
        icon: "/images/remy-companion.webp",
        tag: "french-for-life-session",
      });
    }, delay);
    return () => window.clearTimeout(reminder);
  }, [nextSession, schedule.enabled]);

  function update(next: LearningSchedule) {
    setSchedule(normalizeLearningSchedule(next));
    setNotice("Schedule saved on this device.");
  }

  function toggleDay(day: number) {
    const selected = schedule.days.includes(day);
    const nextDays = selected ? schedule.days.filter((value) => value !== day) : [...schedule.days, day];
    if (nextDays.length === 0) {
      setNotice("Keep at least one practice day.");
      return;
    }
    update({ ...schedule, days: nextDays });
  }

  async function enableBrowserReminder() {
    if (typeof Notification === "undefined") {
      setNotice("This browser does not support notifications. Add the schedule to your calendar instead.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotice(
      permission === "granted"
        ? "Browser reminders are on while this site is open. Add the calendar reminder for reliable alerts when it is closed."
        : "Browser reminders were not enabled. Your calendar can still alert you.",
    );
  }

  function downloadCalendar() {
    const calendar = learningScheduleCalendar(schedule);
    if (!calendar) return;
    const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "french-for-life-schedule.ics";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Calendar file downloaded. The steps for adding it to your calendar are on screen.");
    setImportHelpOpen(true);
  }

  return (
    <section className="card learning-schedule-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Your learning time</p>
          <h2 className="mt-2 text-2xl font-black">Make French part of your week.</h2>
          <p className="mt-2 max-w-2xl text-ink/70">
            Pick a realistic time. Your device calendar gives the most reliable reminder, even when this site is closed.
          </p>
        </div>
        <time className="rounded-2xl bg-cream px-4 py-3 text-right" dateTime={now.toISOString()}>
          <span className="block text-xs font-black uppercase tracking-wide text-ink/55">Local time</span>
          <span className="mt-1 block text-lg font-black">
            {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(now)}
          </span>
        </time>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="flex flex-wrap gap-2" aria-label="Practice days">
            {days.map((day) => {
              const selected = schedule.days.includes(day.value);
              return (
                <button
                  aria-pressed={selected}
                  className={`schedule-day ${selected ? "schedule-day-selected" : ""}`}
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  type="button"
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          <label className="mt-5 block max-w-xs font-bold">
            Start time
            <input
              className="field"
              onChange={(event) => update({ ...schedule, time: event.target.value })}
              type="time"
              value={schedule.time}
            />
          </label>
        </div>

        <div className="rounded-2xl border border-ink/10 bg-cream p-4 lg:w-72">
          <label className="flex min-h-11 items-center gap-3 font-black">
            <input
              checked={schedule.enabled}
              className="h-5 w-5 accent-moss"
              onChange={(event) => update({ ...schedule, enabled: event.target.checked })}
              type="checkbox"
            />
            Keep this routine
          </label>
          <p className="mt-3 text-sm text-ink/70">
            Next session: <strong className="text-ink">{formatNext(nextSession)}</strong>
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button className="button-primary" disabled={!schedule.enabled} onClick={downloadCalendar} type="button">
          Add repeating calendar reminder
        </button>
        <button className="button-secondary" disabled={!schedule.enabled} onClick={enableBrowserReminder} type="button">
          Enable browser reminder
        </button>
      </div>
      {notice && <p className="mt-4 text-sm font-bold text-ink/70" role="status">{notice}</p>}

      <Modal labelledBy="calendar-import-help-title" onClose={() => setImportHelpOpen(false)} open={importHelpOpen}>
        <p className="eyebrow">One more step</p>
        <h2 className="mt-1 text-2xl font-black" id="calendar-import-help-title">
          Your calendar file is downloaded.
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          It is called <strong>french-for-life-schedule.ics</strong> and it holds your repeating practice
          reminder: {formatScheduleSummary(schedule)}, with an alert 10 minutes before. Add it to the
          calendar you actually check:
        </p>

        <div className="mt-4 space-y-4">
          {calendarImportSteps.map((guide) => (
            <section key={guide.platform}>
              <h3 className="font-black">{guide.platform}</h3>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-6 text-ink/75">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="button-primary" onClick={() => setImportHelpOpen(false)} type="button">
            Got it
          </button>
          <button className="button-secondary" onClick={downloadCalendar} type="button">
            Download the file again
          </button>
        </div>
      </Modal>
    </section>
  );
}
