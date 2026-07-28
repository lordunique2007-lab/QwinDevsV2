import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { debitQC, WalletError } from "@/lib/wallet";
import { PREMIUM_PRICING, PremiumTierKey } from "@/lib/pricing";
import { notify } from "@/lib/notify";
import { z } from "zod";

const schema = z.object({ tier: z.enum(["PREMIUM", "PREMIUM_PLUS"]) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
  }

  const tierKey = parsed.data.tier as PremiumTierKey;
  const pricing = PREMIUM_PRICING[tierKey];

  try {
    await debitQC({
      userId: session.user.id,
      amount: pricing.qcPerMonth,
      type: "PREMIUM_PURCHASE",
      description: `${pricing.label} (1 month)`
    });
  } catch (err) {
    if (err instanceof WalletError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Purchase failed." }, { status: 500 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const now = new Date();
  // Stacking: if already subscribed and not expired, extend from the current
  // expiry rather than from now, so buying early never wastes remaining time.
  const base = user?.premiumUntil && user.premiumUntil > now ? user.premiumUntil : now;
  const premiumUntil = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      premiumTier: tierKey,
      premiumUntil,
      // Only upgrade the role if they're a plain USER — never downgrade a
      // Verified Developer/Business/Moderator/Super Admin's role via Premium.
      role: user?.role === "USER" ? "PREMIUM" : user?.role
    }
  });

  await notify({
    userId: updated.id,
    type: "SYSTEM",
    message: `Your ${pricing.label} subscription is active until ${premiumUntil.toLocaleDateString()}.`,
    link: "/wallet"
  });

  return NextResponse.json({ premiumTier: updated.premiumTier, premiumUntil: updated.premiumUntil });
}
