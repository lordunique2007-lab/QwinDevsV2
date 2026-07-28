"use client";

import { useState } from "react";

export type ModerationInfo = {
  id: string;
  status: "ACTIVE" | "FROZEN" | "BANNED";
  banReason: string | null;
  bannedUntil: string | null;
};

export default function QuickModeration({
  moderation,
  onChanged
}: {
  moderation: ModerationInfo;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function act(action: "ban" | "unban" | "freeze" | "unfreeze") {
    let reason = "";
    let bannedUntil: string | undefined;

    if (action === "ban") {
      reason = prompt("Ban reason?") ?? "";
      const durationChoice = prompt("Ban duration in days (leave blank for permanent). Examples: 1, 7, 30");
      if (durationChoice && !isNaN(Number(durationChoice)) && Number(durationChoice) > 0) {
        bannedUntil = new Date(Date.now() + Number(durationChoice) * 24 * 60 * 60 * 1000).toISOString();
      }
      if (!confirm(`Ban this account${bannedUntil ? " temporarily" : " permanently"}?`)) return;
    } else if (action === "freeze") {
      reason = prompt("Freeze reason?") ?? "";
      if (!confirm("Freeze this account?")) return;
    } else if (!confirm(`${action === "unban" ? "Unban" : "Unfreeze"} this account?`)) {
      return;
    }

    setBusy(true);
    const res = await fetch(`/api/admin/users/${moderation.id}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason, bannedUntil })
    });
    setBusy(false);

    if (res.ok) {
      onChanged();
    } else {
      const data = await res.json();
      alert(data.error ?? "Action failed.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-900/40 bg-red-950/20 p-2">
      <span className="text-xs text-qwin-muted">
        Staff: {moderation.status}
        {moderation.banReason && ` — "${moderation.banReason}"`}
        {moderation.bannedUntil && ` (until ${new Date(moderation.bannedUntil).toLocaleDateString()})`}
      </span>
      <div className="ml-auto flex gap-1.5">
        {moderation.status === "ACTIVE" ? (
          <>
            <button disabled={busy} onClick={() => act("freeze")} className="btn-secondary px-2 py-1 text-xs">
              Freeze
            </button>
            <button disabled={busy} onClick={() => act("ban")} className="btn-secondary px-2 py-1 text-xs text-red-400">
              Quick ban
            </button>
          </>
        ) : (
          <button
            disabled={busy}
            onClick={() => act(moderation.status === "BANNED" ? "unban" : "unfreeze")}
            className="btn-secondary px-2 py-1 text-xs"
          >
            Restore
          </button>
        )}
      </div>
    </div>
  );
}
