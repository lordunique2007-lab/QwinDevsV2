"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";

type CommunitySummary = {
  slug: string;
  type: "GROUP" | "CHANNEL";
  name: string;
  description: string;
  category: string;
  memberCount: number;
  isBoosted?: boolean;
  owner: { username: string; displayName: string; isVerified: boolean };
};

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [type, setType] = useState<"" | "GROUP" | "CHANNEL">("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    fetch(`/api/communities?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setCommunities(data.communities);
        setLoading(false);
      });
  }, [type]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold">Groups & Channels</h1>
        <div className="flex gap-2">
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="input w-auto text-sm">
            <option value="">All</option>
            <option value="GROUP">Groups</option>
            <option value="CHANNEL">Channels</option>
          </select>
          <Link href="/communities/new" className="btn-primary text-sm">
            + Create
          </Link>
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-32 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && communities.length === 0 && (
        <div className="card p-10 text-center text-qwin-muted">
          No communities yet. Start the first one.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {communities.map((c) => (
          <Link
            key={c.slug}
            href={`/communities/${c.slug}`}
            className={`card block p-4 hover:border-qwin-primary/50 ${c.isBoosted ? "border-qwin-gold/50 shadow-goldglow" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display font-semibold">
                  {c.type === "CHANNEL" ? "📢" : "👥"} {c.name}
                </h3>
                <p className="line-clamp-2 text-sm text-qwin-muted">{c.description}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {c.isBoosted && <span className="badge bg-qwin-gold/20 text-qwin-gold">🚀</span>}
                <span className="badge bg-qwin-surface2 text-qwin-muted">{c.category}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-qwin-border pt-3 text-xs text-qwin-muted">
              <span>{c.memberCount} members</span>
              <span className="flex items-center gap-1">
                by @{c.owner.username} {c.owner.isVerified && <VerifiedBadge size={11} />}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
