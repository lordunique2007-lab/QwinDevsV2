import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireMembership, CommunityError } from "@/lib/community";
import { communityMessageSchema } from "@/lib/community-validation";
import { triggerEvent, CHANNELS, EVENTS } from "@/lib/pusher-server";

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const community = await prisma.community.findUnique({ where: { slug: params.slug } });
  if (!community) return NextResponse.json({ error: "Community not found." }, { status: 404 });

  try {
    await requireMembership(community.id, session.user.id);
  } catch (err) {
    if (err instanceof CommunityError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  const messages = await prisma.communityMessage.findMany({
    where: {
      communityId: community.id,
      ...(since ? { createdAt: { gt: new Date(since) } } : {})
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { sender: { select: { username: true, displayName: true } } }
  });

  await prisma.communityMember.update({
    where: { communityId_userId: { communityId: community.id, userId: session.user.id } },
    data: { lastReadAt: new Date() }
  });

  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = communityMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid message." }, { status: 400 });
  }

  const community = await prisma.community.findUnique({ where: { slug: params.slug } });
  if (!community) return NextResponse.json({ error: "Community not found." }, { status: 404 });

  let membership;
  try {
    membership = await requireMembership(community.id, session.user.id);
  } catch (err) {
    if (err instanceof CommunityError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  if (membership.muted) {
    return NextResponse.json({ error: "You have been muted in this community." }, { status: 403 });
  }

  const message = await prisma.communityMessage.create({
    data: {
      communityId: community.id,
      senderId: session.user.id,
      content: parsed.data.content,
      type: parsed.data.type,
      mediaUrl: parsed.data.mediaUrl,
      mediaDurationSec: parsed.data.mediaDurationSec
    },
    include: { sender: { select: { username: true, displayName: true } } }
  });

  await triggerEvent(CHANNELS.community(community.id), EVENTS.NEW_MESSAGE, message);

  return NextResponse.json({ message }, { status: 201 });
}
