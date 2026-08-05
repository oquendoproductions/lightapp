import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileHeaderMenuPanel } from "../mapLazyAccountFlows.jsx";
import { PrivacyPolicyModal, TermsOfUseModal } from "../mapLazyAuthShell.jsx";
import { InfoMenuModal } from "../mapLazyInfoPanels.jsx";
import { setResolvedRuntimeUiIconMetaState } from "../mapUiIconRuntimeCoreSupport.js";
import { openExternalUrl } from "../platform/external.js";

vi.mock("../platform/external.js", () => ({
  openExternalUrl: vi.fn().mockResolvedValue(true),
}));

afterEach(() => {
  setResolvedRuntimeUiIconMetaState({});
});

describe("map legend, legal theme, and contact ownership", () => {
  it("shows navigation and uses the active queued asset domain icon", () => {
    const { container } = render(
      <InfoMenuModal
        open
        isAdmin
        onClose={() => {}}
        queuedAssetIconSrc="/pothole_icon.png"
        queuedAssetDomainKey="potholes"
      />,
    );

    expect(screen.getByText("Navigation location and heading")).toBeTruthy();
    expect(screen.getByText("Navigation:")).toBeTruthy();
    expect(screen.getByText("Queued mapped asset")).toBeTruthy();
    expect(container.querySelector('img[src="/pothole_icon.png"]')).toBeTruthy();
  });

  it("omits disabled map tools from the legend", () => {
    setResolvedRuntimeUiIconMetaState({
      satellite: { src: "/Icons/Map Tools/first-paint/satellite_icon.webp", enabled: false },
    });

    render(<InfoMenuModal open onClose={() => {}} />);

    expect(screen.queryByText("Map View:")).toBeNull();
    expect(screen.getByText("My Location:")).toBeTruthy();
  });

  it("passes the active theme into both embedded legal documents", () => {
    const { rerender } = render(
      <TermsOfUseModal open darkMode onClose={() => {}} />,
    );
    expect(screen.getByTitle("CityReport Terms of Service").getAttribute("src"))
      .toBe("/legal/terms.html?theme=dark");

    rerender(<PrivacyPolicyModal open darkMode={false} onClose={() => {}} />);
    expect(screen.getByTitle("CityReport Privacy Notice").getAttribute("src"))
      .toBe("/legal/privacy.html?theme=light");
  });

  it("keeps tenant contact with tenant actions and opens a separate CityReport email", () => {
    const onTenantContact = vi.fn();
    render(
      <MobileHeaderMenuPanel
        open
        onClose={() => {}}
        onContactUs={onTenantContact}
        onOpenAbout={() => {}}
        organizationDisplayName="Test City"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Contact Test City" }));
    expect(onTenantContact).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Contact CityReport.io" }));
    expect(openExternalUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^mailto:cityreport\.io@gmail\.com\?subject=CityReport\.io\+support$/),
    );
  });
});
