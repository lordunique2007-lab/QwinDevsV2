import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema, bioLimitForRole } from "@/lib/validation";
import { formatNumericId } from "@/lib/user-id";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      numericId: true,
      username: true,
      usernameHidden: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      role: true,
      premiumTier: true,
      email: true
    }
  });

  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({
    profile: { ...user, numericId: formatNumericId(user.numericId) },
    bioLimit: bioLimitForRole(user.role, user.premiumTier)
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const body = await req.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const limit = bioLimitForRole(user.role, user.premiumTier);
  if (parsed.data.bio !== undefined && parsed.data.bio.length > limit) {
    return NextResponse.json(
      { error: `Your bio limit is ${limit} characters. Upgrade to Premium for more.` },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
      ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {}),
      ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl || null } : {}),
      ...(parsed.data.bannerUrl !== undefined ? { bannerUrl: parsed.data.bannerUrl || null } : {}),
      ...(parsed.data.usernameHidden !== undefined ? { usernameHidden: parsed.data.usernameHidden } : {})
    },
    select: { numericId: true, username: true, usernameHidden: true, displayName: true, bio: true, avatarUrl: true, bannerUrl: true }
  });

  return NextResponse.json({ profile: { ...updated, numericId: formatNumericId(updated.numericId) } });
}
