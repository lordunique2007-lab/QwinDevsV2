import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveBoostedIds } from "@/lib/boosts";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);

  const community = await prisma.community.findUnique({
    where: { slug: params.slug },
    include: {
      owner: { select: { username: true, displayName: true, isVerified: true } },
      members: {
        orderBy: { joinedAt: "asc" },
        take: 100,
        include: { user: { select: { username: true, displayName: true, isVerified: true } } }
      }
    }
  });

  if (!community) {
    return NextResponse.json({ error: "Community not found" }, { status: 404 });
  }

  const myMembership = session?.user
    ? community.members.find((m) => m.userId === session.user.id) ?? null
    : null;

  if (community.visibility === "PRIVATE" && !myMembership) {
    return NextResponse.json({ error: "This community is private." }, { status: 403 });
  }

  const boostedIds = await getActiveBoostedIds("COMMUNITY", [community.id]);

  return NextResponse.json({
    community: {
      id: community.id,
      type: community.type,
      slug: community.slug,
      name: community.name,
      description: community.description,
      category: community.category,
      visibility: community.visibility,
      status: community.status,
      memberCount: community.memberCount,
      inviteCode: myMembership && myMembership.role !== "MEMBER" ? community.inviteCode : undefined,
      isBoosted: boostedIds.has(community.id),
      mandatory: community.mandatory,
      owner: community.owner,
      createdAt: community.createdAt
    },
    myRole: myMembership?.role ?? null,
    members: community.members.map((m) => ({
      username: m.user.username,
      displayName: m.user.displayName,
      isVerified: m.user.isVerified,
      role: m.role,
      joinedAt: m.joinedAt
    }))
  });
}
