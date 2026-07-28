import { prisma } from "@/lib/prisma";
import { CommunityRole } from "@prisma/client";

export class CommunityError extends Error {}

const RANK: Record<CommunityRole, number> = {
  MEMBER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  OWNER: 3
};

export function outranks(actor: CommunityRole, target: CommunityRole): boolean {
  return RANK[actor] > RANK[target];
}

export async function requireMembership(communityId: string, userId: string) {
  const community = await prisma.community.findUnique({ where: { id: communityId } });
  if (!community) throw new CommunityError("Community not found.");
  if (community.status === "BANNED") {
    throw new CommunityError("This community has been banned and is no longer active.");
  }
  if (community.status === "FROZEN") {
    throw new CommunityError("This community has been frozen by moderation and is temporarily read-only.");
  }

  const member = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } }
  });
  if (!member || member.bannedAt) throw new CommunityError("You are not a member of this community.");
  return member;
}

export async function requireRole(communityId: string, userId: string, minRole: CommunityRole) {
  const member = await requireMembership(communityId, userId);
  if (RANK[member.role] < RANK[minRole]) {
    throw new CommunityError("You do not have permission to do that.");
  }
  return member;
}

export async function joinCommunity(communityId: string, userId: string) {
  const community = await prisma.community.findUnique({ where: { id: communityId } });
  if (!community) throw new CommunityError("Community not found.");
  if (community.status !== "ACTIVE") throw new CommunityError("This community is not accepting new members.");
  if (community.visibility === "PRIVATE") {
    throw new CommunityError("This community is private. You need an invite link to join.");
  }

  return joinByInvite(community.inviteCode, userId);
}

export async function joinByInvite(inviteCode: string, userId: string) {
  const community = await prisma.community.findUnique({ where: { inviteCode } });
  if (!community) throw new CommunityError("Invalid invite link.");
  if (community.status === "BANNED") throw new CommunityError("This community has been removed.");

  const existing = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId } }
  });
  if (existing && !existing.bannedAt) return { community, alreadyMember: true };
  if (existing?.bannedAt) throw new CommunityError("You have been banned from this community.");

  await prisma.$transaction([
    prisma.communityMember.create({ data: { communityId: community.id, userId, role: "MEMBER" } }),
    prisma.community.update({ where: { id: community.id }, data: { memberCount: { increment: 1 } } })
  ]);

  return { community, alreadyMember: false };
}

export async function leaveCommunity(communityId: string, userId: string) {
  const member = await requireMembership(communityId, userId);
  if (member.role === "OWNER") {
    throw new CommunityError("Transfer ownership before leaving, or delete the community instead.");
  }

  const community = await prisma.community.findUnique({ where: { id: communityId } });
  if (community?.mandatory) {
    throw new CommunityError("This is an official channel — every account is automatically a member and it can't be left.");
  }

  await prisma.$transaction([
    prisma.communityMember.delete({ where: { id: member.id } }),
    prisma.community.update({ where: { id: communityId }, data: { memberCount: { decrement: 1 } } })
  ]);
}

/** Auto-joins a newly-registered user to every existing official (mandatory) channel. */
export async function autoJoinMandatoryCommunities(userId: string) {
  const mandatoryCommunities = await prisma.community.findMany({
    where: { mandatory: true, status: "ACTIVE" },
    select: { id: true }
  });

  for (const c of mandatoryCommunities) {
    const existing = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: c.id, userId } }
    });
    if (existing) continue;
    await prisma.$transaction([
      prisma.communityMember.create({ data: { communityId: c.id, userId, role: "MEMBER" } }),
      prisma.community.update({ where: { id: c.id }, data: { memberCount: { increment: 1 } } })
    ]);
  }
}

/** Retroactively enrolls every existing account when a channel becomes official. */
export async function enrollAllUsersInCommunity(communityId: string) {
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  let added = 0;

  for (const u of allUsers) {
    const existing = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: u.id } }
    });
    if (existing) continue;
    await prisma.communityMember.create({ data: { communityId, userId: u.id, role: "MEMBER" } });
    added++;
  }

  if (added > 0) {
    await prisma.community.update({ where: { id: communityId }, data: { memberCount: { increment: added } } });
  }

  return added;
}
