import Link from "next/link";
import { cookies } from "next/headers";
import { E2E_LEARNER_COOKIE } from "@/lib/auth/development-user";
import { isServerAccountSyncReady } from "@/lib/auth/readiness";
import { getCurrentUserId, isDevelopmentDemoMode } from "@/lib/auth/server";
import { getSeedMission } from "@/lib/content/seed";

// Development demo mode resolves every request to a learner id, which would
// make the public landing page greet every local visitor as signed in. There,
// only an explicit dev-learner cookie counts. Production checks the session.
async function getSignedInUserId() {
  if (isDevelopmentDemoMode()) {
    const cookieStore = await cookies();
    if (!cookieStore.get(E2E_LEARNER_COOKIE)?.value) return null;
  }
  return getCurrentUserId();
}

const firstLessonSteps = [
  {
    title: "Learn one useful phrase",
    description: "See what it means and when to use it.",
  },
  {
    title: "Use it yourself",
    description: "Answer one clear question.",
  },
  {
    title: "Get a clear next step",
    description: "Retry once, then see the answer and why.",
  },
];

export default async function LandingPage() {
  const firstLessonMinutes = getSeedMission().estimatedMinutes;
  const accountSyncReady = isServerAccountSyncReady();
  const signedIn = Boolean(await getSignedInUserId());

  return (
    <main id="main-content" className="page-shell flex min-h-screen flex-col">
      <header className="flex min-h-20 items-center justify-between gap-4 border-b border-ink/10 py-4">
        <Link href="/" className="text-lg font-black tracking-tight text-ink" aria-label="French for Life home">
          French for Life
        </Link>
        {signedIn ? (
          <Link
            href="/today"
            className="inline-flex min-h-12 items-center rounded-xl px-3 font-semibold text-ink/70 underline decoration-ink/25 underline-offset-4 hover:text-ink"
          >
            Continue to Today
          </Link>
        ) : (
          <Link
            href={accountSyncReady ? "/auth/sign-in" : "/status"}
            className="inline-flex min-h-12 items-center rounded-xl px-3 font-semibold text-ink/70 underline decoration-ink/25 underline-offset-4 hover:text-ink"
          >
            {accountSyncReady ? "Sign in" : "Account availability"}
          </Link>
        )}
      </header>

      <section className="flex flex-1 items-center py-14 sm:py-20">
        <div className="max-w-3xl">
          <p className="eyebrow">Practical French for everyday life</p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-ink sm:text-6xl">
            Speak useful French, one short lesson at a time.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/75">
            First learn what a phrase means. Then answer one clear question and get useful feedback.
          </p>

          <div className="mt-8">
            {signedIn ? (
              <>
                <Link href="/today" className="button-primary w-full sm:w-auto">
                  Pick up where you left off
                </Link>
                <p className="mt-4 text-sm font-semibold text-ink/70">
                  You are signed in, and your progress is saved to your account.
                </p>
              </>
            ) : (
              <>
                <Link href="/demo" className="button-primary w-full sm:w-auto">
                  Start a free {firstLessonMinutes}-minute lesson
                </Link>
                <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-ink/70" aria-label="First lesson details">
                  <li>{firstLessonMinutes} minutes</li>
                  <li>No account</li>
                  <li>Beginner friendly</li>
                </ul>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mb-12 overflow-hidden rounded-3xl border border-ink/15 bg-surface" aria-labelledby="first-lesson-title">
        <div className="grid gap-0 md:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-ink p-6 text-cream sm:p-8">
            <p className="text-sm font-bold text-amber">YOUR FIRST LESSON</p>
            <h2 id="first-lesson-title" className="mt-2 text-3xl font-black tracking-tight">
              Introduce yourself
            </h2>
            <div className="mt-7 rounded-2xl bg-surface/10 p-5">
              <p lang="fr" className="font-serif text-2xl font-bold">Je m’appelle Jamie.</p>
              <p className="mt-2 text-cream/75">My name is Jamie.</p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <p className="font-black text-ink">What you will practise</p>
            <ul className="mt-3 space-y-3 text-ink/75">
              <li>Say your name and where you are from.</li>
              <li>Say your age with the right French verb.</li>
            </ul>

            <ol className="mt-7 grid gap-4 border-t border-ink/10 pt-6 sm:grid-cols-3" aria-label="How the lesson works">
              {firstLessonSteps.map((step, index) => (
                <li key={step.title}>
                  <p className="text-sm font-black text-coral">{index + 1}. {step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-ink/70">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}
