import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SidebarMenuNav } from "@/components/dashboard/ui";

describe("SidebarMenuNav", () => {
  it("renders dedicated scroll-up and scroll-down buttons and scrolls the sidebar menu", () => {
    render(
      <SidebarMenuNav ariaLabel="Owner dashboard navigation">
        <div>Overview</div>
        <div>Courses</div>
        <div>Payments</div>
      </SidebarMenuNav>,
    );

    const nav = screen.getByRole("navigation", { name: "Owner dashboard navigation" });
    const upBtn = screen.getByRole("button", { name: "Scroll sidebar menu up" });
    const downBtn = screen.getByRole("button", { name: "Scroll sidebar menu down" });

    let currentTop = 0;
    Object.defineProperty(nav, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(nav, "scrollHeight", { configurable: true, value: 600 });
    Object.defineProperty(nav, "scrollTop", {
      configurable: true,
      get: () => currentTop,
      set: (v: number) => {
        currentTop = Math.max(0, Math.min(400, v));
      },
    });
    nav.scrollBy = ((options: ScrollToOptions | number, y?: number) => {
      const delta = typeof options === "number" ? (y ?? 0) : (options.top ?? 0);
      currentTop = Math.max(0, Math.min(400, currentTop + delta));
    }) as typeof nav.scrollBy;

    fireEvent.scroll(nav);
    expect(upBtn).toBeDisabled();
    expect(downBtn).not.toBeDisabled();

    fireEvent.click(downBtn);
    expect(currentTop).toBe(180);
    expect(upBtn).not.toBeDisabled();
    expect(downBtn).not.toBeDisabled();

    fireEvent.click(upBtn);
    expect(currentTop).toBe(0);
    expect(upBtn).toBeDisabled();
  });
});