export function ageOn(dateOfBirth: string, now = new Date()): number {
  const birthDate = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function isEligibleCountryAge({ birthDate, minimumAge }: { birthDate: string; minimumAge: number | null }) {
  if (!minimumAge) return { eligible: false, reason: "This country is not yet enabled for public signup." };
  if (ageOn(birthDate) < minimumAge) return { eligible: false, reason: `You must be at least ${minimumAge} to create an account here.` };
  return { eligible: true, minimumAge };
}
