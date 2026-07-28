import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { createBotSchema } from "@/lib/bot-validation";
import { generateBotToken, hashBotToken, tokenPreview } from "@/lib/bot-token";
import { botLimitForRole } from "@/lib/bot-limits";
import { getActiveBoostedIds, sortBoostedFirst } from "@/lib/boosts";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const mine = searchParams.get("mine");

  const session = await getServerSession(authOptions);

  const where: any = { status: "ACTIVE" };
  if (mine === "true") {
    if (!session?.user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    where.ownerId = session.user.id;
    delete where.status;
  } else {
    where.visibility = "EVERYONE";
  }
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } }
    ];
  }

  const bots = await prisma.bot.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      username: true,
      name: true,
      description: true,
      category: true,
      isVerified: true,
      status: true,
      commandsExecuted: true,
      createdAt: true,
      owner: { select: { username: true, displayName: true, isVerified: true } }
    }
  });

  const boostedIds = await getActiveBoostedIds("BOT", bots.map((b) => b.id));
  const withFlag = bots.map((b) => ({ ...b, isBoosted: boostedIds.has(b.id) }));
  const ordered = mine === "true" ? withFlag : sortBoostedFirst(withFlag, (b) => b.id, boostedIds);

  return NextResponse.json({ bots: ordered });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to create a bot." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const limit = botLimitForRole(user.role);
  const currentCount = await prisma.bot.count({ where: { ownerId: user.id } });
  if (currentCount >= limit) {
    return NextResponse.json(
      { error: `You've reached your bot limit (${limit}) for your account type.` },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = createBotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.bot.findUnique({ where: { username: parsed.data.username } });
  if (existing) {
    return NextResponse.json({ error: "That bot username is already taken." }, { status: 409 });
  }

  const token = generateBotToken();
  const tokenHash = await hashBotToken(token);

  const bot = await prisma.bot.create({
    data: {
      ownerId: user.id,
      username: parsed.data.username,
      name: parsed.data.name,
      description: parsed.data.description,
      category: parsed.data.category,
      visibility: parsed.data.visibility,
      welcomeMessage: parsed.data.welcomeMessage ?? "👋 Hi! Type /help to see what I can do.",
      tokenHash,
      tokenPreview: tokenPreview(token)
    }
  });

  // The plaintext token is returned exactly once. It cannot be retrieved again —
  // only regenerated, which invalidates the old one.
  return NextResponse.json({ bot, token }, { status: 201 });
}
