"use client";

import { useState } from "react";

export type MessageLike = {
  id: string;
  content: string;
  type: "TEXT" | "STICKER" | "VOICE" | "IMAGE" | "VIDEO";
  mediaUrl?: string | null;
  mediaDurationSec?: number | null;
  createdAt: string;
  senderId: string;
  deletedForEveryone?: boolean;
  pinned?: boolean;
  viewOnce?: boolean;
  viewedAt?: string | null;
  replyTo?: { id: string; content: string; sender: { displayName: string } } | null;
  reactions?: { emoji: string; userId: string }[];
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function MessageBubble({
  message,
  mine,
  read,
  currentUserId,
  onReactTap
}: {
  message: MessageLike;
  mine: boolean;
  read?: boolean;
  currentUserId?: string;
  onReactTap?: (emoji: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);

  if (message.deletedForEveryone) {
    return <span className="italic text-qwin-muted">Message deleted</span>;
  }

  const reactionCounts = new Map<string, number>();
  for (const r of message.reactions ?? []) {
    reactionCounts.set(r.emoji, (reactionCounts.get(r.emoji) ?? 0) + 1);
  }
  const myReaction = (message.reactions ?? []).find((r) => r.userId === currentUserId)?.emoji;

  function body() {
    if (message.viewOnce && message.mediaUrl) {
      if (message.viewedAt && !mine) {
        return <span className="italic text-qwin-muted">👁 Viewed</span>;
      }
      if (!revealed) {
        return (
          <button onClick={() => setRevealed(true)} className="flex items-center gap-1 text-sm">
            👁 Tap to view once
          </button>
        );
      }
      return message.type === "VIDEO" ? (
        <video src={message.mediaUrl} controls autoPlay className="max-h-64 max-w-[220px] rounded-lg" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={message.mediaUrl} alt="" className="max-h-64 max-w-[220px] rounded-lg object-cover" />
      );
    }

    if (message.type === "STICKER") {
      if (message.mediaUrl) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={message.mediaUrl} alt="" className="h-20 w-20 object-contain" />;
      }
      return <div className="text-5xl leading-none">{message.content}</div>;
    }

    if (message.type === "VOICE" && message.mediaUrl) {
      return (
        <div className="flex items-center gap-2">
          <audio controls src={message.mediaUrl} className="h-8 max-w-[200px]" />
          {message.mediaDurationSec ? <span className="text-xs opacity-70">{message.mediaDurationSec}s</span> : null}
        </div>
      );
    }

    if (message.type === "IMAGE" && message.mediaUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={message.mediaUrl} alt="" className="max-h-64 max-w-[220px] rounded-lg object-cover" />;
    }

    if (message.type === "VIDEO" && message.mediaUrl) {
      return <video src={message.mediaUrl} controls className="max-h-64 max-w-[220px] rounded-lg" />;
    }

    return <span>{message.content}</span>;
  }

  return (
    <div>
      {message.pinned && <p className="mb-0.5 text-[10px] text-qwin-gold">📌 Pinned</p>}
      {message.replyTo && (
        <div className="mb-1 rounded-lg border-l-2 border-qwin-primary2 bg-black/10 px-2 py-1 text-xs opacity-80">
          <p className="font-medium">{message.replyTo.sender.displayName}</p>
          <p className="truncate">{message.replyTo.content || "Media"}</p>
        </div>
      )}
      {body()}
      <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-70">
        <span>{formatTime(message.createdAt)}</span>
        {mine && <span>{read ? "✓✓" : "✓"}</span>}
      </div>
      {reactionCounts.size > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {Array.from(reactionCounts.entries()).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => onReactTap?.(emoji)}
              className={`rounded-full px-1.5 py-0.5 text-xs ${myReaction === emoji ? "bg-qwin-primary/40" : "bg-black/20"}`}
            >
              {emoji} {count > 1 ? count : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
