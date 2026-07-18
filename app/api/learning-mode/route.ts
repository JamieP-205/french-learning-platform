import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { E2E_LEARNER_COOKIE } from "@/lib/auth/development-user";
import { getCurrentUserId, isDevelopmentDemoMode } from "@/lib/auth/server";
import { hasSupabaseAuthConfiguration } from "@/lib/data";

export async function GET() {
  if (hasSupabaseAuthConfiguration) {
    return NextResponse.json({
      mode: (await getCurrentUserId()) ? "account" : "local",
      developmentDemo: false,
    });
  }

  if (isDevelopmentDemoMode()) {
    const cookieStore = await cookies();
    return NextResponse.json({
      mode: cookieStore.has(E2E_LEARNER_COOKIE) ? "account" : "local",
      developmentDemo: true,
    });
  }

  return NextResponse.json({ mode: "local", developmentDemo: false });
}
