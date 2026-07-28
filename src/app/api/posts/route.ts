import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { postSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      author: { select: { username: true, displayName: true, avatarUrl: true, isVerified: true, role: true } },
      likes: { select: { userId: true } }
    }
  });

  const shaped = posts.map((p) => ({
    ...p,
    likeCount: p.likes.length,
    likes: undefined
  }));

  return NextResponse.json({
    posts: shaped,
    nextCursor: posts.length === 20 ? posts[posts.length - 1].id : null
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to post." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const post = await prisma.post.create({
    data: {
      authorId: session.user.id,
      content: parsed.data.content,
      imageUrl: parsed.data.imageUrl || null,
      mediaType: parsed.data.mediaType || null
    },
    include: {
      author: { select: { username: true, displayName: true, avatarUrl: true, isVerified: true, role: true } }
    }
  });

  return NextResponse.json({ post: { ...post, likeCount: 0 } }, { status: 201 });
}
