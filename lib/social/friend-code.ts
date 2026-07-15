export function normalizeFriendCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function friendCodeForUser(userId: string) {
  const base = normalizeFriendCode(userId);
  return `FR${base.slice(0, 8).padEnd(8, "0")}`;
}
