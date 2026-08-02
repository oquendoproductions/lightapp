import React from "react";

export default function MapTabLoadingSurface({
  pageTopInset = "0px",
  pageBottomInset = "0px",
}) {
  return (
    <div
      aria-hidden="true"
      data-testid="map-tab-loading-surface"
      style={{
        position: "fixed",
        top: pageTopInset,
        right: 0,
        bottom: pageBottomInset,
        left: 0,
        zIndex: 1504,
        background: "var(--sl-ui-modal-bg)",
        color: "var(--sl-ui-text)",
        pointerEvents: "none",
      }}
    />
  );
}
