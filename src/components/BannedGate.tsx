"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

type AccountStatus = {
  signedIn: boolean;
  username?: string;
  status?: "ACTIVE" | "FROZEN" | "BANNED";
  banReason?: string | null;
  bannedUntil?: string | null;
};

const CHECK_INTERVAL_MS = 30000;

export default function BannedGate({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState<AccountStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/auth/status");
        if (!res.ok) return;
        const data: AccountStatus = await res.json();
        if (cancelled) return;
        if (data.signedIn && (data.status === "BANNED" || data.status === "FROZEN")) {
          setBlocked(data);
        } else {
          setBlocked(null);
        }
      } catch {
        // Network hiccup — don't lock someone out over a failed check.
      }
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", check);
    };
  }, []);

  if (!blocked) return <>{children}</>;

  const isBan = blocked.status === "BANNED";
  const until = blocked.bannedUntil ? new Date(blocked.bannedUntil) : null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-qwin-bg p-4">
      <div className="card max-w-md p-8 text-center">
        <div className="text-5xl">{isBan ? "🚫" : "🧊"}</div>
        <h1 className="mt-4 font-display text-xl font-bold">
          {isBan ? "This account has been banned" : "This account has been frozen"}
        </h1>
        {blocked.banReason && <p className="mt-2 text-sm text-qwin-muted">Reason: {blocked.banReason}</p>}
        {isBan && until && (
          <p className="mt-2 text-sm text-qwin-muted">
            You&apos;ll be able to sign in again after {until.toLocaleDateString()} at {until.toLocaleTimeString()}.
          </p>
        )}
        {isBan && !until && (
          <p className="mt-2 text-sm text-qwin-muted">This ban does not have an expiration date.</p>
        )}
        {!isBan && (
          <p className="mt-2 text-sm text-qwin-muted">
            Contact platform staff if you believe this was a mistake.
          </p>
        )}
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-primary mt-6 w-full">
          Sign out
        </button>
      </div>
    </div>
  );
}
