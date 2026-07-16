import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { DEMO_USER_ID, hasSupabaseAuthConfiguration } from "@/lib/data";
import { E2E_LEARNER_COOKIE, resolveDevelopmentLearnerId } from "@/lib/auth/development-user";

export const isDevelopmentDemoMode = () => !hasSupabaseAuthConfiguration && process.env.NODE_ENV !== "production";

function getBearerToken(authorization: string | null) {
  if (!authorization) return undefined;

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return undefined;

  return token;
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!hasSupabaseAuthConfiguration) {
    if (!isDevelopmentDemoMode()) return null;
    const cookieStore = await cookies();
    return resolveDevelopmentLearnerId(cookieStore.get(E2E_LEARNER_COOKIE)?.value, DEMO_USER_ID);
  }

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

  if (bearerToken) {
    const { data } = await supabase.auth.getUser(bearerToken);
    if (data.user?.id) return data.user.id;
  }

  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function requireCurrentUserId() {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Authentication is required.");
  return userId;
}
