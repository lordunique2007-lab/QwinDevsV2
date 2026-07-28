import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateBotToken, hashBotToken, tokenPreview } from "@/lib/bot-token";

export async function POST(_req: Request, { params }: { params: { username: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const bot = await prisma.bot.findUnique({ where: { username: params.username.toLowerCase() } });
  if (!bot) return NextResponse.json({ error: "Bot not found." }, { status: 404 });
  if (bot.ownerId !== session.user.id) {
    return NextResponse.json({ error: "You do not own this bot." }, { status: 403 });
  }

  const token = generateBotToken();
  const tokenHash = await hashBotToken(token);

  await prisma.bot.update({
    where: { id: bot.id },
    data: { tokenHash, tokenPreview: tokenPreview(token) }
  });

  return NextResponse.json({ token });
}
