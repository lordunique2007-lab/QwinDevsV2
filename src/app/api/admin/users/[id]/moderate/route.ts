import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, logAdminAction, AdminError } from "@/lib/admin";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["ban", "unban", "freeze", "unfreeze"]),
  reason: z.string().max(500).optional().default(""),
  bannedUntil: z.string().datetime().optional()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let actor;
  try {
    actor = await requireAdminSession();
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (target.id === actor.id) {
    return NextResponse.json({ error: "You cannot moderate your own account." }, { status: 400 });
  }
  if (target.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "The Super Admin cannot be moderated." }, { status: 400 });
  }
  if (target.role === "MODERATOR" && actor.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only the Super Admin can moderate another moderator." }, { status: 403 });
  }

  const { action, reason } = parsed.data;
  const previousState = target.status;

  const newStatus =
    action === "ban" ? "BANNED" : action === "freeze" ? "FROZEN" : "ACTIVE";

  await prisma.user.update({
    where: { id: target.id },
    data: {
      status: newStatus,
      banReason: action === "ban" || action === "freeze" ? reason : null,
      bannedUntil: action === "ban" && parsed.data.bannedUntil ? new Date(parsed.data.bannedUntil) : null
    }
  });

  await logAdminAction({
    actorId: actor.id,
    actorUsername: actor.username,
    action: `user.${action}`,
    targetType: "USER",
    targetId: target.id,
    reason,
    previousState,
    newState: newStatus
  });

  return NextResponse.json({ status: newStatus });
}
