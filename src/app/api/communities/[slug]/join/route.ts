import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { joinCommunity, CommunityError } from "@/lib/community";

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to join." }, { status: 401 });
  }

  const community = await prisma.community.findUnique({ where: { slug: params.slug } });
  if (!community) {
    return NextResponse.json({ error: "Community not found." }, { status: 404 });
  }

  try {
    const result = await joinCommunity(community.id, session.user.id);
    return NextResponse.json({ joined: true, alreadyMember: result.alreadyMember });
  } catch (err) {
    if (err instanceof CommunityError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Could not join community." }, { status: 500 });
  }
}
