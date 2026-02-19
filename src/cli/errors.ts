export class CliError extends Error {
  exitCode: number;
  debug: boolean;
  override cause?: unknown;

  constructor(message: string, opts?: { exitCode?: number; debug?: boolean; cause?: unknown }) {
    super(message, opts?.cause ? { cause: opts.cause } : undefined);
    this.name = "CliError";
    this.exitCode = opts?.exitCode ?? 1;
    this.debug = opts?.debug ?? false;
    this.cause = opts?.cause;
  }
}

export function isCliError(err: unknown): err is CliError {
  return err instanceof CliError;
}
