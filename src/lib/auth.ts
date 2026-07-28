import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * If a temporary ban's clock has run out, restores the account to ACTIVE
 * and returns the now-current status. Centralized here so both the login
 * flow and the live session check use identical expiry logic.
 */
async function resolveCurrentStatus(user: {
  id: string;
  status: string;
  bannedUntil: Date | null;
}): Promise<"ACTIVE" | "FROZEN" | "BANNED"> {
  if (user.status === "BANNED" && user.bannedUntil && user.bannedUntil <= new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", banReason: null, bannedUntil: null }
    });
    return "ACTIVE";
  }
  return user.status as "ACTIVE" | "FROZEN" | "BANNED";
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.identifier.toLowerCase() },
              { username: credentials.identifier.toLowerCase() }
            ]
          }
        });

        if (!user) throw new Error("Invalid email/username or password");

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) throw new Error("Invalid email/username or password");

        const currentStatus = await resolveCurrentStatus(user);

        if (currentStatus === "BANNED") {
          const until = user.bannedUntil ? ` until ${user.bannedUntil.toLocaleDateString()}` : " permanently";
          throw new Error(`This account is banned${until}.` + (user.banReason ? ` Reason: ${user.banReason}` : ""));
        }
        if (currentStatus === "FROZEN") {
          throw new Error("This account has been frozen." + (user.banReason ? ` Reason: ${user.banReason}` : ""));
        }

        return {
          id: user.id,
          name: user.displayName,
          email: user.email,
          username: user.username,
          role: user.role,
          image: user.avatarUrl ?? undefined
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.username = (user as any).username;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user || !token.id) return session;

      // Re-checked on every session read (login page load, every API route
      // that calls getServerSession, and periodic client polling — see
      // Providers.tsx). This is what makes a ban or freeze take effect
      // immediately for someone already logged in, not just block future
      // logins: their next request anywhere in the app sees session.user
      // wiped out and is treated as signed out.
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { status: true, bannedUntil: true }
      });

      if (!dbUser) {
        return null as any;
      }

      const currentStatus = await resolveCurrentStatus({ id: token.id as string, ...dbUser });

      if (currentStatus === "BANNED" || currentStatus === "FROZEN") {
        // Returning null (not just clearing session.user) is deliberate: it
        // makes next-auth's client-side useSession() report "unauthenticated"
        // cleanly, instead of leaving components that read session.user.X
        // without a null check (Navbar, etc.) in a half-signed-in crash
        // state. Every server route in this app checks `if (!session?.user)`
        // before doing anything, so this also blocks every API route.
        // BannedGate.tsx (which reads the raw JWT via /api/auth/status,
        // bypassing this callback) is what still shows *why* they're locked
        // out instead of just silently bouncing them to the login page.
        return null as any;
      }

      (session.user as any).id = token.id;
      (session.user as any).username = token.username;
      (session.user as any).role = token.role;
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};
