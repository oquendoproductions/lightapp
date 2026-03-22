import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LeadForm } from "../components/LeadForm";
import type { LeadCaptureRequest, LeadCaptureResponse } from "../lib/types";

describe("LeadForm", () => {
  it("shows validation errors on invalid submit", async () => {
    const user = userEvent.setup();
    render(<LeadForm submitter={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /request pilot demo/i }));

    expect(screen.getByText(/review the highlighted fields/i)).toBeInTheDocument();
  });

  it("submits valid payload and shows success panel", async () => {
    const user = userEvent.setup();
    const submitter = vi
      .fn<(payload: LeadCaptureRequest) => Promise<LeadCaptureResponse>>()
      .mockResolvedValue({ ok: true, leadId: "lead_1", message: "We will email you within one business day." });

    render(<LeadForm submitter={submitter} />);

    await user.type(screen.getByLabelText(/full name/i), "Alex Rivera");
    await user.type(screen.getByLabelText(/work email/i), "Alex@City.gov");
    await user.type(screen.getByLabelText(/city or agency/i), "Ashtabula Public Works");
    await user.type(screen.getByLabelText(/role\/title/i), "Operations Director");
    await user.selectOptions(screen.getByLabelText(/top infrastructure priority/i), "potholes");
    await user.type(screen.getByLabelText(/notes/i), "Pilot focus on pothole triage flow.");

    await user.click(screen.getByRole("button", { name: /request pilot demo/i }));

    expect(submitter).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/request received/i)).toBeInTheDocument();
    expect(screen.getByText(/one business day/i)).toBeInTheDocument();
  });
});
