import { createHmac, randomBytes } from "crypto";

export function generateWebhookSecret(): string {
  return randomBytes(24).toString("hex");
}

function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Sends a bot event to the owner's own webhook URL — this is the mechanism
 * that lets a bot actually be written in Python, JS, Go, or anything else:
 * exactly like Telegram, Qwin Devs never executes the developer's own bot
 * code. Instead their external server receives this HTTP POST, does
 * whatever it wants in whatever language, and calls back
 * POST /api/bots/{username}/send (with the bot's token) to reply.
 *
 * Fire-and-forget with a short timeout — a slow or failing webhook must
 * never block or fail the request that triggered it.
 */
export async function deliverWebhook(params: {
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
}) {
  const body = JSON.stringify({
    event: params.event,
    timestamp: new Date().toISOString(),
    data: params.payload
  });
  const signature = signPayload(params.secret, body);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(params.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Qwin-Signature": signature
      },
      body,
      signal: controller.signal
    });
    clearTimeout(timeout);
  } catch (err) {
    // Webhook delivery failures are logged, never thrown — the bot's
    // synchronous static/script response (if any) already went out.
    console.error("Webhook delivery failed:", (err as Error).message);
  }
}
