export const FRIEND_REQUEST_RETRY_COOLDOWN_DAYS = 7;
export const FRIEND_REQUEST_RETRY_COOLDOWN_MS = FRIEND_REQUEST_RETRY_COOLDOWN_DAYS * 24 * 60 * 60 * 1_000;

export function isFriendRequestRetryCoolingDown(respondedAt?: string, now = Date.now()) {
  if (!respondedAt) return false;
  const respondedAtMs = Date.parse(respondedAt);
  return Number.isFinite(respondedAtMs) && respondedAtMs + FRIEND_REQUEST_RETRY_COOLDOWN_MS > now;
}

export function coopChallengeProgress(input: {
  yourStartingSessions: number;
  friendStartingSessions: number;
  yourCompletedSessions: number;
  friendCompletedSessions: number;
}) {
  const yourProgress = Math.max(0, input.yourCompletedSessions - input.yourStartingSessions);
  const friendProgress = Math.max(0, input.friendCompletedSessions - input.friendStartingSessions);
  return {
    yourProgress,
    friendProgress,
    combinedProgress: yourProgress + friendProgress,
  };
}
