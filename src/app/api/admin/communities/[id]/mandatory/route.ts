import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, logAdminAction, AdminError } from "@/lib/admin";
import { enrollAllUsersInCommunity } from "@/lib/community";
import { z } from "zod";

const schema = z.object({ mandatory: z.boolean() });

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
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const community = await prisma.community.findUnique({ where: { id: params.id } });
  if (!community) return NextResponse.json({ error: "Community not found." }, { status: 404 });

  const updated = await prisma.community.update({
    where: { id: community.id },
    data: { mandatory: parsed.data.mandatory }
  });

  let enrolledCount = 0;
  if (parsed.data.mandatory && !community.mandatory) {
    // Turning a channel official retroactively enrolls every existing
    // account, not just future signups — "everyone" means everyone.
    enrolledCount = await enrollAllUsersInCommunity(community.id);
  }

  await logAdminAction({
    actorId: actor.id,
    actorUsername: actor.username,
    action: parsed.data.mandatory ? "community.make_official" : "community.make_optional",
    targetType: "COMMUNITY",
    targetId: community.id,
    previousState: String(community.mandatory),
    newState: String(updated.mandatory),
    reason: enrolledCount > 0 ? `Auto-enrolled ${enrolledCount} existing accounts.` : ""
  });

  return NextResponse.json({ mandatory: updated.mandatory, enrolledCount });
}
