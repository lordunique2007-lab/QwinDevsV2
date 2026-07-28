"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

type Notification = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/notifications");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    setNotifications(data.notifications);
    setLoading(false);
  }

  useEffect(() => {
    if (status !== "loading") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function markAll() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true })
    });
    load();
  }

  async function markOne(id: string) {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  if (loading) return <div className="card h-64 animate-pulse" />;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Notifications</h1>
        <button onClick={markAll} className="btn-secondary text-sm">
          Mark all read
        </button>
      </div>

      <div className="card divide-y divide-qwin-border">
        {notifications.length === 0 && <p className="p-8 text-center text-sm text-qwin-muted">You&apos;re all caught up.</p>}
        {notifications.map((n) => (
          <Link
            key={n.id}
            href={n.link ?? "#"}
            onClick={() => !n.read && markOne(n.id)}
            className={`flex items-center justify-between px-4 py-3 text-sm ${!n.read ? "bg-qwin-primary/5" : ""}`}
          >
            <div>
              <p>{n.message}</p>
              <p className="text-xs text-qwin-muted">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-qwin-primary" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
