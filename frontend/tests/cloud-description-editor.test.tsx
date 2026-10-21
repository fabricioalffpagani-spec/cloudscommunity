import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CloudDescriptionEditor } from "../app/components/CloudDescriptionEditor";

afterEach(() => vi.unstubAllGlobals());

it("saves an updated description without changing title or duration", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ cloud: { description: "Atualizada" } }) });
  const onSaved = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<CloudDescriptionEditor cloudId="cloud 1" description="Original" onSaved={onSaved} />);
  fireEvent.change(screen.getByRole("textbox", { name: /Descrição/ }), { target: { value: "Atualizada" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar descrição" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Atualizada"));
  expect(fetchMock).toHaveBeenCalledWith("/api/clouds/cloud%201", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ description: "Atualizada" }) }));
});

it("shows an error and keeps the draft when saving fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Falha ao salvar" }) }));
  render(<CloudDescriptionEditor cloudId="1" description="Original" onSaved={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox", { name: /Descrição/ }), { target: { value: "Nova" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar descrição" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao salvar");
  expect(screen.getByRole("textbox", { name: /Descrição/ })).toHaveValue("Nova");
});
