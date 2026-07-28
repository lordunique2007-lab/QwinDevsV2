"use client";

import { useState } from "react";

const OPTIONS: { duration: string; label: string; cost: number }[] = [
  { duration: "24h", label: "24 hours", cost: 100 },
  { duration: "3d", label: "3 days", cost: 250 },
  { duration: "7d", label: "7 days", cost: 500 },
  { duration: "14d", label: "14 days", cost: 900 },
  { duration: "30d", label: "30 days", cost: 1600 }
];

export default function BoostButton({
  targetType,
  targetId,
  isBoosted,
  onBoosted
}: {
  targetType: "PROJECT" | "BOT" | "COMMUNITY";
  targetId: string;
  isBoosted: boolean;
  onBoosted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy(duration: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/boosts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, duration })
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Boost purchase failed.");
      return;
    }
    setOpen(false);
    onBoosted?.();
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn-secondary text-sm">
        🚀 {isBoosted ? "Extend boost" : "Boost"}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-qwin-border bg-qwin-surface p-2 shadow-lg">
          <p className="mb-1 px-2 text-xs text-qwin-muted">Spend QC to boost visibility</p>
          {OPTIONS.map((o) => (
            <button
              key={o.duration}
              disabled={busy}
              onClick={() => buy(o.duration)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-qwin-surface2"
            >
              <span>{o.label}</span>
              <span className="text-qwin-gold">{o.cost} QC</span>
            </button>
          ))}
          {error && <p className="mt-1 px-2 text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
