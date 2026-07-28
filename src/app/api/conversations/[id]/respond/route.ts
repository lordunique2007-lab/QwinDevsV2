import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ action: z.enum(["accept", "decline"]) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: { participants: true }
  });

  if (!conversation || !conversation.participants.some((p) => p.userId === session.user.id)) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (conversation.initiatorId === session.user.id) {
    return NextResponse.json({ error: "You cannot respond to your own request." }, { status: 400 });
  }

  const updated = await prisma.conversation.update({
    where: { id: params.id },
    data: { status: parsed.data.action === "accept" ? "ACCEPTED" : "DECLINED" }
  });

  return NextResponse.json({ status: updated.status });
}
