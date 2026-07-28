import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWalletWithHistory } from "@/lib/wallet";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const wallet = await getWalletWithHistory(session.user.id);
  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found." }, { status: 404 });
  }

  const history = [
    ...wallet.sent.map((t) => {
      const isPlatformPurchase = t.receiver.id === wallet.id; // debitQC records sender===receiver when there's no counterparty
      return {
        id: t.id,
        direction: isPlatformPurchase ? ("purchase" as const) : ("out" as const),
        amount: t.amount,
        type: t.type,
        description: t.description,
        counterparty: isPlatformPurchase ? "Qwin Devs" : t.receiver.user.username,
        createdAt: t.createdAt
      };
    }),
    // Self-referential platform purchases already appear above via `sent` —
    // exclude them here so they don't get counted twice.
    ...wallet.received
      .filter((t) => t.sender?.id !== wallet.id)
      .map((t) => ({
        id: t.id,
        direction: "in" as const,
        amount: t.amount,
        type: t.type,
        description: t.description,
        counterparty: t.sender?.user.username ?? "Qwin Devs",
        createdAt: t.createdAt
      }))
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return NextResponse.json({
    balance: wallet.balance,
    lifetimeIn: wallet.lifetimeIn,
    lifetimeOut: wallet.lifetimeOut,
    history
  });
}
