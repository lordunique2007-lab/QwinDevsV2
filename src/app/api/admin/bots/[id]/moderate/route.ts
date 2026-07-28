import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, logAdminAction, AdminError } from "@/lib/admin";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["suspend", "unsuspend", "freeze", "unfreeze"]),
  reason: z.string().max(500).optional().default("")
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let actor;
  try {
    actor = await requireAdminSession();
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const bot = await prisma.bot.findUnique({ where: { id: params.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found." }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const newStatus =
    parsed.data.action === "suspend" ? "SUSPENDED" : parsed.data.action === "freeze" ? "FROZEN" : "ACTIVE";

  const updated = await prisma.bot.update({
    where: { id: bot.id },
    data: { status: newStatus }
  });

  await logAdminAction({
    actorId: actor.id,
    actorUsername: actor.username,
    action: `bot.${parsed.data.action}`,
    targetType: "BOT",
    targetId: bot.id,
    reason: parsed.data.reason,
    previousState: bot.status,
    newState: updated.status
  });

  return NextResponse.json({ status: updated.status });
}
