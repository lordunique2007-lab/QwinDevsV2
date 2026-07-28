"use client";

import { useEffect, useState } from "react";
import { uploadFile } from "@/lib/upload-client";

const EMOJI_STICKERS = ["🔥", "🚀", "👍", "❤️", "😂", "🎉", "💯", "👏", "🐛", "☕", "🤖", "💎", "✅", "🙌", "😎", "🤝", "🗿", "😭", "🥲", "🤔"];

type Tab = "emoji" | "pack" | "recent" | "favorites";

export default function StickerPicker({
  onPick
}: {
  onPick: (payload: { content: string; mediaUrl?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("emoji");
  const [myPack, setMyPack] = useState<{ id: string; imageUrl: string }[]>([]);
  const [recent, setRecent] = useState<{ ref: string; imageUrl?: string }[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/stickers");
    if (!res.ok) return;
    const data = await res.json();
    setMyPack(data.myPack);
    setRecent(data.recent);
    setFavorites(data.favorites);
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function handleAddSticker(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadFile(file, "chat");
      await fetch("/api/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: uploaded.url })
      });
      load();
    } catch (err: any) {
      setError(`Sticker upload failed: ${err?.message ?? "unknown error"}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function toggleFavorite(ref: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch("/api/stickers/favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stickerRef: ref })
    });
    load();
  }

  function pick(ref: string, imageUrl?: string) {
    onPick(imageUrl ? { content: "🖼", mediaUrl: imageUrl } : { content: ref });
    setOpen(false);
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-secondary shrink-0 px-3" aria-label="Stickers">
        😊
      </button>
      {open && (
        <div className="absolute bottom-12 right-0 z-10 w-72 rounded-xl border border-qwin-border bg-qwin-surface p-2 shadow-lg">
          <div className="mb-2 flex gap-1 border-b border-qwin-border pb-2 text-xs">
            {(["emoji", "pack", "recent", "favorites"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-1 capitalize ${tab === t ? "bg-qwin-primary text-white" : "text-qwin-muted hover:bg-qwin-surface2"}`}
              >
                {t === "pack" ? "My pack" : t}
              </button>
            ))}
          </div>

          {tab === "emoji" && (
            <div className="grid grid-cols-5 gap-1">
              {EMOJI_STICKERS.map((s) => (
                <button key={s} onClick={() => pick(s)} className="relative rounded-lg p-2 text-2xl hover:bg-qwin-surface2">
                  {s}
                  <span onClick={(e) => toggleFavorite(s, e)} className="absolute -right-0.5 -top-0.5 text-[10px]">
                    {favorites.includes(s) ? "★" : ""}
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab === "pack" && (
            <div>
              <div className="grid grid-cols-5 gap-1">
                {myPack.map((s) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={s.id}
                    src={s.imageUrl}
                    alt=""
                    onClick={() => pick(s.imageUrl, s.imageUrl)}
                    className="h-12 w-12 cursor-pointer rounded-lg object-cover hover:opacity-80"
                  />
                ))}
              </div>
              {myPack.length === 0 && <p className="py-2 text-center text-xs text-qwin-muted">No stickers yet.</p>}
              <label className="btn-secondary mt-2 block cursor-pointer py-1.5 text-center text-xs">
                {uploading ? "Uploading…" : "+ Add sticker from image"}
                <input type="file" accept="image/*" className="hidden" onChange={handleAddSticker} disabled={uploading} />
              </label>
              {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
            </div>
          )}

          {tab === "recent" && (
            <div className="grid grid-cols-5 gap-1">
              {recent.map((r) =>
                r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={r.ref}
                    src={r.imageUrl}
                    alt=""
                    onClick={() => pick(r.ref, r.imageUrl)}
                    className="h-12 w-12 cursor-pointer rounded-lg object-cover hover:opacity-80"
                  />
                ) : (
                  <button key={r.ref} onClick={() => pick(r.ref)} className="rounded-lg p-2 text-2xl hover:bg-qwin-surface2">
                    {r.ref}
                  </button>
                )
              )}
              {recent.length === 0 && <p className="col-span-5 py-2 text-center text-xs text-qwin-muted">Nothing recent.</p>}
            </div>
          )}

          {tab === "favorites" && (
            <div className="grid grid-cols-5 gap-1">
              {favorites.map((ref) => (
                <button key={ref} onClick={() => pick(ref)} className="rounded-lg p-2 text-2xl hover:bg-qwin-surface2">
                  {ref}
                </button>
              ))}
              {favorites.length === 0 && <p className="col-span-5 py-2 text-center text-xs text-qwin-muted">No favorites yet — tap ★ on a sticker.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
