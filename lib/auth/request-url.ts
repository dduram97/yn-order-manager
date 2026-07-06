/** 브라우저/프록시 Host 기준 origin — 0.0.0.0 리다이렉트 방지 */

const INVALID_HOSTNAMES = new Set(["0.0.0.0", "::", "[::]"]);

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function hostnameOf(host: string): string {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(1, end).toLowerCase();
  }
  return host.split(":")[0]?.toLowerCase() ?? host.toLowerCase();
}

/** x-forwarded-host → host 순, 0.0.0.0 등 무효 host 제외 */
export function requestHost(request: Request): string {
  const candidates = [
    firstHeaderValue(request.headers.get("x-forwarded-host")),
    firstHeaderValue(request.headers.get("host")),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const hostname = hostnameOf(candidate);
    if (INVALID_HOSTNAMES.has(hostname)) continue;
    return candidate;
  }

  return "127.0.0.1:3000";
}

/** x-forwarded-proto 우선, 없으면 http */
export function requestProtocol(request: Request): "http" | "https" {
  const proto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  if (proto === "https") return "https";
  if (proto === "http") return "http";
  return "http";
}

export function requestOrigin(request: Request): string {
  return `${requestProtocol(request)}://${requestHost(request)}`;
}

export function requestAbsoluteUrl(request: Request, path: string): URL {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, requestOrigin(request));

  if (url.hostname === "0.0.0.0") {
    url.hostname = "127.0.0.1";
  }

  return url;
}
