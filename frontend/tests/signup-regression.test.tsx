import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignupPage from "../app/signup/page";

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("traditional signup regression", () => {
  it("keeps the institutional panel stable while only the desktop form pane scrolls", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<SignupPage />);

    expect(screen.getByTestId("signup-shell")).toHaveClass(
      "lg:h-[100dvh]",
      "lg:overflow-hidden",
    );
    expect(screen.getByTestId("signup-copy-panel")).toHaveClass(
      "lg:h-full",
      "lg:justify-center",
    );
    expect(screen.getByTestId("signup-form-scroll")).toHaveClass(
      "signup-form-scroll",
      "lg:h-full",
      "lg:overflow-y-auto",
      "lg:overscroll-contain",
    );
    expect(screen.getByTestId("signup-form-scroll").parentElement).toHaveClass(
      "signup-layout",
    );
    expect(screen.getByTestId("signup-copy-panel")).not.toHaveClass(
      "lg:overflow-y-auto",
    );
  });

  it("renders every field from the original complete signup in the original order", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ available: true }),
      }),
    );
    render(<SignupPage />);

    const fields = [
      screen.getByLabelText("Email"),
      screen.getByLabelText("Nome"),
      screen.getByLabelText("Aniversário"),
      screen.getByLabelText(/Código de convite/i),
      screen.getByLabelText("Região"),
      screen.getByLabelText("Nome de usuário"),
      screen.getByLabelText("Senha"),
      screen.getByLabelText("Confirmar senha"),
      screen.getByRole("checkbox"),
    ];

    for (let index = 1; index < fields.length; index += 1) {
      expect(
        fields[index - 1].compareDocumentPosition(fields[index]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Cadastrar" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Continuar com Google" }),
    ).toBeVisible();
  });

  it("keeps the original required-field validation messages", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<SignupPage />);
    const form = screen
      .getByRole("button", { name: "Cadastrar" })
      .closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(screen.getByText("Digite um email valido.")).toBeVisible();
    expect(screen.getByText("Informe seu nome.")).toBeVisible();
    expect(screen.getByText("Informe sua data de nascimento.")).toBeVisible();
    expect(screen.getByText("Informe um nome de usuário.")).toBeVisible();
    expect(
      screen.getByText("A senha deve ter pelo menos 8 caracteres."),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Aceite os Termos de Uso e as Regras da Comunidade para continuar.",
      ),
    ).toBeVisible();
  });

  it("submits the complete traditional payload including optional legacy fields", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        void _init;
        const url = String(input);
        if (url.includes("availability")) {
          return { ok: true, json: async () => ({ available: true }) };
        }
        return {
          ok: true,
          json: async () => ({ ok: true, pendingVerification: true }),
        };
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "pessoa@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Pessoa Teste" },
    });
    fireEvent.change(screen.getByLabelText("Aniversário"), {
      target: { value: "01/01/2000" },
    });
    fireEvent.change(screen.getByLabelText(/Código de convite/i), {
      target: { value: "ABC1234" },
    });
    fireEvent.change(screen.getByLabelText("Região"), {
      target: { value: "Brasil, São Paulo" },
    });
    fireEvent.change(screen.getByLabelText("Nome de usuário"), {
      target: { value: "pessoa_teste" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "Senha123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "Senha123!" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(
      () =>
        expect(screen.getByRole("button", { name: "Cadastrar" })).toBeEnabled(),
      { timeout: 2_000 },
    );
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    await waitFor(() => {
      const signupCall = fetchMock.mock.calls.find(
        ([input]) => String(input) === "/api/auth/signup",
      );
      expect(signupCall).toBeDefined();
      expect(JSON.parse(String(signupCall?.[1]?.body))).toEqual(
        expect.objectContaining({
          email: "pessoa@example.com",
          name: "Pessoa Teste",
          birthDate: "2000-01-01",
          invitationCode: "ABC1234",
          location: "Brasil, São Paulo",
          username: "pessoa_teste",
          password: "Senha123!",
          acceptedTerms: true,
          acceptedCommunityRules: true,
        }),
      );
    });
  });
});
