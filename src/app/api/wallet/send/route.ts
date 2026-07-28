import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendQcSchema } from "@/lib/validation";
import { transferQC, WalletError } from "@/lib/wallet";
import { notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = sendQcSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const transaction = await transferQC({
      senderUserId: session.user.id,
      receiverUsername: parsed.data.receiverUsername,
      amount: parsed.data.amount,
      type: "GIFT",
      description: parsed.data.message
    });

    const receiver = await prisma.user.findUnique({ where: { username: parsed.data.receiverUsername } });
    if (receiver) {
      await notify({
        userId: receiver.id,
        type: "WALLET_RECEIVED",
        message: `You received ${parsed.data.amount} QC from @${session.user.username}.`,
        link: "/wallet"
      });
    }

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (err) {
    if (err instanceof WalletError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Transfer failed. Please try again." }, { status: 500 });
  }
}
