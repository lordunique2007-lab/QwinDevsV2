import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string; messageId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: params.id, userId: session.user.id } }
  });
  if (!participant) {
    return NextResponse.json({ error: "Not a participant." }, { status: 403 });
  }

  const message = await prisma.message.findUnique({ where: { id: params.messageId } });
  if (!message || message.conversationId !== params.id || !message.viewOnce) {
    return NextResponse.json({ error: "Not a view-once message." }, { status: 400 });
  }

  if (message.senderId === session.user.id) {
    return NextResponse.json({ mediaUrl: message.mediaUrl });
  }

  if (message.viewedAt) {
    return NextResponse.json({ error: "This media has already been viewed." }, { status: 410 });
  }

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: { viewedAt: new Date() }
  });

  return NextResponse.json({ mediaUrl: message.mediaUrl, viewedAt: updated.viewedAt });
}
