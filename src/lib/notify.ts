import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

export async function notify(params: {
  userId: string;
  type: NotificationType;
  message: string;
  link?: string;
}) {
  // Notifications are best-effort — a failure here should never break the
  // action that triggered it (e.g. a follow or a payment should still succeed).
  await prisma.notification
    .create({
      data: {
        userId: params.userId,
        type: params.type,
        message: params.message,
        link: params.link
      }
    })
    .catch(() => null);
}
