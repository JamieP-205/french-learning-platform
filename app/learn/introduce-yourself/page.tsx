import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getSeedMission } from "@/lib/content/seed";

export default function MissionOverviewPage() {
  const mission = getSeedMission();

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">A1 practical mission</p>
        <h1 className="mt-2 text-4xl font-black">{mission.title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-ink/75">{mission.outcome}</p>

        <section className="card mt-8">
          <h2 className="text-xl font-black">You’ll practise</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              "A neutral introduction you can use safely",
              "A casual spoken alternative with context",
              "Avoir for age",
              "A short sentence about today",
              "Listening, writing, and confidence-first speaking",
            ].map((item) => (
              <li key={item} className="rounded-2xl bg-cream p-4 font-bold">{item}</li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="button-primary" href="/demo">Try no-account demo</Link>
            <Link className="button-secondary" href="/today">Start from Today</Link>
          </div>
        </section>

        <section className="card mt-5">
          <p className="eyebrow">Real French note</p>
          <p className="mt-2">
            <strong>{"Je m'appelle…"}</strong> is a neutral everyday default. <strong>{"Moi, c'est…"}</strong> is more relaxed and spoken. Use it with peers rather than in formal writing.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
