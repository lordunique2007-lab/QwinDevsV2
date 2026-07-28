import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, logAdminAction, AdminError } from "@/lib/admin";
import { z } from "zod";

const schema = z.object({
  role: z.enum(["USER", "PREMIUM", "VERIFIED_DEVELOPER", "BUSINESS", "MODERATOR"]).optional(),
  isVerified: z.boolean().optional()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let actor;
  try {
    actor = await requireSuperAdmin();
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success || (parsed.data.role === undefined && parsed.data.isVerified === undefined)) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "The Super Admin role cannot be reassigned here." }, { status: 400 });
  }

  const previousState = JSON.stringify({ role: target.role, isVerified: target.isVerified });

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.isVerified !== undefined ? { isVerified: parsed.data.isVerified } : {})
    }
  });

  await logAdminAction({
    actorId: actor.id,
    actorUsername: actor.username,
    action: "user.role_update",
    targetType: "USER",
    targetId: target.id,
    previousState,
    newState: JSON.stringify({ role: updated.role, isVerified: updated.isVerified })
  });

  return NextResponse.json({ role: updated.role, isVerified: updated.isVerified });
}
