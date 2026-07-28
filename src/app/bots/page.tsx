"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";

type BotSummary = {
  username: string;
  name: string;
  description: string;
  category: string;
  isVerified: boolean;
  commandsExecuted: number;
  isBoosted?: boolean;
  owner: { username: string; displayName: string; isVerified: boolean };
};

export default function BotsPage() {
  const [bots, setBots] = useState<BotSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bots")
      .then((r) => r.json())
      .then((data) => {
        setBots(data.bots);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Botmother — Bot directory</h1>
        <Link href="/bots/new" className="btn-primary text-sm">
          + Create bot
        </Link>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-32 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && bots.length === 0 && (
        <div className="card p-10 text-center text-qwin-muted">No bots published yet.</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bots.map((b) => (
          <Link
            key={b.username}
            href={`/bots/${b.username}`}
            className={`card block p-4 hover:border-qwin-primary/50 ${b.isBoosted ? "border-qwin-gold/50 shadow-goldglow" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-1.5 font-display font-semibold">
                  🤖 {b.name} {b.isVerified && <VerifiedBadge size={13} />}
                </h3>
                <p className="line-clamp-2 text-sm text-qwin-muted">{b.description}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {b.isBoosted && <span className="badge bg-qwin-gold/20 text-qwin-gold">🚀</span>}
                <span className="badge bg-qwin-surface2 text-qwin-muted">{b.category}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-qwin-border pt-3 text-xs text-qwin-muted">
              <span>@{b.username}</span>
              <span>{b.commandsExecuted} runs</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
