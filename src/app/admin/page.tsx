"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Stats = {
  totalUsers: number;
  totalProjects: number;
  totalPosts: number;
  totalCommunities: number;
  totalBots: number;
  pendingReports: number;
  bannedUsers: number;
  frozenUsers: number;
  circulatingQC: number;
  lifetimeIssuedQC: number;
};

type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  isVerified: boolean;
  banReason: string | null;
  bannedUntil: string | null;
};

type ReportItem = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
  createdAt: string;
  reporter: { username: string; displayName: string };
};

export default function AdminConsolePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "users" | "reports" | "audit" | "team" | "channels" | "bots">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [allCommunities, setAllCommunities] = useState<any[]>([]);
  const [allBots, setAllBots] = useState<any[]>([]);
  const [teamSettings, setTeamSettings] = useState<{ pageTitle: string; subtitle: string } | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [newMemberRank, setNewMemberRank] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberLinked, setNewMemberLinked] = useState("");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const isSuperAdmin = (session?.user as any)?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    fetch("/api/admin/stats")
      .then((r) => {
        setAllowed(r.ok);
        return r.json();
      })
      .then((data) => setStats(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function searchUsers() {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setUsers(data.users ?? []);
  }

  async function loadReports() {
    const res = await fetch("/api/reports?status=PENDING");
    const data = await res.json();
    setReports(data.reports ?? []);
  }

  async function loadAudit() {
    const res = await fetch("/api/admin/audit-log");
    const data = await res.json();
    setLogs(data.logs ?? []);
  }

  async function loadTeam() {
    const res = await fetch("/api/admin/team");
    if (!res.ok) return;
    const data = await res.json();
    setTeamSettings(data.settings ?? { pageTitle: "Meet the Team", subtitle: "" });
    setTeamMembers(data.members ?? []);
  }

  async function loadChannels() {
    const res = await fetch("/api/admin/communities");
    if (!res.ok) return;
    const data = await res.json();
    setAllCommunities(data.communities ?? []);
  }

  async function loadBots() {
    const res = await fetch("/api/admin/bots");
    if (!res.ok) return;
    const data = await res.json();
    setAllBots(data.bots ?? []);
  }

  useEffect(() => {
    if (tab === "users") searchUsers();
    if (tab === "reports") loadReports();
    if (tab === "audit") loadAudit();
    if (tab === "team") loadTeam();
    if (tab === "channels") loadChannels();
    if (tab === "bots") loadBots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function moderateBot(id: string, action: string) {
    if (!confirm(`Are you sure you want to ${action.replace("_", " ")} this bot?`)) return;
    const reason = action === "suspend" || action === "freeze" ? prompt("Reason?") ?? "" : "";
    const res = await fetch(`/api/admin/bots/${id}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason })
    });
    if (res.ok) loadBots();
    else alert((await res.json()).error);
  }

  async function toggleMandatory(id: string, mandatory: boolean) {
    const res = await fetch(`/api/admin/communities/${id}/mandatory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mandatory })
    });
    const data = await res.json();
    if (res.ok) {
      if (data.enrolledCount > 0) {
        alert(`Made official — auto-enrolled ${data.enrolledCount} existing accounts.`);
      }
      loadChannels();
    } else {
      alert(data.error);
    }
  }

  async function saveTeamSettings() {
    if (!teamSettings) return;
    await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(teamSettings)
    });
    loadTeam();
  }

  async function addTeamMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberRank.trim() || !newMemberName.trim()) return;
    await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rankLabel: newMemberRank,
        name: newMemberName,
        linkedUsername: newMemberLinked || undefined
      })
    });
    setNewMemberRank("");
    setNewMemberName("");
    setNewMemberLinked("");
    loadTeam();
  }

  async function updateTeamMember(id: string, patch: any) {
    await fetch(`/api/admin/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    loadTeam();
  }

  async function deleteTeamMember(id: string) {
    await fetch(`/api/admin/team/${id}`, { method: "DELETE" });
    loadTeam();
  }

  async function moderate(userId: string, action: string) {
    let reason = "";
    let bannedUntil: string | undefined;

    if (action === "ban") {
      reason = prompt("Ban reason?") ?? "";
      const durationChoice = prompt(
        "Ban duration in days (leave blank for permanent). Examples: 1, 7, 30"
      );
      if (durationChoice && !isNaN(Number(durationChoice)) && Number(durationChoice) > 0) {
        const until = new Date(Date.now() + Number(durationChoice) * 24 * 60 * 60 * 1000);
        bannedUntil = until.toISOString();
      }
    } else if (action === "freeze") {
      reason = prompt("Freeze reason?") ?? "";
    }

    const res = await fetch(`/api/admin/users/${userId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason, bannedUntil })
    });
    if (res.ok) searchUsers();
    else alert((await res.json()).error);
  }

  async function updateRole(userId: string, role: string) {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    });
    if (res.ok) searchUsers();
    else alert((await res.json()).error);
  }

  async function toggleVerified(userId: string, isVerified: boolean) {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVerified: !isVerified })
    });
    if (res.ok) searchUsers();
  }

  async function resolveReport(id: string, action: "resolve" | "dismiss") {
    const res = await fetch(`/api/reports/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    if (res.ok) loadReports();
  }

  if (allowed === false) {
    return (
      <div className="card p-8 text-center text-qwin-muted">
        You do not have access to the admin console.
      </div>
    );
  }
  if (!stats) return <div className="card h-64 animate-pulse" />;

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <div className="card p-5">
        <h1 className="font-display text-xl font-bold">👑 Control Center</h1>
        <p className="text-sm text-qwin-muted">Visible only to Moderators and the Super Admin.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["overview", "users", "reports", "audit", "team", "channels", "bots"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "btn-primary text-sm capitalize" : "btn-secondary text-sm capitalize"}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Users", stats.totalUsers],
            ["Projects", stats.totalProjects],
            ["Posts", stats.totalPosts],
            ["Communities", stats.totalCommunities],
            ["Bots", stats.totalBots],
            ["Pending reports", stats.pendingReports],
            ["Banned", stats.bannedUsers],
            ["Frozen", stats.frozenUsers],
            ["QC in circulation", stats.circulatingQC],
            ["QC issued lifetime", stats.lifetimeIssuedQC]
          ].map(([label, value]) => (
            <div key={label as string} className="card p-4">
              <p className="text-xs text-qwin-muted">{label}</p>
              <p className="font-display text-2xl font-bold">{value as number}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div className="card p-5">
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Search username, email, name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUsers()}
            />
            <button onClick={searchUsers} className="btn-secondary shrink-0 text-sm">
              Search
            </button>
          </div>

          <div className="mt-4 divide-y divide-qwin-border">
            {users.map((u) => (
              <div key={u.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {u.displayName} <span className="text-qwin-muted">@{u.username}</span>
                    </p>
                    <p className="text-xs text-qwin-muted">
                      {u.email} · {u.role} · {u.status}
                      {u.banReason && ` — "${u.banReason}"`}
                      {u.bannedUntil && ` (until ${new Date(u.bannedUntil).toLocaleDateString()})`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {u.status === "ACTIVE" ? (
                      <>
                        <button onClick={() => moderate(u.id, "freeze")} className="btn-secondary px-2 py-1 text-xs">
                          Freeze
                        </button>
                        <button onClick={() => moderate(u.id, "ban")} className="btn-secondary px-2 py-1 text-xs text-red-400">
                          Ban
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => moderate(u.id, u.status === "BANNED" ? "unban" : "unfreeze")}
                        className="btn-secondary px-2 py-1 text-xs"
                      >
                        Restore
                      </button>
                    )}
                    {isSuperAdmin && (
                      <>
                        <button onClick={() => toggleVerified(u.id, u.isVerified)} className="btn-secondary px-2 py-1 text-xs">
                          {u.isVerified ? "Unverify" : "Verify"}
                        </button>
                        <select
                          className="input h-auto px-2 py-1 text-xs"
                          value={u.role}
                          onChange={(e) => updateRole(u.id, e.target.value)}
                        >
                          {["USER", "PREMIUM", "VERIFIED_DEVELOPER", "BUSINESS", "MODERATOR"].map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "reports" && (
        <div className="card p-5">
          {reports.length === 0 && <p className="text-sm text-qwin-muted">No pending reports.</p>}
          <div className="divide-y divide-qwin-border">
            {reports.map((r) => (
              <div key={r.id} className="py-3 text-sm">
                <p className="font-medium">
                  {r.targetType} · {r.reason}
                </p>
                <p className="text-xs text-qwin-muted">
                  reported by @{r.reporter.username} · target ID {r.targetId} · {new Date(r.createdAt).toLocaleString()}
                </p>
                {r.details && <p className="mt-1 text-xs">{r.details}</p>}
                <div className="mt-2 flex gap-2">
                  <button onClick={() => resolveReport(r.id, "resolve")} className="btn-secondary px-2 py-1 text-xs">
                    Mark resolved
                  </button>
                  <button onClick={() => resolveReport(r.id, "dismiss")} className="btn-secondary px-2 py-1 text-xs">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="card p-5">
          <div className="divide-y divide-qwin-border">
            {logs.map((l) => (
              <div key={l.id} className="py-2 text-xs">
                <span className="text-qwin-primary2">{l.action}</span> by @{l.actorUsername} on {l.targetType}:{l.targetId}
                {l.reason && ` — "${l.reason}"`} · {new Date(l.createdAt).toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "team" && teamSettings && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-2 font-display font-semibold">Team page settings</h2>
            <div className="space-y-2">
              <input
                className="input"
                placeholder="Page title"
                value={teamSettings.pageTitle}
                onChange={(e) => setTeamSettings({ ...teamSettings, pageTitle: e.target.value })}
              />
              <input
                className="input"
                placeholder="Subtitle"
                value={teamSettings.subtitle}
                onChange={(e) => setTeamSettings({ ...teamSettings, subtitle: e.target.value })}
              />
              <button onClick={saveTeamSettings} className="btn-primary text-sm">
                Save
              </button>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-2 font-display font-semibold">Roster</h2>
            <div className="divide-y divide-qwin-border">
              {teamMembers.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div className="flex-1">
                    <input
                      className="input mb-1 h-8 text-xs"
                      value={m.rankLabel}
                      onChange={(e) => setTeamMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, rankLabel: e.target.value } : x)))}
                      onBlur={(e) => updateTeamMember(m.id, { rankLabel: e.target.value })}
                    />
                    <input
                      className="input h-8 text-xs"
                      value={m.name}
                      onChange={(e) => setTeamMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)))}
                      onBlur={(e) => updateTeamMember(m.id, { name: e.target.value })}
                    />
                  </div>
                  <button onClick={() => deleteTeamMember(m.id)} className="btn-secondary px-2 py-1 text-xs text-red-400">
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={addTeamMember} className="mt-4 space-y-2 border-t border-qwin-border pt-4">
              <input required placeholder="Rank / group label (e.g. Abyss Members)" className="input" value={newMemberRank} onChange={(e) => setNewMemberRank(e.target.value)} />
              <input required placeholder="Display name" className="input" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
              <input placeholder="Linked username (optional — pulls their real badge)" className="input" value={newMemberLinked} onChange={(e) => setNewMemberLinked(e.target.value)} />
              <button type="submit" className="btn-primary text-sm">
                Add to roster
              </button>
            </form>
          </div>
        </div>
      )}

      {tab === "channels" && (
        <div className="card p-5">
          <h2 className="mb-1 font-display font-semibold">Official Channels</h2>
          <p className="mb-4 text-sm text-qwin-muted">
            Marking a group or channel &quot;official&quot; automatically enrolls every existing
            account and every future signup — members can&apos;t leave it.
          </p>
          <div className="divide-y divide-qwin-border">
            {allCommunities.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {c.type === "CHANNEL" ? "📢" : "👥"} {c.name}
                    {c.mandatory && <span className="badge ml-2 bg-qwin-gold/20 text-qwin-gold">📌 Official</span>}
                    {c.status && c.status !== "ACTIVE" && (
                      <span className="badge ml-2 bg-red-500/20 text-red-400">{c.status}</span>
                    )}
                  </p>
                  <p className="text-xs text-qwin-muted">
                    @{c.slug} · owner @{c.owner.username} · {c.memberCount} members
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => toggleMandatory(c.id, !c.mandatory)}
                    className={c.mandatory ? "btn-secondary px-2 py-1 text-xs" : "btn-primary px-2 py-1 text-xs"}
                  >
                    {c.mandatory ? "Make optional" : "Make official"}
                  </button>
                </div>
              </div>
            ))}
            {allCommunities.length === 0 && <p className="py-6 text-center text-qwin-muted">No communities yet.</p>}
          </div>
        </div>
      )}

      {tab === "bots" && (
        <div className="card p-5">
          <h2 className="mb-1 font-display font-semibold">Bots</h2>
          <p className="mb-4 text-sm text-qwin-muted">Suspend or freeze bots that abuse commands or spam.</p>
          <div className="divide-y divide-qwin-border">
            {allBots.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">
                    🤖 {b.name}
                    {b.status !== "ACTIVE" && <span className="badge ml-2 bg-red-500/20 text-red-400">{b.status}</span>}
                  </p>
                  <p className="text-xs text-qwin-muted">
                    @{b.username} · owner @{b.owner.username} · {b.commandsExecuted} runs
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {b.status === "ACTIVE" ? (
                    <>
                      <button onClick={() => moderateBot(b.id, "freeze")} className="btn-secondary px-2 py-1 text-xs">
                        Freeze
                      </button>
                      <button onClick={() => moderateBot(b.id, "suspend")} className="btn-secondary px-2 py-1 text-xs text-red-400">
                        Suspend
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => moderateBot(b.id, b.status === "SUSPENDED" ? "unsuspend" : "unfreeze")}
                      className="btn-secondary px-2 py-1 text-xs"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
            {allBots.length === 0 && <p className="py-6 text-center text-qwin-muted">No bots yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
