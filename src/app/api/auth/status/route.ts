import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Deliberately uses getToken (reads the JWT directly) instead of
  // getServerSession — the session callback wipes session.user for
  // banned/frozen accounts by design, so this is the one endpoint that can
  // still tell a locked-out user *why*.
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET
  });

  if (!token?.id) {
    return NextResponse.json({ signedIn: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: token.id as string },
    select: { status: true, banReason: true, bannedUntil: true, username: true }
  });

  if (!user) {
    return NextResponse.json({ signedIn: false });
  }

  return NextResponse.json({
    signedIn: true,
    username: user.username,
    status: user.status,
    banReason: user.banReason,
    bannedUntil: user.bannedUntil
  });
}
