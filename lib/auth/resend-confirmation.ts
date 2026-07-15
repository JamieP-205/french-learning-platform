import { friendlyAuthError, type AuthErrorLike } from "@/lib/auth/messages";

type ResendInput = {
  type: "signup";
  email: string;
  options: { emailRedirectTo: string };
};

export type ConfirmationResendResult =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export async function requestSignupConfirmation(
  resend: (input: ResendInput) => PromiseLike<{ error: AuthErrorLike | null }>,
  email: string,
  emailRedirectTo: string,
): Promise<ConfirmationResendResult> {
  try {
    const { error } = await resend({
      type: "signup",
      email,
      options: { emailRedirectTo },
    });

    if (error) return { kind: "error", message: friendlyAuthError(error) };

    return {
      kind: "success",
      message: "Confirmation email requested. If this address has an unconfirmed account, check its inbox and spam folder.",
    };
  } catch {
    return {
      kind: "error",
      message: "We couldn’t request a confirmation email. Check your connection and try again.",
    };
  }
}
