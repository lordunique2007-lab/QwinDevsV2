import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, logAdminAction, AdminError } from "@/lib/admin";
import { z } from "zod";

const memberSchema = z.object({
  rankLabel: z.string().min(1).max(80),
  name: z.string().min(1).max(150),
  linkedUsername: z.string().max(30).optional()
});

const settingsSchema = z.object({
  pageTitle: z.string().min(1).max(150).optional(),
  subtitle: z.string().max(200).optional()
});

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const [settings, members] = await Promise.all([
    prisma.teamSettings.findUnique({ where: { id: "singleton" } }),
    prisma.teamMember.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] })
  ]);

  return NextResponse.json({ settings, members });
}

export async function POST(req: Request) {
  let actor;
  try {
    actor = await requireSuperAdmin();
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const body = await req.json();

  // Distinguish "update page settings" from "add a member" by shape.
  if (body.pageTitle !== undefined || body.subtitle !== undefined) {
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });

    const updated = await prisma.teamSettings.upsert({
      where: { id: "singleton" },
      update: parsed.data,
      create: { id: "singleton", pageTitle: parsed.data.pageTitle ?? "Meet the Team", subtitle: parsed.data.subtitle ?? "" }
    });

    await logAdminAction({
      actorId: actor.id,
      actorUsername: actor.username,
      action: "team.settings_update",
      targetType: "TEAM_SETTINGS",
      targetId: "singleton"
    });

    return NextResponse.json({ settings: updated });
  }

  const parsed = memberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const maxOrder = await prisma.teamMember.aggregate({
    where: { rankLabel: parsed.data.rankLabel },
    _max: { order: true }
  });

  const member = await prisma.teamMember.create({
    data: {
      rankLabel: parsed.data.rankLabel,
      name: parsed.data.name,
      linkedUsername: parsed.data.linkedUsername || null,
      order: (maxOrder._max.order ?? -1) + 1
    }
  });

  await logAdminAction({
    actorId: actor.id,
    actorUsername: actor.username,
    action: "team.member_add",
    targetType: "TEAM_MEMBER",
    targetId: member.id,
    newState: `${member.rankLabel}: ${member.name}`
  });

  return NextResponse.json({ member }, { status: 201 });
}
