import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavigationTutorial } from "../app/components/MobileNavigationTutorial";

const state = vi.hoisted(() => ({ pathname: "/", onboarding: false }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname, useSearchParams: () => new URLSearchParams("welcome=1") }));
vi.mock("../app/components/session-user", () => ({ useSessionUser: () => ({ user: { id: "new-user", interestsOnboardingRequired: state.onboarding } }) }));

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
});
afterEach(() => { state.pathname = "/"; state.onboarding = false; vi.unstubAllGlobals(); });

describe("mobile welcome tutorial", () => {
  it("immediately explains the double tap on Talk and does not repeat after dismissal", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const first = render(<MobileNavigationTutorial />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Para abrir o chat, toque duas vezes rapidamente no título da conversa.");
    expect(screen.getByRole("dialog")).toHaveTextContent("Boas-vindas ao Clouds!");
    expect(screen.queryByRole("button", { name: "Próximo" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    first.unmount();
    render(<MobileNavigationTutorial />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the Read explanation on its first visit, independently of Talk", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const view = render(<MobileNavigationTutorial />);
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    state.pathname = "/read";
    view.rerender(<MobileNavigationTutorial />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Leia conversas que já aconteceram");
    fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    view.unmount();
    render(<MobileNavigationTutorial />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("waits for onboarding and a supported page", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    state.onboarding = true;
    const view = render(<MobileNavigationTutorial />);
    expect(screen.queryByRole("dialog")).toBeNull();
    state.onboarding = false;
    state.pathname = "/cloud/1";
    view.rerender(<MobileNavigationTutorial />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the desktop instructions and Read explanation only once each", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const view = render(<MobileNavigationTutorial />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Para abrir o chat, clique duas vezes no título da conversa.");
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    state.pathname = "/read";
    view.rerender(<MobileNavigationTutorial />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Leia conversas que já aconteceram");
    fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    view.unmount();
    render(<MobileNavigationTutorial />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
