import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignupPage from "../app/signup/page";

afterEach(() => { window.history.replaceState({}, "", "/"); });

describe("signup invitation", () => {
  it("prefills and locks a code received by link", async () => {
    window.history.replaceState({}, "", "/signup?ref=ABC1234");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: true }) }));
    render(<SignupPage />);
    const field = await screen.findByLabelText(/Código de convite/i);
    expect(field).toHaveValue("ABC1234");
    expect(field).toHaveAttribute("readonly");
  });

  it("allows manual entry when there is no invitation link", async () => {
    window.history.replaceState({}, "", "/signup");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: true }) }));
    render(<SignupPage />);
    const field = await screen.findByLabelText(/Código de convite/i);
    expect(field).toHaveValue("");
    expect(field).not.toHaveAttribute("readonly");
  });
});
