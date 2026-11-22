import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PasswordInput } from "@/components/ui/password-input";

describe("PasswordInput", () => {
  it("starts hidden with a show label and a password type", () => {
    render(<PasswordInput aria-label="Password" />);

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("reveals the password on click and flips the label to hide", () => {
    render(<PasswordInput aria-label="Password" defaultValue="secret123" />);

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("hides it again on a second click", () => {
    render(<PasswordInput aria-label="Password" />);

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("never submits the form when the toggle is clicked", () => {
    const onSubmit = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Password" />
      </form>,
    );

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("type", "button");
    fireEvent.click(toggle);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not steal focus from the field when pressed with the mouse", () => {
    render(<PasswordInput aria-label="Password" />);

    const toggle = screen.getByRole("button", { name: "Show password" });
    // fireEvent returns false when a handler called preventDefault.
    expect(fireEvent.mouseDown(toggle)).toBe(false);
  });

  it("each field toggles on its own", () => {
    render(
      <>
        <PasswordInput aria-label="Password" />
        <PasswordInput aria-label="Confirm password" />
      </>,
    );

    const toggles = screen.getAllByRole("button", { name: "Show password" });
    const firstToggle = toggles[0];
    if (!firstToggle) throw new Error("expected a toggle for the first field");
    fireEvent.click(firstToggle);

    // Exact labels only: the toggle buttons are also labelled "... password".
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("type", "password");
  });

  it("forwards props and the ref to the real input", () => {
    const ref = { current: null as HTMLInputElement | null };
    const onChange = vi.fn();
    render(
      <PasswordInput
        ref={ref}
        id="password"
        aria-label="Password"
        name="password"
        value="hunter2"
        onChange={onChange}
        autoComplete="new-password"
        placeholder="At least 8 characters"
        className="h-11"
      />,
    );

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("id", "password");
    expect(input).toHaveAttribute("name", "password");
    expect(input).toHaveAttribute("autocomplete", "new-password");
    expect(input).toHaveAttribute("placeholder", "At least 8 characters");
    expect(input.className).toContain("h-11");
    expect(input.className).toContain("pr-10");
    expect(ref.current).toBe(input);
  });
});
