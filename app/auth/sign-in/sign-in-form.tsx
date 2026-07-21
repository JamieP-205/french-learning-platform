"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/auth/browser";
import { friendlyAuthError, requiresEmailConfirmation } from "@/lib/auth/messages";
import { buildConfirmationRedirectUrl, getSafeAuthDestination, NEW_ACCOUNT_DESTINATION } from "@/lib/auth/redirects";
import { requestSignupConfirmation } from "@/lib/auth/resend-confirmation";

type MessageKind = "success" | "error";

function getSafeRedirectPath() {
  if (typeof window === "undefined") return "/today";
  return getSafeAuthDestination(new URLSearchParams(window.location.search).get("redirectTo"));
}

function getConfirmationRedirectUrl() {
  return buildConfirmationRedirectUrl({
    configuredAppUrl: process.env.NEXT_PUBLIC_APP_URL?.trim(),
    browserOrigin: window.location.origin,
    next: NEW_ACCOUNT_DESTINATION,
  });
}

export function SignInForm({
  accountSyncReady,
  privacySignInReady,
  reauthRequested,
}: {
  accountSyncReady: boolean;
  privacySignInReady: boolean;
  reauthRequested: boolean;
}) {
  const router = useRouter();
  const emailInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<string>();
  const [messageKind, setMessageKind] = useState<MessageKind>("error");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const productionSetupRequired = !accountSyncReady && process.env.NODE_ENV === "production";
  const showAccountForm = accountSyncReady || (reauthRequested && privacySignInReady);

  useEffect(() => {
    let cancelled = false;

    async function prefillCurrentAccountEmail() {
      if (!reauthRequested || !privacySignInReady) return;
      const supabase = getBrowserSupabase();
      if (!supabase) return;

      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        const session = error ? undefined : data.session;
        if (session?.user.email) setEmail(session.user.email);
      } catch {
        // Email prefill is optional; the learner can still enter it directly.
      }
    }

    void prefillCurrentAccountEmail();
    return () => {
      cancelled = true;
    };
  }, [privacySignInReady, reauthRequested]);

  function showMessage(kind: MessageKind, text: string) {
    setMessageKind(kind);
    setMessage(text);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    const supabase = getBrowserSupabase();
    if (!supabase) {
      showMessage("error", "Account sign-in is temporarily unavailable. Please try again later.");
      return;
    }

    setBusy(true);
    setMessage(undefined);

    try {
      const trimmedEmail = email.trim();
      const outcome = isSignUp
        ? await supabase.auth.signUp({
            email: trimmedEmail,
            password,
            options: {
              emailRedirectTo: getConfirmationRedirectUrl(),
            },
          })
        : await supabase.auth.signInWithPassword({ email: trimmedEmail, password });

      if (outcome.error) {
        setNeedsConfirmation(requiresEmailConfirmation(outcome.error));
        showMessage("error", friendlyAuthError(outcome.error));
        return;
      }

      if (isSignUp) {
        setNeedsConfirmation(true);
        showMessage(
          "success",
          "Account created. Check your email and spam folder, then open the confirmation link to finish setup.",
        );
        return;
      }

      router.push(getSafeRedirectPath());
    } catch {
      showMessage("error", "We couldn’t reach the sign-in service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    const supabase = getBrowserSupabase();

    const trimmedEmail = email.trim();
    if (!supabase || !trimmedEmail) {
      showMessage("error", "Enter your email address first, then resend the confirmation link.");
      emailInput.current?.focus();
      return;
    }

    setResending(true);
    setMessage(undefined);

    try {
      const result = await requestSignupConfirmation(
        (input) => supabase.auth.resend(input),
        trimmedEmail,
        getConfirmationRedirectUrl(),
      );

      if (result.kind === "success") setNeedsConfirmation(true);
      showMessage(result.kind, result.message);
    } catch {
      showMessage("error", "We couldn’t prepare the confirmation link. Continue without an account and try again later.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main id="main-content" className="page-shell flex min-h-screen items-center justify-center py-10">
      <section className="card w-full max-w-md">
        <Link href="/" className="text-sm font-bold text-coral">
          &lt;- Back to home
        </Link>

        <p className="eyebrow mt-8">{reauthRequested ? "Privacy check" : "Your learning space"}</p>
        <h1 className="mt-2 text-3xl font-black">
          {reauthRequested ? "Confirm it’s you" : isSignUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          {reauthRequested
            ? "Enter your password again before exporting or deleting account learning data."
            : isSignUp
            ? "Create an account to keep progress across devices and use friends. You can keep learning on this device without one."
            : "Sign in to continue your saved learning, or continue without an account."}
        </p>

        {showAccountForm ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block font-bold">
              Email
              <input
                ref={emailInput}
                className="field"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className="block font-bold">
              Password
              <input
                className="field"
                type="password"
                minLength={isSignUp ? 8 : undefined}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            <button className="button-primary w-full" type="submit" disabled={busy || resending}>
              {busy ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
            </button>

            {!reauthRequested && (
              <>
                <div className={needsConfirmation ? "rounded-2xl bg-amber/10 p-4" : "text-center"}>
                  {needsConfirmation && (
                    <p className="mb-3 text-sm text-ink/75">Still waiting for the email? You can request a fresh link.</p>
                  )}
                  <button
                    className={needsConfirmation ? "button-secondary w-full" : "text-sm font-bold text-coral underline"}
                    type="button"
                    onClick={resendConfirmation}
                    disabled={resending || busy}
                  >
                    {resending ? "Requesting confirmation email..." : "Resend confirmation email"}
                  </button>
                </div>

                <button
                  className="w-full text-sm font-bold text-coral"
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setMessage(undefined);
                  }}
                >
                  {isSignUp ? "I already have an account" : "I need an account"}
                </button>

                <Link className="button-secondary block w-full text-center" href="/demo">
                  Continue without an account
                </Link>
              </>
            )}
          </form>
        ) : reauthRequested ? (
          <div className="mt-6 space-y-4">
            <p className="status-error" role="alert">
              Account privacy sign-in is temporarily unavailable. Try again later before exporting or deleting account data.
            </p>
            <Link className="button-secondary block w-full text-center" href="/privacy">
              Return to Privacy
            </Link>
          </div>
        ) : productionSetupRequired ? (
          <div className="mt-6 space-y-4">
            <p className="status-error">
              Accounts are temporarily unavailable while email confirmation is being tested. You can continue learning without an account.
            </p>
            <Link className="button-primary block w-full text-center" href="/demo">
              Continue without an account
            </Link>
            <Link className="button-secondary block w-full text-center" href="/status">
              View public status
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <p className="status-success">
              Development demo mode is active because Supabase is not configured. It never runs in production.
            </p>
            <button className="button-primary mt-5 w-full" onClick={() => router.push(getSafeRedirectPath())}>
              Try the local demo
            </button>
          </div>
        )}

        {message && (
          <p
            className={messageKind === "success" ? "status-success mt-4" : "status-error mt-4"}
            role={messageKind === "success" ? "status" : "alert"}
          >
            {message}
          </p>
        )}

      </section>
    </main>
  );
}
