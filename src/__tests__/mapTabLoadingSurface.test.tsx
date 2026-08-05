import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MapTabLoadingSurface from "../mapTabLoadingSurface.jsx";

describe("MapTabLoadingSurface", () => {
  it("covers the tab content area with the active theme background", () => {
    render(
      <MapTabLoadingSurface
        pageTopInset="72px"
        pageBottomInset="60px"
      />
    );

    const surface = screen.getByTestId("map-tab-loading-surface");
    expect(surface).toHaveStyle({
      position: "fixed",
      top: "72px",
      bottom: "60px",
      background: "var(--sl-ui-modal-bg)",
    });
  });
});
