"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function NewBotPage() {
  const { status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ username: "", name: "", description: "", category: "Utility" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Could not create bot.");
      return;
    }

    setCreatedToken(data.token);
    setCreatedUsername(data.bot.username);
  }

  if (createdToken) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card p-6">
          <h1 className="font-display text-xl font-bold text-qwin-accent">Bot created 🎉</h1>
          <p className="mt-2 text-sm text-qwin-muted">
            This is the only time your bot&apos;s API token will be shown. Copy it now and store it
            somewhere safe — Qwin Devs only keeps a hash of it.
          </p>
          <div className="mt-4 break-all rounded-xl bg-qwin-surface2 p-3 font-mono text-sm text-qwin-accent">
            {createdToken}
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(createdToken)}
            className="btn-secondary mt-3 w-full text-sm"
          >
            Copy to clipboard
          </button>
          <button
            onClick={() => router.push(`/bots/${createdUsername}`)}
            className="btn-primary mt-2 w-full"
          >
            Go to bot dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6">
        <h1 className="font-display text-xl font-bold">Create a bot</h1>
        <p className="mt-1 text-sm text-qwin-muted">Botmother — build and manage bots without leaving Qwin Devs.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            required
            placeholder="Bot username (letters, numbers, underscores)"
            className="input"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            required
            placeholder="Bot name"
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Creating…" : "Create bot"}
          </button>
        </form>
      </div>
    </div>
  );
}
