import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ stickerRef: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sticker." }, { status: 400 });
  }

  const existing = await prisma.favoriteSticker.findUnique({
    where: { userId_stickerRef: { userId: session.user.id, stickerRef: parsed.data.stickerRef } }
  });

  if (existing) {
    await prisma.favoriteSticker.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  }

  await prisma.favoriteSticker.create({
    data: { userId: session.user.id, stickerRef: parsed.data.stickerRef }
  });
  return NextResponse.json({ favorited: true });
}
