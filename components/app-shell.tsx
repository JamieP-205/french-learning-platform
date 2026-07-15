"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/auth/browser";

const primaryLinks = [
  ["Today", "/today"],
  ["Learn", "/learn"],
  ["Review", "/review"],
  ["Progress", "/progress"],
  ["Friends", "/friends"],
  ["Tutor", "/tutor"],
] as const;

const mobilePrimaryLinks = [
  ["Today", "/today"],
  ["Learn", "/learn"],
  ["Progress", "/progress"],
] as const;

const mobileMoreLinks = [
  ["Review", "/review"],
  ["Friends", "/friends"],
  ["Tutor", "/tutor"],
  ["Settings", "/settings"],
] as const;

function AuthAction() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean>();
  const supabaseConfigured = Boolean(getBrowserSupabase());

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSignedIn(Boolean(data.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!supabaseConfigured || signedIn === undefined) return null;

  if (!signedIn) {
    return (
      <Link href="/auth/sign-in" className="rounded-xl border border-ink/20 px-3 py-1.5 text-sm font-bold hover:border-coral hover:text-coral">
        Sign in
      </Link>
    );
  }

  return (
    <button
      className="rounded-xl border border-ink/20 px-3 py-1.5 text-sm font-bold hover:border-coral hover:text-coral"
      onClick={async () => {
        await getBrowserSupabase()?.auth.signOut();
        router.push("/");
      }}
    >
      Sign out
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="page-shell pb-20 md:pb-0">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 py-5">
        <Link href="/" className="font-black tracking-tight text-ink">
          French for Life
        </Link>
        <nav aria-label="Main navigation" className="hidden gap-x-1 text-sm font-bold text-ink/80 md:flex">
          {primaryLinks.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`rounded-lg px-2.5 py-1.5 hover:text-coral ${isActive(href) ? "bg-cream text-ink" : ""}`}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/settings"
            aria-current={isActive("/settings") ? "page" : undefined}
            className={`rounded-lg px-2.5 py-1.5 hover:text-coral ${isActive("/settings") ? "bg-cream text-ink" : ""}`}
          >
            Settings
          </Link>
        </nav>
        <AuthAction />
      </header>
      {children}
      <footer className="flex flex-wrap gap-x-4 gap-y-2 border-t border-ink/10 py-6 text-sm font-bold text-ink/75">
        <Link href="/privacy" className="hover:text-coral">Privacy</Link>
        <Link href="/terms" className="hover:text-coral">Terms</Link>
        <Link href="/status" className="hover:text-coral">Service status</Link>
        <Link href="/demo" className="hover:text-coral">Try a lesson</Link>
      </footer>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ink/10 bg-white/95 px-2 py-2 backdrop-blur md:hidden"
      >
        {mobilePrimaryLinks.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center rounded-lg px-2 py-2 text-xs font-black ${isActive(href) ? "bg-cream text-coral" : "text-ink/75"}`}
          >
            {label}
          </Link>
        ))}
        <details className="group relative">
          <summary
            className={`flex min-h-12 cursor-pointer list-none items-center justify-center rounded-lg px-2 py-2 text-xs font-black [&::-webkit-details-marker]:hidden ${mobileMoreLinks.some(([, href]) => isActive(href)) ? "bg-cream text-coral" : "text-ink/75"}`}
          >
            More
          </summary>
          <div className="absolute bottom-[calc(100%+0.75rem)] right-0 grid w-44 gap-1 rounded-2xl border border-ink/15 bg-white p-2 shadow-xl">
            {mobileMoreLinks.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`min-h-12 rounded-xl px-4 py-3 text-sm font-bold ${isActive(href) ? "bg-cream text-coral" : "text-ink hover:bg-cream"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </details>
      </nav>
    </div>
  );
}
