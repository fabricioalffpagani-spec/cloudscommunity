/**
 * POST /api/auth/send-code
 * Generates a 6-digit OTP, stores it as a pending verification, and
 * sends it via e-mail (Resend).
 *
 * Body: { email: string }
 */
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { readDb, writeDb, generateOtp, otpExpiry } from "../_db";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório." }, { status: 400 });
    }

    const db = await readDb();

    // Do not allow re-sending if user is already fully registered.
    const alreadyRegistered = db.users.some((u) => u.email === email);
    if (alreadyRegistered) {
      return NextResponse.json(
        { error: "Este email já está cadastrado." },
        { status: 409 }
      );
    }

    const code = generateOtp();
    const expiresAt = otpExpiry().toISOString();

    // Remove any previous pending entry for this email.
    db.pending_verifications = db.pending_verifications.filter((v) => v.email !== email);

    // Store placeholder payload (completed at /signup)
    db.pending_verifications.push({
      email,
      code,
      expiresAt,
      payload: {
        email,
        password: "",
        name: "",
        username: "",
        bio: "",
        birthDate: "",
        region: "",
        gender: "",
      },
    });

    await writeDb(db);

    // Always log OTP for dev visibility
    console.log(`[CloudsCommunity] OTP for ${email}: ${code}  (expires ${expiresAt})`);

    // Alguns ambientes (Turbopack/dev) podem não carregar .env corretamente no runtime.
    // Então fazemos fallback lendo o arquivo .env.local do diretório do projeto.
    // Obs: isso roda no servidor (route handler), então é seguro usar fs/dotenv aqui.
    let resendApiKey = process.env.RESEND_API_KEY;
    let from = process.env.RESEND_FROM;

    if (!resendApiKey || !from) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require("node:fs");

        const parseEnv = (raw: string) => {
          for (const line of raw.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const idx = trimmed.indexOf("=");
            if (idx === -1) continue;
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim();
            if (key && !(key in process.env)) process.env[key] = val;
          }
        };

        const candidatePaths = [
          process.cwd() + "/.env.local", // frontend/.env.local
          process.cwd() + "/../.env.local", // repo root .env.local
        ];

        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, "utf-8");
            parseEnv(raw);
            break;
          }
        }
      } catch {
        // ignore - fallback will stay undefined
      }


      resendApiKey = process.env.RESEND_API_KEY;
      from = process.env.RESEND_FROM;
    }

    if (!resendApiKey || resendApiKey.includes("PALETHOLDER")) {
      return NextResponse.json(
        {
          error:
            "RESEND_API_KEY não configurada. Defina RESEND_API_KEY (e opcional RESEND_FROM) em frontend/.env.local ou na raiz do projeto.",
        },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);
    const fromAddress = from?.includes("<")
      ? from
      : `Clouds Community <${from || "noreply@cloudscommunity.site"}>`;

    // Resend returns { data, error } — it does NOT throw on API failures.
    const { data, error: sendError } = await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: "Seu código de verificação — Clouds Community",
      html: `
        <p>Seu código de verificação é: <strong style="font-size:18px;">${code}</strong>.</p>
        <p>Ele expira em <strong>15 minutos</strong>.</p>
      `,
    });

    if (sendError) {
      console.error(`[CloudsCommunity] Resend error for ${email}:`, sendError);

      // In development the OTP is logged above — allow the signup flow to continue.
      if (process.env.NODE_ENV === "development") {
        return NextResponse.json({
          ok: true,
          dev: true,
          emailWarning: sendError.message,
        });
      }

      const message =
        sendError.message?.toLowerCase().includes("domain") ||
        sendError.name === "validation_error"
          ? "Não foi possível enviar o e-mail. Verifique se o domínio remetente está configurado no Resend."
          : sendError.message || "Erro ao enviar e-mail de verificação.";

      return NextResponse.json({ error: message }, { status: 502 });
    }

    console.log(`[CloudsCommunity] Email sent to ${email} (id: ${data?.id})`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[CloudsCommunity] send-code failed:", err);
    return NextResponse.json({ error: "Erro ao enviar código." }, { status: 500 });
  }
}

