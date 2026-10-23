import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrendingTopicSuggestions } from "../app/components/TrendingTopicSuggestions";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sugestões de temas em alta", () => {
  it.each([375, 1280])("mostra no máximo cinco temas e preenche o título em %ipx", async (width) => {
    vi.stubGlobal("innerWidth", width);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        topics: [
          { id: "tecnologia", name: "Tecnologia" },
          { id: "esportes", name: "Esportes" },
          { id: "musica", name: "Música" },
          { id: "games", name: "Games" },
          { id: "filmes_series", name: "Filmes & Séries" },
          { id: "extra", name: "Não deve aparecer" },
        ],
      }),
    }));
    const onSelect = vi.fn();

    render(<TrendingTopicSuggestions selectedTitle="" onSelect={onSelect} />);

    await waitFor(() => expect(screen.getByRole("region", { name: "Temas em alta" })).toBeInTheDocument());
    expect(screen.getByText("Em alta:")).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.queryByText("Não deve aparecer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tecnologia" }));
    expect(onSelect).toHaveBeenCalledWith({ id: "tecnologia", name: "Tecnologia" });
  });
});
