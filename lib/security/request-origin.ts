import { NextResponse } from "next/server";

function hasBearerAuthorization(request: Request) {
  return /^Bearer\s+\S+$/i.test(request.headers.get("authorization") ?? "");
}

function configuredApplicationOrigin() {
  try {
    return process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Production browser mutations must either carry an explicit bearer token or
 * come from the configured application origin. This keeps cookie fallback
 * useful for auth refresh while rejecting cross-origin form/fetch requests.
 */
export function rejectUntrustedMutation(request: Request) {
  if (hasBearerAuthorization(request) || process.env.NODE_ENV !== "production") {
    return null;
  }

  const expectedOrigin = configuredApplicationOrigin();
  const requestOrigin = request.headers.get("origin");
  if (expectedOrigin && requestOrigin === expectedOrigin) return null;

  return NextResponse.json(
    { error: "This request did not come from the application." },
    { status: 403 },
  );
}
