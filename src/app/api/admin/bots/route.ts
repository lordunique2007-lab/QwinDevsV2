import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, AdminError } from "@/lib/admin";

export async function GET() {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const bots = await prisma.bot.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      username: true,
      name: true,
      status: true,
      commandsExecuted: true,
      owner: { select: { username: true } }
    }
  });

  return NextResponse.json({ bots });
}
