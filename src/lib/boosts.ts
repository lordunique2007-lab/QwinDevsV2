import { prisma } from "@/lib/prisma";
import { BoostTargetType } from "@prisma/client";

/** Returns a Set of target IDs that currently have an active (unexpired) boost. */
export async function getActiveBoostedIds(targetType: BoostTargetType, targetIds: string[]): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set();
  const boosts = await prisma.boost.findMany({
    where: { targetType, targetId: { in: targetIds }, expiresAt: { gt: new Date() } },
    select: { targetId: true }
  });
  return new Set(boosts.map((b) => b.targetId));
}

/** Sorts a list so boosted items come first, preserving relative order within each group. */
export function sortBoostedFirst<T>(items: T[], getId: (item: T) => string, boostedIds: Set<string>): T[] {
  const boosted: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    (boostedIds.has(getId(item)) ? boosted : rest).push(item);
  }
  return [...boosted, ...rest];
}
