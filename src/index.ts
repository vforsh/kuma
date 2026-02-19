import { buildProgram } from "./cli/program.ts";
import { isCliError } from "./cli/errors.ts";

export async function main(argv: string[]): Promise<void> {
  const program = buildProgram();

  try {
    await program.parseAsync(argv);
  } catch (err) {
    const e = normalizeError(err);
    process.exitCode = e.exitCode;

    const wantsJson = argv.includes("--json");
    if (wantsJson) {
      process.stdout.write(`${JSON.stringify({ error: { message: e.message, exitCode: e.exitCode } }, null, 2)}\n`);
      return;
    }

    if (e.printStack) {
      console.error(e.cause ?? e);
      return;
    }

    console.error(e.message);
  }
}

function normalizeError(err: unknown): { message: string; exitCode: number; printStack: boolean; cause?: unknown } {
  if (isCliError(err)) return { message: err.message, exitCode: err.exitCode, printStack: err.debug, cause: err.cause };
  if (err instanceof Error) return { message: err.message, exitCode: 1, printStack: false };
  return { message: String(err), exitCode: 1, printStack: false };
}
