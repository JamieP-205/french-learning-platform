import { SignInForm } from "@/app/auth/sign-in/sign-in-form";
import {
  isServerAccountSyncReady,
  isServerPrivacyAccessReady,
} from "@/lib/auth/readiness";

type SignInPageProps = {
  searchParams: Promise<{
    reauth?: string | string[];
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;

  return (
    <SignInForm
      accountSyncReady={isServerAccountSyncReady()}
      privacySignInReady={isServerPrivacyAccessReady()}
      reauthRequested={params.reauth === "1"}
    />
  );
}
