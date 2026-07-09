import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { clamp } from "./lib/mapPopupSharedConfig.js";
import { resolveReportDomainLabelShared } from "./lib/mapReportDisplaySupport.js";
import { REPORT_DOMAIN_OPTIONS } from "./lib/mapDomainSelectionConfig.js";
import { singularizeDomainLabel, normalizeDomainKeyOrSlug } from "./lib/mapReportParsingSupport.js";
import { RUNTIME_DOMAIN_META } from "./lib/mapRuntimeDomainMeta.js";
import { buildIncidentIssueStateByDomainShared } from "./lib/mapDeferredIncidentWorkspaceStateSupport.js";

const LazyIncidentStackPopup = lazy(() => import("./mapLazyIncidentStackPopup.jsx"));
const LazyQueuedMarkerPopup = lazy(() => import("./mapLazyQueuedMarkerPopup.jsx"));
const loadDeferredSelectionPopupIncidentSupportModule = () => import("./lib/mapDeferredSelectionPopupIncidentSupport.js");

export default function MapSelectionPopups(props) {
  const {
    bulkMode,
    isAdmin,
    mapCenter,
    mapInteracting,
    mapZoom,
    mappingMode,
    mappingQueue,
    openIncidentDomainMarker,
    openNotice,
    persistedIncidentRecordStateByDomain,
    prefersDarkMode,
    projectPopupPixel,
    removeFromMappingQueue,
    selectedIncidentStackMarker,
    selectedQueuedTempId,
    setSelectedIncidentStackMarker,
    setSelectedQueuedTempId,
    updateQueuedSignType,
    useAppShellLayout,
  } = props;

  const [incidentPopupSupport, setIncidentPopupSupport] = useState(null);
  const incidentIssueStateByDomain = useMemo(
    () => buildIncidentIssueStateByDomainShared(persistedIncidentRecordStateByDomain),
    [persistedIncidentRecordStateByDomain]
  );

  useEffect(() => {
    if (!selectedIncidentStackMarker) return undefined;
    let cancelled = false;
    void loadDeferredSelectionPopupIncidentSupportModule().then((module) => {
      if (!cancelled) setIncidentPopupSupport(module);
    }).catch(() => {
      // Keep stack popup usable even if deferred helpers fail.
    });
    return () => {
      cancelled = true;
    };
  }, [selectedIncidentStackMarker]);

  const selectedQueuedLightForPopup = useMemo(() => {
    if (bulkMode || !mappingMode || !isAdmin) return null;
    const id = String(selectedQueuedTempId || "").trim();
    if (!id) return null;
    return (mappingQueue || []).find((row) => String(row?.tempId || "").trim() === id) || null;
  }, [bulkMode, isAdmin, mappingMode, mappingQueue, selectedQueuedTempId]);

  const resolveReportDomainLabel = useCallback((domainKeyRaw, fallback = "Incident") => (
    resolveReportDomainLabelShared(domainKeyRaw, fallback, {
      runtimeDomainMeta: RUNTIME_DOMAIN_META,
      reportDomainOptions: REPORT_DOMAIN_OPTIONS,
    })
  ), []);

  const resolveConfiguredDomainIssueLabel = useCallback((domainKeyRaw, issueValueRaw, issueOptions = []) => (
    incidentPopupSupport?.resolveConfiguredDomainIssueLabelShared?.(domainKeyRaw, issueValueRaw, issueOptions, {
      normalizeDomainKeyOrSlug,
      runtimeDomainMeta: RUNTIME_DOMAIN_META,
    }) || ""
  ), [incidentPopupSupport]);

  const resolveReportIssueLabel = useCallback((row, domainKeyRaw, issueStateByIncidentOverride = null) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
    const issueStateByIncident =
      issueStateByIncidentOverride && typeof issueStateByIncidentOverride === "object" && !Array.isArray(issueStateByIncidentOverride)
        ? issueStateByIncidentOverride
        : (domainKey ? (incidentIssueStateByDomain?.get?.(domainKey) || {}) : {});
    return incidentPopupSupport?.resolveReportIssueLabelShared?.(row, domainKey, issueStateByIncident, {
      normalizeDomainKeyOrSlug,
      resolveConfiguredDomainIssueLabel,
    }) || "";
  }, [
    incidentIssueStateByDomain,
    incidentPopupSupport,
    resolveConfiguredDomainIssueLabel,
  ]);

  const resolveIncidentIssueLabelForDomain = useCallback((row, domainKeyRaw) => (
    resolveReportIssueLabel(row, domainKeyRaw)
  ), [resolveReportIssueLabel]);

  const resolveReportTypeOptionDetails = useCallback((row, domainKeyRaw) => (
    incidentPopupSupport?.resolveReportTypeOptionDetailsShared?.(row, domainKeyRaw, RUNTIME_DOMAIN_META) || []
  ), [incidentPopupSupport]);

  const resolveIncidentStackMarkerTitle = useCallback((marker) => {
    const domainKey = normalizeDomainKeyOrSlug(marker?.domain, { allowUnknown: true });
    if (!domainKey) return "Incident";

    const baseDomainLabel = singularizeDomainLabel(
      String(marker?.domainLabel || resolveReportDomainLabel(domainKey, "Incident")).trim() || "Incident",
      "Incident"
    );
    if (
      typeof incidentPopupSupport?.resolveReportTypeOptionDetailsShared !== "function"
      || typeof incidentPopupSupport?.summarizeIssueTypes !== "function"
    ) {
      return `${baseDomainLabel} Issue`;
    }
    const typeOptionDetails = resolveReportTypeOptionDetails(marker?.rows?.[0], domainKey);
    const nonIssueTypeDetails = typeOptionDetails.filter((detail) => {
      const detailKey = String(detail?.key || "").trim().toLowerCase();
      const detailLabel = String(detail?.label || "").trim().toLowerCase();
      return detailKey !== "issue_type" && detailLabel !== "issue_type";
    });
    const typeSummary = incidentPopupSupport.summarizeIssueTypes(nonIssueTypeDetails, "");
    return String(typeSummary || "").trim()
      ? `${baseDomainLabel} • ${typeSummary}`
      : `${baseDomainLabel} Issue`;
  }, [
    incidentPopupSupport,
    resolveReportDomainLabel,
    resolveReportTypeOptionDetails,
  ]);

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

  const btnPopupSecondary = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
    background: "var(--sl-ui-modal-btn-secondary-bg)",
    color: "var(--sl-ui-modal-btn-secondary-text)",
    fontWeight: 800,
    cursor: "pointer",
  };

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

  const selectedIncidentStackPopupPixel = useMemo(() => (
    selectedIncidentStackMarker
      ? projectPopupPixel?.(selectedIncidentStackMarker.lat, selectedIncidentStackMarker.lng) || null
      : null
  ), [
    mapCenter,
    mapInteracting,
    mapZoom,
    projectPopupPixel,
    selectedIncidentStackMarker,
  ]);

  const selectedQueuedPopupPixel = useMemo(() => (
    selectedQueuedLightForPopup
      ? projectPopupPixel?.(selectedQueuedLightForPopup.lat, selectedQueuedLightForPopup.lng) || null
      : null
  ), [
    mapCenter,
    mapInteracting,
    mapZoom,
    projectPopupPixel,
    selectedQueuedLightForPopup,
  ]);

  const selectedIncidentStackPopupPlacement = getMarkerPopupPlacement(selectedIncidentStackPopupPixel, { estimatedHeight: 360 });
  const selectedQueuedPopupPlacement = getMarkerPopupPlacement(selectedQueuedPopupPixel, { estimatedHeight: 230 });

  return (
    <>
      {!bulkMode && selectedIncidentStackMarker && selectedIncidentStackPopupPixel ? (
        <Suspense fallback={null}>
          <LazyIncidentStackPopup
            open
            popupPlacement={selectedIncidentStackPopupPlacement}
            markerPopupCardStyle={markerPopupCardStyle}
            selectedIncidentStackMarker={selectedIncidentStackMarker}
            setSelectedIncidentStackMarker={setSelectedIncidentStackMarker}
            resolveIncidentStackMarkerTitle={resolveIncidentStackMarkerTitle}
            resolveIncidentIssueLabelForDomain={resolveIncidentIssueLabelForDomain}
            openIncidentDomainMarker={openIncidentDomainMarker}
          />
        </Suspense>
      ) : null}

      {!bulkMode && selectedQueuedLightForPopup && selectedQueuedPopupPixel ? (
        <Suspense fallback={null}>
          <LazyQueuedMarkerPopup
            open
            popupPlacement={selectedQueuedPopupPlacement}
            markerPopupCardStyle={markerPopupCardStyle}
            selectedQueuedLight={selectedQueuedLightForPopup}
            btnPopupSecondary={btnPopupSecondary}
            prefersDarkMode={prefersDarkMode}
            setSelectedQueuedTempId={setSelectedQueuedTempId}
            updateQueuedSignType={updateQueuedSignType}
            removeFromMappingQueue={removeFromMappingQueue}
            openNotice={openNotice}
          />
        </Suspense>
      ) : null}
    </>
  );
}
