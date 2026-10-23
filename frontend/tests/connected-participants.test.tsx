import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectedParticipants } from "../app/components/ConnectedParticipants";

describe("connected participants", () => {
  const people = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `Pessoa ${i}`, username: `pessoa${i}`, avatarUrl: null }));
  it("shows active connections and responsive overflow counts", () => {
    render(<ConnectedParticipants participants={people} ids={new Set(people.slice(0, 7).map((p) => p.id))} />);
    expect(screen.getByText("estão participando dessa cloud")).toBeInTheDocument();
    expect(screen.getByText("+3")).toHaveClass("md:hidden");
    expect(screen.getByText("+1")).toHaveClass("md:flex");
    expect(screen.queryByTitle("Pessoa 7")).not.toBeInTheDocument();
  });
  it.each([true, false])("uses singular for one person and opens their profile, archived=%s", (archived) => {
    render(<ConnectedParticipants participants={people.slice(0, 2)} ids={new Set(["p0"])} archived={archived} />);
    expect(screen.getByText(archived ? "participou dessa cloud" : "está participando dessa cloud")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver 1 pessoa em comum" }));
    const dialog = screen.getByRole("dialog", { name: "Pessoas em comum" });
    expect(within(dialog).getByText(archived ? "1 pessoa participou dessa cloud" : "1 pessoa está participando dessa cloud")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Pessoa 0/ })).toHaveAttribute("href", "/users/p0");
    expect(within(dialog).queryByText("Pessoa 1")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("updates the open list and count as live participants change", () => {
    const ids = new Set(["p0", "p1"]);
    const view = render(<ConnectedParticipants participants={people.slice(0, 1)} ids={ids} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver 1 pessoa em comum" }));
    view.rerender(<ConnectedParticipants participants={people.slice(0, 3)} ids={ids} />);
    expect(screen.getByText("2 pessoas estão participando dessa cloud")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getAllByRole("link")).toHaveLength(2);
    view.rerender(<ConnectedParticipants participants={[]} ids={ids} />);
    expect(screen.getByText("0 pessoas estão participando dessa cloud")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("does not show an indicator without connections", () => {
    const { container } = render(<ConnectedParticipants participants={people} ids={new Set()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
