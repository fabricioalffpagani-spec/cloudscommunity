/**
 * POST /api/auth/login
 * Validates credentials and sets an HttpOnly session cookie.
 *
 * Body: { email, password }
 * Returns: { ok: true, user: { id, email, name, username } }
 */
import { NextResponse } from "next/server";
import { readDb } from "../_db";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const db = await readDb();
    const user = db.users.find((u) => u.email === email);

    if (!user || user.password !== password) {
      return NextResponse.json(
        { error: "Credenciais inválidas." },
        { status: 401 }
      );
    }

    // ── Set session cookie ──────────────────────────────────────────────────
    const sessionPayload = JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
    });
    const sessionValue = Buffer.from(sessionPayload).toString("base64");

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
      },
    });

    response.cookies.set("cc_session", sessionValue, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Erro ao entrar." }, { status: 500 });
  }
}
