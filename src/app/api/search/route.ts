import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ users: [], projects: [], bots: [], communities: [] });
  }

  const [users, projects, bots, communities] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } }
        ]
      },
      take: 5,
      select: { username: true, displayName: true, isVerified: true, role: true }
    }),
    prisma.project.findMany({
      where: {
        visibility: "PUBLIC",
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } }
        ]
      },
      take: 5,
      select: { slug: true, name: true, category: true }
    }),
    prisma.bot.findMany({
      where: {
        visibility: "EVERYONE",
        OR: [{ name: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }]
      },
      take: 5,
      select: { username: true, name: true, category: true }
    }),
    prisma.community.findMany({
      where: {
        visibility: "PUBLIC",
        OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }]
      },
      take: 5,
      select: { slug: true, name: true, type: true }
    })
  ]);

  return NextResponse.json({ users, projects, bots, communities });
}
