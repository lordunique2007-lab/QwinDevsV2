"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function NewCommunityPage() {
  const { status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({
    type: "GROUP" as "GROUP" | "CHANNEL",
    name: "",
    description: "",
    category: "General",
    visibility: "PUBLIC" as "PUBLIC" | "PRIVATE"
  });
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

    const res = await fetch("/api/communities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Could not create community.");
      return;
    }

    router.push(`/communities/${data.community.slug}`);
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="card p-6">
        <h1 className="font-display text-xl font-bold">Create a group or channel</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "GROUP" })}
              className={form.type === "GROUP" ? "btn-primary" : "btn-secondary"}
            >
              👥 Group
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "CHANNEL" })}
              className={form.type === "CHANNEL" ? "btn-primary" : "btn-secondary"}
            >
              📢 Channel
            </button>
          </div>

          <input
            required
            placeholder="Name"
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <textarea
            placeholder="Description"
            rows={3}
            className="input resize-none"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input
            placeholder="Category"
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, visibility: "PUBLIC" })}
              className={form.visibility === "PUBLIC" ? "btn-primary" : "btn-secondary"}
            >
              Public
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, visibility: "PRIVATE" })}
              className={form.visibility === "PRIVATE" ? "btn-primary" : "btn-secondary"}
            >
              Private
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Creating…" : `Create ${form.type === "GROUP" ? "group" : "channel"}`}
          </button>
        </form>
      </div>
    </div>
  );
}
