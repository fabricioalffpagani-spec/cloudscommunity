/**
 * POST /api/auth/signup
 * Final registration step — verifies OTP + persists user profile.
 *
 * Body:
 *   email, password, name, username, bio, birthDate, region, gender, code
 *
 * Returns:
 *   { ok: true, user: { id, email, name, username } }
 *   Sets an HttpOnly session cookie: cc_session=<base64 user snapshot>
 */
import { NextResponse } from "next/server";
import { readDb, writeDb, type User } from "../_db";
import crypto from "node:crypto";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
      username?: string;
      bio?: string;
      birthDate?: string;
      region?: string;
      gender?: string;
      code?: string;
    };

    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const name = (body.name ?? "").trim();
    const username = (body.username ?? "").trim().toLowerCase();
    const bio = (body.bio ?? "").trim();
    const birthDate = (body.birthDate ?? "").trim();
    const region = (body.region ?? "").trim();
    const gender = (body.gender ?? "").trim();
    const code = (body.code ?? "").trim();

    // ── Validate required fields ────────────────────────────────────────────
    if (!email)      return NextResponse.json({ error: "Email é obrigatório." }, { status: 400 });
    if (!password)   return NextResponse.json({ error: "Senha é obrigatória." }, { status: 400 });
    if (!name)       return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
    if (!username)   return NextResponse.json({ error: "Nome de usuário é obrigatório." }, { status: 400 });
    if (!birthDate)  return NextResponse.json({ error: "Data de nascimento é obrigatória." }, { status: 400 });
    if (!region)     return NextResponse.json({ error: "Região é obrigatória." }, { status: 400 });
    if (!gender)     return NextResponse.json({ error: "Gênero é obrigatório." }, { status: 400 });
    if (!code)       return NextResponse.json({ error: "Código de verificação é obrigatório." }, { status: 400 });

    if (password.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 });
    }

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: "Nome de usuário inválido. Use 3-20 caracteres: letras, números ou _." },
        { status: 400 }
      );
    }

    const db = await readDb();

    // ── Check duplicates ────────────────────────────────────────────────────
    if (db.users.some((u) => u.email === email)) {
      return NextResponse.json({ error: "Este email já está cadastrado." }, { status: 409 });
    }
    if (db.users.some((u) => u.username === username)) {
      return NextResponse.json({ error: "Este nome de usuário já está em uso." }, { status: 409 });
    }

    // ── Verify OTP ──────────────────────────────────────────────────────────
    const pendingIdx = db.pending_verifications.findIndex(
      (v) => v.email === email
    );
    if (pendingIdx === -1) {
      return NextResponse.json(
        { error: "Código não solicitado. Por favor, solicite um novo código." },
        { status: 400 }
      );
    }

    const pending = db.pending_verifications[pendingIdx];

    if (new Date() > new Date(pending.expiresAt)) {
      db.pending_verifications.splice(pendingIdx, 1);
      await writeDb(db);
      return NextResponse.json(
        { error: "Código expirado. Solicite um novo código." },
        { status: 400 }
      );
    }

    if (pending.code !== code) {
      return NextResponse.json({ error: "Código incorreto." }, { status: 400 });
    }

    // ── Persist user ────────────────────────────────────────────────────────
    const newUser: User = {
      id: `usr_${crypto.randomBytes(8).toString("hex")}`,
      email,
      password,
      name,
      username,
      bio,
      birthDate,
      region,
      gender,
      verified: true,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    // Remove from pending
    db.pending_verifications.splice(pendingIdx, 1);
    await writeDb(db);

    // ── Set session cookie ──────────────────────────────────────────────────
    const sessionPayload = JSON.stringify({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      username: newUser.username,
    });
    const sessionValue = Buffer.from(sessionPayload).toString("base64");

    const response = NextResponse.json({
      ok: true,
      user: { id: newUser.id, email: newUser.email, name: newUser.name, username: newUser.username },
    });

    response.cookies.set("cc_session", sessionValue, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Erro ao cadastrar." }, { status: 500 });
  }
}
