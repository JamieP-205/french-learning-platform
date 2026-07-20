"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/auth/browser";
import { Wordmark } from "@/components/brand/wordmark";
import { RemyCompanion } from "@/components/companion/remy-companion";
import { ThemeToggle } from "@/components/theme/theme-toggle";

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

type AuthState = "loading" | "signed-in" | "signed-out" | "error";

function useAuthState() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authCheckAttempt, setAuthCheckAttempt] = useState(0);
  const supabaseConfigured = Boolean(getBrowserSupabase());

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const auth = supabase.auth;
    let cancelled = false;

    async function checkSession() {
      setAuthState("loading");
      try {
        const { data, error } = await auth.getSession();
        if (error) throw error;
        if (!cancelled) setAuthState(data.session ? "signed-in" : "signed-out");
      } catch {
        if (!cancelled) setAuthState("error");
      }
    }

    void checkSession();
    const { data: listener } = auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setAuthState(session ? "signed-in" : "signed-out");
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [authCheckAttempt]);

  return {
    authState,
    supabaseConfigured,
    retry: () => setAuthCheckAttempt((attempt) => attempt + 1),
  };
}

function AuthAction({
  authState,
  supabaseConfigured,
  retry,
}: {
  authState: AuthState;
  supabaseConfigured: boolean;
  retry: () => void;
}) {
  const router = useRouter();

  if (!supabaseConfigured) return null;

  if (authState === "loading") {
    return <span className="text-sm font-bold text-ink/60" role="status">Checking account...</span>;
  }

  if (authState === "error") {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm" role="alert">
        <span className="font-bold text-danger">Account check failed.</span>
        <Link href="/auth/sign-in" className="rounded-xl border border-ink/20 px-3 py-1.5 font-bold hover:border-coral hover:text-coral">
          Sign in
        </Link>
        <button
          type="button"
          className="rounded-xl border border-ink/20 px-3 py-1.5 font-bold hover:border-coral hover:text-coral"
          onClick={retry}
        >
          Retry
        </button>
      </div>
    );
  }

  if (authState === "signed-out") {
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
  const auth = useAuthState();

  return (
    <div className="page-shell app-shell">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 py-5">
        <Link href={auth.authState === "signed-in" ? "/today" : "/"}>
          <Wordmark />
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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AuthAction authState={auth.authState} supabaseConfigured={auth.supabaseConfigured} retry={auth.retry} />
        </div>
      </header>
      <div id="main-content" className="focus-target" tabIndex={-1}>
        {children}
      </div>
      <footer className="flex flex-wrap gap-x-4 gap-y-2 border-t border-ink/10 py-6 text-sm font-bold text-ink/75">
        <Link href="/privacy" className="hover:text-coral">Privacy</Link>
        <Link href="/terms" className="hover:text-coral">Terms</Link>
        <Link href="/status" className="hover:text-coral">Service status</Link>
        <Link href="/demo" className="hover:text-coral">Try a lesson</Link>
      </footer>
      <RemyCompanion />

      <nav
        aria-label="Primary"
        className="mobile-primary-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ink/10 bg-surface/95 px-2 pt-2 backdrop-blur md:hidden"
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
          <div className="absolute bottom-[calc(100%+0.75rem)] right-0 grid w-44 gap-1 rounded-2xl border border-ink/15 bg-surface p-2 shadow-xl">
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
