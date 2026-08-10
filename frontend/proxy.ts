import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];
const PROTECTED_PATH_PREFIXES = [
  "/",
  "/profile",
  "/messages",
  "/meet",
  "/settings",
  "/cloud",
  "/following",
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
  if (pathname === "/") return true;
  return PROTECTED_PATH_PREFIXES.some((prefix) => prefix !== "/" && pathname.startsWith(prefix));
}

async function hasValidSession(request: NextRequest) {
  try {
    const sessionUrl = new URL("/api/auth/session", request.url);
    const response = await fetch(sessionUrl, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set("cc_session", "", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Development convenience: allow accessing root without auth checks.
  // This makes it easy to preview the frontend during development when
  // session handling may redirect to /login. It is intentionally limited
  // to non-production environments and only for the root path.
  if (process.env.NODE_ENV !== "production" && pathname === "/") {
    return NextResponse.next();
  }

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const sessionExists = request.cookies.has("cc_session");
  const sessionIsValid = sessionExists ? await hasValidSession(request) : false;

  if (PUBLIC_PATHS.includes(pathname)) {
    if (sessionIsValid) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (sessionExists && !sessionIsValid) {
      const response = NextResponse.next();
      clearSessionCookie(response);
      return response;
    }

    return NextResponse.next();
  }

  if (isProtectedPath(pathname)) {
    if (!sessionExists) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (!sessionIsValid) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      clearSessionCookie(response);
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

