import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
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

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 1) {
    return NextResponse.json({ messages: [] });
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId: params.id,
      deletedForEveryone: false,
      content: { contains: q, mode: "insensitive" }
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { sender: { select: { username: true, displayName: true } } }
  });

  return NextResponse.json({ messages });
}
