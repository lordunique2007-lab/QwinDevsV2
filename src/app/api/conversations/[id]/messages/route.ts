import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMessage, MessagingError } from "@/lib/messaging";
import { z } from "zod";

async function requireParticipant(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } }
  });
  return participant;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const participant = await requireParticipant(params.id, session.user.id);
  if (!participant) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              isVerified: true,
              role: true,
              status: true,
              banReason: true,
              bannedUntil: true
            }
          }
        }
      }
    }
  });

  const messages = await prisma.message.findMany({
    where: {
      conversationId: params.id,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      ...(participant.clearedAt ? { createdAt: { gt: participant.clearedAt } } : {}),
      hiddenFor: { none: { userId: session.user.id } }
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      sender: { select: { username: true, displayName: true, avatarUrl: true } },
      replyTo: { include: { sender: { select: { username: true, displayName: true } } } },
      reactions: { select: { emoji: true, userId: true } }
    }
  });

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: params.id, userId: session.user.id } },
    data: { lastReadAt: new Date() }
  });

  const otherParticipant = conversation!.participants.find((p) => p.userId !== session.user.id);
  const viewer = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  const isStaffViewer = viewer?.role === "SUPER_ADMIN" || viewer?.role === "MODERATOR";

  const otherUserFull = otherParticipant
    ? await prisma.user.findUnique({ where: { id: otherParticipant.userId }, select: { lastActiveAt: true } })
    : null;

  return NextResponse.json({
    conversation: {
      id: conversation!.id,
      status: conversation!.status,
      initiatorId: conversation!.initiatorId,
      myWallpaperUrl: participant.wallpaperUrl,
      otherUserReadAt: otherParticipant?.lastReadAt ?? null,
      otherUser: otherParticipant
        ? {
            username: otherParticipant.user.username,
            displayName: otherParticipant.user.displayName,
            avatarUrl: otherParticipant.user.avatarUrl,
            isVerified: otherParticipant.user.isVerified,
            lastActiveAt: otherUserFull?.lastActiveAt ?? null,
            // Only sent to Moderators/Super Admin — powers the quick-ban
            // button directly from a DM thread.
            moderation:
              isStaffViewer && otherParticipant.user.role !== "SUPER_ADMIN"
                ? {
                    id: otherParticipant.user.id,
                    status: otherParticipant.user.status,
                    banReason: otherParticipant.user.banReason,
                    bannedUntil: otherParticipant.user.bannedUntil
                  }
                : undefined
          }
        : null
    },
    messages
  });
}

const sendSchema = z.object({
  content: z.string().min(0).max(4000),
  type: z.enum(["TEXT", "STICKER", "VOICE", "IMAGE", "VIDEO"]).optional().default("TEXT"),
  mediaUrl: z.string().url().optional(),
  mediaDurationSec: z.number().int().positive().max(600).optional(),
  replyToId: z.string().optional(),
  viewOnce: z.boolean().optional()
}).refine((d) => d.type !== "TEXT" || d.content.length > 0, { message: "Message cannot be empty." });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid message." }, { status: 400 });
  }

  try {
    const message = await sendMessage(params.id, session.user.id, parsed.data.content, {
      type: parsed.data.type,
      mediaUrl: parsed.data.mediaUrl,
      mediaDurationSec: parsed.data.mediaDurationSec,
      replyToId: parsed.data.replyToId,
      viewOnce: parsed.data.viewOnce
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    if (err instanceof MessagingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Could not send message." }, { status: 500 });
  }
}
