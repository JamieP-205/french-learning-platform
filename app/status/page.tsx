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
        <p className="eyebrow">Public status</p>
        <h1 className="mt-2 text-4xl font-black">Public learning is open. Here is what is still growing.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          This page is deliberately blunt. The browser-based learner path is usable now; account sync and wider scored
          curriculum can grow without blocking someone from starting French today.
        </p>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="card">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeTone(status.publicLearningReady)}`}>
              {status.publicLearningReady ? "Open" : "Blocked"}
            </span>
            <h2 className="mt-4 text-2xl font-black">Public browser learning</h2>
            <p className="mt-2 text-sm text-ink/70">
              A no-account learner path with verified intro practice, adaptive repair, progress, review, and topic previews.
            </p>
            <Link className="button-primary mt-5" href="/demo">
              Start learning
            </Link>
          </article>

          <article className="card">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeTone(status.publicSignupEnabled)}`}>
              {status.publicSignupEnabled ? "Open" : "Setup required"}
            </span>
            <h2 className="mt-4 text-2xl font-black">Account sync</h2>
            <p className="mt-2 text-sm text-ink/70">
              {status.publicSignupEnabled
                ? "Available for cross-device saved learning, friends, and co-op challenges."
                : "Not publicly available until confirmation emails have been delivered and verified end to end. Browser learning remains available without an account."}
            </p>
            <Link className="button-secondary mt-5" href={status.publicSignupEnabled ? "/auth/sign-in" : "/demo"}>
              {status.publicSignupEnabled ? "Sign in or create an account" : "Continue without an account"}
            </Link>
          </article>

          <article className="card">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeTone(status.verifiedScoredTopics.length > 0)}`}>
              {status.verifiedScoredTopics.length > 0 ? "Ready" : "Growing"}
            </span>
            <h2 className="mt-4 text-2xl font-black">Scored curriculum</h2>
            <p className="mt-2 text-sm text-ink/70">
              One verified scored vertical slice is live; other topics are public as practice previews until fully reviewed.
            </p>
            <Link className="button-secondary mt-5" href="/learn">
              Open Today
            </Link>
          </article>
        </section>

        <section className="card mt-6">
          <p className="eyebrow">Account social layer</p>
          <h2 className="mt-2 text-2xl font-black">
            {status.publicSignupEnabled
              ? "Private friend codes and co-op practice are live for signed-in learners."
              : "Friend codes and co-op practice are staged until email-confirmed accounts are ready."}
          </h2>
          <p className="mt-3 text-ink/75">
            Friends are opt-in by code, requests must be accepted, and block/report controls sit beside each connection.
            Co-op challenges reward completed practice sessions rather than ranking private mistakes.
          </p>
          <Link className="button-secondary mt-5" href={status.publicSignupEnabled ? "/friends" : "/demo"}>
            {status.publicSignupEnabled ? "Open friends" : "Use browser learning"}
          </Link>
        </section>

        <section className="card mt-6">
          <p className="eyebrow">Real French layer</p>
          <h2 className="mt-2 text-2xl font-black">Deterministic roleplay is live for cafe and travel situations.</h2>
          <p className="mt-3 text-ink/75">
            The roleplay trainer compares formal, neutral, casual, and too-blunt choices with explicit feedback. It is
            not open-ended AI chat; every branch is reviewed content the app can explain.
          </p>
          <Link className="button-secondary mt-5" href="/roleplay">
            Open roleplay
          </Link>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="card">
            <p className="eyebrow">Verified scored content</p>
            <h2 className="mt-2 text-2xl font-black">Safe to run as scored practice.</h2>
            <div className="mt-5 space-y-3">
              {status.verifiedScoredTopics.map((topic) => (
                <div key={topic.slug} className="rounded-2xl bg-cream p-4">
                  <p className="font-black">{topic.title}</p>
                  <p className="text-sm text-ink/65">{topic.level} verified vertical slice</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <p className="eyebrow">Review-stage content</p>
            <h2 className="mt-2 text-2xl font-black">Visible, but not scored yet.</h2>
            <div className="mt-5 space-y-3">
              {status.reviewStageTopics.map((topic) => (
                <div key={topic.slug} className="rounded-2xl bg-cream p-4">
                  <p className="font-black">{topic.title}</p>
                  <p className="text-sm text-ink/65">{topic.level} preview pending independent French review</p>
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
            <p className="status-success mt-4">No public browser-learning blockers are currently reported by the app.</p>
          )}
        </section>
      </main>
    </AppShell>
  );
}
