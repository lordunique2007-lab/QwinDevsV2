import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, logAdminAction, AdminError } from "@/lib/admin";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["ban", "unban", "freeze", "unfreeze"]),
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

  const community = await prisma.community.findUnique({ where: { id: params.id } });
  if (!community) return NextResponse.json({ error: "Community not found." }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const newStatus =
    parsed.data.action === "ban" ? "BANNED" : parsed.data.action === "freeze" ? "FROZEN" : "ACTIVE";

  const updated = await prisma.community.update({
    where: { id: community.id },
    data: { status: newStatus }
  });

  await logAdminAction({
    actorId: actor.id,
    actorUsername: actor.username,
    action: `community.${parsed.data.action}`,
    targetType: "COMMUNITY",
    targetId: community.id,
    reason: parsed.data.reason,
    previousState: community.status,
    newState: updated.status
  });

  return NextResponse.json({ status: updated.status });
}
