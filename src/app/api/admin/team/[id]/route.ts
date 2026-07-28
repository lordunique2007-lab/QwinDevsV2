import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, logAdminAction, AdminError } from "@/lib/admin";
import { z } from "zod";

const updateSchema = z.object({
  rankLabel: z.string().min(1).max(80).optional(),
  name: z.string().min(1).max(150).optional(),
  linkedUsername: z.string().max(30).optional().nullable(),
  order: z.number().int().optional()
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let actor;
  try {
    actor = await requireSuperAdmin();
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const existing = await prisma.teamMember.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Team member not found." }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const updated = await prisma.teamMember.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.rankLabel !== undefined ? { rankLabel: parsed.data.rankLabel } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.linkedUsername !== undefined ? { linkedUsername: parsed.data.linkedUsername || null } : {}),
      ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {})
    }
  });

  await logAdminAction({
    actorId: actor.id,
    actorUsername: actor.username,
    action: "team.member_update",
    targetType: "TEAM_MEMBER",
    targetId: updated.id,
    previousState: `${existing.rankLabel}: ${existing.name}`,
    newState: `${updated.rankLabel}: ${updated.name}`
  });

  return NextResponse.json({ member: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let actor;
  try {
    actor = await requireSuperAdmin();
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const existing = await prisma.teamMember.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Team member not found." }, { status: 404 });

  await prisma.teamMember.delete({ where: { id: params.id } });

  await logAdminAction({
    actorId: actor.id,
    actorUsername: actor.username,
    action: "team.member_remove",
    targetType: "TEAM_MEMBER",
    targetId: params.id,
    previousState: `${existing.rankLabel}: ${existing.name}`
  });

  return NextResponse.json({ deleted: true });
}
