import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { uniqueCommunitySlug } from "@/lib/slug";
import { createCommunitySchema } from "@/lib/community-validation";
import { getActiveBoostedIds, sortBoostedFirst } from "@/lib/boosts";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  const where: any = { visibility: "PUBLIC", status: "ACTIVE" };
  if (type === "GROUP" || type === "CHANNEL") where.type = type;
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } }
    ];
  }

  const communities = await prisma.community.findMany({
    where,
    orderBy: { memberCount: "desc" },
    take: 50,
    include: { owner: { select: { username: true, displayName: true, isVerified: true } } }
  });

  const boostedIds = await getActiveBoostedIds("COMMUNITY", communities.map((c) => c.id));
  const withFlag = communities.map((c) => ({ ...c, isBoosted: boostedIds.has(c.id) }));
  const ordered = sortBoostedFirst(withFlag, (c) => c.id, boostedIds);

  return NextResponse.json({ communities: ordered });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to create a community." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createCommunitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  const slug = await uniqueCommunitySlug(data.name);

  const community = await prisma.community.create({
    data: {
      type: data.type,
      slug,
      name: data.name,
      description: data.description,
      category: data.category,
      visibility: data.visibility,
      ownerId: session.user.id,
      members: {
        create: { userId: session.user.id, role: "OWNER" }
      }
    }
  });

  return NextResponse.json({ community }, { status: 201 });
}
