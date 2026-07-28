"use client";

import { useEffect, useRef } from "react";
import PusherClient from "pusher-js";

let sharedClient: PusherClient | null = null;

function getPusherClient(): PusherClient | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return null; // Real-time disabled — falls back to whatever polling the caller does.

  if (!sharedClient) {
    sharedClient = new PusherClient(key, { cluster });
  }
  return sharedClient;
}

/**
 * Subscribes to a Pusher channel/event for the lifetime of the component.
 * If Pusher isn't configured (no env vars), this is a silent no-op — the
 * calling component should keep its own polling fallback so chat still
 * works either way.
 */
export function usePusherChannel<T = unknown>(
  channelName: string | null,
  eventName: string,
  onEvent: (data: T) => void
) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!channelName) return;
    const client = getPusherClient();
    if (!client) return;

    const channel = client.subscribe(channelName);
    const handler = (data: T) => handlerRef.current(data);
    channel.bind(eventName, handler);

    return () => {
      channel.unbind(eventName, handler);
      client.unsubscribe(channelName);
    };
  }, [channelName, eventName]);
}

export function isRealtimeEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_PUSHER_KEY;
}
