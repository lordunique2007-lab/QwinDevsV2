"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await signIn("credentials", {
      identifier,
      password,
      redirect: false
    });

    setSubmitting(false);

    if (res?.error) {
      setError("Invalid email/username or password.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6">
        <h1 className="font-display text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-qwin-muted">Log in to Qwin Devs</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            required
            placeholder="Email or username"
            className="input"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <input
            required
            type="password"
            placeholder="Password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-qwin-muted">
          New to Qwin Devs?{" "}
          <Link href="/register" className="text-qwin-primary2 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
