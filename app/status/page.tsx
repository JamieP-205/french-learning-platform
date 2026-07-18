import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { buildLaunchStatus } from "@/lib/launch/status";

function badgeTone(ready: boolean) {
  return ready ? "bg-moss/10 text-ink" : "bg-amber/20 text-ink";
}

export default function StatusPage() {
  const status = buildLaunchStatus();

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Availability</p>
        <h1 className="mt-2 text-4xl font-black">What you can use today.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          Start a lesson and save progress on this device without an account. Account and social features appear only when they are ready.
        </p>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="card">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeTone(status.publicLearningReady)}`}>
              {status.publicLearningReady ? "Open" : "Blocked"}
            </span>
            <h2 className="mt-4 text-2xl font-black">Learning without an account</h2>
            <p className="mt-2 text-sm text-ink/70">
              Reviewed beginner practice, saved progress, useful follow-up for mistakes, and topic previews on this device.
            </p>
            <Link className="button-primary mt-5" href="/demo">
              Start learning
            </Link>
          </article>

          <article className="card">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeTone(status.publicSignupEnabled)}`}>
              {status.publicSignupEnabled ? "Open" : "Setup required"}
            </span>
            <h2 className="mt-4 text-2xl font-black">Accounts</h2>
            <p className="mt-2 text-sm text-ink/70">
              {status.publicSignupEnabled
                ? "Available for cross-device saved learning, friends, and co-op challenges."
                : "Not publicly available until confirmation emails have been tested successfully. Learning on this device remains available without an account."}
            </p>
            <Link className="button-secondary mt-5" href={status.publicSignupEnabled ? "/auth/sign-in" : "/demo"}>
              {status.publicSignupEnabled ? "Sign in or create an account" : "Continue without an account"}
            </Link>
          </article>

          <article className="card">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeTone(status.verifiedScoredTopics.length > 0)}`}>
              {status.verifiedScoredTopics.length > 0 ? "Ready" : "Growing"}
            </span>
            <h2 className="mt-4 text-2xl font-black">Reviewed lessons</h2>
            <p className="mt-2 text-sm text-ink/70">
              One checked beginner lesson is ready. Other topics remain practice previews until their answers and feedback are fully reviewed.
            </p>
            <Link className="button-secondary mt-5" href="/learn">
              Browse lessons
            </Link>
          </article>
        </section>

        <section className="card mt-6">
          <p className="eyebrow">Friends and shared practice</p>
          <h2 className="mt-2 text-2xl font-black">
            {status.publicSignupEnabled
              ? "Private friend codes and co-op practice are live for signed-in learners."
               : "Friends and co-op practice will be available when accounts are ready."}
          </h2>
          <p className="mt-3 text-ink/75">
            Friends are opt-in by code, requests must be accepted, and block/report controls sit beside each connection.
            Co-op challenges reward completed practice sessions rather than ranking private mistakes.
          </p>
          <Link className="button-secondary mt-5" href={status.publicSignupEnabled ? "/friends" : "/demo"}>
            {status.publicSignupEnabled ? "Open friends" : "Learn without an account"}
          </Link>
        </section>

        <section className="card mt-6">
          <p className="eyebrow">Real-life French</p>
          <h2 className="mt-2 text-2xl font-black">Guided roleplay is available for cafe and travel situations.</h2>
          <p className="mt-3 text-ink/75">
            The roleplay trainer compares formal, neutral, casual, and too-blunt choices with explicit feedback. It is
            not open-ended AI chat; every choice and explanation is written and reviewed in advance.
          </p>
          <Link className="button-secondary mt-5" href="/roleplay">
            Open roleplay
          </Link>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="card">
            <p className="eyebrow">Full lessons</p>
            <h2 className="mt-2 text-2xl font-black">Available now.</h2>
            <div className="mt-5 space-y-3">
              {status.verifiedScoredTopics.map((topic) => (
                <div key={topic.slug} className="rounded-2xl bg-cream p-4">
                  <p className="font-black">{topic.title}</p>
                  <p className="text-sm text-ink/65">{topic.level} reviewed lesson</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <p className="eyebrow">Extra practice</p>
            <h2 className="mt-2 text-2xl font-black">Practise now; the full lesson is still under review.</h2>
            <div className="mt-5 space-y-3">
              {status.reviewStageTopics.map((topic) => (
                <div key={topic.slug} className="rounded-2xl bg-cream p-4">
                  <p className="font-black">{topic.title}</p>
                  <p className="text-sm text-ink/65">{topic.level} practice preview</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card mt-6">
          <p className="eyebrow">Still growing</p>
          {status.blockers.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {status.blockers.map((blocker) => (
                <li key={blocker} className="rounded-2xl bg-amber/20 p-4 font-bold text-ink/75">
                  {blocker}
                </li>
              ))}
            </ul>
          ) : (
            <p className="status-success mt-4">Everything listed as available is working normally.</p>
          )}
        </section>
      </main>
    </AppShell>
  );
}
