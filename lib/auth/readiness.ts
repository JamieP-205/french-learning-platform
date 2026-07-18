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

/** Existing learners need the complete account data stack for privacy actions. */
export function isServerPrivacyAccessReady(environment: AccountSyncEnvironment = process.env) {
  return (
    hasConfigurationValue(environment.NEXT_PUBLIC_SUPABASE_URL) &&
    hasConfigurationValue(environment.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    hasConfigurationValue(environment.SUPABASE_SERVICE_ROLE_KEY)
  );
}

/** Account APIs also require the server-only key used for durable learner data. */
export function isServerAccountSyncReady(environment: AccountSyncEnvironment = process.env) {
  return isAccountSyncReady(environment) && isServerPrivacyAccessReady(environment);
}
