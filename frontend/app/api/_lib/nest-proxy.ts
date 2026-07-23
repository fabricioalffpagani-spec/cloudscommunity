import { NextResponse } from "next/server";

const BACKEND_ORIGIN_ENV_NAMES = ["CLOUDS_BRIDGE_URL"] as const;

function resolveBackendOrigin() {
  const configuredOrigin = BACKEND_ORIGIN_ENV_NAMES
    .map((name) => process.env[name]?.trim())
    .find((value): value is string => Boolean(value));

  if (!configuredOrigin) {
    throw new Error(
      `Missing backend origin. Set ${BACKEND_ORIGIN_ENV_NAMES[0]} in the server environment.`,
    );
  }

  return configuredOrigin.replace(/\/+$/, "");
}

function buildBackendUrl(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalizedPath, `${resolveBackendOrigin()}/`).toString();
}

function copyRequestHeaders(source: Headers) {
  const headers = new Headers();

  source.forEach((value, key) => {
    const lowerKey = key.toLowerCase();

    if (lowerKey === "host" || lowerKey === "connection" || lowerKey === "content-length") {
      return;
    }

    headers.set(key, value);
  });

  return headers;
}

function forwardSetCookies(source: Headers, destination: NextResponse) {
  const headersWithCookies = source as Headers & { getSetCookie?: () => string[] };
  const cookies = headersWithCookies.getSetCookie?.() ?? [];

  if (cookies.length > 0) {
    cookies.forEach((cookie) => destination.headers.append("set-cookie", cookie));
    return;
  }

  const singleCookie = source.get("set-cookie");
  if (singleCookie) {
    destination.headers.append("set-cookie", singleCookie);
  }
}

async function responseToNextResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const status = response.status;

  if (status === 204) {
    const emptyResponse = new NextResponse(null, { status });
    forwardSetCookies(response.headers, emptyResponse);
    return emptyResponse;
  }

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    const nextResponse = NextResponse.json(payload ?? {}, { status });
    forwardSetCookies(response.headers, nextResponse);
    return nextResponse;
  }

  const text = await response.text();
  const nextResponse = new NextResponse(text, {
    status,
    headers: contentType ? { "content-type": contentType } : undefined,
  });
  forwardSetCookies(response.headers, nextResponse);
  return nextResponse;
}

export async function proxyRequest(req: Request, pathname: string) {
  const method = req.method.toUpperCase();
  const backendResponse = await fetch(buildBackendUrl(pathname), {
    method,
    headers: copyRequestHeaders(req.headers),
    body: method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer(),
    cache: "no-store",
  });

  return responseToNextResponse(backendResponse);
}

export async function proxyJsonRequest(req: Request, pathname: string) {
  return proxyRequest(req, pathname);
}
