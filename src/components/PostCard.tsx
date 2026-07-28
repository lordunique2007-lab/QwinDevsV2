"use client";

import { useState } from "react";
import Link from "next/link";
import VerifiedBadge from "./VerifiedBadge";
import ReportButton from "./ReportButton";

export type FeedPost = {
  id: string;
  content: string;
  imageUrl: string | null;
  mediaType?: string | null;
  createdAt: string;
  likeCount: number;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean;
    role: string;
  };
};

export default function PostCard({ post }: { post: FeedPost }) {
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleLike() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-qwin-surface2 font-medium">
          {post.author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.author.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            post.author.displayName.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <Link href={`/profile/${post.author.username}`} className="font-medium hover:underline">
            {post.author.displayName}
          </Link>
          {post.author.isVerified && <VerifiedBadge size={14} />}
          <p className="text-xs text-qwin-muted">
            @{post.author.username} · {new Date(post.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {post.content && <p className="mt-3 whitespace-pre-wrap text-qwin-text">{post.content}</p>}

      {post.imageUrl && post.mediaType === "video" ? (
        <video src={post.imageUrl} controls className="mt-3 max-h-96 w-full rounded-xl" />
      ) : (
        post.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.imageUrl} alt="" className="mt-3 max-h-96 w-full rounded-xl object-cover" />
        )
      )}

      <div className="mt-3 flex items-center gap-4 border-t border-qwin-border pt-3 text-sm">
        <button
          onClick={toggleLike}
          disabled={busy}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors ${
            liked ? "text-qwin-primary2" : "text-qwin-muted hover:text-qwin-text"
          }`}
        >
          {liked ? "❤️" : "🤍"} {likeCount}
        </button>
        <ReportButton targetType="POST" targetId={post.id} />
      </div>
    </article>
  );
}
