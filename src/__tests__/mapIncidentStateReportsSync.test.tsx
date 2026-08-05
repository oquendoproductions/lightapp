import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  normalizeIncidentStateHistoryRowsShared,
  resolveIncidentStateForReportsShared,
} from "../lib/mapIncidentStateReportSupport.js";
import { buildIncidentAllReportsModalPayloadShared } from "../lib/mapDeferredIncidentPopupFollowupSupport.js";
import { OpenReportsSubmittedReportsModal } from "../mapLazyOpenReportsDialogs.jsx";
import { AllReportsModal } from "../mapLazyReportInspectors.jsx";

describe("incident state synchronization in reports", () => {
  it("builds marker report history with the canonical incident key", () => {
    const payload = buildIncidentAllReportsModalPayloadShared({
      popupInfo: {
        domainKey: "potholes",
        incidentId: "PH8167463198",
        displayId: "PH8167463198",
        rows: [],
      },
      marker: {
        incident_id: "pothole:be085a6a-cb0e-498e-af31-5903e7303a52",
        display_id: "PH8167463198",
      },
      domainKey: "potholes",
    }, {
      normalizeDomainKeyOrSlug: (value: string) => value,
      getIncidentDisplaySupportDeps: () => ({}),
    });

    expect(payload?.options?.incidentKey).toBe(
      "potholes:pothole:be085a6a-cb0e-498e-af31-5903e7303a52",
    );
  });

  it("prefers the authoritative incident snapshot over the original report timeline", () => {
    const result = resolveIncidentStateForReportsShared({
      snapshot: {
        state: "confirmed",
        last_changed_at: "2026-07-19T23:38:00.000Z",
      },
      timelineState: {
        state: "reported",
        fixedAtIso: "",
        lastChangedAtIso: "2026-07-05T05:49:00.000Z",
      },
    });

    expect(result).toEqual({
      state: "confirmed",
      fixedAtIso: "",
      lastChangedAtIso: "2026-07-19T23:38:00.000Z",
    });
  });

  it("lists state updates separately from submitted reports", () => {
    const stateEvents = normalizeIncidentStateHistoryRowsShared([{
      event_id: 42,
      previous_state: "reported",
      new_state: "confirmed",
      source: "admin",
      changed_at: "2026-07-19T23:38:00.000Z",
      metadata: {
        source: "map_admin_status_update",
        note: "Crew verified the pothole.",
        image_url: "https://example.com/confirmed.jpg",
      },
    }]);

    render(
      <OpenReportsSubmittedReportsModal
        open
        row={{
          incident_id: "PH8234662171",
          rows: [{
            report_id: "report-1",
            report_number: "PH-R00000001",
            submitted_at: "2026-07-05T05:49:00.000Z",
            notes: "Original resident report",
          }],
        }}
        rowDomainKey="potholes"
        modalTitleLabel="Pothole"
        modalTitleValue="PH8234662171"
        stateEvents={stateEvents}
        reportNumberForRow={(row) => row.report_number}
        resolveItemDomainKey={() => "potholes"}
        resolveIssueLabel={() => "Pothole"}
      />,
    );

    expect(screen.getByText("Incident History")).toBeTruthy();
    expect(screen.getByText("Previous State:").parentElement).toHaveTextContent("Reported");
    expect(screen.getByText("New State:").parentElement).toHaveTextContent("Confirmed");
    expect(screen.getByText("Crew verified the pothole.")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "View Image" })[0]).toHaveAttribute(
      "href",
      "https://example.com/confirmed.jpg",
    );
    expect(screen.getByText("Submitted Reports")).toBeTruthy();
    expect(screen.getByText("PH-R00000001")).toBeTruthy();
  });

  it("keeps admin lifecycle updates even when the metadata source tag is absent", () => {
    const stateEvents = normalizeIncidentStateHistoryRowsShared([{
      event_id: 43,
      previous_state: "reported",
      new_state: "confirmed",
      source: "admin",
      changed_at: "2026-07-20T00:14:00.000Z",
      metadata: {
        note: "Verified from the map.",
        image_url: "https://example.com/map-update.jpg",
      },
    }]);

    expect(stateEvents).toHaveLength(1);
    expect(stateEvents[0]).toMatchObject({
      newState: "confirmed",
      note: "Verified from the map.",
      imageUrl: "https://example.com/map-update.jpg",
    });
  });

  it("normalizes resident Is fixed confirmations as history records without changing lifecycle state", () => {
    const events = normalizeIncidentStateHistoryRowsShared([{
      history_kind: "repair_confirmation",
      event_id: 91,
      previous_state: null,
      new_state: null,
      changed_by: "8d84a7c0-8d44-4eaa-a410-cc88f397c220",
      changed_by_name: "Resident User",
      source: "user",
      changed_at: "2026-07-20T03:30:00.000Z",
      metadata: { source: "resident_repair_confirmation" },
    }]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "repair_confirmation",
      newState: "",
      changedByName: "Resident User",
    });
  });

  it("shows Is fixed confirmations in both shared incident-history views", () => {
    const repairEvent = {
      kind: "repair_confirmation",
      eventId: "92",
      changedBy: "8d84a7c0-8d44-4eaa-a410-cc88f397c220",
      changedByName: "Resident User",
      changedAt: "2026-07-20T03:35:00.000Z",
    };

    const { unmount } = render(
      <OpenReportsSubmittedReportsModal
        open
        row={{ incident_id: "PH8234662171", rows: [] }}
        rowDomainKey="potholes"
        modalTitleLabel="Pothole"
        modalTitleValue="PH8234662171"
        stateEvents={[repairEvent]}
        reportNumberForRow={() => ""}
        resolveItemDomainKey={() => "potholes"}
        resolveIssueLabel={() => "Pothole"}
      />,
    );

    expect(screen.getByText("Incident History")).toBeTruthy();
    expect(screen.getByText("Marked fixed")).toBeTruthy();
    expect(screen.getByText("Submitted by:").parentElement).toHaveTextContent("Resident User");
    unmount();

    render(
      <AllReportsModal
        open
        title="PH8234662171 Reports"
        reportRows={[]}
        stateEvents={[repairEvent]}
        onClose={() => {}}
        isWorkingReportType={() => false}
      />,
    );

    expect(screen.getByText("Marked fixed")).toBeTruthy();
    expect(screen.getByText("Submitted by:").parentElement).toHaveTextContent("Resident User");
  });

  it("shows state updates in the map all-reports history with the shared image format", () => {
    render(
      <AllReportsModal
        open
        title="PH8167463198 Reports"
        reportRows={[]}
        stateEvents={[{
          eventId: "44",
          previousState: "reported",
          newState: "confirmed",
          changedAt: "2026-07-20T00:14:00.000Z",
          note: "Crew confirmed the incident.",
          imageUrl: "https://example.com/state-update.jpg",
        }]}
        onClose={() => {}}
        isWorkingReportType={() => false}
      />,
    );

    expect(screen.getByText("State updated")).toBeTruthy();
    expect(screen.getByText("New State:").parentElement).toHaveTextContent("Confirmed");
    expect(screen.getByText("Crew confirmed the incident.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View Image" })).toHaveAttribute(
      "href",
      "https://example.com/state-update.jpg",
    );
  });
});
