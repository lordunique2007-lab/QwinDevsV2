import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { projectSchema } from "@/lib/validation";
import { uniqueProjectSlug } from "@/lib/slug";
import { getActiveBoostedIds, sortBoostedFirst } from "@/lib/boosts";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") ?? "newest";
  const q = searchParams.get("q");

  const where: any = { visibility: "PUBLIC" };
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { tags: { has: q.toLowerCase() } }
    ];
  }

  const orderBy =
    sort === "downloads"
      ? { downloadCount: "desc" as const }
      : sort === "oldest"
      ? { createdAt: "asc" as const }
      : { createdAt: "desc" as const };

  const projects = await prisma.project.findMany({
    where,
    orderBy,
    take: 50,
    include: {
      developer: { select: { username: true, displayName: true, avatarUrl: true, isVerified: true } },
      ratings: { select: { stars: true } }
    }
  });

  const shaped = projects.map((p) => {
    const avg =
      p.ratings.length > 0
        ? p.ratings.reduce((sum, r) => sum + r.stars, 0) / p.ratings.length
        : 0;
    const { ratings, ...rest } = p;
    return { ...rest, avgRating: Math.round(avg * 10) / 10, ratingCount: ratings.length };
  });

  const boostedIds = await getActiveBoostedIds("PROJECT", shaped.map((p) => p.id));
  const withBoostFlag = shaped.map((p) => ({ ...p, isBoosted: boostedIds.has(p.id) }));
  // Boosted-first only makes sense for "newest" (the default discovery view) —
  // explicit sorts like "most downloaded" should stay a pure ranking.
  const ordered = sort === "downloads" ? withBoostFlag : sortBoostedFirst(withBoostFlag, (p) => p.id, boostedIds);

  return NextResponse.json({ projects: ordered });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to publish a project." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  const slug = await uniqueProjectSlug(data.name);

  const project = await prisma.project.create({
    data: {
      slug,
      name: data.name,
      tagline: data.tagline,
      description: data.description,
      category: data.category,
      tags: data.tags.map((t) => t.toLowerCase()),
      repoUrl: data.repoUrl || null,
      websiteUrl: data.websiteUrl || null,
      version: data.version,
      license: data.license,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      developerId: session.user.id
    }
  });

  return NextResponse.json({ project }, { status: 201 });
}
