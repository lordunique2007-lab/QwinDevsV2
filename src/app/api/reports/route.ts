import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, AdminError } from "@/lib/admin";
import { z } from "zod";

const fileReportSchema = z.object({
  targetType: z.enum(["USER", "PROJECT", "POST", "BOT", "COMMUNITY"]),
  targetId: z.string().min(1),
  reason: z.string().min(1).max(60),
  details: z.string().max(2000).optional().default("")
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to report content." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = fileReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const report = await prisma.report.create({
    data: {
      reporterId: session.user.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      details: parsed.data.details
    }
  });

  return NextResponse.json({ report }, { status: 201 });
}

export async function GET(req: Request) {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";

  const reports = await prisma.report.findMany({
    where: { status: status as any },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { reporter: { select: { username: true, displayName: true } } }
  });

  return NextResponse.json({ reports });
}
