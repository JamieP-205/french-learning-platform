import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AccountProfileSettings } from "@/components/settings/account-profile-settings";
import { LocalLearningDataControls } from "@/components/settings/local-learning-data-controls";
import { LocalLearningPreferences } from "@/components/settings/local-learning-preferences";

export default function SettingsPage() {
  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Settings</p>
        <h1 className="mt-2 text-4xl font-black">Your learning controls.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          Some controls are live now, and some are marked clearly as future work. The app should be honest about that.
        </p>

        <section className="mt-7">
          <AccountProfileSettings />
        </section>

        <section className="mt-7">
          <LocalLearningPreferences />
        </section>

        <section className="mt-7">
          <LocalLearningDataControls />
        </section>

        <section className="mt-7 grid gap-5 lg:grid-cols-2">
          <div className="card">
            <p className="eyebrow">Learning setup</p>
            <h2 className="mt-2 text-2xl font-black">Keep setup lightweight</h2>
            <p className="mt-3 text-ink/75">
              Name, session length, speaking confidence and practice focus can be changed above without repeating onboarding.
            </p>
          </div>

          <div className="card">
            <p className="eyebrow">Speaking</p>
            <h2 className="mt-2 text-2xl font-black">Browser speech, with honest fallback</h2>
            <p className="mt-3 text-ink/75">
              Where the browser supports it, Speak can check repeat-after-me practice. Nothing is uploaded; unsupported
              browsers stay as a clear self-check.
            </p>
          </div>

          <div className="card">
            <p className="eyebrow">Data</p>
            <h2 className="mt-2 text-2xl font-black">Account data controls</h2>
            <p className="mt-3 text-ink/75">
              Account export and deletion live in the privacy centre. Browser-only public progress can be exported or
              reset above.
            </p>
            <Link className="button-secondary mt-6" href="/privacy">
              Open privacy centre
            </Link>
          </div>
        </section>

        <section className="card mt-6">
          <p className="eyebrow">Coming later</p>
          <h2 className="mt-2 text-2xl font-black">Calendar, topic badges, and deeper roleplay.</h2>
          <p className="mt-3 text-ink/75">
            The next product layer should add richer real-life scenarios, deterministic roleplay branches, and more
            reviewed topic depth beyond the current vertical slice.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
