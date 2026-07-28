"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Tx = {
  id: string;
  direction: "in" | "out" | "purchase";
  amount: number;
  type: string;
  description: string;
  counterparty: string;
  createdAt: string;
};

export default function WalletPage() {
  const { status } = useSession();
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState(10);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function load() {
    const res = await fetch("/api/wallet");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    setBalance(data.balance);
    setHistory(data.history);
    setLoading(false);
  }

  useEffect(() => {
    if (status !== "loading") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const res = await fetch("/api/wallet/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverUsername: receiver, amount, message: note })
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "Transfer failed.");
      return;
    }
    setReceiver("");
    setNote("");
    load();
  }

  if (loading) return <div className="card h-64 animate-pulse" />;

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div className="card bg-gradient-to-br from-qwin-primary/20 to-qwin-surface p-6">
        <p className="text-sm text-qwin-muted">Your balance</p>
        <p className="mt-1 font-display text-4xl font-bold text-qwin-gold">💎 {balance?.toLocaleString()} QC</p>
      </div>

      <div className="card p-6">
        <h2 className="font-display font-semibold">Send Qwin Currency</h2>
        <form onSubmit={handleSend} className="mt-3 space-y-3">
          <input
            required
            placeholder="Recipient username"
            className="input"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
          />
          <input
            required
            type="number"
            min={1}
            className="input"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value || "0", 10))}
          />
          <input
            placeholder="Message (optional)"
            className="input"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={sending} className="btn-primary w-full">
            {sending ? "Sending…" : "Send QC"}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="font-display font-semibold">Transaction history</h2>
        <div className="mt-3 divide-y divide-qwin-border">
          {history.length === 0 && <p className="py-4 text-sm text-qwin-muted">No transactions yet.</p>}
          {history.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">
                  {tx.direction === "in" ? "Received from" : tx.direction === "purchase" ? "Spent on" : "Sent to"}{" "}
                  {tx.direction === "purchase" ? tx.description || tx.type : `@${tx.counterparty}`}
                </p>
                <p className="text-xs text-qwin-muted">
                  {tx.type} · {new Date(tx.createdAt).toLocaleString()}
                </p>
                {tx.description && <p className="text-xs text-qwin-muted">&ldquo;{tx.description}&rdquo;</p>}
              </div>
              <span className={tx.direction === "in" ? "text-qwin-accent" : tx.direction === "purchase" ? "text-qwin-gold" : "text-red-400"}>
                {tx.direction === "in" ? "+" : "-"}
                {tx.amount} QC
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
