export const FRIEND_CODE_LENGTH = 22;

export function normalizeFriendCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, FRIEND_CODE_LENGTH);
}

export function generateFriendCode() {
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  return `FR${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function formatFriendCode(value: string) {
  const normalized = normalizeFriendCode(value);
  if (!normalized.startsWith("FR")) return normalized;
  const groups = normalized.slice(2).match(/.{1,4}/g) ?? [];
  return ["FR", ...groups].join("-");
}
