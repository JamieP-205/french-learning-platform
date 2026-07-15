export type AuthErrorLike = {
  code?: string | null;
  message: string;
};

export function requiresEmailConfirmation(error: AuthErrorLike) {
  return error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message);
}

export function friendlyAuthError(error: AuthErrorLike) {
  if (requiresEmailConfirmation(error)) {
    return "Your email address hasn’t been confirmed yet. Resend the confirmation email below, then check your inbox and spam folder.";
  }

  if (error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message)) {
    return "Those details didn’t sign you in. Check the email and password, or resend the confirmation email if you haven’t confirmed your account yet.";
  }

  if (error.code === "over_request_rate_limit" || /rate limit|too many/i.test(error.message)) {
    return "Too many attempts too quickly. Wait a minute, then try again.";
  }

  if (error.code === "email_address_not_authorized" || /email address not authorized/i.test(error.message)) {
    return "This site’s email service cannot send to that address yet. You can continue learning without an account while email delivery is fixed.";
  }

  return "We couldn’t complete that account request. Try again, or continue learning without an account.";
}
