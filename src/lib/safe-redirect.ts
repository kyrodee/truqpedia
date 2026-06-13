export function safeSameOriginRedirect(
  requestUrl: URL,
  fallbackPath = "/",
): URL {
  const next = requestUrl.searchParams.get("next");

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return new URL(fallbackPath, requestUrl.origin);
  }

  const target = new URL(next, requestUrl.origin);

  if (target.origin !== requestUrl.origin) {
    return new URL(fallbackPath, requestUrl.origin);
  }

  return target;
}
