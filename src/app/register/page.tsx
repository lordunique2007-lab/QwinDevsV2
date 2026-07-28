"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

function passwordStrength(pw: string): { label: string; score: number } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong", "Excellent"];
  return { label: labels[score], score };
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    dateOfBirth: "",
    password: "",
    confirmPassword: ""
  });
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (form.username.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(form.username)}`);
        const data = await res.json();
        setUsernameStatus(data.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.username]);

  const strength = passwordStrength(form.password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        setSubmitting(false);
        return;
      }

      const signInRes = await signIn("credentials", {
        identifier: form.email,
        password: form.password,
        redirect: false
      });

      if (signInRes?.error) {
        router.push("/login");
        return;
      }

      router.push(`/profile/${form.username.toLowerCase()}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6">
        <h1 className="font-display text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-qwin-muted">Where Developers Build. Share. Connect. Grow.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="First name"
              className="input"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
            <input
              required
              placeholder="Last name"
              className="input"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>

          <div>
            <input
              required
              placeholder="Username"
              className="input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, "") })}
            />
            {usernameStatus === "checking" && (
              <p className="mt-1 text-xs text-qwin-muted">Checking availability…</p>
            )}
            {usernameStatus === "available" && (
              <p className="mt-1 text-xs text-qwin-accent">@{form.username} is available</p>
            )}
            {usernameStatus === "taken" && (
              <p className="mt-1 text-xs text-red-400">That username is not available</p>
            )}
          </div>

          <input
            required
            type="email"
            placeholder="Email address"
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <div>
            <label className="mb-1 block text-xs text-qwin-muted">Date of birth</label>
            <input
              required
              type="date"
              className="input"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            />
          </div>

          <div>
            <input
              required
              type="password"
              placeholder="Password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            {form.password.length > 0 && (
              <div className="mt-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-qwin-surface2">
                  <div
                    className="h-full bg-qwin-primary transition-all"
                    style={{ width: `${(strength.score / 5) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-qwin-muted">{strength.label}</p>
              </div>
            )}
          </div>

          <input
            required
            type="password"
            placeholder="Confirm password"
            className="input"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting || usernameStatus === "taken"}
            className="btn-primary w-full"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-qwin-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-qwin-primary2 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
