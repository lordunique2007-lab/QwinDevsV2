import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveBoostedIds } from "@/lib/boosts";

export async function GET(_req: Request, { params }: { params: { username: string } }) {
  const session = await getServerSession(authOptions);

  const bot = await prisma.bot.findUnique({
    where: { username: params.username.toLowerCase() },
    include: {
      owner: { select: { username: true, displayName: true, isVerified: true } },
      commands: { orderBy: { trigger: "asc" } }
    }
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  const isOwner = session?.user?.id === bot.ownerId;

  if (bot.visibility === "PRIVATE" && !isOwner) {
    return NextResponse.json({ error: "This bot is private." }, { status: 403 });
  }

  const boostedIds = await getActiveBoostedIds("BOT", [bot.id]);

  return NextResponse.json({
    bot: {
      id: bot.id,
      username: bot.username,
      name: bot.name,
      description: bot.description,
      category: bot.category,
      visibility: bot.visibility,
      status: bot.status,
      isVerified: bot.isVerified,
      welcomeMessage: bot.welcomeMessage,
      commandsExecuted: bot.commandsExecuted,
      createdAt: bot.createdAt,
      owner: bot.owner,
      isBoosted: boostedIds.has(bot.id),
      tokenPreview: isOwner ? bot.tokenPreview : undefined,
      webhookUrl: isOwner ? bot.webhookUrl : undefined,
      webhookEnabled: isOwner ? bot.webhookEnabled : undefined,
      hasWebhookSecret: isOwner ? !!bot.webhookSecret : undefined
    },
    commands: bot.commands.map((c) => ({
      trigger: c.trigger,
      description: c.description,
      mode: c.mode,
      response: isOwner ? c.response : undefined,
      handlerCode: isOwner ? c.handlerCode : undefined,
      usageCount: c.usageCount
    })),
    isOwner
  });
}
