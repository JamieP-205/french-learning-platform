import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function TermsPage() {
  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Terms and learner safety</p>
        <h1 className="mt-2 text-4xl font-black">Use the app as a learning tool, not as an authority beyond its verified content.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          These product terms explain the current MVP behaviour. They are not a substitute for the qualified review
          still required before a broad public account launch.
        </p>

        <section className="mt-7 grid gap-5 lg:grid-cols-2">
          <article className="card">
            <p className="eyebrow">Current access</p>
            <h2 className="mt-2 text-2xl font-black">The public demo is open.</h2>
            <p className="mt-3 text-ink/75">
              The no-account demo uses verified A1 introduction content, runs deterministic answer checks, and does not
              save personal learner data.
            </p>
            <Link className="button-primary mt-5" href="/demo">
              Try demo
            </Link>
          </article>

          <article className="card">
            <p className="eyebrow">Account signup</p>
            <h2 className="mt-2 text-2xl font-black">Learner accounts require 13+ confirmation.</h2>
            <p className="mt-3 text-ink/75">
              When Supabase is configured, accounts use email confirmation and onboarding requires a 13+ declaration
              plus required policy consents. Without production storage, the app shows a setup-required screen.
            </p>
            <Link className="button-secondary mt-5" href="/status">
              Check status
            </Link>
          </article>

          <article className="card">
            <p className="eyebrow">French accuracy</p>
            <h2 className="mt-2 text-2xl font-black">Verified content is the source of truth.</h2>
            <p className="mt-3 text-ink/75">
              The app does not treat AI output as canonical French. Closed-answer checks use accepted answers, known
              mistake rules, and source-backed lesson notes first.
            </p>
          </article>

          <article className="card">
            <p className="eyebrow">AI tutor</p>
            <h2 className="mt-2 text-2xl font-black">Tutor help stays bounded.</h2>
            <p className="mt-3 text-ink/75">
              The tutor is designed to explain current verified lesson material. Unsupported topics should receive a
              safe fallback instead of invented course content.
            </p>
          </article>

          <article className="card">
            <p className="eyebrow">Audio attribution</p>
            <h2 className="mt-2 text-2xl font-black">Bundled French audio uses an attributed open dataset.</h2>
            <p className="mt-3 text-ink/75">
              The fixed French clips were generated with the MIT-licensed Piper <code>fr_FR-mls-medium</code> voice, trained
              from scratch on Multilingual LibriSpeech by Pratap et al. (2020), licensed under{" "}
              <a className="font-bold underline" href="https://creativecommons.org/licenses/by/4.0/">
                CC BY 4.0
              </a>
              , then converted to mono MP3 files for this app. See the{" "}
              <a className="font-bold underline" href="https://openslr.org/94/">
                MLS source and citation
              </a>
              .
            </p>
          </article>
        </section>

        <section className="card mt-6">
          <p className="eyebrow">Before broad public launch</p>
          <h2 className="mt-2 text-2xl font-black">These terms still need formal approval.</h2>
          <p className="mt-3 text-ink/75">
            A public account launch requires qualified review of the full terms, privacy notice, consent language,
            retention policy, youth safeguards, and country-specific requirements.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
