import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { autoJoinMandatoryCommunities } from "@/lib/community";

const SIGNUP_BONUS_QC = 100;

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { firstName, lastName, username, email, password } = parsed.data;

  const [existingUsername, existingEmail] = await Promise.all([
    prisma.user.findUnique({ where: { username } }),
    prisma.user.findUnique({ where: { email } })
  ]);

  if (existingUsername) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }
  if (existingEmail) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username,
      displayName: `${firstName} ${lastName}`.trim(),
      email,
      passwordHash,
      wallet: {
        create: {
          balance: SIGNUP_BONUS_QC,
          lifetimeIn: SIGNUP_BONUS_QC
        }
      }
    },
    select: { id: true, username: true, displayName: true, email: true }
  });

  // Every new account is automatically enrolled in the platform's official
  // channels (set by the Super Admin) — no opt-in needed, matching how a
  // platform-owned announcement channel works.
  await autoJoinMandatoryCommunities(user.id).catch((err) => {
    console.error("Failed to auto-join mandatory communities:", err);
  });

  return NextResponse.json({ user }, { status: 201 });
}
