import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchModal } from "../app/components/SearchModal";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../app/components/session-user", () => ({
  useSessionUser: () => ({ user: null }),
}));

describe("ordinary search field", () => {
  it("uses a single-line textarea and opts out of credential autofill", () => {
    render(<SearchModal onClose={vi.fn()} />);
    const search = screen.getByRole("textbox", {
      name: "Buscar Clouds e pessoas",
    });
    expect(search.tagName).toBe("TEXTAREA");
    expect(search).toHaveAttribute("autocomplete", "off");
    expect(search).toHaveAttribute("inputmode", "text");
    expect(search).toHaveAttribute("rows", "1");
    expect(search).toHaveAttribute("aria-multiline", "false");
    expect(search).toHaveAttribute("data-lpignore", "true");
    expect(search).toHaveAttribute("data-1p-ignore", "true");
  });
});
