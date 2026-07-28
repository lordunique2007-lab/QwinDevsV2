import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, CommunityError } from "@/lib/community";
import { communityPostSchema } from "@/lib/community-validation";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const community = await prisma.community.findUnique({ where: { slug: params.slug } });
  if (!community) return NextResponse.json({ error: "Community not found." }, { status: 404 });

  const posts = await prisma.communityPost.findMany({
    where: { communityId: community.id },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 50,
    include: { author: { select: { username: true, displayName: true, isVerified: true } } }
  });

  return NextResponse.json({ posts });
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = communityPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Post cannot be empty." }, { status: 400 });
  }

  const community = await prisma.community.findUnique({ where: { slug: params.slug } });
  if (!community) return NextResponse.json({ error: "Community not found." }, { status: 404 });

  try {
    await requireRole(community.id, session.user.id, "ADMIN");
  } catch (err) {
    if (err instanceof CommunityError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const post = await prisma.communityPost.create({
    data: {
      communityId: community.id,
      authorId: session.user.id,
      content: parsed.data.content,
      mediaUrl: parsed.data.mediaUrl,
      mediaType: parsed.data.mediaType
    },
    include: { author: { select: { username: true, displayName: true, isVerified: true } } }
  });

  return NextResponse.json({ post }, { status: 201 });
}
