import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { topicPreviews } from "@/lib/content/topic-previews";

function statusTone(status: string) {
  if (status === "ready") return "bg-moss/10 text-ink";
  if (status === "practice_preview") return "bg-amber/20 text-ink";
  return "bg-cream text-ink/70";
}

export default function LearnPage() {
  const pathSteps = [
    {
      title: "Foundation",
      detail: "Live now",
      description: "Introduce yourself, give your age correctly, and repair the most common early mistake.",
      href: "/demo",
    },
    {
      title: "Everyday situations",
      detail: "Preview now",
      description: "Café and travel phrases are visible as reviewed previews before they become scored missions.",
      href: "/learn/cafe-food",
    },
    {
      title: "Focused review",
      detail: "Live locally",
      description: "Mistakes from the public lesson come back first in this browser so practice is not random.",
      href: "/review",
    },
    {
      title: "Register confidence",
      detail: "Live now",
      description: "Neutral, polite, casual, and later regional French stay clearly labelled so learners know when to use each phrase.",
      href: "/roleplay",
    },
  ];

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Learn</p>
        <h1 className="mt-2 text-4xl font-black">Pick a useful French topic.</h1>
        <p className="mt-4 max-w-3xl text-lg text-ink/75">
          Start with a guided foundation lesson, then branch into practical topics. Each activity is clearly labelled as a full lesson, extra practice, or planned content.
        </p>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <Link href="/speak" className="card transition hover:bg-cream">
            <p className="eyebrow">Speak</p>
            <h2 className="mt-2 text-2xl font-black">Speaking practice with word-matching feedback</h2>
            <p className="mt-3 text-ink/75">
              Repeat phrases with optional browser word matching, compare tricky sounds such as tu and tout, and shadow the rhythm.
            </p>
          </Link>
          <Link href="/listen" className="card transition hover:bg-cream">
            <p className="eyebrow">Listen</p>
            <h2 className="mt-2 text-2xl font-black">Dictation and hands-free training</h2>
            <p className="mt-3 text-ink/75">
              Type what you hear at slow or normal speed, then take walking mode out for screen-free recall practice.
            </p>
          </Link>
          <Link href="/roleplay" className="card transition hover:bg-cream">
            <p className="eyebrow">Real French</p>
            <h2 className="mt-2 text-2xl font-black">Register-aware roleplay</h2>
            <p className="mt-3 text-ink/75">
              Choose replies in cafe and travel scenarios, then see why a phrase is safe, polite, blunt, or too casual.
            </p>
          </Link>
        </section>

        <section className="card mt-8 bg-ink text-cream">
          <p className="text-sm font-bold uppercase tracking-wide text-amber">Public path</p>
          <h2 className="mt-2 text-3xl font-black">A learner always has a next useful step.</h2>
          <p className="mt-3 max-w-2xl text-cream/75">
            Start with the foundations, revisit anything you miss, then expand into practical situations.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {pathSteps.map((step, index) => (
              <Link key={step.title} href={step.href} className="rounded-2xl bg-surface/10 p-4 transition hover:bg-surface/20">
                <p className="text-xs font-black uppercase tracking-wide text-amber">
                  {String(index + 1).padStart(2, "0")} · {step.detail}
                </p>
                <h3 className="mt-2 font-black">{step.title}</h3>
                <p className="mt-2 text-sm text-cream/70">{step.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="card mt-6">
          <p className="eyebrow">Choose your starting point</p>
          <h2 className="mt-2 text-2xl font-black">Start at any level with a short foundation check.</h2>
          <p className="mt-3 text-ink/75">
            A2, B1, B2, C1, and C2 learners begin with a short, reviewed foundation check. Recommendations then use
            their answers to point to useful repair work and the topic coverage that is genuinely available.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="button-primary" href="/settings">
              Set level and goal
            </Link>
            <Link className="button-secondary" href="/progress">
              See your progress
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          {topicPreviews.map((topic) => (
            <article key={topic.slug} className="card flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">{topic.detail}</p>
                    <h2 className="mt-2 text-2xl font-black">{topic.title}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone(topic.status)}`}>
                    {topic.statusLabel}
                  </span>
                </div>
                <p className="mt-4 text-ink/75">{topic.description}</p>
                <p className="mt-3 text-sm font-bold text-ink/60">{topic.outcome}</p>
              </div>

              {topic.href ? (
                <Link className={topic.status === "ready" ? "button-primary mt-6" : "button-secondary mt-6"} href={topic.href}>
                  {topic.status === "ready" ? "Start reviewed lesson" : "Open practice preview"}
                </Link>
              ) : (
                <div className="mt-6 rounded-2xl bg-cream p-4 text-sm font-bold text-ink/70">
                  More practice for this topic is on the way.
                </div>
              )}
            </article>
          ))}
        </section>

        <section className="card mt-6">
          <p className="eyebrow">How the course grows</p>
          <h2 className="mt-2 text-2xl font-black">Practice previews become full lessons after review.</h2>
          <p className="mt-3 text-ink/75">
            Each preview needs reviewed answers, useful mistake feedback, and follow-up practice before it becomes a
            full lesson. Roleplay will also gain more choices for different situations and levels of formality.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
