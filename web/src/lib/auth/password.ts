import bcrypt from "bcryptjs";

/** Cost factor — higher = slower but more resistant to brute force. */
const BCRYPT_ROUNDS = 12;

/**
 * Hash a plaintext password with bcrypt + salt.
 * GotREFS uses Supabase Auth for login (passwords stored in auth.users, hashed by Supabase).
 * Use these helpers only for self-hosted auth or admin tooling — never log the plaintext.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  if (!plaintext || plaintext.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/** Compare plaintext to a stored bcrypt hash. */
export async function verifyPassword(plaintext: string, passwordHash: string): Promise<boolean> {
  if (!plaintext || !passwordHash) return false;
  return bcrypt.compare(plaintext, passwordHash);
}

/** Basic strength rules before signup. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password is too long.";
  if (!/[a-zA-Z]/.test(password)) return "Password must include at least one letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  return null;
}
