import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const story = await prisma.story.findUnique({ where: { id: params.id } });
  if (!story || story.expiresAt < new Date()) {
    return NextResponse.json({ error: "Story not found or expired." }, { status: 404 });
  }

  await prisma.storyView.upsert({
    where: { storyId_viewerId: { storyId: story.id, viewerId: session.user.id } },
    update: {},
    create: { storyId: story.id, viewerId: session.user.id }
  });

  return NextResponse.json({ ok: true });
}
