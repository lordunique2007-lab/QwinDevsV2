"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { FeedPost } from "./PostCard";
import { uploadFile } from "@/lib/upload-client";

export default function Composer({ onPosted }: { onPosted: (post: FeedPost) => void }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [pendingMedia, setPendingMedia] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    return (
      <div className="card flex items-center justify-between p-4">
        <p className="text-sm text-qwin-muted">Sign in to share an update with the community.</p>
        <button onClick={() => router.push("/login")} className="btn-primary text-sm">
          Log in
        </button>
      </div>
    );
  }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && !pendingMedia) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, imageUrl: pendingMedia?.url, mediaType: pendingMedia?.type })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not post.");
        return;
      }
      onPosted(data.post);
      setContent("");
      setPendingMedia(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={3000}
        rows={3}
        placeholder="What are you building today?"
        className="input resize-none"
      />

      {pendingMedia && (
        <div className="mt-2 flex items-center gap-2">
          {pendingMedia.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pendingMedia.url} alt="" className="h-20 w-20 rounded-lg object-cover" />
          ) : (
            <video src={pendingMedia.url} className="h-20 w-20 rounded-lg object-cover" />
          )}
          <button type="button" onClick={() => setPendingMedia(null)} className="text-xs text-red-400">
            Remove
          </button>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
            {uploading ? "Uploading…" : "📎 Photo/Video"}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaSelect} disabled={uploading} />
          </label>
          <span className="text-xs text-qwin-muted">{content.length}/3000</span>
        </div>
        {error && <span className="text-xs text-red-400">{error}</span>}
        <button type="submit" disabled={submitting || (!content.trim() && !pendingMedia)} className="btn-primary text-sm">
          {submitting ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
