import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const memberships = await prisma.communityMember.findMany({
    where: { userId: session.user.id, bannedAt: null },
    include: {
      community: {
        select: { slug: true, name: true, type: true, mandatory: true, memberCount: true }
      }
    },
    orderBy: [{ community: { mandatory: "desc" } }, { joinedAt: "desc" }]
  });

  return NextResponse.json({
    communities: memberships.map((m) => ({
      slug: m.community.slug,
      name: m.community.name,
      type: m.community.type,
      mandatory: m.community.mandatory,
      memberCount: m.community.memberCount
    }))
  });
}
