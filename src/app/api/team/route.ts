import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [settings, members] = await Promise.all([
    prisma.teamSettings.findUnique({ where: { id: "singleton" } }),
    prisma.teamMember.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] })
  ]);

  const linkedUsernames = members.map((m) => m.linkedUsername).filter((u): u is string => !!u);
  const linkedUsers = linkedUsernames.length
    ? await prisma.user.findMany({
        where: { username: { in: linkedUsernames } },
        select: { username: true, isVerified: true, role: true, avatarUrl: true }
      })
    : [];
  const linkedByUsername = new Map(linkedUsers.map((u) => [u.username, u]));

  // Preserve roster order, grouped by rank label.
  const groups: { rankLabel: string; members: typeof members }[] = [];
  for (const m of members) {
    let group = groups.find((g) => g.rankLabel === m.rankLabel);
    if (!group) {
      group = { rankLabel: m.rankLabel, members: [] };
      groups.push(group);
    }
    group.members.push(m);
  }

  return NextResponse.json({
    title: settings?.pageTitle ?? "Meet the Team",
    subtitle: settings?.subtitle ?? "",
    groups: groups.map((g) => ({
      rankLabel: g.rankLabel,
      members: g.members.map((m) => ({
        name: m.name,
        linked: m.linkedUsername ? linkedByUsername.get(m.linkedUsername) ?? null : null
      }))
    }))
  });
}
