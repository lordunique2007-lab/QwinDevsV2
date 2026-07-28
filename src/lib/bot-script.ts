import vm from "node:vm";

export class ScriptError extends Error {}

const TIMEOUT_MS = 1000;
const MAX_OUTPUT_LENGTH = 4000;

/**
 * Executes a bot command's custom JS handler.
 *
 * IMPORTANT — HONEST SECURITY NOTE: Node's `vm` module is a convenient way to
 * evaluate a script separately from the surrounding scope and cap how long
 * it runs, but Node's own docs are explicit that `vm` is "not a security
 * mechanism" and must never be used to run code from untrusted strangers.
 * This is why script commands can only be authored by a bot's own owner
 * (enforced by the API route that calls this, not by this function) — it's
 * for a developer's own trusted logic, the same trust boundary as any other
 * setting only the owner can change, not a safe way to execute arbitrary
 * code submitted by the public.
 *
 * The context exposes only plain data and pure helpers — no `require`,
 * `process`, `fs`, network access, or timers are provided.
 */
/** Compiles (but does not run) a command script, to catch syntax errors at save time. */
export function validateScriptSyntax(code: string): void {
  const wrapped = `(function () { "use strict"; ${code} })();`;
  try {
    // eslint-disable-next-line no-new
    new vm.Script(wrapped, { filename: "command.js" });
  } catch (err: any) {
    throw new ScriptError(`Syntax error: ${err?.message ?? "invalid code"}`);
  }
}

export function runCommandScript(
  code: string,
  input: { args: string[]; rawMessage: string; triggeredBy: { username: string; displayName: string } }
): string {
  const sandbox: Record<string, unknown> = {
    args: input.args,
    rawMessage: input.rawMessage,
    user: { username: input.triggeredBy.username, displayName: input.triggeredBy.displayName },
    __result: undefined as string | undefined
  };

  const context = vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false }
  });

  // Wrap the owner's code so `return "..."` inside it becomes the result,
  // without giving the script access to the outer function scope.
  const wrapped = `
    (function () {
      "use strict";
      ${code}
    })();
  `;

  let output: unknown;
  try {
    const script = new vm.Script(wrapped, { filename: "command.js" });
    output = script.runInContext(context, { timeout: TIMEOUT_MS });
  } catch (err: any) {
    if (err?.message?.includes("Script execution timed out")) {
      throw new ScriptError("This command took too long to run (limit: 1 second).");
    }
    throw new ScriptError(`Script error: ${err?.message ?? "unknown error"}`);
  }

  if (output === undefined || output === null) {
    throw new ScriptError("The command's script must return a text response.");
  }

  const text = String(output);
  if (text.length > MAX_OUTPUT_LENGTH) {
    return text.slice(0, MAX_OUTPUT_LENGTH) + "… (truncated)";
  }
  return text;
}
