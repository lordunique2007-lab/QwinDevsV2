import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["clear", "hide", "unhide", "set_wallpaper"]),
  wallpaperUrl: z.string().url().optional().or(z.literal(""))
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
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
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.action === "clear") data.clearedAt = new Date();
  if (parsed.data.action === "hide") data.hiddenAt = new Date();
  if (parsed.data.action === "unhide") data.hiddenAt = null;
  if (parsed.data.action === "set_wallpaper") data.wallpaperUrl = parsed.data.wallpaperUrl || null;

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: params.id, userId: session.user.id } },
    data
  });

  return NextResponse.json({ ok: true });
}
