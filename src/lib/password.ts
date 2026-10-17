import argon2 from "argon2";

// Valid argon2id hash of a random string, used to keep failed-login timing uniform.
const DUMMY =
  "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$Zr9m2m0m9hQ3kz9o1zYf3q8w0yq2cYp3VJm1b9mWm5E";

export function hashPassword(pw: string) {
  return argon2.hash(pw, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string | null, pw: string): Promise<boolean> {
  try {
    return await argon2.verify(hash ?? DUMMY, pw).then((ok) => ok && hash !== null);
  } catch {
    return false;
  }
}

/** Minimum bar: 10+ chars and not a trivially common choice. */
const COMMON = new Set(["password123", "1234567890", "qwertyuiop", "password1234", "letmein1234", "iloveyou123"]);
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 200) return "That password is too long.";
  if (COMMON.has(pw.toLowerCase())) return "That password is too common.";
  return null;
}
