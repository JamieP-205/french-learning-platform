import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isServerAccountSyncReady } from "@/lib/auth/readiness";
import { getSafeAuthDestination } from "@/lib/auth/redirects";

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const safeNext = getSafeAuthDestination(requestUrl.searchParams.get("next"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.redirect(new URL(safeNext, requestUrl.origin));

  if (!isServerAccountSyncReady() || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/auth/sign-in", requestUrl.origin));
  }

  if (code) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.redirect(new URL(safeNext, requestUrl.origin));

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/auth/sign-in", requestUrl.origin));
    }
  }

  return response;
}
