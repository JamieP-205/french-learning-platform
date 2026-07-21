import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { safeTutorPrompts } from "@/lib/content/safe-tutor-prompts";

export default function TutorPage() {
  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Tutor mode</p>
        <h1 className="mt-2 text-4xl font-black">Ask why an answer was right or wrong.</h1>

        <section className="card mt-7 max-w-3xl">
          <h2 className="text-2xl font-black">This tutor works inside your lesson.</h2>
          <p className="mt-3 leading-7 text-ink/75">
            After a checked answer, the tutor uses your submitted answer and that lesson&apos;s reviewed explanation. It cannot change your score or add unreviewed material.
          </p>

          <div className="mt-6 rounded-2xl bg-cream p-5">
            <p className="font-bold">Topics outside this lesson</p>
            <p className="mt-2 text-sm text-ink/70">
              “This topic is not covered in this lesson yet. Try the closest reviewed topic.”
            </p>
          </div>

          <Link className="button-primary mt-7" href="/today">
            Open today’s lesson
          </Link>
        </section>

        <section className="mt-7 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="card bg-ink text-cream">
            <p className="text-sm font-bold uppercase tracking-wide text-amber">Lesson help</p>
            <h2 className="mt-2 text-3xl font-black">Explanations based on reviewed course material.</h2>
            <p className="mt-3 text-cream/75">
              Choose a common question below. The answer comes from reviewed lesson notes and does not change your score.
            </p>
            <div className="mt-6 rounded-2xl bg-surface/10 p-4 text-sm text-cream/75">
              If a question goes beyond the available lessons, you will be directed to the closest relevant topic.
            </div>
          </div>

          <div className="space-y-4">
            {safeTutorPrompts.map((prompt) => (
              <details key={prompt.id} className="card">
                <summary className="cursor-pointer text-xl font-black">{prompt.question}</summary>
                <p className="eyebrow mt-5">{prompt.sourceLabel}</p>
                <h3 className="mt-2 text-2xl font-black">{prompt.headline}</h3>
                <p className="mt-3 text-ink/75">{prompt.explanation}</p>
                <div className="mt-4 rounded-2xl bg-cream p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-coral">Safe example</p>
                  <p className="mt-1 text-xl font-black" lang="fr">{prompt.example}</p>
                </div>
                <Link className="button-secondary mt-5" href={prompt.href}>
                  Practise this
                </Link>
              </details>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
