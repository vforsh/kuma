export async function readStdinText(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export function stdinIsTty(): boolean {
  return Boolean(process.stdin.isTTY);
}
