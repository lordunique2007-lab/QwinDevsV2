import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateConversation, MessagingError } from "@/lib/messaging";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId: session.user.id, hiddenAt: null },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { select: { username: true, displayName: true, avatarUrl: true, isVerified: true } } }
          },
          messages: { orderBy: { createdAt: "desc" }, take: 1 }
        }
      }
    },
    orderBy: { conversation: { updatedAt: "desc" } }
  });

  const chats = memberships.map((m) => {
    const other = m.conversation.participants.find((p) => p.userId !== session.user.id);
    const lastMessage = m.conversation.messages[0] ?? null;
    const unread =
      lastMessage &&
      lastMessage.senderId !== session.user.id &&
      (!m.lastReadAt || lastMessage.createdAt > m.lastReadAt);

    return {
      conversationId: m.conversation.id,
      status: m.conversation.status,
      isRequest: m.conversation.status === "PENDING" && m.conversation.initiatorId !== session.user.id,
      otherUser: other?.user ?? null,
      lastMessage: lastMessage ? { content: lastMessage.content, createdAt: lastMessage.createdAt } : null,
      unread: !!unread,
      updatedAt: m.conversation.updatedAt
    };
  });

  return NextResponse.json({ chats });
}

const startSchema = z.object({ username: z.string().min(1) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A username is required." }, { status: 400 });
  }

  try {
    const conversation = await getOrCreateConversation(session.user.id, parsed.data.username);
    return NextResponse.json({ conversationId: conversation.id, status: conversation.status }, { status: 201 });
  } catch (err) {
    if (err instanceof MessagingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Could not start conversation." }, { status: 500 });
  }
}
