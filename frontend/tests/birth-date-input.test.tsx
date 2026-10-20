import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { BirthDateInput } from "../app/components/BirthDateInput";

function Form() {
  const [value, setValue] = useState("");
  return <><label htmlFor="birthday">Aniversário</label><BirthDateInput id="birthday" value={value} onChange={setValue} /><output data-testid="date">{value}</output></>;
}

describe("typed birth date", () => {
  it("formats keyboard input and sends a valid date in the existing API format", () => {
    render(<Form />);
    const input = screen.getByLabelText("Aniversário");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "numeric");
    fireEvent.change(input, { target: { value: "29022000" } });
    expect(input).toHaveValue("29/02/2000");
    expect(screen.getByTestId("date")).toHaveTextContent("2000-02-29");
    fireEvent.change(input, { target: { value: "1999-12-31" } });
    expect(input).toHaveValue("31/12/1999");
    expect(screen.getByTestId("date")).toHaveTextContent("1999-12-31");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("rejects incomplete and impossible dates and allows correction", () => {
    render(<Form />);
    const input = screen.getByLabelText("Aniversário");
    fireEvent.change(input, { target: { value: "29022001" } });
    fireEvent.blur(input);
    expect(screen.getByText("Digite uma data válida no formato DD/MM/AAAA.")).toBeInTheDocument();
    expect(screen.getByTestId("date")).toBeEmptyDOMElement();
    fireEvent.change(input, { target: { value: "28022001" } });
    expect(screen.getByTestId("date")).toHaveTextContent("2001-02-28");
    expect(screen.queryByText("Digite uma data válida no formato DD/MM/AAAA.")).toBeNull();
    fireEvent.change(input, { target: { value: "28/02" } });
    expect(screen.getByTestId("date")).toBeEmptyDOMElement();
  });
});
