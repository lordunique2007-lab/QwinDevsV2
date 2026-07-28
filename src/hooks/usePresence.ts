"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

const HEARTBEAT_MS = 30000;

export function usePresenceHeartbeat() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;

    async function ping() {
      if (!active) return;
      fetch("/api/presence", { method: "POST" }).catch(() => null);
    }

    ping();
    const interval = setInterval(ping, HEARTBEAT_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [status]);
}

/** Formats a lastActiveAt timestamp as "Online" (within 60s) or "Last seen ...". */
export function formatPresence(lastActiveAt: string | null | undefined): string {
  if (!lastActiveAt) return "Offline";
  const diffMs = Date.now() - new Date(lastActiveAt).getTime();
  if (diffMs < 60000) return "Online";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `Last seen ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  return `Last seen ${new Date(lastActiveAt).toLocaleDateString()}`;
}

export function isOnline(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < 60000;
}
