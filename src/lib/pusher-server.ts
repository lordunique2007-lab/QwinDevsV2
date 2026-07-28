import PusherServer from "pusher";

let pusherServer: PusherServer | null = null;

/**
 * Lazily-constructed Pusher server client. Returns null if Pusher env vars
 * aren't configured, so the app degrades gracefully (falls back silently —
 * callers should not crash if this is null; real-time is an enhancement,
 * not a requirement for messages to send).
 */
export function getPusherServer(): PusherServer | null {
  if (pusherServer) return pusherServer;

  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
    return null;
  }

  pusherServer = new PusherServer({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS: true
  });

  return pusherServer;
}

export async function triggerEvent(channel: string, event: string, data: unknown) {
  const server = getPusherServer();
  if (!server) return; // Real-time disabled until Pusher env vars are set — not a hard failure.
  await server.trigger(channel, event, data).catch((err) => {
    console.error("Pusher trigger failed:", err);
  });
}

export const CHANNELS = {
  conversation: (id: string) => `conversation-${id}`,
  community: (id: string) => `community-${id}`,
  userNotifications: (userId: string) => `user-${userId}-notifications`
};

export const EVENTS = {
  NEW_MESSAGE: "new-message",
  MESSAGE_UPDATED: "message-updated",
  NEW_NOTIFICATION: "new-notification",
  TYPING: "typing"
};
