import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBotToken } from "@/lib/bot-token";
import { invokeSchema } from "@/lib/bot-validation";
import { runCommandScript, ScriptError } from "@/lib/bot-script";
import { deliverWebhook } from "@/lib/bot-webhook";

/**
 * Public Bot API. Any client holding the bot's token can call this to execute a
 * command and get back a response — this is what makes a bot's commands
 * reachable from anywhere: Qwin Devs' own test console, an external script,
 * or your own bot server written in Python, JS, or any language that can
 * make an HTTP request.
 *
 * Two ways a command can answer:
 *  - STATIC: returns the fixed text configured in the dashboard.
 *  - SCRIPT: runs the owner's own short JS snippet (sandboxed, 1s timeout,
 *    no network/filesystem access) and returns whatever it returns.
 *
 * If the bot has a webhook configured, every invocation is also forwarded
 * there (fire-and-forget, HMAC-signed) so external code in any language can
 * do heavier processing and push a follow-up message via
 * POST /api/bots/{username}/send.
 *
 * Authorization: Bearer qwin_bot_...
 * Body: { "trigger": "/greet John" }
 */
export async function POST(req: Request, { params }: { params: { username: string } }) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Missing bot token." }, { status: 401 });
  }

  const bot = await prisma.bot.findUnique({ where: { username: params.username.toLowerCase() } });
  if (!bot) return NextResponse.json({ error: "Bot not found." }, { status: 404 });
  if (bot.status !== "ACTIVE") {
    return NextResponse.json({ error: "This bot is not active." }, { status: 403 });
  }

  const validToken = await verifyBotToken(token, bot.tokenHash);
  if (!validToken) {
    return NextResponse.json({ error: "Invalid bot token." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = invokeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A trigger is required, e.g. /help." }, { status: 400 });
  }

  const rawMessage = parsed.data.trigger.trim();
  const parts = rawMessage.split(/\s+/);
  const trigger = parts[0].toLowerCase();
  const args = parts.slice(1);

  const owner = await prisma.user.findUnique({ where: { id: bot.ownerId }, select: { username: true, displayName: true } });

  async function forwardToWebhook(response: string) {
    if (bot!.webhookEnabled && bot!.webhookUrl && bot!.webhookSecret) {
      await deliverWebhook({
        url: bot!.webhookUrl,
        secret: bot!.webhookSecret,
        event: "invoke",
        payload: { botUsername: bot!.username, trigger, args, rawMessage, response }
      });
    }
  }

  if (trigger === "/start") {
    await logInvocation(bot.id, trigger);
    await forwardToWebhook(bot.welcomeMessage);
    return NextResponse.json({ response: bot.welcomeMessage });
  }

  if (trigger === "/help") {
    const commands = await prisma.botCommand.findMany({ where: { botId: bot.id }, orderBy: { trigger: "asc" } });
    await logInvocation(bot.id, trigger);
    const response =
      commands.length === 0
        ? "This bot has no custom commands yet."
        : commands.map((c) => `${c.trigger} — ${c.description || "No description"}`).join("\n");
    await forwardToWebhook(response);
    return NextResponse.json({ response });
  }

  const command = await prisma.botCommand.findUnique({
    where: { botId_trigger: { botId: bot.id, trigger } }
  });

  if (!command) {
    return NextResponse.json({ response: "Unknown command. Try /help." }, { status: 200 });
  }

  let response: string;

  if (command.mode === "SCRIPT" && command.handlerCode) {
    try {
      response = runCommandScript(command.handlerCode, {
        args,
        rawMessage,
        triggeredBy: { username: owner?.username ?? "", displayName: owner?.displayName ?? "" }
      });
    } catch (err) {
      if (err instanceof ScriptError) {
        return NextResponse.json({ response: `⚠️ ${err.message}` }, { status: 200 });
      }
      throw err;
    }
  } else {
    response = command.response;
  }

  await prisma.$transaction([
    prisma.botCommand.update({ where: { id: command.id }, data: { usageCount: { increment: 1 } } }),
    prisma.bot.update({ where: { id: bot.id }, data: { commandsExecuted: { increment: 1 } } })
  ]);
  await logInvocation(bot.id, trigger);
  await forwardToWebhook(response);

  return NextResponse.json({ response });
}

async function logInvocation(botId: string, trigger: string) {
  await prisma.botInvocation.create({ data: { botId, trigger } }).catch(() => null);
}
