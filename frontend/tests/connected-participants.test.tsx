import { render, screen } from "@testing-library/react";
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
  it("does not show an indicator without connections", () => {
    const { container } = render(<ConnectedParticipants participants={people} ids={new Set()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
