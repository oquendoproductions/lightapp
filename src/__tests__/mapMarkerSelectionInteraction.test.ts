import { describe, expect, it, vi } from "vitest";

import {
  handleMapDragStartRuntimeShared,
  handleMapIdleRuntimeShared,
  handleMapZoomChangedRuntimeShared,
} from "../lib/mapDeferredMapInteractionRuntime";
import { processGoogleMapTapRuntimeShared } from "../lib/mapDeferredMapTapRuntime";
import {
  MARKER_SELECTION_MIN_ZOOM,
  MARKER_SELECTION_VERTICAL_FRACTION,
  focusMapMarkerSelectionShared,
  markerSelectionCameraCenterShared,
} from "../lib/mapMarkerSelectionInteractionSupport";
import {
  MARKER_POPUP_ANCHOR_GAP,
  resolveMarkerPopupPlacementShared,
} from "../lib/mapPopupSharedConfig";

describe("map marker selection interactions", () => {
  it("centers a marker and raises zoom to 17 when below the selection minimum", () => {
    const panTo = vi.fn();
    const setZoom = vi.fn();
    const setMapCenter = vi.fn();
    const setMapZoom = vi.fn();
    const mapZoomRef = { current: 12 };

    const focused = focusMapMarkerSelectionShared({ lat: 41.6, lng: -80.8 }, {
      mapRef: { current: { getZoom: () => 12, getDiv: () => ({ clientHeight: 900 }), panTo, setZoom } },
      mapZoomRef,
      suppressMapClickRef: { current: { until: 0 } },
    }, {
      setMapCenter,
      setMapZoom,
    });

    expect(focused).toBe(true);
    const cameraCenter = panTo.mock.calls[0][0];
    expect(cameraCenter.lng).toBe(-80.8);
    expect(cameraCenter.lat).toBeGreaterThan(41.6);
    expect(setZoom).toHaveBeenCalledWith(MARKER_SELECTION_MIN_ZOOM);
    expect(setMapCenter).toHaveBeenCalledWith(cameraCenter);
    expect(setMapZoom).toHaveBeenCalledWith(MARKER_SELECTION_MIN_ZOOM);
    expect(mapZoomRef.current).toBe(MARKER_SELECTION_MIN_ZOOM);
  });

  it("centers a marker without reducing a zoom level above 17", () => {
    const panTo = vi.fn();
    const setZoom = vi.fn();
    const setMapZoom = vi.fn();

    focusMapMarkerSelectionShared({ lat: 41.6, lng: -80.8 }, {
      mapRef: { current: { getZoom: () => 19, getDiv: () => ({ clientHeight: 900 }), panTo, setZoom } },
      mapZoomRef: { current: 19 },
    }, {
      setMapCenter: vi.fn(),
      setMapZoom,
    });

    expect(panTo.mock.calls[0][0].lat).toBeGreaterThan(41.6);
    expect(panTo.mock.calls[0][0].lng).toBe(-80.8);
    expect(setZoom).not.toHaveBeenCalled();
    expect(setMapZoom).not.toHaveBeenCalled();
  });

  it("places the selected marker at two-thirds of the map height", () => {
    const marker = { lat: 41.6, lng: -80.8 };
    const viewportHeight = 900;
    const center = markerSelectionCameraCenterShared(marker, 17, viewportHeight);
    const worldSize = 256 * (2 ** 17);
    const worldY = (latitude: number) => {
      const sin = Math.sin((latitude * Math.PI) / 180);
      return 0.5 - (Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI));
    };
    const projectedMarkerY = (viewportHeight / 2) + ((worldY(marker.lat) - worldY(center.lat)) * worldSize);

    expect(projectedMarkerY).toBeCloseTo(viewportHeight * MARKER_SELECTION_VERTICAL_FRACTION, 5);
  });

  it("anchors an above-marker popup pointer to the marker near a viewport edge", () => {
    const placement = resolveMarkerPopupPlacementShared({ x: 32, y: 650 }, {
      estimatedHeight: 340,
      useAppShellLayout: true,
      viewportWidth: 390,
      viewportHeight: 844,
    });

    expect(placement.frameStyle.transform).toBe("translate(-50%, -100%)");
    expect(placement.frameStyle.top).toBe(650 - MARKER_POPUP_ANCHOR_GAP);
    expect(placement.frameStyle.top).toBe(650 - 24);
    expect(placement.arrowStyle.bottom).toBe(-7);
    expect(placement.arrowStyle.width).toBe(12);
    expect(placement.arrowStyle.transform).toContain("rotate(45deg)");
    expect(placement.arrowStyle.left).toBe(22);
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

  it("reanchors an open popup after the map camera settles", () => {
    const refreshPopupProjection = vi.fn();

    handleMapIdleRuntimeShared({
      mapRef: {
        current: {
          getZoom: () => 17,
          getCenter: () => ({ lat: () => 41.6, lng: () => -80.8 }),
          getBounds: () => null,
        },
      },
    }, {
      setMapZoom: vi.fn(),
      setMapCenter: vi.fn(),
      setMapBounds: vi.fn(),
      refreshPopupProjection,
    });

    expect(refreshPopupProjection).toHaveBeenCalledTimes(1);
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
