import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AlertsWindow, EventsWindow } from "../mapLazyResidentFeeds.jsx";

function feedHeaderFor(title: string) {
  const titleElement = screen.getByText(title);
  return titleElement.parentElement?.parentElement?.parentElement?.parentElement;
}

describe("resident feed page layout", () => {
  it("keeps the Alerts and Events headers in grid flow above the scrollable content", () => {
    const commonProps = {
      open: true,
      onClose: vi.fn(),
      loading: false,
      error: "",
      darkMode: false,
      pageMode: true,
      pageTopInset: "0px",
      pageBottomInset: "0px",
      canCreate: false,
      canEdit: false,
      newItemKeys: [],
      focusItemId: "",
      mapCommunityFeedItemReadKey: () => "",
    };

    const { unmount } = render(<AlertsWindow {...commonProps} alerts={[]} />);
    const alertsHeader = feedHeaderFor("Location Alerts");
    expect(alertsHeader).not.toHaveStyle({ position: "absolute" });
    expect(alertsHeader).not.toHaveStyle({ inset: "0" });
    unmount();

    render(
      <EventsWindow
        {...commonProps}
        events={[]}
        sortResidentEvents={(items) => items}
        filterActiveResidentEvents={(items) => items}
      />,
    );
    const eventsHeader = feedHeaderFor("Location Events");
    expect(eventsHeader).not.toHaveStyle({ position: "absolute" });
    expect(eventsHeader).not.toHaveStyle({ inset: "0" });
  });
});
