import { describe, expect, it, vi } from "vitest";

import {
  handleMapDragStartRuntimeShared,
  handleMapZoomChangedRuntimeShared,
} from "../lib/mapDeferredMapInteractionRuntime";
import { processGoogleMapTapRuntimeShared } from "../lib/mapDeferredMapTapRuntime";
import {
  MARKER_SELECTION_MIN_ZOOM,
  focusMapMarkerSelectionShared,
} from "../lib/mapMarkerSelectionInteractionSupport";

describe("map marker selection interactions", () => {
  it("centers a marker and raises zoom to 17 when below the selection minimum", () => {
    const panTo = vi.fn();
    const setZoom = vi.fn();
    const setMapCenter = vi.fn();
    const setMapZoom = vi.fn();
    const mapZoomRef = { current: 12 };

    const focused = focusMapMarkerSelectionShared({ lat: 41.6, lng: -80.8 }, {
      mapRef: { current: { getZoom: () => 12, panTo, setZoom } },
      mapZoomRef,
      suppressMapClickRef: { current: { until: 0 } },
    }, {
      setMapCenter,
      setMapZoom,
    });

    expect(focused).toBe(true);
    expect(panTo).toHaveBeenCalledWith({ lat: 41.6, lng: -80.8 });
    expect(setZoom).toHaveBeenCalledWith(MARKER_SELECTION_MIN_ZOOM);
    expect(setMapCenter).toHaveBeenCalledWith({ lat: 41.6, lng: -80.8 });
    expect(setMapZoom).toHaveBeenCalledWith(MARKER_SELECTION_MIN_ZOOM);
    expect(mapZoomRef.current).toBe(MARKER_SELECTION_MIN_ZOOM);
  });

  it("centers a marker without reducing a zoom level above 17", () => {
    const panTo = vi.fn();
    const setZoom = vi.fn();
    const setMapZoom = vi.fn();

    focusMapMarkerSelectionShared({ lat: 41.6, lng: -80.8 }, {
      mapRef: { current: { getZoom: () => 19, panTo, setZoom } },
      mapZoomRef: { current: 19 },
    }, {
      setMapCenter: vi.fn(),
      setMapZoom,
    });

    expect(panTo).toHaveBeenCalledWith({ lat: 41.6, lng: -80.8 });
    expect(setZoom).not.toHaveBeenCalled();
    expect(setMapZoom).not.toHaveBeenCalled();
  });

  it("closes marker popups when a map drag begins", () => {
    const closeAnyPopup = vi.fn();

    handleMapDragStartRuntimeShared({}, {
      beginMapInteraction: vi.fn(),
      closeAnyPopup,
    });

    expect(closeAnyPopup).toHaveBeenCalledTimes(1);
  });

  it("keeps marker popups open when zoom changes", () => {
    const closeAnyPopup = vi.fn();

    handleMapZoomChangedRuntimeShared({
      mapRef: { current: { getZoom: () => 18 } },
      mapZoomRef: { current: 17 },
      lastZoomGestureAtRef: { current: 0 },
    }, {
      beginMapInteraction: vi.fn(),
      closeAnyPopup,
      setMapZoom: vi.fn(),
    });

    expect(closeAnyPopup).not.toHaveBeenCalled();
  });

  it("consumes an outside map tap after closing an open popup", () => {
    const setSelectedOfficialId = vi.fn();
    const setSelectedQueuedTempId = vi.fn();
    const setSelectedDomainMarker = vi.fn();
    const setSelectedIncidentStackMarker = vi.fn();
    const setIncidentTypePickerOpen = vi.fn();

    processGoogleMapTapRuntimeShared(41.6, -80.8, {
      selectedDomainMarker: { id: "incident-1" },
      activeMapLayerKey: "incident_reporting",
      residentIncidentPickerOptions: [{ key: "potholes" }],
      mapZoom: 18,
    }, {
      setSelectedOfficialId,
      setSelectedQueuedTempId,
      setSelectedDomainMarker,
      setSelectedIncidentStackMarker,
      setIncidentTypePickerOpen,
      INCIDENT_REPORTING_LAYER_KEY: "incident_reporting",
    });

    expect(setSelectedOfficialId).toHaveBeenCalledWith(null);
    expect(setSelectedQueuedTempId).toHaveBeenCalledWith(null);
    expect(setSelectedDomainMarker).toHaveBeenCalledWith(null);
    expect(setSelectedIncidentStackMarker).toHaveBeenCalledWith(null);
    expect(setIncidentTypePickerOpen).not.toHaveBeenCalled();
  });
});
