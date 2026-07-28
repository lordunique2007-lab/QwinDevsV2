"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { uploadFile } from "@/lib/upload-client";

const CATEGORIES = [
  "Artificial Intelligence",
  "Automation",
  "Bots",
  "Business",
  "Cybersecurity",
  "Developer Tools",
  "Education",
  "Games",
  "Libraries",
  "Mobile Apps",
  "Open Source",
  "Productivity",
  "Utilities",
  "Web Applications"
];

export default function NewProjectPage() {
  const { status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    tagline: "",
    description: "",
    category: CATEGORIES[0],
    tags: "",
    repoUrl: "",
    websiteUrl: "",
    version: "1.0.0",
    license: "MIT"
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let fileFields: { fileUrl?: string; fileName?: string; fileSize?: number } = {};
    if (file) {
      try {
        setUploadPct(0);
        const uploaded = await uploadFile(file, "project", setUploadPct);
        fileFields = { fileUrl: uploaded.url, fileName: uploaded.fileName, fileSize: uploaded.fileSize };
      } catch (err: any) {
        setSubmitting(false);
        setUploadPct(null);
        setError(`File upload failed: ${err?.message ?? "unknown error"}`);
        return;
      }
      setUploadPct(null);
    }

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ...fileFields,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean)
      })
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Could not publish project.");
      return;
    }

    router.push(`/projects/${data.project.slug}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="card p-6">
        <h1 className="font-display text-xl font-bold">Publish a project</h1>
        <p className="mt-1 text-sm text-qwin-muted">Share what you&apos;ve built with the Qwin Devs community.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            required
            placeholder="Project name"
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Short tagline"
            className="input"
            maxLength={120}
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
          />
          <textarea
            required
            placeholder="Describe your project (min 20 characters)"
            rows={6}
            className="input resize-none"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              placeholder="Version"
              className="input"
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
            />
          </div>
          <input
            placeholder="Tags, comma separated (react, ai, cli)"
            className="input"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
          <input
            placeholder="Repository URL (optional)"
            className="input"
            value={form.repoUrl}
            onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
          />
          <input
            placeholder="Website URL (optional)"
            className="input"
            value={form.websiteUrl}
            onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
          />
          <input
            placeholder="License"
            className="input"
            value={form.license}
            onChange={(e) => setForm({ ...form, license: e.target.value })}
          />

          <div>
            <label className="mb-1 block text-xs text-qwin-muted">
              Project file — ZIP, APK, installer, or source archive (optional, up to 200MB)
            </label>
            <input
              type="file"
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-qwin-surface2 file:px-3 file:py-1.5 file:text-qwin-text"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {uploadPct !== null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-qwin-surface2">
                <div className="h-full bg-qwin-primary transition-all" style={{ width: `${uploadPct}%` }} />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {uploadPct !== null ? `Uploading… ${uploadPct}%` : submitting ? "Publishing…" : "Publish project"}
          </button>
        </form>
      </div>
    </div>
  );
}
