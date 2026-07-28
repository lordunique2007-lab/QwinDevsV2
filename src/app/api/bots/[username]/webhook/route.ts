import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWebhookSecret } from "@/lib/bot-webhook";
import { z } from "zod";

const schema = z.object({
  webhookUrl: z.string().url().max(500).optional().or(z.literal("")),
  webhookEnabled: z.boolean().optional(),
  regenerateSecret: z.boolean().optional().default(false)
});

export async function PATCH(req: Request, { params }: { params: { username: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const bot = await prisma.bot.findUnique({ where: { username: params.username.toLowerCase() } });
  if (!bot) return NextResponse.json({ error: "Bot not found." }, { status: 404 });
  if (bot.ownerId !== session.user.id) {
    return NextResponse.json({ error: "You do not own this bot." }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  if (parsed.data.webhookUrl && !parsed.data.webhookUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Webhook URL must use HTTPS." }, { status: 400 });
  }

  const needsNewSecret = parsed.data.regenerateSecret || (!bot.webhookSecret && !!parsed.data.webhookUrl);

  const updated = await prisma.bot.update({
    where: { id: bot.id },
    data: {
      ...(parsed.data.webhookUrl !== undefined ? { webhookUrl: parsed.data.webhookUrl || null } : {}),
      ...(parsed.data.webhookEnabled !== undefined ? { webhookEnabled: parsed.data.webhookEnabled } : {}),
      ...(needsNewSecret ? { webhookSecret: generateWebhookSecret() } : {})
    }
  });

  return NextResponse.json({
    webhookUrl: updated.webhookUrl,
    webhookEnabled: updated.webhookEnabled,
    // Only returned when it changes — same "shown once, then only a preview" pattern as the bot API token.
    webhookSecret: needsNewSecret ? updated.webhookSecret : undefined
  });
}
