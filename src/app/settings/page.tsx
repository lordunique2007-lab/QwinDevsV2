"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { uploadFile } from "@/lib/upload-client";

type SelfProfile = {
  numericId: string;
  username: string;
  usernameHidden: boolean;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  role: string;
  premiumTier: string;
  email: string;
};

export default function SettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<SelfProfile | null>(null);
  const [bioLimit, setBioLimit] = useState(150);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [usernameHidden, setUsernameHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy ID");

  async function load() {
    const res = await fetch("/api/profile");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    setProfile(data.profile);
    setBioLimit(data.bioLimit);
    setDisplayName(data.profile.displayName);
    setBio(data.profile.bio);
    setAvatarUrl(data.profile.avatarUrl);
    setBannerUrl(data.profile.bannerUrl);
    setUsernameHidden(data.profile.usernameHidden);
  }

  useEffect(() => {
    if (status !== "loading") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setAvatarUploading(true);
    try {
      const uploaded = await uploadFile(file, "avatar");
      setAvatarUrl(uploaded.url);
    } catch (err: any) {
      setUploadError(`Avatar upload failed: ${err?.message ?? "unknown error"}`);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setBannerUploading(true);
    try {
      const uploaded = await uploadFile(file, "banner");
      setBannerUrl(uploaded.url);
    } catch (err: any) {
      setUploadError(`Banner upload failed: ${err?.message ?? "unknown error"}`);
    } finally {
      setBannerUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, bio, avatarUrl: avatarUrl ?? "", bannerUrl: bannerUrl ?? "", usernameHidden })
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save changes.");
      return;
    }
    setMessage("Saved.");
    load();
  }

  function copyId() {
    if (!profile) return;
    navigator.clipboard.writeText(profile.numericId);
    setCopyLabel("Copied!");
    setTimeout(() => setCopyLabel("Copy ID"), 1500);
  }

  if (!profile) return <div className="card h-64 animate-pulse" />;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="card p-6">
        <h1 className="font-display text-xl font-bold">Settings</h1>

        <div className="mt-4 rounded-xl bg-qwin-surface2 p-3">
          <p className="text-xs text-qwin-muted">Your permanent account ID</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-mono text-lg text-qwin-accent">{profile.numericId}</span>
            <button onClick={copyId} className="btn-secondary px-2 py-1 text-xs">
              {copyLabel}
            </button>
          </div>
          <p className="mt-1 text-xs text-qwin-muted">
            This never changes, even if you hide your username — it's how bots and other systems can
            always find your account.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-qwin-muted">Profile picture</label>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-qwin-surface2 text-xl font-bold">
                {avatarUploading ? (
                  <span className="text-xs text-qwin-muted">…</span>
                ) : avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="text-sm" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-qwin-muted">Banner</label>
            <div className="mb-2 h-24 w-full overflow-hidden rounded-xl bg-qwin-surface2">
              {bannerUploading ? (
                <div className="flex h-full items-center justify-center text-xs text-qwin-muted">Uploading…</div>
              ) : (
                bannerUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
                )
              )}
            </div>
            <input type="file" accept="image/*" onChange={handleBannerChange} className="text-sm" />
          </div>

          {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}

          <div>
            <label className="mb-1 block text-xs text-qwin-muted">Display name</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} />
          </div>

          <div>
            <label className="mb-1 block text-xs text-qwin-muted">
              Bio ({bio.length}/{bioLimit})
            </label>
            <textarea
              className="input resize-none"
              rows={3}
              value={bio}
              maxLength={bioLimit}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-qwin-surface2 p-3">
            <div>
              <p className="text-sm">Hide my @username publicly</p>
              <p className="text-xs text-qwin-muted">
                Your profile page still shows your permanent ID instead. Signed-in search still
                resolves your username internally.
              </p>
            </div>
            <button
              onClick={() => setUsernameHidden((v) => !v)}
              className={usernameHidden ? "btn-primary px-3 py-1.5 text-xs" : "btn-secondary px-3 py-1.5 text-xs"}
            >
              {usernameHidden ? "Hidden" : "Visible"}
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-qwin-accent">{message}</p>}

          <button onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-display font-semibold">Account</h2>
        <p className="mt-1 text-sm text-qwin-muted">
          @{profile.username} · {profile.email} · {profile.role}
          {profile.premiumTier !== "NONE" && ` · ${profile.premiumTier.replace("_", " ")}`}
        </p>
      </div>
    </div>
  );
}
