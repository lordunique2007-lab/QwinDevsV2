import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createStorySchema = z.object({
  mediaUrl: z.string().url(),
  mediaType: z.enum(["image", "video"]).optional().default("image"),
  caption: z.string().max(200).optional().default("")
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const following = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: { followingId: true }
  });
  const authorIds = [...following.map((f) => f.followingId), session.user.id];

  const stories = await prisma.story.findMany({
    where: {
      authorId: { in: authorIds },
      expiresAt: { gt: new Date() } // Only unexpired (< 24h old) stories are ever returned.
    },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { username: true, displayName: true, isVerified: true } },
      views: { where: { viewerId: session.user.id }, select: { id: true } }
    }
  });

  // Group by author for a "stories bar" UI.
  const byAuthor = new Map<string, { author: (typeof stories)[number]["author"]; stories: typeof stories }>();
  for (const s of stories) {
    const key = s.author.username;
    if (!byAuthor.has(key)) byAuthor.set(key, { author: s.author, stories: [] });
    byAuthor.get(key)!.stories.push(s);
  }

  return NextResponse.json({
    authors: Array.from(byAuthor.values()).map((g) => ({
      author: g.author,
      hasUnseen: g.stories.some((s) => s.views.length === 0),
      stories: g.stories.map((s) => ({
        id: s.id,
        mediaUrl: s.mediaUrl,
        mediaType: s.mediaType,
        caption: s.caption,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        seen: s.views.length > 0
      }))
    }))
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createStorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const story = await prisma.story.create({
    data: {
      authorId: session.user.id,
      mediaUrl: parsed.data.mediaUrl,
      mediaType: parsed.data.mediaType,
      caption: parsed.data.caption,
      expiresAt
    }
  });

  return NextResponse.json({ story }, { status: 201 });
}
