"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const TIERS = [
  {
    key: "PREMIUM",
    label: "Premium",
    cost: 300,
    perks: ["300-character bio", "Animated profile frame eligibility", "Priority support"]
  },
  {
    key: "PREMIUM_PLUS",
    label: "Premium Plus",
    cost: 600,
    perks: ["500-character bio", "Everything in Premium", "Higher upload limits", "Exclusive reactions"]
  }
];

export default function PremiumPage() {
  const { status } = useSession();
  const router = useRouter();
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function purchase(tier: string) {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    setBusyTier(tier);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/premium/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier })
    });
    const data = await res.json();
    setBusyTier(null);
    if (!res.ok) {
      setError(data.error ?? "Purchase failed.");
      return;
    }
    setMessage(`Active until ${new Date(data.premiumUntil).toLocaleDateString()}.`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-bold">Qwin Premium</h1>
        <p className="mt-1 text-qwin-muted">Paid for with Qwin Currency — no external payment required.</p>
      </div>

      {error && <p className="mb-4 text-center text-sm text-red-400">{error}</p>}
      {message && <p className="mb-4 text-center text-sm text-qwin-accent">{message}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {TIERS.map((t) => (
          <div key={t.key} className="card p-6">
            <h2 className="font-display text-lg font-bold">{t.label}</h2>
            <p className="mt-1 text-2xl font-bold text-qwin-gold">{t.cost} QC<span className="text-sm text-qwin-muted"> / month</span></p>
            <ul className="mt-4 space-y-1 text-sm text-qwin-muted">
              {t.perks.map((p) => (
                <li key={p}>✓ {p}</li>
              ))}
            </ul>
            <button
              onClick={() => purchase(t.key)}
              disabled={busyTier === t.key}
              className="btn-primary mt-4 w-full"
            >
              {busyTier === t.key ? "Processing…" : `Subscribe for ${t.cost} QC`}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-qwin-muted">
        Buying early extends your current subscription rather than wasting remaining time.
        Need QC? Earn it from supporters or top up in your <a href="/wallet" className="text-qwin-primary2 hover:underline">wallet</a>.
      </p>
    </div>
  );
}
