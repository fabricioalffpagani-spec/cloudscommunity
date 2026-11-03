"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BirthDateInput } from "../components/BirthDateInput";
import { useSessionUser } from "../components/session-user";

type RequiredRegistrationField = "name" | "username" | "birthDate" | "terms";

export default function GoogleOnboardingPage() {
  const router = useRouter();
  const { refresh } = useSessionUser();
  const [returnTo, setReturnTo] = useState("/");
  const [form, setForm] = useState({
    name: "",
    username: "",
    birthDate: "",
    accepted: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [missingFields, setMissingFields] = useState<
    RequiredRegistrationField[] | null
  >(null);
  const [completingExistingAccount, setCompletingExistingAccount] =
    useState(false);

  useEffect(() => {
    const value =
      new URLSearchParams(window.location.search).get("returnTo") || "/";
    setReturnTo(value.startsWith("/") && !value.startsWith("//") ? value : "/");
    fetch("/api/auth/google/pending-registration", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          displayName?: string;
          username?: string;
          birthDate?: string;
          email?: string;
          missingFields?: RequiredRegistrationField[];
          completingExistingAccount?: boolean;
          message?: string;
        } | null;
        if (!response.ok)
          throw new Error(payload?.message ?? "Este cadastro Google expirou.");
        setEmail(payload?.email ?? "");
        setMissingFields(payload?.missingFields ?? []);
        setCompletingExistingAccount(
          payload?.completingExistingAccount === true,
        );
        setForm((current) => ({
          ...current,
          name: payload?.displayName ?? "",
          username: payload?.username ?? "",
          birthDate: payload?.birthDate ?? "",
        }));
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Este cadastro Google expirou.",
        ),
      );
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/google/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          username: form.username,
          birthDate: form.birthDate,
          acceptedTerms: form.accepted,
          acceptedCommunityRules: form.accepted,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        fieldErrors?: Record<string, string>;
        returnTo?: string;
      } | null;
      if (!response.ok)
        throw new Error(
          payload?.message ??
            Object.values(payload?.fieldErrors ?? {})[0] ??
            "Não foi possível concluir o cadastro.",
        );
      await refresh();
      const destination = payload?.returnTo || returnTo;
      router.replace(
        completingExistingAccount
          ? destination
          : `/onboarding?returnTo=${encodeURIComponent(destination)}`,
      );
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível concluir o cadastro.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#030208] px-5 py-10 text-white"
      style={{
        background:
          "radial-gradient(ellipse at 50% 15%, rgba(91,33,182,.48), transparent 55%), #030208",
      }}
    >
      <section className="w-full max-w-lg rounded-[32px] border border-white/10 bg-[#12101d]/95 p-6 shadow-2xl sm:p-9">
        <p className="text-[12px] font-bold uppercase tracking-[.25em] text-[#C084FC]">
          Cadastro com Google
        </p>
        <h1 className="mt-3 text-3xl font-bold">Completar cadastro</h1>
        <p className="mt-2 text-[14px] text-white/60">
          {completingExistingAccount
            ? "Encontramos sua conta. Preencha somente os dados obrigatórios que ainda faltam."
            : "Precisamos apenas das informações obrigatórias que o Google não forneceu."}
        </p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          {email && (
            <div className="rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-[14px] text-white/65">
              {email}
            </div>
          )}
          {missingFields?.includes("name") && (
            <label className="block text-[12px] font-semibold uppercase tracking-[.16em] text-white/70">
              Nome
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Seu nome completo"
                autoComplete="name"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#17171C] px-4 py-3 text-[15px] font-normal normal-case tracking-normal text-white outline-none focus:border-[#A855F7]"
              />
            </label>
          )}
          {missingFields?.includes("username") && (
            <label className="block text-[12px] font-semibold uppercase tracking-[.16em] text-white/70">
              Nome de usuário
              <input
                required
                value={form.username}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    username: event.target.value
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, ""),
                  }))
                }
                minLength={4}
                maxLength={15}
                placeholder="seu_usuario"
                autoComplete="username"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#17171C] px-4 py-3 text-[15px] font-normal normal-case tracking-normal text-white outline-none focus:border-[#A855F7]"
              />
            </label>
          )}
          {missingFields?.includes("birthDate") && (
            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[.16em] text-white/70">
                Aniversário
              </p>
              <BirthDateInput
                id="googleBirthDate"
                value={form.birthDate}
                onChange={(birthDate) =>
                  setForm((current) => ({ ...current, birthDate }))
                }
              />
            </div>
          )}
          {missingFields?.includes("terms") && (
            <label className="flex items-start gap-3 text-[13px] text-white/70">
              <input
                type="checkbox"
                checked={form.accepted}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    accepted: event.target.checked,
                  }))
                }
                className="mt-1 accent-[#A855F7]"
              />
              <span>
                Li e aceito os{" "}
                <a
                  href="/legal/documentos-da-plataforma.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#C084FC] hover:underline"
                >
                  Termos de Uso e as Regras da Comunidade
                </a>
                .
              </span>
            </label>
          )}
          {missingFields === null && !error && (
            <p className="text-[13px] text-white/55">Carregando cadastro...</p>
          )}
          {error && (
            <p role="alert" className="text-[13px] text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={
              submitting ||
              missingFields === null ||
              (missingFields.includes("terms") && !form.accepted)
            }
            className="w-full rounded-full bg-[#9333EA] px-6 py-3 font-semibold transition hover:bg-[#7C3AED] disabled:opacity-40"
          >
            {submitting ? "Concluindo..." : "Concluir cadastro"}
          </button>
        </form>
      </section>
    </main>
  );
}
