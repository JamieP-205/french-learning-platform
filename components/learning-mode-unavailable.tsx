"use client";

import Link from "next/link";

export function LearningModeUnavailable() {
  return (
    <section className="card mt-7" role="alert">
      <h2 className="text-2xl font-black">We couldn&apos;t confirm where to save your learning.</h2>
      <p className="mt-3 max-w-2xl text-ink/75">
        Account progress and data saved on this device stay separate. Nothing on this page has been loaded or changed.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="button-primary" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
        <Link className="button-secondary" href="/status">
          Check service status
        </Link>
      </div>
    </section>
  );
}
