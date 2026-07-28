import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

export async function POST(_req: Request, { params }: { params: { username: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to follow." }, { status: 401 });
  }

  const target = await prisma.user.findUnique({ where: { username: params.username.toLowerCase() } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.id === session.user.id) {
    return NextResponse.json({ error: "You cannot follow yourself." }, { status: 400 });
  }

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: session.user.id, followingId: target.id } }
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return NextResponse.json({ following: false });
  }

  await prisma.follow.create({ data: { followerId: session.user.id, followingId: target.id } });

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  await notify({
    userId: target.id,
    type: "FOLLOW",
    message: `@${me?.username} started following you.`,
    link: `/profile/${me?.username}`
  });

  return NextResponse.json({ following: true });
}
