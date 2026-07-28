import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, AdminError } from "@/lib/admin";

export async function GET(req: Request) {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  const where: any = {};
  if (q) {
    where.OR = [
      { username: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } }
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      status: true,
      isVerified: true,
      banReason: true,
      bannedUntil: true,
      createdAt: true
    }
  });

  return NextResponse.json({ users });
}
