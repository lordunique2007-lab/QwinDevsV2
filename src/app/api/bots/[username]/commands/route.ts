import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCommandSchema } from "@/lib/bot-validation";
import { validateScriptSyntax, ScriptError } from "@/lib/bot-script";

async function requireOwnedBot(username: string, userId: string) {
  const bot = await prisma.bot.findUnique({ where: { username: username.toLowerCase() } });
  if (!bot) return { error: "Bot not found." as const, status: 404 as const };
  if (bot.ownerId !== userId) return { error: "You do not own this bot." as const, status: 403 as const };
  return { bot };
}

export async function POST(req: Request, { params }: { params: { username: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const result = await requireOwnedBot(params.username, session.user.id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const body = await req.json();
  const parsed = createCommandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  if (parsed.data.mode === "SCRIPT" && parsed.data.handlerCode) {
    try {
      validateScriptSyntax(parsed.data.handlerCode);
    } catch (err) {
      if (err instanceof ScriptError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  const existing = await prisma.botCommand.findUnique({
    where: { botId_trigger: { botId: result.bot.id, trigger: parsed.data.trigger } }
  });
  if (existing) {
    return NextResponse.json({ error: "That command already exists on this bot." }, { status: 409 });
  }

  const command = await prisma.botCommand.create({
    data: {
      botId: result.bot.id,
      trigger: parsed.data.trigger,
      description: parsed.data.description,
      mode: parsed.data.mode,
      response: parsed.data.response,
      handlerCode: parsed.data.handlerCode
    }
  });

  return NextResponse.json({ command }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { username: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const result = await requireOwnedBot(params.username, session.user.id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { searchParams } = new URL(req.url);
  const trigger = searchParams.get("trigger");
  if (!trigger) return NextResponse.json({ error: "Missing trigger." }, { status: 400 });

  await prisma.botCommand.deleteMany({ where: { botId: result.bot.id, trigger } });
  return NextResponse.json({ deleted: true });
}
