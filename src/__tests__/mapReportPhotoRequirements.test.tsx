import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { RUNTIME_DOMAIN_META } from "../lib/mapRuntimeDomainMeta.js";
import {
  resolveRuntimeDomainReportImageRequiredShared,
} from "../lib/mapRuntimeDomainReportConfigSupport.js";
import { DomainReportModal } from "../mapLazyReportFlow.jsx";

const DOMAIN_KEY = "tenant_photo_test";

function renderReportModal({ imageFile = null, imagePreviewUrl = "" } = {}) {
  return render(
    <DomainReportModal
      open
      domain={DOMAIN_KEY}
      domainLabel="Tenant Photo Test"
      locationLabel="Map location"
      note=""
      setNote={vi.fn()}
      issueValue=""
      setIssueValue={vi.fn()}
      typeSelections={{}}
      setTypeSelections={vi.fn()}
      acknowledgements={{}}
      setAcknowledgements={vi.fn()}
      imageFile={imageFile}
      imagePreviewUrl={imagePreviewUrl}
      setImageFile={vi.fn()}
      saving={false}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
      btnPrimary={{}}
      btnSecondary={{}}
    />,
  );
}

afterEach(() => {
  RUNTIME_DOMAIN_META.allowReportImagesByDomain.delete(DOMAIN_KEY);
  RUNTIME_DOMAIN_META.reportImageRequiredByDomain.delete(DOMAIN_KEY);
});

describe("tenant report photo requirements", () => {
  it("only requires a report photo when the tenant allows photos", () => {
    RUNTIME_DOMAIN_META.reportImageRequiredByDomain.set(DOMAIN_KEY, true);
    expect(resolveRuntimeDomainReportImageRequiredShared(DOMAIN_KEY)).toBe(false);

    RUNTIME_DOMAIN_META.allowReportImagesByDomain.set(DOMAIN_KEY, true);
    expect(resolveRuntimeDomainReportImageRequiredShared(DOMAIN_KEY)).toBe(true);
  });

  it("blocks submission until a required photo is attached", () => {
    RUNTIME_DOMAIN_META.allowReportImagesByDomain.set(DOMAIN_KEY, true);
    RUNTIME_DOMAIN_META.reportImageRequiredByDomain.set(DOMAIN_KEY, true);

    const view = renderReportModal();
    const photoInput = screen.getByLabelText("Choose report photo") as HTMLInputElement;
    expect(photoInput.required).toBe(true);
    expect(screen.getByRole("button", { name: "Report" })).toBeDisabled();

    const photo = new File(["photo"], "report.jpg", { type: "image/jpeg" });
    view.rerender(
      <DomainReportModal
        open
        domain={DOMAIN_KEY}
        domainLabel="Tenant Photo Test"
        locationLabel="Map location"
        note=""
        setNote={vi.fn()}
        issueValue=""
        setIssueValue={vi.fn()}
        typeSelections={{}}
        setTypeSelections={vi.fn()}
        acknowledgements={{}}
        setAcknowledgements={vi.fn()}
        imageFile={photo}
        imagePreviewUrl="blob:report-photo"
        setImageFile={vi.fn()}
        saving={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        btnPrimary={{}}
        btnSecondary={{}}
      />,
    );

    expect(screen.getByRole("button", { name: "Report" })).toBeEnabled();
    const removeImageButton = screen.getByRole("button", { name: "Remove image" });
    expect(screen.getByLabelText("Choose report photo").parentElement).toBe(removeImageButton.parentElement);
    expect(removeImageButton.parentElement).toHaveStyle({
      gridTemplateColumns: "minmax(0, 1fr) auto",
    });
    expect(screen.getByAltText("Report attachment preview")).toHaveStyle({
      maxWidth: "100%",
      maxHeight: "112px",
      objectFit: "contain",
    });
  });
});
