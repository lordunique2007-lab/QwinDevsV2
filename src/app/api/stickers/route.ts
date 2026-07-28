import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({ imageUrl: z.string().url() });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const [myPack, favorites, recentMessages] = await Promise.all([
    prisma.sticker.findMany({ where: { ownerId: session.user.id }, orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.favoriteSticker.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } }),
    prisma.message.findMany({
      where: { senderId: session.user.id, type: "STICKER" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { content: true, mediaUrl: true }
    })
  ]);

  const seen = new Set<string>();
  const recent: { ref: string; imageUrl?: string }[] = [];
  for (const m of recentMessages) {
    const ref = m.mediaUrl ?? m.content;
    if (seen.has(ref)) continue;
    seen.add(ref);
    recent.push({ ref, imageUrl: m.mediaUrl ?? undefined });
    if (recent.length >= 16) break;
  }

  return NextResponse.json({
    myPack: myPack.map((s) => ({ id: s.id, imageUrl: s.imageUrl })),
    favorites: favorites.map((f) => f.stickerRef),
    recent
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid image is required." }, { status: 400 });
  }

  const count = await prisma.sticker.count({ where: { ownerId: session.user.id } });
  if (count >= 60) {
    return NextResponse.json({ error: "Your sticker pack is full (60 max)." }, { status: 400 });
  }

  const sticker = await prisma.sticker.create({
    data: { ownerId: session.user.id, imageUrl: parsed.data.imageUrl }
  });

  return NextResponse.json({ sticker }, { status: 201 });
}
