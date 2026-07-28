"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import VerifiedBadge from "./VerifiedBadge";
import { uploadFile } from "@/lib/upload-client";

type StoryItem = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  caption: string;
  seen: boolean;
};
type AuthorGroup = {
  author: { username: string; displayName: string; isVerified: boolean };
  hasUnseen: boolean;
  stories: StoryItem[];
};

export default function StoriesBar() {
  const { data: session } = useSession();
  const [groups, setGroups] = useState<AuthorGroup[]>([]);
  const [viewing, setViewing] = useState<AuthorGroup | null>(null);
  const [viewIndex, setViewIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const res = await fetch("/api/stories");
    if (!res.ok) return;
    const data = await res.json();
    setGroups(data.authors);
  }

  useEffect(() => {
    if (session) load();
  }, [session]);

  async function openStory(group: AuthorGroup) {
    setViewing(group);
    setViewIndex(0);
    const first = group.stories[0];
    if (first && !first.seen) {
      await fetch(`/api/stories/${first.id}/view`, { method: "POST" });
    }
  }

  async function nextStory() {
    if (!viewing) return;
    const next = viewIndex + 1;
    if (next >= viewing.stories.length) {
      setViewing(null);
      load();
      return;
    }
    setViewIndex(next);
    const story = viewing.stories[next];
    if (!story.seen) await fetch(`/api/stories/${story.id}/view`, { method: "POST" });
  }

  async function handleUploadStory(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const mediaType = file.type.startsWith("video") ? "video" : "image";
      const uploaded = await uploadFile(file, "story");
      await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: uploaded.url, mediaType })
      });
      load();
    } catch (err: any) {
      alert(`Story upload failed: ${err?.message ?? "unknown error"}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (!session) return null;

  return (
    <>
      <div className="card flex gap-3 overflow-x-auto p-3">
        <label className="flex shrink-0 cursor-pointer flex-col items-center gap-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-qwin-border text-qwin-muted">
            {uploading ? "…" : "+"}
          </div>
          <span className="text-xs text-qwin-muted">Add story</span>
          <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUploadStory} />
        </label>

        {groups.map((g) => (
          <button key={g.author.username} onClick={() => openStory(g)} className="flex shrink-0 flex-col items-center gap-1">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ${
                g.hasUnseen ? "bg-gradient-to-tr from-qwin-primary to-qwin-accent p-0.5" : "bg-qwin-surface2 p-0.5"
              }`}
            >
              <div className="flex h-full w-full items-center justify-center rounded-full bg-qwin-surface">
                {g.author.displayName.charAt(0).toUpperCase()}
              </div>
            </div>
            <span className="flex max-w-[60px] items-center gap-0.5 truncate text-xs text-qwin-muted">
              {g.author.displayName} {g.author.isVerified && <VerifiedBadge size={10} />}
            </span>
          </button>
        ))}
      </div>

      {viewing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={nextStory}>
          <div className="relative w-full max-w-sm">
            <div className="mb-2 flex gap-1">
              {viewing.stories.map((_, i) => (
                <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                  <div className={`h-full bg-white ${i <= viewIndex ? "w-full" : "w-0"}`} />
                </div>
              ))}
            </div>
            <p className="mb-2 flex items-center gap-1 text-sm text-white">
              {viewing.author.displayName} {viewing.author.isVerified && <VerifiedBadge size={12} />}
            </p>
            {viewing.stories[viewIndex].mediaType === "video" ? (
              <video src={viewing.stories[viewIndex].mediaUrl} autoPlay controls className="w-full rounded-xl" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewing.stories[viewIndex].mediaUrl} alt="" className="w-full rounded-xl" />
            )}
            {viewing.stories[viewIndex].caption && (
              <p className="mt-2 text-center text-sm text-white">{viewing.stories[viewIndex].caption}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
