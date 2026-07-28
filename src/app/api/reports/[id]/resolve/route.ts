import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, logAdminAction, AdminError } from "@/lib/admin";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["resolve", "dismiss"]),
  resolution: z.string().max(1000).optional().default("")
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let actor;
  try {
    actor = await requireAdminSession();
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const report = await prisma.report.findUnique({ where: { id: params.id } });
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const newStatus = parsed.data.action === "resolve" ? "RESOLVED" : "DISMISSED";

  await prisma.report.update({
    where: { id: report.id },
    data: {
      status: newStatus,
      resolvedAt: new Date(),
      resolvedBy: actor.id,
      resolution: parsed.data.resolution
    }
  });

  await logAdminAction({
    actorId: actor.id,
    actorUsername: actor.username,
    action: `report.${parsed.data.action}`,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: parsed.data.resolution,
    previousState: "PENDING",
    newState: newStatus
  });

  return NextResponse.json({ status: newStatus });
}
