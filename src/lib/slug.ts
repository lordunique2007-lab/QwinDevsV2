import { prisma } from "@/lib/prisma";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

/** Guarantees a unique project slug by appending -2, -3, ... on collision. */
export async function uniqueProjectSlug(name: string): Promise<string> {
  const base = slugify(name) || "project";
  let candidate = base;
  let i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.project.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    i += 1;
    candidate = `${base}-${i}`;
  }
}

/** Guarantees a unique community (group/channel) slug by appending -2, -3, ... on collision. */
export async function uniqueCommunitySlug(name: string): Promise<string> {
  const base = slugify(name) || "community";
  let candidate = base;
  let i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.community.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    i += 1;
    candidate = `${base}-${i}`;
  }
}
