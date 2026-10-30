import { NextRequest, NextResponse } from "next/server";
import { resolveBackendOrigin } from "./app/api/_lib/nest-proxy";

const AUTH_PATHS = ["/login", "/signup", "/verify-email"];
const PROTECTED_PATH_PREFIXES = [
  "/profile",
  "/messages",
  "/settings",
  "/mini-cloud",
  "/following",
  "/onboarding",
  "/notifications",
];

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/logo") ||
    pathname.startsWith("/assets") ||
    pathname.includes(".")
  );
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function loginUrl(request: NextRequest) {
  const url = new URL("/login", request.url);
  url.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return url;
}

async function hasValidSession(request: NextRequest) {
  try {
    const sessionUrl = new URL("/auth/session", `${resolveBackendOrigin()}/`);
    const response = await fetch(sessionUrl, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    if (response.ok) return true;
    if (response.status === 401) return false;
    return null;
  } catch {
    return null;
  }
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set("cc_session", "", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    domain: process.env.SESSION_COOKIE_DOMAIN?.trim() || undefined,
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const sessionExists = request.cookies.has("cc_session");

  if (AUTH_PATHS.includes(pathname)) {
    const sessionIsValid = sessionExists ? await hasValidSession(request) : false;
    if (sessionIsValid) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (sessionExists && sessionIsValid === false) {
      const response = NextResponse.next();
      clearSessionCookie(response);
      return response;
    }

    return NextResponse.next();
  }

  if (isProtectedPath(pathname)) {
    if (!sessionExists) {
      return NextResponse.redirect(loginUrl(request));
    }

    const sessionIsValid = await hasValidSession(request);
    if (sessionIsValid === false) {
      const response = NextResponse.redirect(loginUrl(request));
      clearSessionCookie(response);
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

