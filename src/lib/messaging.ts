import { prisma } from "@/lib/prisma";
import { triggerEvent, CHANNELS, EVENTS } from "@/lib/pusher-server";
import { deliverWebhook } from "@/lib/bot-webhook";

export class MessagingError extends Error {}

export async function assertNotBlocked(userAId: string, userBId: string) {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userAId, blockedId: userBId },
        { blockerId: userBId, blockedId: userAId }
      ]
    }
  });
  if (block) {
    throw new MessagingError("This conversation is not available.");
  }
}

/**
 * Finds or creates a 1:1 conversation between two users.
 * If the recipient does not follow the sender back, the conversation is
 * created as a PENDING message request until the recipient accepts it.
 */
export async function getOrCreateConversation(senderId: string, receiverUsername: string) {
  const receiver = await prisma.user.findUnique({ where: { username: receiverUsername.toLowerCase() } });
  if (!receiver) throw new MessagingError("User not found.");
  if (receiver.id === senderId) throw new MessagingError("You cannot message yourself.");

  await assertNotBlocked(senderId, receiver.id);

  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: senderId } } },
        { participants: { some: { userId: receiver.id } } }
      ]
    },
    include: { participants: true }
  });

  // Only treat it as the same conversation if it's exactly these two participants (1:1).
  const found = existing && existing.participants.length === 2 ? existing : null;
  if (found) return found;

  const receiverFollowsSender = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: receiver.id, followingId: senderId } }
  });

  const conversation = await prisma.conversation.create({
    data: {
      initiatorId: senderId,
      status: receiverFollowsSender ? "ACCEPTED" : "PENDING",
      participants: {
        create: [{ userId: senderId, lastReadAt: new Date() }, { userId: receiver.id }]
      }
    },
    include: { participants: true }
  });

  return conversation;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  options?: {
    type?: "TEXT" | "STICKER" | "VOICE" | "IMAGE" | "VIDEO";
    mediaUrl?: string;
    mediaDurationSec?: number;
    replyToId?: string;
    viewOnce?: boolean;
  }
) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: senderId } }
  });
  if (!participant) throw new MessagingError("You are not part of this conversation.");

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true }
  });
  if (!conversation) throw new MessagingError("Conversation not found.");
  if (conversation.status === "DECLINED") {
    throw new MessagingError("This message request was declined.");
  }

  const other = conversation.participants.find((p) => p.userId !== senderId);
  if (other) {
    await assertNotBlocked(senderId, other.userId);
  }

  if (options?.replyToId) {
    const target = await prisma.message.findUnique({ where: { id: options.replyToId } });
    if (!target || target.conversationId !== conversationId) {
      throw new MessagingError("Can't reply to that message.");
    }
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
        type: options?.type ?? "TEXT",
        mediaUrl: options?.mediaUrl,
        mediaDurationSec: options?.mediaDurationSec,
        replyToId: options?.replyToId,
        viewOnce: options?.viewOnce ?? false
      },
      include: {
        sender: { select: { username: true, displayName: true, avatarUrl: true } },
        replyTo: { include: { sender: { select: { username: true, displayName: true } } } }
      }
    }),
    prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: senderId } },
      data: { lastReadAt: new Date() }
    })
  ]);

  await triggerEvent(CHANNELS.conversation(conversationId), EVENTS.NEW_MESSAGE, message);

  if (other) {
    // If the recipient had deleted this chat from their list, a new message
    // brings it back — matches the behavior promised in the delete-chat UI.
    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: other.userId, hiddenAt: { not: null } },
      data: { hiddenAt: null }
    });
  }

  // If the recipient's account owns any active, webhook-enabled bots, forward
  // this DM to those webhooks — this is what lets a bot "hear" and reply to
  // a message sent to its owner's account, exactly like messaging a bot on
  // Telegram. The external server (any language) decides how to respond and
  // calls back POST /api/bots/{username}/send with this same conversationId.
  if (other) {
    const recipientBots = await prisma.bot.findMany({
      where: { ownerId: other.userId, status: "ACTIVE", webhookEnabled: true, webhookUrl: { not: null }, webhookSecret: { not: null } }
    });
    for (const bot of recipientBots) {
      await deliverWebhook({
        url: bot.webhookUrl!,
        secret: bot.webhookSecret!,
        event: "message",
        payload: {
          botUsername: bot.username,
          conversationId,
          messageId: message.id,
          content,
          type: options?.type ?? "TEXT",
          mediaUrl: options?.mediaUrl,
          sender: { username: message.sender.username, displayName: message.sender.displayName }
        }
      });
    }
  }

  return message;
}
