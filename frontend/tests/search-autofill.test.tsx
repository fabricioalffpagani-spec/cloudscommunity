import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchModal } from "../app/components/SearchModal";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../app/components/session-user", () => ({
  useSessionUser: () => ({ user: null }),
}));

describe("ordinary search input", () => {
  it("identifies the field as search and opts out of credential autofill", () => {
    render(<SearchModal onClose={vi.fn()} />);
    const search = screen.getByRole("searchbox", {
      name: "Buscar Clouds e pessoas",
    });
    expect(search).toHaveAttribute("type", "search");
    expect(search).toHaveAttribute("autocomplete", "off");
    expect(search).toHaveAttribute("inputmode", "search");
    expect(search).toHaveAttribute("data-lpignore", "true");
    expect(search).toHaveAttribute("data-1p-ignore", "true");
  });
});
