import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerEvent, CHANNELS, EVENTS } from "@/lib/pusher-server";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["delete_for_me", "delete_for_everyone", "pin", "unpin"])
});

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

  const message = await prisma.message.findUnique({ where: { id: params.messageId } });
  if (!message || message.conversationId !== params.id) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  if (parsed.data.action === "delete_for_me") {
    await prisma.messageHiddenFor.upsert({
      where: { messageId_userId: { messageId: message.id, userId: session.user.id } },
      update: {},
      create: { messageId: message.id, userId: session.user.id }
    });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "delete_for_everyone") {
    if (message.senderId !== session.user.id) {
      return NextResponse.json({ error: "You can only delete your own messages for everyone." }, { status: 403 });
    }
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { deletedForEveryone: true, content: "", mediaUrl: null }
    });
    await triggerEvent(CHANNELS.conversation(params.id), EVENTS.MESSAGE_UPDATED, updated);
    return NextResponse.json({ ok: true });
  }

  // pin / unpin — either participant can pin, matching common chat app behavior.
  const updated = await prisma.message.update({
    where: { id: message.id },
    data: { pinned: parsed.data.action === "pin" }
  });
  await triggerEvent(CHANNELS.conversation(params.id), EVENTS.MESSAGE_UPDATED, updated);
  return NextResponse.json({ ok: true, pinned: updated.pinned });
}
