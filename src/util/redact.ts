export function redactPassword(password: string | undefined | null): string | null {
  if (!password) return null;
  if (password.length <= 8) return "***";
  return `${password.slice(0, 2)}***${password.slice(-2)}`;
}
