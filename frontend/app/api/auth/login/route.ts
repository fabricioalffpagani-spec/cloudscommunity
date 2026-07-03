import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

type DbShape = {
  users: Array<{ email: string; password: string; createdAt: string }>;
};

const DB_FILE = path.join(process.cwd(), "app", "api", "auth", "_db.json");

async function readDb(): Promise<DbShape> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw) as DbShape;
    if (!parsed?.users) return { users: [] };
    return parsed;
  } catch {
    return { users: [] };
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios." }, { status: 400 });
    }

    const db = await readDb();
    const user = db.users.find((u) => u.email === email);
    if (!user || user.password !== password) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    // Sessão (demo): retorna sucesso. A UI pode guardar em localStorage/cookie.
    return NextResponse.json({ ok: true, email: user.email });
  } catch {
    return NextResponse.json({ error: "Erro ao entrar." }, { status: 500 });
  }
}

