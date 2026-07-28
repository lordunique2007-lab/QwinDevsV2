"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const REASONS = [
  "Spam",
  "Harassment",
  "Violence",
  "Nudity or sexual content",
  "Hate speech",
  "Impersonation",
  "Copyright",
  "Scam or fraud",
  "Malware",
  "Other"
];

export default function ReportButton({
  targetType,
  targetId,
  label = "Report"
}: {
  targetType: "USER" | "PROJECT" | "POST" | "BOT" | "COMMUNITY";
  targetId: string;
  label?: string;
}) {
  const { status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal() {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    setOpen(true);
    setDone(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason, details })
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not submit report.");
      return;
    }
    setDone(true);
    setDetails("");
  }

  return (
    <>
      <button onClick={openModal} className="text-xs text-qwin-muted hover:text-red-400" type="button">
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            {done ? (
              <>
                <p className="text-center text-sm text-qwin-accent">
                  Report submitted. Our moderation team will review it.
                </p>
                <button onClick={() => setOpen(false)} className="btn-secondary mt-4 w-full text-sm">
                  Close
                </button>
              </>
            ) : (
              <form onSubmit={submit}>
                <h2 className="font-display font-semibold">Report</h2>
                <div className="mt-3 space-y-2">
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="input text-sm"
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <textarea
                    placeholder="Additional details (optional)"
                    rows={3}
                    maxLength={2000}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    className="input resize-none text-sm"
                  />
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 text-sm">
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="btn-primary flex-1 text-sm">
                      {submitting ? "Submitting…" : "Submit report"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
