/**
 * GET /api/auth/me
 * Returns the session user from the HttpOnly cookie.
 * Returns 401 if not authenticated.
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const sessionValue = req.cookies.get("cc_session")?.value;

  if (!sessionValue) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const payload = JSON.parse(
      Buffer.from(sessionValue, "base64").toString("utf-8")
    ) as { id: string; email: string; name: string; username: string };

    return NextResponse.json({ ok: true, user: payload });
  } catch {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
}

/**
 * DELETE /api/auth/me  (logout)
 * Clears the session cookie.
 */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("cc_session", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
