"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";

type Chat = {
  conversationId: string;
  status: "ACCEPTED" | "PENDING" | "DECLINED";
  isRequest: boolean;
  otherUser: { username: string; displayName: string; isVerified: boolean } | null;
  lastMessage: { content: string; createdAt: string } | null;
  unread: boolean;
  updatedAt: string;
};

type MyCommunity = {
  slug: string;
  name: string;
  type: "GROUP" | "CHANNEL";
  mandatory: boolean;
  memberCount: number;
};

export default function MessagesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [communities, setCommunities] = useState<MyCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [chatsRes, communitiesRes] = await Promise.all([
      fetch("/api/conversations"),
      fetch("/api/communities/mine")
    ]);
    if (chatsRes.status === 401) {
      router.push("/login");
      return;
    }
    const chatsData = await chatsRes.json();
    setChats(chatsData.chats);
    if (communitiesRes.ok) {
      const communitiesData = await communitiesRes.json();
      setCommunities(communitiesData.communities);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (status !== "loading") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function startChat(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim()) return;
    setStarting(true);
    setError(null);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newUsername.trim() })
    });
    const data = await res.json();
    setStarting(false);
    if (!res.ok) {
      setError(data.error ?? "Could not start conversation.");
      return;
    }
    router.push(`/messages/${data.conversationId}`);
  }

  const accepted = chats.filter((c) => c.status === "ACCEPTED" || !c.isRequest);
  const requests = chats.filter((c) => c.isRequest && c.status === "PENDING");
  const official = communities.filter((c) => c.mandatory);
  const otherCommunities = communities.filter((c) => !c.mandatory);

  if (loading) return <div className="card h-64 animate-pulse" />;

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <form onSubmit={startChat} className="card flex gap-2 p-4">
        <input
          className="input"
          placeholder="Message a username…"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
        />
        <button type="submit" disabled={starting} className="btn-primary shrink-0">
          {starting ? "…" : "Chat"}
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {requests.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-2 font-display text-sm font-semibold text-qwin-muted">Message requests</h2>
          <div className="divide-y divide-qwin-border">
            {requests.map((c) => (
              <ChatRow key={c.conversationId} chat={c} />
            ))}
          </div>
        </div>
      )}

      {official.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-2 font-display text-sm font-semibold text-qwin-muted">📌 Official</h2>
          <div className="divide-y divide-qwin-border">
            {official.map((c) => (
              <CommunityRow key={c.slug} community={c} />
            ))}
          </div>
        </div>
      )}

      <div className="card p-4">
        <h2 className="mb-2 font-display text-sm font-semibold text-qwin-muted">Chats</h2>
        {accepted.length === 0 && otherCommunities.length === 0 && (
          <p className="py-6 text-center text-sm text-qwin-muted">No conversations yet.</p>
        )}
        <div className="divide-y divide-qwin-border">
          {otherCommunities.map((c) => (
            <CommunityRow key={c.slug} community={c} />
          ))}
          {accepted.map((c) => (
            <ChatRow key={c.conversationId} chat={c} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatRow({ chat }: { chat: Chat }) {
  return (
    <Link href={`/messages/${chat.conversationId}`} className="flex items-center gap-3 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-qwin-surface2 font-medium">
        {chat.otherUser?.displayName.charAt(0).toUpperCase() ?? "?"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 font-medium">
          {chat.otherUser?.displayName ?? "Unknown"} {chat.otherUser?.isVerified && <VerifiedBadge size={12} />}
        </p>
        <p className="truncate text-sm text-qwin-muted">
          {chat.lastMessage?.content ?? "Say hello 👋"}
        </p>
      </div>
      {chat.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-qwin-primary" />}
    </Link>
  );
}

function CommunityRow({ community }: { community: MyCommunity }) {
  return (
    <Link href={`/communities/${community.slug}`} className="flex items-center gap-3 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-qwin-surface2 text-lg">
        {community.type === "CHANNEL" ? "📢" : "👥"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{community.name}</p>
        <p className="truncate text-sm text-qwin-muted">
          {community.mandatory ? "Official channel · " : ""}
          {community.memberCount} members
        </p>
      </div>
    </Link>
  );
}
