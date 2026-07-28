"use client";

import { useEffect, useState } from "react";
import VerifiedBadge from "@/components/VerifiedBadge";

type LinkedUser = { username: string; isVerified: boolean; role: string } | null;
type Member = { name: string; linked: LinkedUser };
type Group = { rankLabel: string; members: Member[] };

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: "👑 Super Admin",
  MODERATOR: "🛡 Moderator",
  VERIFIED_DEVELOPER: "💠 Verified Developer"
};

export default function TeamPage() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((data) => {
        setTitle(data.title);
        setSubtitle(data.subtitle);
        setGroups(data.groups);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="card h-64 animate-pulse" />;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-qwin-muted">{subtitle}</p>}
      </div>

      {groups.map((group, gi) => (
        <div key={group.rankLabel}>
          {gi > 0 && <div className="my-8 border-t border-qwin-border" />}
          <h2 className="mb-3 text-center font-display text-sm font-semibold uppercase tracking-wide text-qwin-primary2">
            {group.rankLabel}
          </h2>
          <div className="space-y-2">
            {group.members.map((m) => (
              <div key={m.name} className="card flex items-center justify-between p-3">
                <span className="flex items-center gap-1.5 text-sm">
                  {m.name}
                  {m.linked?.isVerified && <VerifiedBadge size={13} />}
                </span>
                {m.linked && ROLE_BADGE[m.linked.role] && (
                  <span className="badge bg-qwin-gold/20 text-qwin-gold">{ROLE_BADGE[m.linked.role]}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {groups.length === 0 && (
        <div className="card p-10 text-center text-qwin-muted">No team members listed yet.</div>
      )}
    </div>
  );
}
