import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, AdminError } from "@/lib/admin";

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const communities = await prisma.community.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      memberCount: true,
      mandatory: true,
      status: true,
      owner: { select: { username: true } }
    }
  });

  return NextResponse.json({ communities });
}
