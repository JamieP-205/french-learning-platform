import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { safeTutorPrompts } from "@/lib/content/safe-tutor-prompts";

export default function TutorPage() {
  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Tutor mode</p>
        <h1 className="mt-2 text-4xl font-black">Helpful when you need it. Grounded when it matters.</h1>

        <section className="card mt-7 max-w-3xl">
          <h2 className="text-2xl font-black">This tutor works inside your lesson.</h2>
          <p className="mt-3 leading-7 text-ink/75">
            Ask “Why does this work?” after a correction and the tutor receives only the current activity, your answer, the verified lesson note, and the relevant mistake pattern. It cannot promote generated French into your course or replace the answer checker.
          </p>

          <div className="mt-6 rounded-2xl bg-cream p-5">
            <p className="font-bold">Outside the current verified lesson</p>
            <p className="mt-2 text-sm text-ink/70">
              “This topic is not in the verified course yet, so I’ll keep you on the safe version.”
            </p>
          </div>

          <Link className="button-primary mt-7" href="/today">
            Open today’s lesson
          </Link>
        </section>

        <section className="mt-7 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="card bg-ink text-white">
            <p className="text-sm font-bold uppercase tracking-wide text-amber">Public safe tutor</p>
            <h2 className="mt-2 text-3xl font-black">Get help without open-ended guessing.</h2>
            <p className="mt-3 text-white/75">
              These answers are tied to the verified intro mission and source-backed preview topics. They do not add new
              French, score you, or turn AI output into course content.
            </p>
            <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm text-white/75">
              If your question is outside the current content, the safe answer is to practise the closest verified topic first.
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
                  <p className="mt-1 text-xl font-black">{prompt.example}</p>
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
