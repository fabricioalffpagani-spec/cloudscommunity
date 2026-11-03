import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GoogleOnboardingPage from "../app/google-onboarding/page";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));
vi.mock("../app/components/session-user", () => ({
  useSessionUser: () => ({ refresh: vi.fn() }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Google registration completeness", () => {
  it("asks only for data Google did not provide and never asks for a password", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          email: "person@gmail.com",
          displayName: "Pessoa Google",
          missingFields: ["username", "birthDate", "terms"],
          completingExistingAccount: false,
        }),
      }),
    );
    render(<GoogleOnboardingPage />);

    expect(await screen.findByLabelText("Nome de usuário")).toBeVisible();
    expect(screen.getByText("Aniversário")).toBeVisible();
    expect(screen.getByRole("checkbox")).toBeVisible();
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Senha/i)).not.toBeInTheDocument();
  });

  it("requests only terms for an existing Google user whose profile is already complete", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          email: "person@gmail.com",
          displayName: "Pessoa Google",
          username: "pessoa_google",
          birthDate: "2000-01-01",
          missingFields: ["terms"],
          completingExistingAccount: true,
        }),
      }),
    );
    render(<GoogleOnboardingPage />);

    await waitFor(() => expect(screen.getByRole("checkbox")).toBeVisible());
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nome de usuário")).not.toBeInTheDocument();
    expect(screen.queryByText("Aniversário")).not.toBeInTheDocument();
  });
});
