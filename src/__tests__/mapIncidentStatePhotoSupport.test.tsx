import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  buildIncidentStatusDialogCompatOptionsShared,
  emitIncidentStateChangeShared,
  resolveIncidentStatusDialogCompatTargetShared,
  submitPendingIncidentActionShared,
} from "../lib/mapDeferredIncidentAdminSupport.js";
import { OpenReportsIncidentStateUpdateModal } from "../mapLazyOpenReportsDialogs.jsx";

describe("incident state update photos", () => {
  it("uses the marker's canonical pothole identity instead of its display label", () => {
    const normalizeDomainKeyOrSlug = (value: string) => value;
    const getIncidentDomainHelper = () => ({
      buildStatusDialogCompatMode: "lookup_official_marker",
      buildStatusDialogCompatCompatMarkerIncidentField: "pothole_id",
      buildStatusDialogCompatExternalIdFields: ["ph_id"],
      buildStatusDialogCompatCompatMarkerExternalIdField: "ph_id",
      resolveStatusDialogCompatTargetMode: "canonical_incident_official",
      resolveStatusDialogCompatTargetIncidentFields: ["incident_id", "pothole_id"],
    });
    const lookupIncidentIdForDomain = (_domainKey: string, incidentId: string) => (
      String(incidentId || "").replace(/^pothole:/, "")
    );
    const compatOptions = buildIncidentStatusDialogCompatOptionsShared("potholes", {
      incidentId: "PH8167463198",
      marker: {
        incident_id: "pothole:be085a6a-cb0e-498e-af31-5903e7303a52",
        ph_id: "PH8167463198",
        lat: 41.62,
        lng: -80.82,
      },
    }, {
      normalizeDomainKeyOrSlug,
      getIncidentDomainHelper,
      lookupIncidentIdForDomain,
      incidentDomainBuildCoordsDisplayId: () => "",
    });

    expect(compatOptions?.compatMarker).toMatchObject({
      incident_id: "be085a6a-cb0e-498e-af31-5903e7303a52",
      pothole_id: "be085a6a-cb0e-498e-af31-5903e7303a52",
      ph_id: "PH8167463198",
    });

    const target = resolveIncidentStatusDialogCompatTargetShared("potholes", {
      incidentId: "PH8167463198",
      compatMarker: compatOptions?.compatMarker,
    }, {
      resolveIncidentDomainHelperEntry: () => ({ domainKey: "potholes", helper: getIncidentDomainHelper() }),
      lookupIncidentIdForDomain,
      incidentDomainCanonicalIncidentId: (_domainKey: string, row: { incident_id: string }) => (
        `pothole:${row.incident_id}`
      ),
    });

    expect(target?.lightId).toBe("pothole:be085a6a-cb0e-498e-af31-5903e7303a52");
  });

  it("persists a non-fixed pothole update with the canonical target", async () => {
    const pinBytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode("platform-pin:user-1:1234"),
    );
    const pinHash = Array.from(new Uint8Array(pinBytes))
      .map((part) => part.toString(16).padStart(2, "0"))
      .join("");
    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: { pin_hash: pinHash }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    };
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const setIncidentStateByKey = vi.fn((updater) => updater({}));

    const saved = await submitPendingIncidentActionShared({
      supabase: {
        from: vi.fn(() => query),
        rpc,
      },
      tenantKey: "testcity1",
      sessionUserId: "user-1",
      lid: "PH8167463198",
      domainKey: "potholes",
      compatTarget: {
        lightId: "pothole:be085a6a-cb0e-498e-af31-5903e7303a52",
        isOfficial: true,
      },
      nextState: "confirmed",
      currentState: "reported",
      pin: "1234",
      isMissingRelationError: () => false,
      setPendingIncidentStatusError: vi.fn(),
      setMarkFixedSubmitting: vi.fn(),
      setIncidentStateByKey,
      incidentSnapshotKey: (domainKey: string, incidentId: string) => `${domainKey}:${incidentId}`,
      openConfiguredNotice: vi.fn(),
      resetMarkFixedDialogState: vi.fn(),
    });

    expect(saved).toBe(true);
    expect(rpc).toHaveBeenCalledWith("emit_incident_state_change_tenant", expect.objectContaining({
      p_incident_id: "pothole:be085a6a-cb0e-498e-af31-5903e7303a52",
      p_new_state: "confirmed",
    }));
    expect(setIncidentStateByKey).toHaveBeenCalled();
  });

  it("offers photo collection for every state transition", () => {
    const onImageFileChange = vi.fn();
    render(
      <OpenReportsIncidentStateUpdateModal
        open
        currentStateLabel="Reported"
        stateOptions={[{ value: "confirmed", label: "Confirmed" }]}
        nextState="confirmed"
        onImageFileChange={onImageFileChange}
      />,
    );

    const input = screen.getByLabelText("Photo (optional)") as HTMLInputElement;
    const photo = new File(["photo"], "confirmed.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [photo] } });

    expect(input.accept).toBe("image/*");
    expect(onImageFileChange).toHaveBeenCalledWith(photo);
  });

  it("keeps the state-update preview compact without cropping the image", () => {
    render(
      <OpenReportsIncidentStateUpdateModal
        open
        currentStateLabel="Reported"
        stateOptions={[{ value: "confirmed", label: "Confirmed" }]}
        nextState="confirmed"
        imageFile={new File(["photo"], "confirmed.jpg", { type: "image/jpeg" })}
        imagePreviewUrl="blob:confirmed-photo"
      />,
    );

    expect(screen.getByAltText("State update photo preview")).toHaveStyle({
      maxWidth: "100%",
      maxHeight: "112px",
      objectFit: "contain",
    });
  });

  it("persists uploaded photo metadata with non-fixed state events", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const imageUpload = {
      publicUrl: "https://example.com/confirmed.jpg",
      path: "testcity1/downed_tree/incident-actions/confirmed.jpg",
      contentType: "image/jpeg",
      fileName: "confirmed.jpg",
      capturedAt: "2026-07-19T18:00:00.000Z",
    };

    const result = await emitIncidentStateChangeShared({
      supabase: { rpc },
      tenantKey: "testcity1",
      incidentId: "DT0000000940",
      domainKey: "downed_tree",
      nextState: "confirmed",
      changedBy: "user-1",
      noteText: "Crew verified the incident.",
      previousState: "reported",
      imageUpload,
    });

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("emit_incident_state_change_tenant", expect.objectContaining({
      p_metadata: expect.objectContaining({
        image_url: imageUpload.publicUrl,
        image_path: imageUpload.path,
        image_mime_type: imageUpload.contentType,
        image_file_name: imageUpload.fileName,
        captured_at: imageUpload.capturedAt,
      }),
    }));
  });
});
