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

  const [
    totalUsers,
    totalProjects,
    totalPosts,
    totalCommunities,
    totalBots,
    pendingReports,
    bannedUsers,
    frozenUsers,
    walletAgg
  ] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.post.count(),
    prisma.community.count(),
    prisma.bot.count(),
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { status: "BANNED" } }),
    prisma.user.count({ where: { status: "FROZEN" } }),
    prisma.wallet.aggregate({ _sum: { balance: true, lifetimeIn: true } })
  ]);

  return NextResponse.json({
    totalUsers,
    totalProjects,
    totalPosts,
    totalCommunities,
    totalBots,
    pendingReports,
    bannedUsers,
    frozenUsers,
    circulatingQC: walletAgg._sum.balance ?? 0,
    lifetimeIssuedQC: walletAgg._sum.lifetimeIn ?? 0
  });
}
