import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CloudFeedNavigation } from "../app/components/CloudFeedNavigation";

describe("CloudFeedNavigation", () => {
  it("keeps the previous control disabled at the beginning and navigates once", () => {
    const onNavigate = vi.fn();
    render(
      <CloudFeedNavigation
        activeIndex={0}
        cloudCount={3}
        onNavigate={onNavigate}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Cloud anterior" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima Cloud" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("keeps the next control disabled at the end", () => {
    render(
      <CloudFeedNavigation
        activeIndex={2}
        cloudCount={3}
        onNavigate={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Próxima Cloud" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Cloud anterior" }),
    ).toBeEnabled();
  });

  it("does not render for a single Cloud", () => {
    render(
      <CloudFeedNavigation
        activeIndex={0}
        cloudCount={1}
        onNavigate={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId("cloud-feed-navigation"),
    ).not.toBeInTheDocument();
  });
});
