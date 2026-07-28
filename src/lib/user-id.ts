/**
 * Every account gets a permanent numeric ID (like Telegram's user ID) in
 * addition to its username. The username is a mutable, hideable public
 * handle; the numeric ID never changes and is always resolvable, even if
 * the username is hidden from public view.
 *
 * Internally this rides on a Postgres auto-increment sequence starting at 1.
 * OFFSET shifts the displayed value so the first real account reads as a
 * 10-digit number (1,000,000,001) instead of starting at 1 — purely
 * cosmetic, the underlying sequence is untouched.
 */
const OFFSET = 1_000_000_000;

export function formatNumericId(numericId: number): string {
  return String(numericId + OFFSET);
}
