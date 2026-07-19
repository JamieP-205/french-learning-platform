import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { DEMO_USER_ID, hasSupabaseAuthConfiguration } from "@/lib/data";
import { E2E_LEARNER_COOKIE, resolveDevelopmentLearnerId } from "@/lib/auth/development-user";
import { isServerAccountSyncReady } from "@/lib/auth/readiness";

export const isDevelopmentDemoMode = () => !hasSupabaseAuthConfiguration && process.env.NODE_ENV !== "production";

function getBearerToken(authorization: string | null) {
  if (!authorization) return undefined;

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return undefined;

  return token;
}

export type CurrentUserAuthContext = {
  userId: string;
  recentlyAuthenticated: boolean;
};

const RECENT_AUTHENTICATION_WINDOW_MS = 15 * 60 * 1000;
const RECENT_AUTHENTICATION_METHODS = new Set(["password"]);

export function hasRecentAuthenticationMethod(claims: unknown, now = Date.now()) {
  if (!claims || typeof claims !== "object" || !("amr" in claims) || !Array.isArray(claims.amr)) {
    return false;
  }
  const authenticationTimes = claims.amr.flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      !("method" in entry) ||
      typeof entry.method !== "string" ||
      !RECENT_AUTHENTICATION_METHODS.has(entry.method) ||
      !("timestamp" in entry)
    ) {
      return [];
    }
    const timestamp = Number(entry.timestamp) * 1000;
    return Number.isFinite(timestamp) ? [timestamp] : [];
  });
  const latestAuthentication = Math.max(...authenticationTimes, Number.NEGATIVE_INFINITY);
  const age = now - latestAuthentication;
  return age >= -60_000 && age <= RECENT_AUTHENTICATION_WINDOW_MS;
}

async function resolveCurrentUserAuthContext(
  requireAccountSyncReady: boolean,
  requireRecentAuthentication: boolean,
): Promise<CurrentUserAuthContext | null> {
  if (!hasSupabaseAuthConfiguration) {
    if (!isDevelopmentDemoMode()) return null;
    const cookieStore = await cookies();
    return {
      userId: resolveDevelopmentLearnerId(cookieStore.get(E2E_LEARNER_COOKIE)?.value, DEMO_USER_ID),
      recentlyAuthenticated: true,
    };
  }

  // Supabase configuration alone does not open account learning. Privacy
  // export and deletion opt out below so existing learners keep those rights
  // while signup or account learning is paused.
  if (requireAccountSyncReady && !isServerAccountSyncReady()) return null;

  const cookieStore = await cookies();
  const headerStore = await headers();
  const bearerToken = getBearerToken(headerStore.get("authorization"));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (entries: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            entries.forEach(({ name, value, options }) => cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]));
          } catch {
            // Server Components cannot always write cookies; auth refresh remains handled by route handlers.
          }
        },
      },
    },
  );

  async function buildAuthContext(userId: string, accessToken?: string): Promise<CurrentUserAuthContext> {
    if (!requireRecentAuthentication) {
      return { userId, recentlyAuthenticated: false };
    }

    try {
      const { data, error } = await supabase.auth.getClaims(accessToken);
      return {
        userId,
        recentlyAuthenticated: !error &&
          data?.claims.sub === userId &&
          hasRecentAuthenticationMethod(data.claims),
      };
    } catch {
      // High-assurance actions fail closed if local JWT verification or the
      // signing-key lookup is unavailable. Routine learning never depends on
      // this extra check.
      return { userId, recentlyAuthenticated: false };
    }
  }

  if (bearerToken) {
    const { data } = await supabase.auth.getUser(bearerToken);
    if (data.user?.id && data.user.email_confirmed_at) {
      return buildAuthContext(data.user.id, bearerToken);
    }
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user?.email_confirmed_at) return null;
  return buildAuthContext(data.user.id);
}

export function getCurrentUserAuthContext(): Promise<CurrentUserAuthContext | null> {
  return resolveCurrentUserAuthContext(true, false);
}

/**
 * Existing learners retain access to export and deletion even while new
 * account learning is paused by the launch gate.
 */
export function getCurrentPrivacyUserAuthContext(): Promise<CurrentUserAuthContext | null> {
  return resolveCurrentUserAuthContext(false, true);
}

export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUserAuthContext())?.userId ?? null;
}

export async function requireCurrentUserId() {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Authentication is required.");
  return userId;
}
