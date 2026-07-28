"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { status } = useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    fetch(`/api/invite/${params.code}`, { method: "POST" })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error ?? "Invalid invite link.");
          return;
        }
        router.push(`/communities/${data.slug}`);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, params.code]);

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8 text-center">
        {error ? <p className="text-red-400">{error}</p> : <p className="text-qwin-muted">Joining…</p>}
      </div>
    </div>
  );
}
