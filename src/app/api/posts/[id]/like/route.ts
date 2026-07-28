import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to like a post." }, { status: 401 });
  }

  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId: params.id, userId: session.user.id } }
  });

  if (existing) {
    await prisma.postLike.delete({ where: { id: existing.id } });
    const count = await prisma.postLike.count({ where: { postId: params.id } });
    return NextResponse.json({ liked: false, likeCount: count });
  }

  await prisma.postLike.create({ data: { postId: params.id, userId: session.user.id } });
  const count = await prisma.postLike.count({ where: { postId: params.id } });
  return NextResponse.json({ liked: true, likeCount: count });
}
