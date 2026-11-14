/**
 * Sign-in rule for GateHub accounts. An explicit `email_verified: false` is
 * rejected; a missing claim is accepted so providers that omit it keep working.
 */
export function isSignInAllowed(email: string | null | undefined, allowed: string[], emailVerified?: unknown) {
  if (emailVerified === false) return false;
  const normalized = email?.toLowerCase();
  return Boolean(normalized && allowed.includes(normalized));
}
