/**
 * Accept only same-site absolute paths. This keeps auth redirects from becoming
 * an open redirect when a query parameter is supplied by an untrusted caller.
 */
export function getSafeRedirectPath(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://buildmate.local");
    if (parsed.origin !== "https://buildmate.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
