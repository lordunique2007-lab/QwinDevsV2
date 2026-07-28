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

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return NextResponse.json({ logs });
}
