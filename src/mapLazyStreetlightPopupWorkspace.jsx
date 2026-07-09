import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REPORTING_MIN_ZOOM, STREETLIGHT_UTILITY_REPORT_URL, clamp } from "./lib/mapPopupSharedConfig.js";
import { displayLightId } from "./lib/mapStreetlightDisplayIdSupport.js";
import { buildStreetlightUtilityRows } from "./lib/mapStreetlightUtilityRowsSupport.js";
import { isNativeAppRuntime } from "./platform/runtime.js";
import { getRuntimeTenantKey } from "./tenant/runtimeTenant";
import { supabase } from "./supabaseClient";

const LazyIncidentLocationModal = lazy(() => import("./mapLazyReportInspectors.jsx").then((module) => ({ default: module.IncidentLocationModal })));
const LazyOfficialStreetlightPopup = lazy(() => import("./mapLazyOfficialStreetlightPopup.jsx"));
const loadPlatformExternalModule = () => import("./platform/external.js");

const EMPTY_STREETLIGHT_UTILITY_CONTEXT = {
  lightId: "",
  loading: false,
  nearestAddress: "",
  nearestStreet: "",
  nearestCrossStreet: "",
  nearestIntersection: "",
  nearestLandmark: "",
};

export default function MapLazyStreetlightPopupWorkspace({
  bulkMode,
  closeAnyPopup,
  clearUtilityReportedForViewer,
  isAdmin,
  isStreetlightsLayerActive,
  mappingMode,
  mapCenter,
  mapInteracting,
  mapZoom,
  officialLights,
  openConfirmForLight,
  openMyReports,
  openUtilityReportDialogForLight,
  prefersDarkMode,
  projectPopupPixel,
  reverseGeocodeRoadLabel,
  selectedOfficialId,
  session,
  setDeleteOfficialConfirmOpen,
  setIsWorkingConfirmOpen,
  setOfficialLights,
  setPendingDeleteOfficialLightId,
  setPendingWorkingLightId,
  setSelectedOfficialId,
  slIdByUuid,
  streetlightConfidenceByLightId,
  useAppShellLayout,
  utilityReportReferenceByLightId,
  viewerSavedStreetlightLightIdSet,
  viewerStreetlightRingOpenIdSet,
  viewerUtilityReportedLightIdSet,
}) {
  const selectedOfficialLightForPopup = useMemo(() => {
    if (bulkMode || !isStreetlightsLayerActive) return null;
    const id = String(selectedOfficialId || "").trim();
    if (!id) return null;
    return (officialLights || []).find((row) => String(row?.id || "").trim() === id) || null;
  }, [bulkMode, isStreetlightsLayerActive, officialLights, selectedOfficialId]);

  const [streetlightLocationInfoOpen, setStreetlightLocationInfoOpen] = useState(false);
  const [streetlightUtilityContext, setStreetlightUtilityContext] = useState(EMPTY_STREETLIGHT_UTILITY_CONTEXT);
  const [copyToastText, setCopyToastText] = useState("");
  const copyToastTimerRef = useRef(null);

  useEffect(() => () => {
    if (copyToastTimerRef.current) {
      clearTimeout(copyToastTimerRef.current);
      copyToastTimerRef.current = null;
    }
  }, []);

  const showCopyToast = useCallback((text) => {
    setCopyToastText(String(text || "Copied to clipboard"));
    if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    copyToastTimerRef.current = setTimeout(() => {
      setCopyToastText("");
      copyToastTimerRef.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    setStreetlightLocationInfoOpen(false);
  }, [selectedOfficialLightForPopup?.id]);

  useEffect(() => {
    setStreetlightUtilityContext(EMPTY_STREETLIGHT_UTILITY_CONTEXT);
  }, [selectedOfficialLightForPopup?.id]);

  const hydrateStreetlightUtilityContext = useCallback((light) => {
    const lid = String(light?.id || "").trim();
    if (!lid) {
      setStreetlightUtilityContext(EMPTY_STREETLIGHT_UTILITY_CONTEXT);
      return;
    }
    const fromDb = (officialLights || []).find((row) => String(row?.id || "").trim() === lid) || light;
    setStreetlightUtilityContext({
      lightId: lid,
      loading: false,
      nearestAddress: String(fromDb?.nearest_address || "").trim() || "Address unavailable",
      nearestStreet: "",
      nearestCrossStreet: String(fromDb?.nearest_cross_street || "").trim(),
      nearestIntersection: "",
      nearestLandmark: String(fromDb?.nearest_landmark || "").trim(),
    });
  }, [officialLights]);

  const streetlightLocationRows = useMemo(() => {
    if (!streetlightLocationInfoOpen) return [];
    const coords = selectedOfficialLightForPopup
      ? { lat: selectedOfficialLightForPopup.lat, lng: selectedOfficialLightForPopup.lng }
      : null;
    return buildStreetlightUtilityRows(streetlightUtilityContext, coords);
  }, [streetlightLocationInfoOpen, streetlightUtilityContext, selectedOfficialLightForPopup?.lat, selectedOfficialLightForPopup?.lng]);

  const ensureStreetlightLocationInfoForPopup = useCallback(async (light) => {
    const lid = String(light?.id || "").trim();
    const lat = Number(light?.lat);
    const lng = Number(light?.lng);
    if (!lid || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const fromDb = (officialLights || []).find((row) => String(row?.id || "").trim() === lid) || light;
    const existingAddress = String(fromDb?.nearest_address || "").trim();
    const existingCrossStreet = String(fromDb?.nearest_cross_street || "").trim();
    const existingLandmark = String(fromDb?.nearest_landmark || "").trim();
    const hasCachedGeo = Boolean(existingAddress && existingCrossStreet && existingLandmark);

    if (hasCachedGeo) {
      hydrateStreetlightUtilityContext(fromDb);
      return;
    }

    setStreetlightUtilityContext((prev) => ({
      ...prev,
      lightId: lid,
      loading: true,
    }));

    try {
      const geo = await reverseGeocodeRoadLabel(lat, lng, {
        mode: "full",
        debugSource: "popup:streetlight-utility",
      });
      const nearestAddress = String(geo?.nearestAddress || "").trim();
      const nearestStreet = String(geo?.nearestStreet || "").trim();
      const nearestCrossStreet = String(geo?.nearestCrossStreet || "").trim();
      const nearestLandmark = String(geo?.nearestLandmark || "").trim();
      const nearestIntersection = String(geo?.nearestIntersection || "").trim();

      if ((nearestAddress || nearestCrossStreet || nearestLandmark) && supabase?.functions?.invoke) {
        const { error: cacheErr } = await supabase.functions.invoke("cache-official-light-geo", {
          body: {
            tenant_key: getRuntimeTenantKey() || null,
            domain: "streetlights",
            incident_id: lid,
            light_id: lid,
            nearest_address: nearestAddress || null,
            nearest_cross_street: nearestCrossStreet || null,
            nearest_landmark: nearestLandmark || null,
          },
        });
        if (cacheErr) {
          console.warn("[cache-official-light-geo] streetlight popup cache warning:", cacheErr);
        }
      }

      if (nearestAddress || nearestCrossStreet || nearestLandmark) {
        setOfficialLights?.((prev) => (prev || []).map((row) => {
          if (String(row?.id || "").trim() !== lid) return row;
          return {
            ...row,
            nearest_address: nearestAddress || row?.nearest_address || "",
            nearest_cross_street: nearestCrossStreet || row?.nearest_cross_street || "",
            nearest_landmark: nearestLandmark || row?.nearest_landmark || "",
          };
        }));
      }

      setStreetlightUtilityContext((prev) => ({
        ...prev,
        lightId: lid,
        loading: false,
        nearestAddress: nearestAddress || existingAddress || "Address unavailable",
        nearestStreet: nearestStreet || "",
        nearestCrossStreet: nearestCrossStreet || existingCrossStreet || "",
        nearestIntersection: nearestIntersection || "",
        nearestLandmark: nearestLandmark || existingLandmark || "",
      }));
    } catch {
      setStreetlightUtilityContext((prev) => ({ ...prev, lightId: lid, loading: false }));
    }
  }, [hydrateStreetlightUtilityContext, officialLights, reverseGeocodeRoadLabel, setOfficialLights]);

  const copyStreetlightLocationField = useCallback(async (label, value) => {
    const text = String(value || "").trim();
    if (!text || text.toLowerCase() === "unavailable") {
      showCopyToast(`${label || "Value"} unavailable`);
      return;
    }
    try {
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showCopyToast("Copied to clipboard");
      } else {
        showCopyToast("Copy unavailable");
      }
    } catch {
      showCopyToast("Copy failed");
    }
  }, [showCopyToast]);

  const getMarkerPopupPlacement = useCallback((pixel, { estimatedHeight = 320, maxWidth = 280 } = {}) => {
    const x = Number(pixel?.x);
    const y = Number(pixel?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return {
        frameStyle: { display: "none" },
        arrowStyle: { display: "none" },
      };
    }
    const viewportW = typeof window !== "undefined" ? Number(window.innerWidth || 0) : 0;
    const viewportH = typeof window !== "undefined" ? Number(window.innerHeight || 0) : 0;
    const width = Math.min(maxWidth, Math.max(210, (viewportW || 360) - 20));
    const topSafe = useAppShellLayout ? 150 : 102;
    const bottomSafe = useAppShellLayout ? 92 : 20;
    const gap = 14;
    const usableBottom = Math.max(topSafe + 120, (viewportH || 720) - bottomSafe);
    const clampedX = clamp(x, 10 + width / 2, Math.max(10 + width / 2, (viewportW || 360) - 10 - width / 2));
    const fitsAbove = y - estimatedHeight - gap >= topSafe;
    const fitsBelow = y + estimatedHeight + gap <= usableBottom;
    const placeBelow = !fitsAbove && (fitsBelow || y < (viewportH || 720) / 2);
    const top = placeBelow
      ? clamp(y + gap, topSafe + 8, Math.max(topSafe + 8, usableBottom - estimatedHeight))
      : clamp(y - gap, topSafe + estimatedHeight, usableBottom);
    return {
      frameStyle: {
        position: "absolute",
        left: clampedX,
        top,
        transform: placeBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
        zIndex: 2600,
        pointerEvents: "auto",
        width,
        maxWidth: "calc(100vw - 20px)",
        maxHeight: `min(430px, ${Math.max(160, Math.round(usableBottom - topSafe - 18))}px)`,
      },
      arrowStyle: placeBelow
        ? {
            position: "absolute",
            left: "50%",
            top: -7,
            width: 12,
            height: 12,
            background: "var(--sl-ui-modal-bg)",
            borderLeft: "1px solid var(--sl-ui-modal-border)",
            borderTop: "1px solid var(--sl-ui-modal-border)",
            transform: "translateX(-50%) rotate(45deg)",
          }
        : {
            position: "absolute",
            left: "50%",
            bottom: -7,
            width: 12,
            height: 12,
            background: "var(--sl-ui-modal-bg)",
            borderRight: "1px solid var(--sl-ui-modal-border)",
            borderBottom: "1px solid var(--sl-ui-modal-border)",
            transform: "translateX(-50%) rotate(45deg)",
          },
    };
  }, [useAppShellLayout]);

  const selectedOfficialPopupPixel = useMemo(() => (
    selectedOfficialLightForPopup
      ? projectPopupPixel?.(selectedOfficialLightForPopup.lat, selectedOfficialLightForPopup.lng) || null
      : null
  ), [
    mapCenter,
    mapInteracting,
    mapZoom,
    projectPopupPixel,
    selectedOfficialLightForPopup,
  ]);

  const selectedOfficialPopupPlacement = getMarkerPopupPlacement(selectedOfficialPopupPixel, { estimatedHeight: 390 });

  const markerPopupCardStyle = {
    minWidth: 210,
    display: "grid",
    gap: 8,
    background: "var(--sl-ui-modal-bg)",
    border: "1px solid var(--sl-ui-modal-border)",
    borderRadius: 12,
    boxShadow: "var(--sl-ui-modal-shadow)",
    padding: 10,
    color: "var(--sl-ui-text)",
    fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    maxHeight: "min(430px, calc(100dvh - 190px))",
    overflowY: "auto",
    overscrollBehavior: "contain",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  const btnPopupPrimary = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "none",
    background: "var(--sl-ui-brand-blue)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };

  const btnPopupSecondary = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
    background: "var(--sl-ui-modal-btn-secondary-bg)",
    color: "var(--sl-ui-modal-btn-secondary-text)",
    fontWeight: 900,
    cursor: "pointer",
  };

  const selectedOfficialLightId = String(selectedOfficialLightForPopup?.id || "").trim();
  const selectedOfficialDisplayId = selectedOfficialLightId
    ? displayLightId(selectedOfficialLightId, slIdByUuid)
    : "";
  const selectedOfficialAlreadySaved = selectedOfficialLightId
    ? viewerSavedStreetlightLightIdSet.has(selectedOfficialLightId)
    : false;
  const selectedOfficialCurrentlyOpen = selectedOfficialLightId
    ? viewerStreetlightRingOpenIdSet.has(selectedOfficialLightId)
    : false;
  const selectedOfficialShowSaveLight = Boolean(
    selectedOfficialLightForPopup && !(selectedOfficialAlreadySaved && selectedOfficialCurrentlyOpen)
  );
  const selectedOfficialCanSaveLight = Number(mapZoom) >= REPORTING_MIN_ZOOM;
  const selectedOfficialCanTrackUtility = Boolean(
    selectedOfficialLightId
    && session?.user?.id
    && (
      viewerSavedStreetlightLightIdSet.has(selectedOfficialLightId)
      || viewerUtilityReportedLightIdSet.has(selectedOfficialLightId)
    )
  );
  const selectedOfficialUtilityReported = selectedOfficialLightId
    ? viewerUtilityReportedLightIdSet.has(selectedOfficialLightId)
    : false;
  const selectedOfficialUtilityReportReference = selectedOfficialLightId
    ? String(utilityReportReferenceByLightId?.[selectedOfficialLightId] || "").trim()
    : "";
  const selectedOfficialConfidence = selectedOfficialLightId
    ? (streetlightConfidenceByLightId?.[selectedOfficialLightId] || null)
    : null;
  const selectedOfficialShowWorkingButton = Boolean(selectedOfficialConfidence?.canViewerMarkWorking);
  const selectedOfficialShowDeleteButton = Boolean(mappingMode && isAdmin && selectedOfficialLightId);
  const selectedOfficialShowZoomHint = Number(mapZoom) < REPORTING_MIN_ZOOM;

  if (!selectedOfficialLightForPopup || !selectedOfficialPopupPixel) return null;

  return (
    <>
      <Suspense fallback={null}>
        <LazyOfficialStreetlightPopup
          open
          popupPlacement={selectedOfficialPopupPlacement}
          markerPopupCardStyle={markerPopupCardStyle}
          btnPopupPrimary={btnPopupPrimary}
          btnPopupSecondary={btnPopupSecondary}
          prefersDarkMode={prefersDarkMode}
          displayId={selectedOfficialDisplayId}
          onClose={() => setSelectedOfficialId(null)}
          onOpenLocationInfo={() => {
            hydrateStreetlightUtilityContext(selectedOfficialLightForPopup);
            setStreetlightLocationInfoOpen(true);
            void ensureStreetlightLocationInfoForPopup(selectedOfficialLightForPopup);
          }}
          onReportOutage={() => {
            void loadPlatformExternalModule().then(({ openExternalUrl }) => openExternalUrl(STREETLIGHT_UTILITY_REPORT_URL));
          }}
          showSaveLight={selectedOfficialShowSaveLight}
          canSaveLight={selectedOfficialCanSaveLight}
          onSaveLight={() => {
            openConfirmForLight({
              lat: selectedOfficialLightForPopup.lat,
              lng: selectedOfficialLightForPopup.lng,
              lightId: selectedOfficialLightForPopup.id,
              isOfficial: true,
            });
          }}
          canTrackUtility={selectedOfficialCanTrackUtility}
          utilityReported={selectedOfficialUtilityReported}
          onToggleUtilityReported={(checked) => {
            if (!selectedOfficialLightId) return;
            if (checked) {
              openUtilityReportDialogForLight(selectedOfficialLightId);
            } else {
              void clearUtilityReportedForViewer(selectedOfficialLightId);
            }
          }}
          onOpenUtilityReport={() => {
            if (!selectedOfficialLightId) return;
            openUtilityReportDialogForLight(selectedOfficialLightId);
          }}
          utilityReportReference={selectedOfficialUtilityReportReference}
          onViewMyReport={() => {
            if (!selectedOfficialLightId) return;
            openMyReports({
              domainKey: "streetlights",
              focusIncidentId: selectedOfficialLightId,
              focusQuery: selectedOfficialDisplayId,
            });
          }}
          showWorkingButton={selectedOfficialShowWorkingButton}
          onMarkWorking={() => {
            if (!selectedOfficialLightId) return;
            closeAnyPopup();
            setPendingWorkingLightId(selectedOfficialLightId);
            setIsWorkingConfirmOpen(true);
          }}
          showDeleteButton={selectedOfficialShowDeleteButton}
          onDelete={() => {
            if (!selectedOfficialLightForPopup?.id) return;
            setPendingDeleteOfficialLightId(selectedOfficialLightForPopup.id);
            setDeleteOfficialConfirmOpen(true);
          }}
          showZoomHint={selectedOfficialShowZoomHint}
        />
      </Suspense>

      {streetlightLocationInfoOpen ? (
        <Suspense fallback={null}>
          <LazyIncidentLocationModal
            open={streetlightLocationInfoOpen}
            title="Streetlight Location Info"
            rows={streetlightLocationRows}
            loading={Boolean(streetlightUtilityContext.loading)}
            copyHint="Use this location information to submit directly to the electric utility."
            onCopyRow={(row) => {
              void copyStreetlightLocationField(row?.label || "Location field", row?.value || "");
            }}
            showReportToUtility
            onReportToUtility={() => {
              void loadPlatformExternalModule().then(({ openExternalUrl }) => openExternalUrl(STREETLIGHT_UTILITY_REPORT_URL));
            }}
            reportToUtilityLabel="Report to Utility"
            onClose={() => setStreetlightLocationInfoOpen(false)}
          />
        </Suspense>
      ) : null}

      {!!copyToastText && (
        <div
          style={{
            position: "fixed",
            top: 48,
            left: 18,
            zIndex: 10050,
            padding: "7px 11px",
            borderRadius: 8,
            border: "1px solid var(--sl-ui-brand-blue-border)",
            background: "var(--sl-ui-brand-blue)",
            color: "white",
            fontSize: 12,
            fontWeight: 900,
            boxShadow: "0 8px 20px rgba(0,0,0,0.24)",
            pointerEvents: "none",
          }}
        >
          {copyToastText}
        </div>
      )}
    </>
  );
}
