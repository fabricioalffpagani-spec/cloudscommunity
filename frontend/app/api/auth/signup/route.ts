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

async function writeDb(db: DbShape) {
  const dir = path.dirname(DB_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 });
    }

    const db = await readDb();
    const exists = db.users.some((u) => u.email === email);
    if (exists) {
      return NextResponse.json({ error: "Este email já está cadastrado." }, { status: 409 });
    }

    db.users.push({ email, password, createdAt: new Date().toISOString() });
    await writeDb(db);

    // Sessão (demo): não implementa JWT/cookies aqui.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro ao cadastrar." }, { status: 500 });
  }
}

