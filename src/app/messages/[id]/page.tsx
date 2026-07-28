"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";
import StickerPicker from "@/components/StickerPicker";
import MessageBubble, { MessageLike } from "@/components/MessageBubble";
import MessageContextMenu from "@/components/MessageContextMenu";
import QuickModeration, { ModerationInfo } from "@/components/QuickModeration";
import { usePusherChannel, isRealtimeEnabled } from "@/hooks/usePusherChannel";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useMessageGestures } from "@/hooks/useMessageGestures";
import { formatPresence, isOnline } from "@/hooks/usePresence";
import { uploadFile } from "@/lib/upload-client";

type Message = MessageLike & { sender: { username: string; displayName: string } };

type ConversationMeta = {
  id: string;
  status: "ACCEPTED" | "PENDING" | "DECLINED";
  initiatorId: string;
  myWallpaperUrl?: string | null;
  otherUserReadAt?: string | null;
  otherUser: {
    username: string;
    displayName: string;
    isVerified: boolean;
    lastActiveAt?: string | null;
    moderation?: ModerationInfo;
  } | null;
};

const FALLBACK_POLL_MS = 15000;
const TYPING_TIMEOUT_MS = 4000;

export default function ChatThreadPage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [conversation, setConversation] = useState<ConversationMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [contextMenuFor, setContextMenuFor] = useState<Message | null>(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [viewOnceNext, setViewOnceNext] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastFetchRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const voice = useVoiceRecorder();

  async function poll(initial = false) {
    const url = initial || !lastFetchRef.current
      ? `/api/conversations/${params.id}/messages`
      : `/api/conversations/${params.id}/messages?since=${encodeURIComponent(lastFetchRef.current)}`;

    const res = await fetch(url);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setConversation(data.conversation);

    if (initial) {
      setMessages(data.messages);
    } else if (data.messages.length > 0) {
      setMessages((prev) => mergeMessages(prev, data.messages));
    }

    if (data.messages.length > 0) {
      lastFetchRef.current = data.messages[data.messages.length - 1].createdAt;
    } else if (initial) {
      lastFetchRef.current = new Date(0).toISOString();
    }

    setLoading(false);
  }

  function mergeMessages(prev: Message[], incoming: Message[]) {
    const ids = new Set(prev.map((m) => m.id));
    const fresh = incoming.filter((m) => !ids.has(m.id));
    return fresh.length ? [...prev, ...fresh] : prev;
  }

  usePusherChannel<Message>(conversation?.id ?? null, "new-message", (incoming) => {
    setMessages((prev) => mergeMessages(prev, [incoming]));
    lastFetchRef.current = incoming.createdAt;
    setOtherTyping(false);
  });

  usePusherChannel<Partial<Message> & { id: string }>(conversation?.id ?? null, "message-updated", (incoming) => {
    setMessages((prev) => prev.map((m) => (m.id === incoming.id ? { ...m, ...incoming } : m)));
  });

  usePusherChannel<{ userId: string }>(conversation?.id ?? null, "typing", (incoming) => {
    if (incoming.userId === session?.user?.id) return;
    setOtherTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), TYPING_TIMEOUT_MS);
  });

  useEffect(() => {
    poll(true);
    const interval = setInterval(() => poll(false), FALLBACK_POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function notifyTyping() {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    fetch(`/api/conversations/${params.id}/typing`, { method: "POST" }).catch(() => null);
  }

  async function sendPayload(payload: {
    content: string;
    type: "TEXT" | "STICKER" | "VOICE" | "IMAGE" | "VIDEO";
    mediaUrl?: string;
    mediaDurationSec?: number;
    replyToId?: string;
    viewOnce?: boolean;
  }) {
    setSending(true);
    setError(null);
    const res = await fetch(`/api/conversations/${params.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not send message.");
      return;
    }
    setMessages((prev) => mergeMessages(prev, [data.message]));
    lastFetchRef.current = data.message.createdAt;
    setReplyTarget(null);
    setViewOnceNext(false);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const content = draft;
    setDraft("");
    await sendPayload({ content, type: "TEXT", replyToId: replyTarget?.id });
  }

  async function handleSticker(payload: { content: string; mediaUrl?: string }) {
    await sendPayload({ content: payload.content, type: "STICKER", mediaUrl: payload.mediaUrl, replyToId: replyTarget?.id });
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
        mediaDurationSec: result.durationSec,
        replyToId: replyTarget?.id
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
        mediaUrl: uploaded.url,
        replyToId: replyTarget?.id,
        viewOnce: viewOnceNext
      });
    } catch (err: any) {
      setError(`Media upload failed: ${err?.message ?? "unknown error"}`);
    } finally {
      e.target.value = "";
    }
  }

  async function respond(action: "accept" | "decline") {
    const res = await fetch(`/api/conversations/${params.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    if (res.ok) {
      const data = await res.json();
      setConversation((c) => (c ? { ...c, status: data.status } : c));
    }
  }

  async function messageAction(message: Message, action: "delete_for_me" | "delete_for_everyone" | "pin" | "unpin") {
    if (action === "delete_for_everyone" && !confirm("Delete this message for everyone?")) return;
    const res = await fetch(`/api/conversations/${params.id}/messages/${message.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    if (!res.ok) return;
    if (action === "delete_for_me") {
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    } else if (action === "delete_for_everyone") {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, deletedForEveryone: true } : m)));
    } else {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, pinned: action === "pin" } : m)));
    }
  }

  async function reactToMessage(message: Message, emoji: string) {
    const res = await fetch(`/api/conversations/${params.id}/messages/${message.id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji })
    });
    if (!res.ok) return;
    const data = await res.json();
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, reactions: data.reactions } : m)));
  }

  function copyMessage(message: Message) {
    navigator.clipboard.writeText(message.content).catch(() => null);
  }

  async function runSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const res = await fetch(`/api/conversations/${params.id}/search?q=${encodeURIComponent(searchQuery)}`);
    if (res.ok) {
      const data = await res.json();
      setSearchResults(data.messages);
    }
  }

  async function clearChat() {
    if (!confirm("Clear this chat? Messages will stay for the other person.")) return;
    await fetch(`/api/conversations/${params.id}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" })
    });
    setMessages([]);
    setChatMenuOpen(false);
  }

  async function deleteChat() {
    if (!confirm("Delete this chat from your list? It'll reappear if they message you again.")) return;
    await fetch(`/api/conversations/${params.id}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "hide" })
    });
    window.location.href = "/messages";
  }

  async function toggleBlock() {
    if (!conversation?.otherUser) return;
    if (!confirm("Block this user? They won't be able to message you.")) return;
    await fetch(`/api/users/${conversation.otherUser.username}/block`, { method: "POST" });
    setChatMenuOpen(false);
  }

  async function setWallpaper(url: string) {
    await fetch(`/api/conversations/${params.id}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_wallpaper", wallpaperUrl: url })
    });
    setConversation((c) => (c ? { ...c, myWallpaperUrl: url } : c));
    setChatMenuOpen(false);
  }

  async function handleWallpaperUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadFile(file, "chat");
      await setWallpaper(uploaded.url);
    } catch (err: any) {
      setError(`Wallpaper upload failed: ${err?.message ?? "unknown error"}`);
    }
  }

  if (loading) return <div className="card h-96 animate-pulse" />;
  if (!conversation) return <div className="card p-8 text-center text-qwin-muted">Conversation not found.</div>;

  const isRecipientOfRequest = conversation.status === "PENDING" && conversation.initiatorId !== session?.user?.id;
  const isBlockedFromSending = conversation.status === "DECLINED";
  const otherReadAt = conversation.otherUserReadAt ? new Date(conversation.otherUserReadAt) : null;

  return (
    <div className="mx-auto flex h-[75vh] max-w-2xl flex-col">
      <div className="card mb-3 flex items-center gap-3 p-3">
        <Link href="/messages" className="text-qwin-muted" aria-label="Back to messages">
          ←
        </Link>
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-qwin-surface2 font-medium">
          {conversation.otherUser?.displayName.charAt(0).toUpperCase() ?? "?"}
          {isOnline(conversation.otherUser?.lastActiveAt) && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-qwin-surface bg-green-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/profile/${conversation.otherUser?.username}`} className="flex items-center gap-1.5 font-medium hover:underline">
            {conversation.otherUser?.displayName} {conversation.otherUser?.isVerified && <VerifiedBadge size={14} />}
          </Link>
          <p className="text-xs text-qwin-muted">
            {otherTyping ? <span className="text-qwin-primary2">typing…</span> : formatPresence(conversation.otherUser?.lastActiveAt)}
          </p>
        </div>
        {!isRealtimeEnabled() && (
          <span className="text-xs text-qwin-muted" title="Add Pusher env vars for instant delivery">
            ⏱
          </span>
        )}
        <div className="relative">
          <button onClick={() => setChatMenuOpen((o) => !o)} className="btn-secondary px-2 py-1 text-sm" aria-label="Chat options">
            ⋮
          </button>
          {chatMenuOpen && (
            <div className="absolute right-0 top-10 z-20 w-56 rounded-xl border border-qwin-border bg-qwin-surface p-2 shadow-lg">
              <button
                onClick={() => {
                  setSearchOpen((o) => !o);
                  setChatMenuOpen(false);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-qwin-surface2"
              >
                🔍 Search messages
              </button>
              <label className="block cursor-pointer rounded-lg px-3 py-2 text-left text-sm hover:bg-qwin-surface2">
                🖼 Change wallpaper
                <input type="file" accept="image/*" className="hidden" onChange={handleWallpaperUpload} />
              </label>
              {conversation.myWallpaperUrl && (
                <button onClick={() => setWallpaper("")} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-qwin-surface2">
                  Remove wallpaper
                </button>
              )}
              <button onClick={clearChat} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-qwin-surface2">
                🧹 Clear chat
              </button>
              <button onClick={deleteChat} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-qwin-surface2">
                🗑 Delete chat
              </button>
              <button onClick={toggleBlock} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-qwin-surface2">
                🚫 Block
              </button>
            </div>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="card mb-3 p-3">
          <div className="flex gap-2">
            <input
              className="input h-9 text-sm"
              placeholder="Search in this chat…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
            <button onClick={runSearch} className="btn-secondary shrink-0 text-sm">
              Go
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {searchResults.map((m) => (
                <p key={m.id} className="truncate rounded-lg bg-qwin-surface2 px-2 py-1 text-xs">
                  <span className="text-qwin-muted">{new Date(m.createdAt).toLocaleDateString()}:</span> {m.content}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {conversation.otherUser?.moderation && (
        <div className="mb-3">
          <QuickModeration moderation={conversation.otherUser.moderation} onChanged={() => poll(true)} />
        </div>
      )}

      <div
        className="card flex-1 space-y-2 overflow-y-auto bg-cover bg-center p-4"
        style={conversation.myWallpaperUrl ? { backgroundImage: `url(${conversation.myWallpaperUrl})` } : undefined}
      >
        {messages.map((m) => (
          <MessageRow
            key={m.id}
            message={m}
            mine={m.senderId === session?.user?.id}
            read={!!(m.senderId === session?.user?.id && otherReadAt && new Date(m.createdAt) <= otherReadAt)}
            currentUserId={session?.user?.id}
            onLongPress={() => setContextMenuFor(m)}
            onSwipeReply={() => setReplyTarget(m)}
            onReactTap={(emoji) => reactToMessage(m, emoji)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {contextMenuFor && (
        <MessageContextMenu
          isMine={contextMenuFor.senderId === session?.user?.id}
          isPinned={!!contextMenuFor.pinned}
          onReply={() => setReplyTarget(contextMenuFor)}
          onPin={() => messageAction(contextMenuFor, contextMenuFor.pinned ? "unpin" : "pin")}
          onDeleteForMe={() => messageAction(contextMenuFor, "delete_for_me")}
          onDeleteForEveryone={
            contextMenuFor.senderId === session?.user?.id ? () => messageAction(contextMenuFor, "delete_for_everyone") : undefined
          }
          onCopy={() => copyMessage(contextMenuFor)}
          onReact={(emoji) => reactToMessage(contextMenuFor, emoji)}
          onClose={() => setContextMenuFor(null)}
        />
      )}

      {isRecipientOfRequest ? (
        <div className="card mt-3 flex items-center justify-between p-3">
          <p className="text-sm text-qwin-muted">@{conversation.otherUser?.username} wants to message you.</p>
          <div className="flex gap-2">
            <button onClick={() => respond("decline")} className="btn-secondary text-sm">
              Decline
            </button>
            <button onClick={() => respond("accept")} className="btn-primary text-sm">
              Accept
            </button>
          </div>
        </div>
      ) : (
        <>
          {replyTarget && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-qwin-surface2 px-3 py-2 text-xs">
              <span className="truncate">
                Replying to <b>{replyTarget.sender.displayName}</b>: {replyTarget.content || "Media"}
              </span>
              <button onClick={() => setReplyTarget(null)} className="shrink-0 text-qwin-muted">
                ✕
              </button>
            </div>
          )}
          <form onSubmit={handleSend} className="mt-2 flex gap-2">
            <input
              className="input"
              placeholder={isBlockedFromSending ? "This request was declined" : "Type a message…"}
              value={draft}
              disabled={isBlockedFromSending}
              onChange={(e) => {
                setDraft(e.target.value);
                notifyTyping();
              }}
              aria-label="Message"
            />
            <StickerPicker onPick={handleSticker} />
            <label className="btn-secondary shrink-0 cursor-pointer px-3" aria-label="Attach photo or video">
              📎
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaAttach} disabled={isBlockedFromSending} />
            </label>
            <button
              type="button"
              onClick={() => setViewOnceNext((v) => !v)}
              className={viewOnceNext ? "btn-primary shrink-0 px-3" : "btn-secondary shrink-0 px-3"}
              title="Next photo/video will be view-once"
              aria-label="Toggle view-once for next media"
            >
              👁
            </button>
            {voice.recording ? (
              <button type="button" onClick={handleVoiceStop} className="btn-primary shrink-0 animate-pulse px-3" aria-label="Stop recording and send">
                ⏹ {voice.seconds}s
              </button>
            ) : (
              <button
                type="button"
                onClick={() => voice.start().catch((e) => setError(e.message))}
                disabled={isBlockedFromSending}
                className="btn-secondary shrink-0 px-3"
                aria-label="Record a voice message"
              >
                🎤
              </button>
            )}
            <button type="submit" disabled={sending || isBlockedFromSending} className="btn-primary shrink-0">
              Send
            </button>
          </form>
        </>
      )}
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
}

function MessageRow({
  message,
  mine,
  read,
  currentUserId,
  onLongPress,
  onSwipeReply,
  onReactTap
}: {
  message: Message;
  mine: boolean;
  read: boolean;
  currentUserId?: string;
  onLongPress: () => void;
  onSwipeReply: () => void;
  onReactTap: (emoji: string) => void;
}) {
  // One hook call per MessageRow instance — each row is its own component,
  // so this satisfies React's rules of hooks (no hooks inside .map()).
  const gestures = useMessageGestures(onLongPress, onSwipeReply);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`} {...gestures}>
      <div
        className={`max-w-[75%] select-none rounded-2xl px-3 py-2 text-sm ${
          mine ? "bg-qwin-primary text-white" : "bg-qwin-surface2 text-qwin-text"
        }`}
      >
        <MessageBubble message={message} mine={mine} read={read} currentUserId={currentUserId} onReactTap={onReactTap} />
      </div>
    </div>
  );
}
