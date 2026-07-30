export function maskAccountNumber(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\s+/g, "");
  if (digits.length <= 4) return "•".repeat(digits.length);
  return `•••• ${digits.slice(-4)}`;
}
