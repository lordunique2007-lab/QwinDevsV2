import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, outranks, CommunityError } from "@/lib/community";
import { memberActionSchema } from "@/lib/community-validation";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = memberActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const community = await prisma.community.findUnique({ where: { slug: params.slug } });
  if (!community) {
    return NextResponse.json({ error: "Community not found." }, { status: 404 });
  }

  try {
    const actorMembership = await requireRole(community.id, session.user.id, "MODERATOR");

    const target = await prisma.user.findUnique({ where: { username: parsed.data.username.toLowerCase() } });
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const targetMembership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: target.id } }
    });
    if (!targetMembership) return NextResponse.json({ error: "That user is not a member." }, { status: 404 });

    if (targetMembership.role === "OWNER") {
      return NextResponse.json({ error: "The owner cannot be modified this way." }, { status: 400 });
    }
    if (!outranks(actorMembership.role, targetMembership.role) && actorMembership.role !== "OWNER") {
      return NextResponse.json({ error: "You cannot act on a member of equal or higher rank." }, { status: 403 });
    }

    const action = parsed.data.action;

    if (action === "promote_admin" || action === "promote_moderator") {
      if (actorMembership.role !== "OWNER" && actorMembership.role !== "ADMIN") {
        return NextResponse.json({ error: "Only owners and admins can promote members." }, { status: 403 });
      }
      await prisma.communityMember.update({
        where: { id: targetMembership.id },
        data: { role: action === "promote_admin" ? "ADMIN" : "MODERATOR" }
      });
    } else if (action === "demote") {
      await prisma.communityMember.update({ where: { id: targetMembership.id }, data: { role: "MEMBER" } });
    } else if (action === "kick") {
      await prisma.$transaction([
        prisma.communityMember.delete({ where: { id: targetMembership.id } }),
        prisma.community.update({ where: { id: community.id }, data: { memberCount: { decrement: 1 } } })
      ]);
    } else if (action === "ban") {
      await prisma.communityMember.update({ where: { id: targetMembership.id }, data: { bannedAt: new Date() } });
    } else if (action === "unban") {
      await prisma.communityMember.update({ where: { id: targetMembership.id }, data: { bannedAt: null } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CommunityError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error(err);
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}
