"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import VerifiedBadge from "@/components/VerifiedBadge";
import StickerPicker from "@/components/StickerPicker";
import MessageBubble from "@/components/MessageBubble";
import { usePusherChannel, isRealtimeEnabled } from "@/hooks/usePusherChannel";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { uploadFile } from "@/lib/upload-client";
import BoostButton from "@/components/BoostButton";
import ReportButton from "@/components/ReportButton";
import QuickEntityModeration from "@/components/QuickEntityModeration";

type CommunityDetail = {
  id: string;
  type: "GROUP" | "CHANNEL";
  slug: string;
  name: string;
  description: string;
  category: string;
  visibility: "PUBLIC" | "PRIVATE";
  status: string;
  memberCount: number;
  inviteCode?: string;
  isBoosted?: boolean;
  mandatory?: boolean;
  owner: { username: string; displayName: string; isVerified: boolean };
};

type Member = {
  username: string;
  displayName: string;
  isVerified: boolean;
  role: "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER";
};

const CAN_MANAGE = new Set(["OWNER", "ADMIN", "MODERATOR"]);

export default function CommunityDetailPage() {
  const params = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [myRole, setMyRole] = useState<Member["role"] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"feed" | "members">("feed");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCommunity() {
    const res = await fetch(`/api/communities/${params.slug}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setCommunity(data.community);
    setMyRole(data.myRole);
    setMembers(data.members);
    setLoading(false);
  }

  useEffect(() => {
    loadCommunity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  async function join() {
    setJoining(true);
    setError(null);
    const res = await fetch(`/api/communities/${params.slug}/join`, { method: "POST" });
    const data = await res.json();
    setJoining(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    loadCommunity();
  }

  async function leave() {
    await fetch(`/api/communities/${params.slug}/leave`, { method: "POST" });
    loadCommunity();
  }

  async function memberAction(username: string, action: string) {
    const res = await fetch(`/api/communities/${params.slug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, action })
    });
    if (res.ok) loadCommunity();
  }

  if (loading) return <div className="card h-64 animate-pulse" />;
  if (!community) return <div className="card p-8 text-center text-qwin-muted">Community not found.</div>;

  const isMember = !!myRole;

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div className="card p-5">
        {((session?.user as any)?.role === "SUPER_ADMIN" || (session?.user as any)?.role === "MODERATOR") && (
          <div className="mb-4">
            <QuickEntityModeration kind="community" id={community.id} status={community.status} onChanged={loadCommunity} />
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold">
              {community.type === "CHANNEL" ? "📢" : "👥"} {community.name}
              {community.mandatory && <span className="badge ml-2 bg-qwin-gold/20 text-qwin-gold align-middle">📌 Official</span>}
            </h1>
            <p className="mt-1 text-sm text-qwin-muted">{community.description}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-qwin-muted">
              <span>{community.memberCount} members</span>
              <span>{community.category}</span>
              <span>{community.visibility === "PRIVATE" ? "🔒 Private" : "🌐 Public"}</span>
              <span className="flex items-center gap-1">
                owner @{community.owner.username} {community.owner.isVerified && <VerifiedBadge size={11} />}
              </span>
            </div>
            {community.mandatory && (
              <p className="mt-1 text-xs text-qwin-muted">
                Every Qwin Devs account is automatically a member of this channel and it can&apos;t be left.
              </p>
            )}
            {myRole !== "OWNER" && (
              <div className="mt-2">
                <ReportButton targetType="COMMUNITY" targetId={community.id} />
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-start gap-2">
            {myRole === "OWNER" && (
              <BoostButton targetType="COMMUNITY" targetId={community.id} isBoosted={!!community.isBoosted} onBoosted={loadCommunity} />
            )}
            {isMember ? (
              myRole !== "OWNER" &&
              !community.mandatory && (
                <button onClick={leave} className="btn-secondary text-sm">
                  Leave
                </button>
              )
            ) : (
              <button onClick={join} disabled={joining} className="btn-primary text-sm">
                {joining ? "…" : "Join"}
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        {community.inviteCode && (
          <div className="mt-3 rounded-lg bg-qwin-surface2 p-2 text-xs text-qwin-muted">
            Invite link: <span className="text-qwin-accent">/invite/{community.inviteCode}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("feed")} className={tab === "feed" ? "btn-primary text-sm" : "btn-secondary text-sm"}>
          {community.type === "CHANNEL" ? "Posts" : "Chat"}
        </button>
        <button onClick={() => setTab("members")} className={tab === "members" ? "btn-primary text-sm" : "btn-secondary text-sm"}>
          Members ({members.length})
        </button>
      </div>

      {tab === "feed" && isMember && community.type === "GROUP" && (
        <GroupChat slug={community.slug} communityId={community.id} currentUserId={session?.user?.id} />
      )}
      {tab === "feed" && community.type === "CHANNEL" && (
        <ChannelPosts slug={community.slug} canPost={!!myRole && CAN_MANAGE.has(myRole) && myRole !== "MODERATOR"} />
      )}
      {tab === "feed" && !isMember && community.type === "GROUP" && (
        <div className="card p-8 text-center text-qwin-muted">Join this group to see the chat.</div>
      )}

      {tab === "members" && (
        <div className="card divide-y divide-qwin-border p-4">
          {members.map((m) => (
            <div key={m.username} className="flex items-center justify-between py-2">
              <span className="flex items-center gap-1.5 text-sm">
                {m.displayName} {m.isVerified && <VerifiedBadge size={12} />}
                <span className="text-xs text-qwin-muted">@{m.username}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="badge bg-qwin-surface2 text-qwin-muted">{m.role}</span>
                {myRole && CAN_MANAGE.has(myRole) && m.role !== "OWNER" && m.username !== session?.user?.username && (
                  <MemberMenu onAction={(action) => memberAction(m.username, action)} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberMenu({ onAction }: { onAction: (action: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn-secondary px-2 py-1 text-xs">
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-qwin-border bg-qwin-surface p-1 text-sm shadow-lg">
          {[
            ["promote_admin", "Make admin"],
            ["promote_moderator", "Make moderator"],
            ["demote", "Demote to member"],
            ["kick", "Kick"],
            ["ban", "Ban"]
          ].map(([action, label]) => (
            <button
              key={action}
              onClick={() => {
                onAction(action);
                setOpen(false);
              }}
              className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-qwin-surface2"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupChat({ slug, communityId, currentUserId }: { slug: string; communityId: string; currentUserId?: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<string | null>(null);
  const voice = useVoiceRecorder();

  function mergeMessages(prev: any[], incoming: any[]) {
    const ids = new Set(prev.map((m) => m.id));
    const fresh = incoming.filter((m: any) => !ids.has(m.id));
    return fresh.length ? [...prev, ...fresh] : prev;
  }

  async function poll(initial = false) {
    const url = initial || !lastRef.current
      ? `/api/communities/${slug}/messages`
      : `/api/communities/${slug}/messages?since=${encodeURIComponent(lastRef.current)}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (initial) setMessages(data.messages);
    else if (data.messages.length) setMessages((prev) => mergeMessages(prev, data.messages));
    if (data.messages.length) lastRef.current = data.messages[data.messages.length - 1].createdAt;
    else if (initial) lastRef.current = new Date(0).toISOString();
  }

  usePusherChannel<any>(communityId, "new-message", (incoming) => {
    setMessages((prev) => mergeMessages(prev, [incoming]));
    lastRef.current = incoming.createdAt;
  });

  useEffect(() => {
    poll(true);
    const i = setInterval(() => poll(false), 15000); // fallback safety net
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendPayload(payload: { content: string; type: string; mediaUrl?: string; mediaDurationSec?: number }) {
    setError(null);
    const res = await fetch(`/api/communities/${slug}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      setMessages((prev) => mergeMessages(prev, [data.message]));
      lastRef.current = data.message.createdAt;
    } else {
      setError(data.error ?? "Could not send message.");
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const content = draft;
    setDraft("");
    await sendPayload({ content, type: "TEXT" });
  }

  async function handleSticker(payload: { content: string; mediaUrl?: string }) {
    await sendPayload({ content: payload.content, type: "STICKER", mediaUrl: payload.mediaUrl });
  }

  async function handleVoiceStop() {
    const result = await voice.stop();
    if (!result) return;
    try {
      const file = new File([result.blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      const uploaded = await uploadFile(file, "voice");
      await sendPayload({
        content: "🎤 Voice message",
        type: "VOICE",
        mediaUrl: uploaded.url,
        mediaDurationSec: result.durationSec
      });
    } catch (err: any) {
      setError(`Voice upload failed: ${err?.message ?? "unknown error"}`);
    }
  }

  async function handleMediaAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const isVideo = file.type.startsWith("video");
      const uploaded = await uploadFile(file, "chat");
      await sendPayload({
        content: isVideo ? "🎬 Video" : "🖼 Photo",
        type: isVideo ? "VIDEO" : "IMAGE",
        mediaUrl: uploaded.url
      });
    } catch (err: any) {
      setError(`Media upload failed: ${err?.message ?? "unknown error"}`);
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="flex h-[55vh] flex-col">
      {!isRealtimeEnabled() && <p className="mb-1 text-right text-xs text-qwin-muted">⏱ syncing</p>}
      <div className="card flex-1 space-y-2 overflow-y-auto p-4">
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-qwin-primary text-white" : "bg-qwin-surface2"}`}>
                {!mine && <p className="text-xs text-qwin-muted">{m.sender.displayName}</p>}
                <MessageBubble message={m} mine={mine} />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input className="input" placeholder="Message the group…" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Message" />
        <StickerPicker onPick={handleSticker} />
        <label className="btn-secondary shrink-0 cursor-pointer px-3" aria-label="Attach photo or video">
          📎
          <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaAttach} />
        </label>
        {voice.recording ? (
          <button type="button" onClick={handleVoiceStop} className="btn-primary shrink-0 animate-pulse px-3" aria-label="Stop recording and send">
            ⏹ {voice.seconds}s
          </button>
        ) : (
          <button type="button" onClick={() => voice.start().catch((e) => setError(e.message))} className="btn-secondary shrink-0 px-3" aria-label="Record a voice message">
            🎤
          </button>
        )}
        <button type="submit" className="btn-primary shrink-0">
          Send
        </button>
      </form>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
}

function ChannelPosts({ slug, canPost }: { slug: string; canPost: boolean }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingMedia, setPendingMedia] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/communities/${slug}/posts`);
    const data = await res.json();
    setPosts(data.posts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const isVideo = file.type.startsWith("video");
      const uploaded = await uploadFile(file, "chat");
      setPendingMedia({ url: uploaded.url, type: isVideo ? "video" : "image" });
    } catch (err: any) {
      setError(`Media upload failed: ${err?.message ?? "unknown error"}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() && !pendingMedia) return;
    const res = await fetch(`/api/communities/${slug}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft, mediaUrl: pendingMedia?.url, mediaType: pendingMedia?.type })
    });
    if (res.ok) {
      setDraft("");
      setPendingMedia(null);
      load();
    }
  }

  if (loading) return <div className="card h-40 animate-pulse" />;

  return (
    <div className="space-y-3">
      {canPost && (
        <form onSubmit={submit} className="card p-4">
          <textarea className="input resize-none" rows={3} placeholder="Broadcast to subscribers…" value={draft} onChange={(e) => setDraft(e.target.value)} />
          {pendingMedia && (
            <div className="mt-2 flex items-center gap-2">
              {pendingMedia.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pendingMedia.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <video src={pendingMedia.url} className="h-16 w-16 rounded-lg object-cover" />
              )}
              <button type="button" onClick={() => setPendingMedia(null)} className="text-xs text-red-400">
                Remove
              </button>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <label className="btn-secondary cursor-pointer px-3 text-sm">
              {uploading ? "Uploading…" : "📎 Attach media"}
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaSelect} disabled={uploading} />
            </label>
            <button type="submit" className="btn-primary text-sm">
              Post
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </form>
      )}
      {posts.length === 0 && <div className="card p-8 text-center text-qwin-muted">No posts yet.</div>}
      {posts.map((p) => (
        <div key={p.id} className="card p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {p.author.displayName} {p.author.isVerified && <VerifiedBadge size={12} />}
          </p>
          {p.content && <p className="mt-1 whitespace-pre-wrap text-sm">{p.content}</p>}
          {p.mediaUrl && p.mediaType === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.mediaUrl} alt="" className="mt-2 max-h-96 w-full rounded-lg object-cover" />
          )}
          {p.mediaUrl && p.mediaType === "video" && (
            <video src={p.mediaUrl} controls className="mt-2 max-h-96 w-full rounded-lg" />
          )}
        </div>
      ))}
    </div>
  );
}
