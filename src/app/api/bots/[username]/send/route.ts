import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBotToken } from "@/lib/bot-token";
import { sendMessage, MessagingError } from "@/lib/messaging";
import { triggerEvent, CHANNELS, EVENTS } from "@/lib/pusher-server";
import { z } from "zod";

const sendSchema = z.object({
  conversationId: z.string().min(1).optional(),
  communityId: z.string().min(1).optional(),
  content: z.string().min(1).max(4000)
}).refine((d) => !!d.conversationId !== !!d.communityId, {
  message: "Provide exactly one of conversationId or communityId."
});

/**
 * The other half of the webhook loop: once your own external bot code
 * (Python, JS, anything) has decided how to respond to an event it received
 * via the webhook, it calls this endpoint with the bot's token to actually
 * deliver the reply — the same shape as Telegram's sendMessage Bot API call.
 *
 * Authorization: Bearer qwin_bot_...
 */
export async function POST(req: Request, { params }: { params: { username: string } }) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Missing bot token." }, { status: 401 });
  }

  const bot = await prisma.bot.findUnique({ where: { username: params.username.toLowerCase() } });
  if (!bot) return NextResponse.json({ error: "Bot not found." }, { status: 404 });
  if (bot.status !== "ACTIVE") {
    return NextResponse.json({ error: "This bot is not active." }, { status: 403 });
  }

  const validToken = await verifyBotToken(token, bot.tokenHash);
  if (!validToken) {
    return NextResponse.json({ error: "Invalid bot token." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  if (parsed.data.conversationId) {
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId: parsed.data.conversationId, userId: bot.ownerId }
    });
    if (!participant) {
      return NextResponse.json({ error: "This bot is not part of that conversation." }, { status: 403 });
    }

    try {
      const message = await sendMessage(parsed.data.conversationId, bot.ownerId, parsed.data.content);
      return NextResponse.json({ message }, { status: 201 });
    } catch (err) {
      if (err instanceof MessagingError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  if (parsed.data.communityId) {
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: parsed.data.communityId, userId: bot.ownerId } }
    });
    if (!membership) {
      return NextResponse.json({ error: "This bot's owner is not a member of that community." }, { status: 403 });
    }

    const message = await prisma.communityMessage.create({
      data: { communityId: parsed.data.communityId, senderId: bot.ownerId, content: parsed.data.content },
      include: { sender: { select: { username: true, displayName: true } } }
    });

    await triggerEvent(CHANNELS.community(parsed.data.communityId), EVENTS.NEW_MESSAGE, message);

    return NextResponse.json({ message }, { status: 201 });
  }

  return NextResponse.json({ error: "Nothing to send." }, { status: 400 });
}
