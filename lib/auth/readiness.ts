export type AccountSyncEnvironment = Record<string, string | undefined>;

function hasConfigurationValue(value: string | undefined) {
  return Boolean(value?.trim());
}

export function isAccountSyncReady(environment: AccountSyncEnvironment = process.env) {
  return (
    environment.NEXT_PUBLIC_ACCOUNT_SYNC_READY === "true" &&
    hasConfigurationValue(environment.NEXT_PUBLIC_SUPABASE_URL) &&
    hasConfigurationValue(environment.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}
