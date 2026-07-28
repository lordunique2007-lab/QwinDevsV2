"use client";

import { useState } from "react";

export default function QuickEntityModeration({
  kind,
  id,
  status,
  onChanged
}: {
  kind: "community" | "bot";
  id: string;
  status: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const banLabel = kind === "community" ? "ban" : "suspend";
  const unbanLabel = kind === "community" ? "unban" : "unsuspend";
  const bannedStatus = kind === "community" ? "BANNED" : "SUSPENDED";

  async function act(action: string) {
    if (!confirm(`Are you sure you want to ${action.replace("_", " ")} this ${kind}?`)) return;
    const reason = action === banLabel || action === "freeze" ? prompt("Reason?") ?? "" : "";

    setBusy(true);
    const res = await fetch(`/api/admin/${kind === "community" ? "communities" : "bots"}/${id}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason })
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
      <span className="text-xs text-qwin-muted">Staff: {status}</span>
      <div className="ml-auto flex gap-1.5">
        {status === "ACTIVE" ? (
          <>
            <button disabled={busy} onClick={() => act("freeze")} className="btn-secondary px-2 py-1 text-xs">
              Freeze
            </button>
            <button disabled={busy} onClick={() => act(banLabel)} className="btn-secondary px-2 py-1 text-xs text-red-400">
              {kind === "community" ? "Quick ban" : "Suspend"}
            </button>
          </>
        ) : (
          <button
            disabled={busy}
            onClick={() => act(status === bannedStatus ? unbanLabel : "unfreeze")}
            className="btn-secondary px-2 py-1 text-xs"
          >
            Restore
          </button>
        )}
      </div>
    </div>
  );
}
