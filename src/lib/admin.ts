import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export class AdminError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/** Only Super Admin and Moderator roles may reach admin endpoints at all. */
export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new AdminError("You must be signed in.", 401);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new AdminError("User not found.", 404);
  if (user.role !== "SUPER_ADMIN" && user.role !== "MODERATOR") {
    throw new AdminError("You do not have access to the admin console.", 403);
  }
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireAdminSession();
  if (user.role !== "SUPER_ADMIN") {
    throw new AdminError("This action is restricted to the Super Admin.", 403);
  }
  return user;
}

export async function logAdminAction(params: {
  actorId: string;
  actorUsername: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  previousState?: string;
  newState?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      actorUsername: params.actorUsername,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason ?? "",
      previousState: params.previousState ?? "",
      newState: params.newState ?? ""
    }
  });
}
