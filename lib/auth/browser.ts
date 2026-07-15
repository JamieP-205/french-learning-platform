"use client";

import { createBrowserClient } from "@supabase/ssr";

export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export async function getBrowserAccessToken() {
  const supabase = getBrowserSupabase();
  if (!supabase) return undefined;

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

export async function getBrowserAuthHeaders({ json = false }: { json?: boolean } = {}) {
  const headers: Record<string, string> = {};
  const accessToken = await getBrowserAccessToken();

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}
