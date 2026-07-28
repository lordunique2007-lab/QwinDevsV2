import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveBoostedIds } from "@/lib/boosts";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);

  const project = await prisma.project.update({
    where: { slug: params.slug },
    data: { viewCount: { increment: 1 } },
    include: {
      developer: {
        select: { username: true, displayName: true, avatarUrl: true, isVerified: true, bio: true }
      },
      ratings: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { username: true, displayName: true, avatarUrl: true } } }
      }
    }
  }).catch(() => null);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const avg =
    project.ratings.length > 0
      ? project.ratings.reduce((sum, r) => sum + r.stars, 0) / project.ratings.length
      : 0;

  const isOwner = session?.user?.id === project.developerId;
  const boostedIds = await getActiveBoostedIds("PROJECT", [project.id]);

  return NextResponse.json({
    project: {
      ...project,
      id: project.id,
      avgRating: Math.round(avg * 10) / 10,
      ratingCount: project.ratings.length,
      isBoosted: boostedIds.has(project.id),
      isOwner
    }
  });
}
