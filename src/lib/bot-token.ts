import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";

/** Generates a bot API token: qwin_bot_<32 random hex chars>. */
export function generateBotToken(): string {
  return `qwin_bot_${randomBytes(24).toString("hex")}`;
}

export async function hashBotToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

export async function verifyBotToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

/** Short, non-secret preview shown in the dashboard so owners can recognize the token, e.g. qwin_bot_ab12…f9. */
export function tokenPreview(token: string): string {
  return `${token.slice(0, 13)}…${token.slice(-4)}`;
}

/** Deterministic short fingerprint, useful for log correlation without storing the raw token. */
export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}
