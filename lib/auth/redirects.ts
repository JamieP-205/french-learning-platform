const DEFAULT_AUTH_DESTINATION = "/today";

/**
 * Brand-new accounts still need the questionnaire, so signup confirmation
 * links carry this explicit destination. Returning sign-ins use the default
 * above and land on the dashboard; the onboarding page itself sends anyone
 * with a saved profile back to Today.
 */
export const NEW_ACCOUNT_DESTINATION = "/onboarding";
const APP_ORIGIN = "https://french-for-life.invalid";

function isHttpOrigin(value: string | undefined) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
    if (url.protocol !== "https:" && !isLocalHttp) return undefined;
    if (url.username || url.password) return undefined;
    if (url.pathname !== "/" || url.search || url.hash) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function getSafeAuthDestination(
  requestedPath: string | null | undefined,
  fallback = DEFAULT_AUTH_DESTINATION,
) {
  if (!requestedPath || /[\u0000-\u001f\\]/u.test(requestedPath)) return fallback;

  try {
    const base = new URL(APP_ORIGIN);
    const resolved = new URL(requestedPath, base);
    const pathname = resolved.pathname.toLowerCase();

    if (resolved.origin !== base.origin) return fallback;
    if (!requestedPath.startsWith("/") || requestedPath.startsWith("//")) return fallback;
    if (pathname === "/auth" || pathname.startsWith("/auth/")) return fallback;

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export function buildConfirmationRedirectUrl({
  configuredAppUrl,
  browserOrigin,
  next = DEFAULT_AUTH_DESTINATION,
}: {
  configuredAppUrl?: string;
  browserOrigin: string;
  next?: string | null;
}) {
  const origin = isHttpOrigin(configuredAppUrl) ?? isHttpOrigin(browserOrigin);
  if (!origin) throw new Error("A valid application origin is required for email confirmation.");

  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", getSafeAuthDestination(next));
  return callback.toString();
}
