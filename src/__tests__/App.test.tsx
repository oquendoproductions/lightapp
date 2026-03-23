import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

const scrollIntoViewMock = vi.fn();

describe("App", () => {
  beforeEach(() => {
    scrollIntoViewMock.mockReset();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
  });

  it("renders homepage sections in expected order", () => {
    const { container } = render(<App />);
    const sectionIds = Array.from(container.querySelectorAll("main > section")).map((section) => section.id);

    expect(sectionIds).toEqual([
      "hero",
      "problem-outcome",
      "capabilities",
      "pilot-proof",
      "workflow",
      "domains",
      "trust",
    ]);

    expect(screen.getByRole("heading", { name: /move from report intake to auditable city outcomes/i })).toBeInTheDocument();
  });

  it("scrolls to workflow from secondary CTA", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /view platform workflow/i }));

    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});
