import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudTitleMarquee } from "../app/components/CloudTitleMarquee";

afterEach(() => vi.restoreAllMocks());

describe("Cloud title marquee", () => {
  it("keeps a fitting title still, including after a viewport resize", () => {
    let availableWidth = 300;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      () => availableWidth,
    );
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
      () => 120,
    );
    const { container } = render(<CloudTitleMarquee title="Título curto" />);
    expect(
      screen.getByRole("heading", { name: "Título curto" }),
    ).not.toHaveClass("cloud-title-marquee");
    expect(container.querySelectorAll("h1 span")).toHaveLength(1);
    availableWidth = 200;
    fireEvent.resize(window);
    expect(container.querySelectorAll("h1 span")).toHaveLength(1);
  });

  it.each([
    "Título bastante longo",
    "Uma Cloud com um título extremamente longo que excede até mesmo o desktop",
  ])(
    "animates only overflowing text and repeats it seamlessly: %s",
    (title) => {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
        () => 180,
      );
      vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
        () => 600,
      );
      const { container } = render(<CloudTitleMarquee title={title} />);
      expect(screen.getByRole("heading", { name: title })).toHaveClass(
        "cloud-title-marquee",
      );
      expect(container.querySelectorAll("h1 span")).toHaveLength(2);
      expect(container.querySelector("h1 span:first-child")).toHaveClass(
        "inline-block",
      );
      expect(
        container.querySelector('h1 span[aria-hidden="true"]'),
      ).toHaveTextContent(title);
      expect(container.querySelector("div")).toHaveClass(
        "flex-1",
        "overflow-hidden",
      );
    },
  );

  it("starts the marquee when a smaller mobile viewport makes the same title overflow", () => {
    let availableWidth = 800;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      () => availableWidth,
    );
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
      () => 400,
    );
    const { container } = render(
      <CloudTitleMarquee title="Título que cabe no desktop" />,
    );
    expect(container.querySelector("h1")).not.toHaveClass(
      "cloud-title-marquee",
    );
    availableWidth = 180;
    fireEvent.resize(window);
    expect(container.querySelector("h1")).toHaveClass("cloud-title-marquee");
  });
});
