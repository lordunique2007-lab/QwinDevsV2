import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { debitQC, WalletError } from "@/lib/wallet";
import { BOOST_PRICING, BOOST_DURATIONS_MS } from "@/lib/pricing";
import { z } from "zod";

const schema = z.object({
  targetType: z.enum(["PROJECT", "BOT", "COMMUNITY"]),
  targetId: z.string().min(1),
  duration: z.enum(["24h", "3d", "7d", "14d", "30d"])
});

async function assertOwnership(targetType: string, targetId: string, userId: string) {
  if (targetType === "PROJECT") {
    const p = await prisma.project.findUnique({ where: { id: targetId } });
    if (!p) throw new Error("Project not found.");
    if (p.developerId !== userId) throw new Error("You can only boost your own projects.");
  } else if (targetType === "BOT") {
    const b = await prisma.bot.findUnique({ where: { id: targetId } });
    if (!b) throw new Error("Bot not found.");
    if (b.ownerId !== userId) throw new Error("You can only boost your own bots.");
  } else if (targetType === "COMMUNITY") {
    const c = await prisma.community.findUnique({ where: { id: targetId } });
    if (!c) throw new Error("Community not found.");
    if (c.ownerId !== userId) throw new Error("You can only boost communities you own.");
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid boost request." }, { status: 400 });
  }

  try {
    await assertOwnership(parsed.data.targetType, parsed.data.targetId, session.user.id);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const cost = BOOST_PRICING[parsed.data.duration];

  try {
    await debitQC({
      userId: session.user.id,
      amount: cost,
      type: "BOOST_PURCHASE",
      description: `Boost (${parsed.data.duration}) for ${parsed.data.targetType.toLowerCase()}`
    });
  } catch (err) {
    if (err instanceof WalletError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Boost purchase failed." }, { status: 500 });
  }

  // Extend an existing active boost on the same target rather than stacking
  // separate overlapping rows, so "time remaining" always reads correctly.
  const now = new Date();
  const existing = await prisma.boost.findFirst({
    where: { targetType: parsed.data.targetType, targetId: parsed.data.targetId, expiresAt: { gt: now } },
    orderBy: { expiresAt: "desc" }
  });

  const base = existing ? existing.expiresAt : now;
  const expiresAt = new Date(base.getTime() + BOOST_DURATIONS_MS[parsed.data.duration]);

  const boost = await prisma.boost.create({
    data: {
      userId: session.user.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      qcSpent: cost,
      expiresAt
    }
  });

  return NextResponse.json({ boost }, { status: 201 });
}
