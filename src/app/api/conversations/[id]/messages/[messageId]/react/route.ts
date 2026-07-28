import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerEvent, CHANNELS, EVENTS } from "@/lib/pusher-server";
import { z } from "zod";

const schema = z.object({ emoji: z.string().min(1).max(8) });

export async function POST(req: Request, { params }: { params: { id: string; messageId: string } }) {
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

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid emoji." }, { status: 400 });
  }

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId: { messageId: params.messageId, userId: session.user.id } }
  });

  if (existing && existing.emoji === parsed.data.emoji) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else if (existing) {
    await prisma.messageReaction.update({ where: { id: existing.id }, data: { emoji: parsed.data.emoji } });
  } else {
    await prisma.messageReaction.create({
      data: { messageId: params.messageId, userId: session.user.id, emoji: parsed.data.emoji }
    });
  }

  const reactions = await prisma.messageReaction.findMany({
    where: { messageId: params.messageId },
    select: { emoji: true, userId: true }
  });

  await triggerEvent(CHANNELS.conversation(params.id), EVENTS.MESSAGE_UPDATED, {
    id: params.messageId,
    reactions
  });

  return NextResponse.json({ reactions });
}
