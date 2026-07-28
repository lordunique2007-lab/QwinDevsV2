"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import VerifiedBadge from "@/components/VerifiedBadge";
import BoostButton from "@/components/BoostButton";
import ReportButton from "@/components/ReportButton";
import QuickEntityModeration from "@/components/QuickEntityModeration";

type Command = {
  trigger: string;
  description: string;
  mode: "STATIC" | "SCRIPT";
  response?: string;
  handlerCode?: string | null;
  usageCount: number;
};
type BotDetail = {
  id?: string;
  username: string;
  name: string;
  description: string;
  category: string;
  isVerified: boolean;
  status: string;
  welcomeMessage: string;
  commandsExecuted: number;
  isBoosted?: boolean;
  tokenPreview?: string;
  webhookUrl?: string | null;
  webhookEnabled?: boolean;
  hasWebhookSecret?: boolean;
  owner: { username: string; displayName: string; isVerified: boolean };
};

const SCRIPT_EXAMPLE = [
  "// Example: a script command that greets whoever ran it",
  '// "args" are the words after the command, "user" is who triggered it.',
  "if (args.length > 0) {",
  '  return "Hello, " + args.join(" ") + "! \\ud83d\\udc4b";',
  "}",
  'return "Hello, " + user.displayName + "! \\ud83d\\udc4b";'
].join("\n");

export default function BotDetailPage() {
  const params = useParams<{ username: string }>();
  const { data: session } = useSession();
  const [bot, setBot] = useState<BotDetail | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"commands" | "webhook" | "test">("commands");

  const [newTrigger, setNewTrigger] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newMode, setNewMode] = useState<"STATIC" | "SCRIPT">("STATIC");
  const [newResponse, setNewResponse] = useState("");
  const [newCode, setNewCode] = useState(SCRIPT_EXAMPLE);
  const [error, setError] = useState<string | null>(null);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const [testTrigger, setTestTrigger] = useState("/start");
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testToken, setTestToken] = useState("");

  async function load() {
    const res = await fetch(`/api/bots/${params.username}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setBot(data.bot);
    setCommands(data.commands);
    setIsOwner(data.isOwner);
    setWebhookUrl(data.bot.webhookUrl ?? "");
    setWebhookEnabled(!!data.bot.webhookEnabled);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.username]);

  async function addCommand(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/bots/${params.username}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger: newTrigger,
        description: newDescription,
        mode: newMode,
        response: newMode === "STATIC" ? newResponse : "",
        handlerCode: newMode === "SCRIPT" ? newCode : undefined
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setNewTrigger("");
    setNewDescription("");
    setNewResponse("");
    setNewCode(SCRIPT_EXAMPLE);
    load();
  }

  async function deleteCommand(trigger: string) {
    await fetch(`/api/bots/${params.username}/commands?trigger=${encodeURIComponent(trigger)}`, { method: "DELETE" });
    load();
  }

  async function regenerateToken() {
    const res = await fetch(`/api/bots/${params.username}/regenerate-token`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      alert("New token (copy it now, it won't be shown again):\n\n" + data.token);
      load();
    }
  }

  async function saveWebhook(regenerateSecret = false) {
    setWebhookSaving(true);
    const res = await fetch(`/api/bots/${params.username}/webhook`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl, webhookEnabled, regenerateSecret })
    });
    const data = await res.json();
    setWebhookSaving(false);
    if (res.ok) {
      if (data.webhookSecret) setRevealedSecret(data.webhookSecret);
      load();
    } else {
      setError(data.error);
    }
  }

  async function runTest() {
    const res = await fetch(`/api/bots/${params.username}/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${testToken}` },
      body: JSON.stringify({ trigger: testTrigger })
    });
    const data = await res.json();
    setTestOutput(res.ok ? data.response : `Error: ${data.error}`);
  }

  if (loading) return <div className="card h-64 animate-pulse" />;
  if (!bot) return <div className="card p-8 text-center text-qwin-muted">Bot not found.</div>;

  const pythonExample = [
    "import hmac, hashlib, requests",
    "from flask import Flask, request",
    "",
    "app = Flask(__name__)",
    'SECRET = "your-webhook-secret"',
    'TOKEN = "your-bot-token"  # shown once at bot creation',
    "",
    '@app.post("/qwin-webhook")',
    "def webhook():",
    "    body = request.get_data()",
    "    sig = hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()",
    '    if sig != request.headers.get("X-Qwin-Signature"):',
    '        return "", 401',
    "",
    "    event = request.json",
    '    if event["event"] == "message":',
    '        reply = "You said: " + event["data"]["content"]',
    "        requests.post(",
    `            f"https://your-qwin-devs-site.com/api/bots/${bot.username}/send",`,
    '            headers={"Authorization": f"Bearer {TOKEN}"},',
    '            json={"conversationId": event["data"]["conversationId"], "content": reply},',
    "        )",
    '    return "", 200'
  ].join("\n");

  const nodeExample = [
    'const crypto = require("crypto");',
    'const express = require("express");',
    "const app = express();",
    'app.use(express.raw({ type: "*/*" }));',
    "",
    'const SECRET = "your-webhook-secret";',
    'const TOKEN = "your-bot-token";',
    "",
    'app.post("/qwin-webhook", async (req, res) => {',
    '  const sig = crypto.createHmac("sha256", SECRET).update(req.body).digest("hex");',
    '  if (sig !== req.headers["x-qwin-signature"]) return res.sendStatus(401);',
    "",
    "  const event = JSON.parse(req.body);",
    '  if (event.event === "message") {',
    `    await fetch("https://your-qwin-devs-site.com/api/bots/${bot.username}/send", {`,
    '      method: "POST",',
    '      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },',
    '      body: JSON.stringify({ conversationId: event.data.conversationId, content: "You said: " + event.data.content })',
    "    });",
    "  }",
    "  res.sendStatus(200);",
    "});"
  ].join("\n");

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      {((session?.user as any)?.role === "SUPER_ADMIN" || (session?.user as any)?.role === "MODERATOR") && bot.id && (
        <QuickEntityModeration kind="bot" id={bot.id} status={bot.status} onChanged={load} />
      )}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-1.5 font-display text-xl font-bold">
              🤖 {bot.name} {bot.isVerified && <VerifiedBadge size={16} />}
            </h1>
            <p className="text-sm text-qwin-muted">@{bot.username} · {bot.category}</p>
            <p className="mt-3 text-sm">{bot.description}</p>
            <p className="mt-3 text-xs text-qwin-muted">
              Owner: @{bot.owner.username} {bot.owner.isVerified && <VerifiedBadge size={11} />} · {bot.commandsExecuted} command runs
            </p>
            {!isOwner && bot.id && (
              <div className="mt-2">
                <ReportButton targetType="BOT" targetId={bot.id} />
              </div>
            )}
          </div>
          {isOwner && bot.id && (
            <BoostButton targetType="BOT" targetId={bot.id} isBoosted={!!bot.isBoosted} onBoosted={load} />
          )}
        </div>
      </div>

      {isOwner && (
        <div className="card p-6">
          <h2 className="font-display font-semibold">API token</h2>
          <p className="mt-1 text-sm text-qwin-muted">Current: {bot.tokenPreview}</p>
          <button onClick={regenerateToken} className="btn-secondary mt-2 text-sm">
            Regenerate token
          </button>
        </div>
      )}

      {isOwner && (
        <div className="flex gap-2">
          <button onClick={() => setTab("commands")} className={tab === "commands" ? "btn-primary text-sm" : "btn-secondary text-sm"}>
            Commands
          </button>
          <button onClick={() => setTab("webhook")} className={tab === "webhook" ? "btn-primary text-sm" : "btn-secondary text-sm"}>
            Webhook (Python/JS)
          </button>
          <button onClick={() => setTab("test")} className={tab === "test" ? "btn-primary text-sm" : "btn-secondary text-sm"}>
            Test console
          </button>
        </div>
      )}

      {(!isOwner || tab === "commands") && (
        <div className="card p-6">
          <h2 className="font-display font-semibold">Commands</h2>
          <div className="mt-3 divide-y divide-qwin-border">
            {commands.length === 0 && <p className="py-4 text-sm text-qwin-muted">No custom commands yet.</p>}
            {commands.map((c) => (
              <div key={c.trigger} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-mono text-qwin-primary2">
                    {c.trigger} {c.mode === "SCRIPT" && <span className="text-qwin-gold">⚡ script</span>}
                  </p>
                  <p className="text-xs text-qwin-muted">{c.description}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-qwin-muted">
                  <span>{c.usageCount} runs</span>
                  {isOwner && (
                    <button onClick={() => deleteCommand(c.trigger)} className="text-red-400 hover:underline">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isOwner && (
            <form onSubmit={addCommand} className="mt-4 space-y-2 border-t border-qwin-border pt-4">
              <input required placeholder="/trigger" className="input" value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} />
              <input placeholder="Description" className="input" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />

              <div className="flex gap-2">
                <button type="button" onClick={() => setNewMode("STATIC")} className={newMode === "STATIC" ? "btn-primary text-xs" : "btn-secondary text-xs"}>
                  Static reply
                </button>
                <button type="button" onClick={() => setNewMode("SCRIPT")} className={newMode === "SCRIPT" ? "btn-primary text-xs" : "btn-secondary text-xs"}>
                  ⚡ JS script
                </button>
              </div>

              {newMode === "STATIC" ? (
                <textarea required placeholder="Response text" rows={3} className="input resize-none" value={newResponse} onChange={(e) => setNewResponse(e.target.value)} />
              ) : (
                <div>
                  <textarea
                    required
                    rows={8}
                    className="input resize-none font-mono text-xs"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-qwin-muted">
                    Runs sandboxed with a 1-second timeout — no network or file access. You have{" "}
                    <code>args</code> (words after the command), <code>rawMessage</code>, and{" "}
                    <code>user</code>. Return a string.
                  </p>
                </div>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="submit" className="btn-primary text-sm">
                Add command
              </button>
            </form>
          )}
        </div>
      )}

      {isOwner && tab === "webhook" && (
        <div className="card p-6">
          <h2 className="font-display font-semibold">Webhook — write your bot in Python, JS, or anything</h2>
          <p className="mt-2 text-sm text-qwin-muted">
            Exactly like Telegram: Qwin Devs never runs your bot&apos;s real logic on our servers.
            Instead, when someone messages your bot&apos;s account, we <code>POST</code> the event to
            your own server at the URL below (signed so you can verify it&apos;s really us). Your
            server — written in whatever language you want — decides how to respond, then calls back
            our API to actually send the reply.
          </p>

          <div className="mt-4 space-y-3">
            <input
              placeholder="https://your-server.com/qwin-webhook"
              className="input"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <div className="flex items-center justify-between rounded-xl bg-qwin-surface2 p-3">
              <span className="text-sm">Webhook enabled</span>
              <button
                onClick={() => setWebhookEnabled((v) => !v)}
                className={webhookEnabled ? "btn-primary px-3 py-1 text-xs" : "btn-secondary px-3 py-1 text-xs"}
              >
                {webhookEnabled ? "On" : "Off"}
              </button>
            </div>
            {bot.hasWebhookSecret && !revealedSecret && (
              <p className="text-xs text-qwin-muted">A signing secret is already set for this bot.</p>
            )}
            {revealedSecret && (
              <div className="rounded-xl bg-qwin-surface2 p-3 text-xs">
                <p className="text-qwin-muted">Signing secret (copy now, shown once):</p>
                <p className="mt-1 break-all font-mono text-qwin-accent">{revealedSecret}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => saveWebhook(false)} disabled={webhookSaving} className="btn-primary text-sm">
                {webhookSaving ? "Saving…" : "Save webhook settings"}
              </button>
              <button onClick={() => saveWebhook(true)} disabled={webhookSaving} className="btn-secondary text-sm">
                Regenerate secret
              </button>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          <div className="mt-6 border-t border-qwin-border pt-4">
            <p className="mb-2 text-sm font-medium">Python example (Flask)</p>
            <pre className="overflow-x-auto whitespace-pre rounded-xl bg-qwin-surface2 p-3 text-xs">{pythonExample}</pre>

            <p className="mb-2 mt-4 text-sm font-medium">Node.js example (Express)</p>
            <pre className="overflow-x-auto whitespace-pre rounded-xl bg-qwin-surface2 p-3 text-xs">{nodeExample}</pre>
          </div>
        </div>
      )}

      {isOwner && tab === "test" && (
        <div className="card p-6">
          <h2 className="font-display font-semibold">Test console</h2>
          <p className="mt-1 text-xs text-qwin-muted">
            Calls the real Bot API (<code>POST /api/bots/{bot.username}/invoke</code>) with a token you paste in.
          </p>
          <div className="mt-3 space-y-2">
            <input
              placeholder="Paste a bot token to test with"
              className="input"
              value={testToken}
              onChange={(e) => setTestToken(e.target.value)}
            />
            <div className="flex gap-2">
              <input className="input" value={testTrigger} onChange={(e) => setTestTrigger(e.target.value)} />
              <button onClick={runTest} className="btn-secondary shrink-0 text-sm">
                Run
              </button>
            </div>
            {testOutput && <div className="whitespace-pre-wrap rounded-xl bg-qwin-surface2 p-3 text-sm">{testOutput}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
