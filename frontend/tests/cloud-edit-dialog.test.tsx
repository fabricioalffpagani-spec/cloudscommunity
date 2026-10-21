import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CloudEditDialog, type EditableCloud } from "../app/components/CloudEditDialog";

const cloud: EditableCloud = { id: "cloud-1", title: "Original", duration: "10min", description: "Antes", editCount: 2 };
afterEach(() => vi.unstubAllGlobals());

it("updates title, duration and description and returns the saved Cloud", async () => {
  const saved = { ...cloud, title: "Novo título", duration: "30min", description: "Depois", editCount: 3 };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ cloud: saved }) });
  const onSaved = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<CloudEditDialog cloud={cloud} onSaved={onSaved} onClose={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox", { name: /Título/ }), { target: { value: saved.title } });
  fireEvent.change(screen.getByRole("combobox", { name: "Duração" }), { target: { value: saved.duration } });
  fireEvent.change(screen.getByRole("textbox", { name: /Descrição/ }), { target: { value: saved.description } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar edição" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
  expect(fetchMock).toHaveBeenCalledWith("/api/clouds/cloud-1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: saved.title, duration: saved.duration, description: saved.description }) }));
});

it("still allows editing the description when the title and duration limit is reached", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ cloud: { ...cloud, editCount: 3, description: "Outra" } }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<CloudEditDialog cloud={{ ...cloud, editCount: 3 }} onSaved={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByRole("textbox", { name: /Título/ })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "Duração" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: /Descrição/ }), { target: { value: "Outra" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar edição" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/clouds/cloud-1", expect.objectContaining({ body: JSON.stringify({ description: "Outra" }) })));
});

it("shows the server error without closing the editor", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Erro ao salvar" }) }));
  render(<CloudEditDialog cloud={cloud} onSaved={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Salvar edição" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Erro ao salvar");
  expect(screen.getByRole("dialog", { name: "Editar Cloud" })).toBeInTheDocument();
});
