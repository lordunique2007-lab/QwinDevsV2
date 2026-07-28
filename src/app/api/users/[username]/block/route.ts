import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { username: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const target = await prisma.user.findUnique({ where: { username: params.username.toLowerCase() } });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (target.id === session.user.id) {
    return NextResponse.json({ error: "You cannot block yourself." }, { status: 400 });
  }

  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: target.id } }
  });

  if (existing) {
    await prisma.block.delete({ where: { id: existing.id } });
    return NextResponse.json({ blocked: false });
  }

  await prisma.$transaction([
    prisma.block.create({ data: { blockerId: session.user.id, blockedId: target.id } }),
    prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: session.user.id, followingId: target.id },
          { followerId: target.id, followingId: session.user.id }
        ]
      }
    })
  ]);

  return NextResponse.json({ blocked: true });
}
