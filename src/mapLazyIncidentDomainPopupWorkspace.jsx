import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formattedIncidentDisplayIdShared,
} from "./lib/mapIncidentDisplaySupport.js";
import { REPORTING_MIN_ZOOM, STREETLIGHT_UTILITY_REPORT_URL, clamp } from "./lib/mapPopupSharedConfig.js";
import {
  resolveReportDomainLabelShared,
} from "./lib/mapReportDisplaySupport.js";
import {
  REPORT_DOMAIN_OPTIONS,
} from "./lib/mapDomainSelectionConfig.js";
import { hasIssueTypeOptionDetail } from "./lib/mapDomainDetailSupport.js";
import {
  adminFacingIncidentStateLabel,
  incidentStateLabel,
  isLifecycleStateOpen,
} from "./lib/incidentLifecycle.js";
import { incidentLocationCacheKey } from "./lib/mapIncidentLocationCacheSupport.js";
import { resolveIncidentRepairSnapshotShared } from "./lib/mapIncidentRepairSupport.js";
import { isWorkingReportType, reportIdentityKey } from "./lib/mapIncidentIdentitySupport.js";
import {
  isPlaceholderLocationText,
  isUsableAddressText,
} from "./lib/mapPopupTextSupport.js";
import { normalizeDomainKey, normalizeDomainKeyOrSlug, singularizeDomainLabel } from "./lib/mapReportParsingSupport.js";
import { repairActionButtonStyle } from "./lib/mapRepairActionStyleSupport.js";
import { getIncidentDomainHelperShared } from "./lib/mapIncidentDomainConfig.js";
import {
  incidentSnapshotCandidateDomainsShared,
  normalizeIncidentDrivenLookupIdShared,
} from "./lib/mapIncidentDomainHelperCoreSupport.js";
import { RUNTIME_DOMAIN_META } from "./lib/mapRuntimeDomainMeta.js";
import {
  buildIncidentDrivenRecordMapByDomainShared,
  buildIncidentIssueStateByDomainShared,
} from "./lib/mapDeferredIncidentWorkspaceStateSupport.js";
import { isNativeAppRuntime } from "./platform/runtime.js";

const LazyIncidentLocationModal = lazy(() => import("./mapLazyReportInspectors.jsx").then((module) => ({ default: module.IncidentLocationModal })));
const LazyAllReportsModal = lazy(() => import("./mapLazyReportInspectors.jsx").then((module) => ({ default: module.AllReportsModal })));
const LazyAdminIncidentInfoWindowDetails = lazy(() => import("./mapLazyInfoPanels.jsx").then((module) => ({ default: module.AdminIncidentInfoWindowDetails })));
const LazyIncidentPopupAdminExtras = lazy(() => import("./mapLazyIncidentPopupAdminExtras.jsx"));
const loadDeferredSelectionPopupIncidentSupportModule = () => import("./lib/mapDeferredSelectionPopupIncidentSupport.js");
const loadDeferredIncidentPopupFollowupSupportModule = () => import("./lib/mapDeferredIncidentPopupFollowupSupport.js");
const loadDeferredIncidentPopupLocationSupportModule = () => import("./lib/mapDeferredIncidentPopupLocationSupport.js");
const loadDeferredIncidentPopupReportTargetSupportModule = () => import("./lib/mapDeferredIncidentPopupReportTargetSupport.js");
const loadPlatformExternalModule = () => import("./platform/external.js");

function collectIncidentIdsFromRowsLocal(rows, fallbackIncidentId = "") {
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const row of rows || []) push(row?.light_id);
  push(fallbackIncidentId);
  return out;
}

export default function MapIncidentDomainPopupWorkspace(props) {
  const { shared = {}, ...rest } = props;
  const {
    isOrganizationManagedIncidentDomain,
  } = shared;
  const {
    bulkMode,
    canManageIncidentDomainRepairs,
    canShowPublicRepairAction,
    incidentRepairProgressByKey,
    incidentDomainCanonicalIncidentId,
    incidentDrivenRowsByDomain,
    isAdmin,
    isPlatformAdmin,
    isPublicRepairEnabledForDomain,
    isReportsAdminView,
    mapCenter,
    mapInteracting,
    mapZoom,
    mappingMode,
    actionsByLightId,
    openDomainReportFlow,
    openIncidentStatusDialogForTarget,
    openMyReports,
    persistIncidentLocationCacheEntry,
    persistedIncidentRepairConfirmedKeySet,
    prefersDarkMode,
    projectPopupPixel,
    resolveIncidentDrivenFixTsForId,
    requestIncidentRepairConfirmation,
    selectedDomainMarker,
    reverseGeocodeRoadLabel,
    slIdByUuid,
    openDeleteOfficialSignConfirm,
    setSelectedDomainMarker,
    useAppShellLayout,
    adminReportDomain,
    getIncidentSnapshot,
    incidentLocationCacheByKey,
    persistedIncidentRecordStateByDomain,
    configuredIncidentSeededByIdByDomain,
    viewerIdentityKey,
  } = rest;
  const getIncidentDomainHelper = getIncidentDomainHelperShared;
  const incidentIssueStateByDomain = useMemo(
    () => buildIncidentIssueStateByDomainShared(persistedIncidentRecordStateByDomain),
    [persistedIncidentRecordStateByDomain]
  );
  const incidentDrivenRecordMapByDomain = useMemo(
    () => buildIncidentDrivenRecordMapByDomainShared({
      configuredIncidentSeededByIdByDomain,
      persistedIncidentRecordStateByDomain,
      shouldBuild: Boolean(selectedDomainMarker),
    }),
    [
      configuredIncidentSeededByIdByDomain,
      persistedIncidentRecordStateByDomain,
      selectedDomainMarker,
    ]
  );
  const [incidentPopupSupport, setIncidentPopupSupport] = useState(null);
  const resolveReportTypeOptionDetails = useCallback((row, domainKeyRaw) => (
    incidentPopupSupport?.resolveReportTypeOptionDetailsShared?.(row, domainKeyRaw, RUNTIME_DOMAIN_META) || []
  ), [incidentPopupSupport]);
  const resolveConfiguredDomainIssueLabel = useCallback((domainKeyRaw, issueValueRaw, issueOptions = []) => (
    incidentPopupSupport?.resolveConfiguredDomainIssueLabelShared?.(domainKeyRaw, issueValueRaw, issueOptions, {
      normalizeDomainKeyOrSlug,
      runtimeDomainMeta: RUNTIME_DOMAIN_META,
    }) || ""
  ), [incidentPopupSupport, normalizeDomainKeyOrSlug]);
  const resolveReportIssueLabel = useCallback((row, domainKeyRaw, issueStateByIncidentOverride = null) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
    const issueStateByIncident =
      issueStateByIncidentOverride && typeof issueStateByIncidentOverride === "object" && !Array.isArray(issueStateByIncidentOverride)
        ? issueStateByIncidentOverride
        : (domainKey ? (incidentIssueStateByDomain?.get?.(domainKey) || {}) : {});
    return incidentPopupSupport?.resolveReportIssueLabelShared?.(row, domainKey, issueStateByIncident, {
      getIncidentDomainHelper,
      normalizeDomainKeyOrSlug,
      resolveConfiguredDomainIssueLabel,
    }) || "";
  }, [
    getIncidentDomainHelper,
    incidentPopupSupport,
    incidentIssueStateByDomain,
    normalizeDomainKeyOrSlug,
    resolveConfiguredDomainIssueLabel,
  ]);
  const resolveIncidentIssueLabelForDomain = useCallback((row, domainKeyRaw) => (
    resolveReportIssueLabel(row, domainKeyRaw)
  ), [resolveReportIssueLabel]);
  const incidentDisplaySupportDeps = useMemo(() => ({
    getIncidentDomainHelper,
    runtimeDomainMeta: RUNTIME_DOMAIN_META,
  }), [getIncidentDomainHelper]);
  const formattedIncidentDisplayId = useCallback((...args) => (
    formattedIncidentDisplayIdShared(...args, incidentDisplaySupportDeps)
  ), [incidentDisplaySupportDeps]);
  const resolveReportDomainLabel = useCallback((domainKeyRaw, fallback = "Incident") => (
    resolveReportDomainLabelShared(domainKeyRaw, fallback, {
      runtimeDomainMeta: RUNTIME_DOMAIN_META,
      reportDomainOptions: REPORT_DOMAIN_OPTIONS,
    })
  ), []);
  const formatConfiguredPopupDetailValue = useCallback((rawValue, formatModeRaw = "", options = {}) => (
    incidentPopupSupport?.formatConfiguredPopupDetailValueShared?.(
      rawValue,
      formatModeRaw,
      options,
      { normalizeDomainKeyOrSlug }
    ) || String(rawValue || "").trim()
  ), [incidentPopupSupport, normalizeDomainKeyOrSlug]);
  const [incidentLocationModal, setIncidentLocationModal] = useState({
    open: false,
    title: "",
    rows: [],
    loading: false,
    incidentKey: "",
    domainKey: "",
    copyHint: "",
    showReportToUtility: false,
  });
  const [allReportsModal, setAllReportsModal] = useState({
    open: false,
    incidentKey: "",
    title: "",
    items: [],
    reportRows: [],
    fixActionRows: [],
    issueStateByIncident: {},
    domainKey: "streetlights",
    incidentLabel: "",
    sharedLocation: "",
    sharedAddress: "",
    sharedCrossStreet: "",
    sharedLandmark: "",
    sharedCoordinates: "",
    geoLoading: false,
    currentState: "",
    lastChangedAt: "",
    hideSubmittedBy: false,
    useSubmittedReportFormat: false,
  });
  const [incidentLocationCopyToast, setIncidentLocationCopyToast] = useState(null);
  const incidentLocationCopyToastTimerRef = useRef(null);
  useEffect(() => () => {
    if (incidentLocationCopyToastTimerRef.current) {
      clearTimeout(incidentLocationCopyToastTimerRef.current);
      incidentLocationCopyToastTimerRef.current = null;
    }
  }, []);
  const showIncidentCopyToast = useCallback((text = "Copied to clipboard", placement = {}) => {
    setIncidentLocationCopyToast({
      text: String(text || "Copied to clipboard"),
      ...placement,
    });
    if (incidentLocationCopyToastTimerRef.current) clearTimeout(incidentLocationCopyToastTimerRef.current);
    incidentLocationCopyToastTimerRef.current = setTimeout(() => {
      setIncidentLocationCopyToast(null);
      incidentLocationCopyToastTimerRef.current = null;
    }, 900);
  }, []);
  const copyIncidentPopupLocationField = useCallback(async (label, value, anchorEl = null) => {
    const text = String(value || "").trim();
    if (!text || text.toLowerCase() === "unavailable") {
      showIncidentCopyToast(`${label || "Value"} unavailable`);
      return;
    }
    try {
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        const rect = anchorEl?.getBoundingClientRect?.();
        const toastWidth = 176;
        const toastHeight = 34;
        const toastGap = 8;
        const modalEl = anchorEl?.closest?.("[data-incident-location-modal='true']");
        if (rect && modalEl?.getBoundingClientRect) {
          const modalRect = modalEl.getBoundingClientRect();
          const localX = Math.max(
            10,
            Math.min(
              Math.max(10, modalRect.width - toastWidth - 10),
              (rect.left - modalRect.left) + (rect.width / 2) - (toastWidth / 2)
            )
          );
          const localY = Math.max(10, (rect.top - modalRect.top) - toastHeight - toastGap);
          showIncidentCopyToast("Copied to clipboard", {
            scope: "incident_location_modal",
            localX,
            localY,
          });
        } else {
          const placement = rect
            ? {
              x: Math.max(
                10,
                Math.min(
                  window.innerWidth - toastWidth - 10,
                  rect.left + (rect.width / 2) - (toastWidth / 2)
                )
              ),
              y: Math.max(10, rect.top - toastHeight - toastGap),
            }
            : {};
          showIncidentCopyToast("Copied to clipboard", placement);
        }
      } else {
        showIncidentCopyToast("Copy unavailable");
      }
    } catch {
      showIncidentCopyToast("Copy failed");
    }
  }, [showIncidentCopyToast]);
  const openIncidentAllReportsFromMarker = useCallback(async (marker, domainOverride = "", popupInfo = null) => {
    const m = marker || selectedDomainMarker;
    if (!m || !popupInfo) return;
    const normalizedDomainOverride = String(
      normalizeDomainKeyOrSlug(domainOverride || popupInfo?.domainKey || m?.domain || adminReportDomain, { allowUnknown: true })
      || popupInfo?.domainKey
      || m?.domain
      || adminReportDomain
      || ""
    ).trim();
    if (!normalizedDomainOverride) return;
    const { buildIncidentAllReportsModalPayloadShared } = await loadDeferredIncidentPopupFollowupSupportModule();
    const modalPayload = buildIncidentAllReportsModalPayloadShared({
      popupInfo,
      marker: m,
      domainKey: normalizedDomainOverride,
      selectedDomainMarker,
      adminReportDomain,
      actionsByLightId,
      incidentIssueStateByDomain,
      slIdByUuid,
    }, {
      normalizeDomainKeyOrSlug,
      getIncidentDisplaySupportDeps: () => incidentDisplaySupportDeps,
    });
    if (!modalPayload) return;
    setAllReportsModal({
      open: true,
      incidentKey: String(modalPayload?.options?.incidentKey || "").trim(),
      title: modalPayload.title || "All Reports",
      items: Array.isArray(modalPayload.items) ? modalPayload.items : [],
      reportRows: Array.isArray(modalPayload?.options?.reportRows) ? modalPayload.options.reportRows : [],
      fixActionRows: Array.isArray(modalPayload?.options?.fixActionRows) ? modalPayload.options.fixActionRows : [],
      issueStateByIncident:
        modalPayload?.options?.issueStateByIncident
        && typeof modalPayload.options.issueStateByIncident === "object"
        && !Array.isArray(modalPayload.options.issueStateByIncident)
          ? modalPayload.options.issueStateByIncident
          : {},
      domainKey: String(modalPayload?.options?.domainKey || "streetlights").trim() || "streetlights",
      incidentLabel: String(modalPayload?.options?.incidentLabel || "").trim(),
      sharedLocation: String(modalPayload?.options?.sharedLocation || "").trim(),
      sharedAddress: String(modalPayload?.options?.sharedAddress || "").trim(),
      sharedCrossStreet: String(modalPayload?.options?.sharedCrossStreet || "").trim(),
      sharedLandmark: String(modalPayload?.options?.sharedLandmark || "").trim(),
      sharedCoordinates: String(modalPayload?.options?.sharedCoordinates || "").trim(),
      geoLoading: Boolean(modalPayload?.options?.geoLoading),
      currentState: String(modalPayload?.options?.currentState || "").trim(),
      lastChangedAt: String(modalPayload?.options?.lastChangedAt || "").trim(),
      hideSubmittedBy: Boolean(modalPayload?.options?.hideSubmittedBy),
      useSubmittedReportFormat: Boolean(modalPayload?.options?.useSubmittedReportFormat),
    });
  }, [
    actionsByLightId,
    adminReportDomain,
    incidentDisplaySupportDeps,
    incidentIssueStateByDomain,
    normalizeDomainKeyOrSlug,
    selectedDomainMarker,
    slIdByUuid,
  ]);
  const openMyReportsFromIncidentPopup = useCallback((popupInfo, domainOverride = "") => {
    const domainKey = String(
      normalizeDomainKeyOrSlug(domainOverride || popupInfo?.domainKey || "", { allowUnknown: true })
      || popupInfo?.domainKey
      || ""
    ).trim();
    const focusIncidentId = String(popupInfo?.incidentId || "").trim();
    const focusQuery = String(popupInfo?.displayId || "").trim() || focusIncidentId;
    if (!domainKey || !focusIncidentId) return;
    openMyReports({
      domainKey,
      focusIncidentId,
      focusQuery,
    });
  }, [normalizeDomainKeyOrSlug, openMyReports]);

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
  const selectedDomainMarkerDomain = useMemo(
    () => normalizeDomainKeyOrSlug(selectedDomainMarker?.domain, { allowUnknown: true }),
    [normalizeDomainKeyOrSlug, selectedDomainMarker?.domain]
  );
  useEffect(() => {
    if (!selectedDomainMarker) return undefined;
    let cancelled = false;
    void loadDeferredSelectionPopupIncidentSupportModule().then((module) => {
      if (!cancelled) setIncidentPopupSupport(module);
    }).catch(() => {
      // Keep the popup shell responsive even if deferred support fails.
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDomainMarker]);
  const incidentPopupSupportReady = Boolean(
    typeof incidentPopupSupport?.buildSharedConfiguredIncidentPopupVariantConfig === "function"
    && typeof incidentPopupSupport?.buildSharedIncidentDrivenPopupVariant === "function"
    && typeof incidentPopupSupport?.buildIncidentDrivenPopupVariantShared === "function"
    && typeof incidentPopupSupport?.buildIncidentPopupRenderModelShared === "function"
    && typeof incidentPopupSupport?.buildSelectedIncidentPopupInfoShared === "function"
    && typeof incidentPopupSupport?.resolveConfiguredDomainIssueLabelShared === "function"
    && typeof incidentPopupSupport?.resolveReportIssueLabelShared === "function"
    && typeof incidentPopupSupport?.resolveReportTypeOptionDetailsShared === "function"
    && typeof incidentPopupSupport?.resolveConfiguredDomainTypeSelectionLabelShared === "function"
    && typeof incidentPopupSupport?.formatConfiguredPopupDetailValueShared === "function"
    && typeof incidentPopupSupport?.ReportTypeOptionDetails === "function"
    && typeof incidentPopupSupport?.summarizeIssueTypes === "function"
  );
  const buildIncidentDrivenPopupVariant = useCallback((options = {}) => (
    incidentPopupSupport?.buildIncidentDrivenPopupVariantShared?.({
      ...options,
      getIncidentDomainHelper,
      formatConfiguredPopupDetailValue,
      buildSharedConfiguredIncidentPopupVariantConfig:
        incidentPopupSupport?.buildSharedConfiguredIncidentPopupVariantConfig,
      buildSharedIncidentDrivenPopupVariant:
        incidentPopupSupport?.buildSharedIncidentDrivenPopupVariant,
    }) || null
  ), [
    formatConfiguredPopupDetailValue,
    getIncidentDomainHelper,
    incidentPopupSupport,
  ]);
  const buildIncidentPopupRenderModel = useCallback((options = {}) => (
    incidentPopupSupport?.buildIncidentPopupRenderModelShared?.({
      ...options,
      isPlatformAdmin,
    }) || null
  ), [incidentPopupSupport, isPlatformAdmin]);
  const resolveIncidentDrivenLocationContextForRow = useCallback((domainKeyRaw, row) => (
    incidentPopupSupport?.resolveIncidentDrivenLocationContextForRowShared?.(domainKeyRaw, row, {
      incidentLocationCacheByKey,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
    }) || null
  ), [
    incidentPopupSupport,
    incidentLocationCacheByKey,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
  ]);
  const resolveIncidentDrivenDomainMeta = useCallback((domainKeyRaw, incidentIdRaw) => (
    incidentPopupSupport?.resolveIncidentDrivenDomainMetaShared?.(domainKeyRaw, incidentIdRaw, {
      getIncidentDomainHelper,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
      resolveIncidentDrivenRecord: (domainKey, incidentId) => {
        const normalizedDomainKey = normalizeDomainKeyOrSlug(domainKey, { allowUnknown: true }) || normalizeDomainKey(domainKey);
        const normalizedIncidentId = normalizeIncidentDrivenLookupIdShared(domainKey, incidentId, {
          getIncidentDomainHelper,
          normalizeDomainKeyOrSlug,
        });
        if (!(normalizedDomainKey && normalizedIncidentId)) return null;
        return incidentDrivenRecordMapByDomain?.get?.(normalizedDomainKey)?.get?.(normalizedIncidentId) || null;
      },
    })
  ), [
    getIncidentDomainHelper,
    incidentPopupSupport,
    incidentDrivenRecordMapByDomain,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
  ]);
  const getIncidentRepairSnapshot = useCallback((domainKeyRaw, incidentIdRaw) => (
    resolveIncidentRepairSnapshotShared(domainKeyRaw, incidentIdRaw, {
      incidentRepairProgressByKey,
      persistedIncidentRepairConfirmedKeySet,
    })
  ), [incidentRepairProgressByKey, persistedIncidentRepairConfirmedKeySet]);
  const incidentSnapshotCandidateDomains = useCallback((domainKeyRaw, incidentIdRaw) => (
    incidentSnapshotCandidateDomainsShared(domainKeyRaw, incidentIdRaw, {
      getIncidentDomainHelper,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
    })
  ), [getIncidentDomainHelper, normalizeDomainKey, normalizeDomainKeyOrSlug]);
  const resolveIncidentDrivenGroupMeta = useCallback((domainKeyRaw, incidentIdRaw, context = {}) => (
    incidentPopupSupport?.resolveIncidentDrivenGroupMetaShared?.(domainKeyRaw, incidentIdRaw, context, {
      formattedIncidentDisplayId,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
      resolveIncidentDrivenDomainMeta,
      slIdByUuid,
    })
  ), [
    formattedIncidentDisplayId,
    incidentPopupSupport,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
    resolveIncidentDrivenDomainMeta,
    slIdByUuid,
  ]);
  const resolveIncidentDrivenPopupMetaContext = useCallback((domainKeyRaw, incidentIdRaw, incidentIdsRaw = []) => (
    incidentPopupSupport?.resolveIncidentDrivenPopupMetaContextShared?.(domainKeyRaw, incidentIdRaw, incidentIdsRaw, {
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
      resolveIncidentDrivenDomainMeta,
    })
  ), [
    incidentPopupSupport,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
    resolveIncidentDrivenDomainMeta,
  ]);
  const resolveIncidentDrivenPopupLocationContext = useCallback((context = {}) => (
    incidentPopupSupport?.resolveIncidentDrivenPopupLocationContextShared?.(context, {
      incidentLocationCacheByKey,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
      resolveIncidentDrivenGroupMeta,
      resolveIncidentDrivenPopupMetaContext,
    })
  ), [
    incidentLocationCacheByKey,
    incidentPopupSupport,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
    resolveIncidentDrivenGroupMeta,
    resolveIncidentDrivenPopupMetaContext,
  ]);
  const resolveIncidentDrivenScopedIncidentIds = useCallback((domainKeyRaw, {
    marker = null,
    markerRows = [],
    markerId = "",
    fallbackIncidentId = "",
  } = {}) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
    if (!domainKey) {
      return {
        incidentId: "",
        incidentIds: [],
      };
    }

    const baseIncidentIds = collectIncidentIdsFromRowsLocal(
      markerRows,
      String(markerId || marker?.incident_id || marker?.light_id || fallbackIncidentId).trim()
    );
    const incidentId = incidentDomainCanonicalIncidentId(
      domainKey,
      marker,
      String(fallbackIncidentId || markerId || baseIncidentIds[0] || "").trim()
    );
    if (!incidentId) {
      return {
        incidentId: "",
        incidentIds: [],
      };
    }
    if (Boolean(getIncidentDomainHelper(domainKey)?.usesCanonicalPrefixedId)) {
      return {
        incidentId,
        incidentIds: [incidentId],
      };
    }
    return {
      incidentId,
      incidentIds: Array.from(new Set([
        incidentId,
        markerId,
        ...baseIncidentIds,
      ].filter(Boolean))),
    };
  }, [
    getIncidentDomainHelper,
    incidentDomainCanonicalIncidentId,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
  ]);
  const resolveIncidentDrivenCandidateRows = useCallback((domainKeyRaw, {
    markerRows = [],
    incidentIds = [],
    markerId = "",
    marker = null,
  } = {}) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
    if (!domainKey) return [];
    if (Array.isArray(markerRows) && markerRows.length) return markerRows;

    const domainRows = incidentDrivenRowsByDomain?.get?.(domainKey) || [];
    const candidateIds = new Set([
      ...((Array.isArray(incidentIds) ? incidentIds : []).map((id) => String(id || "").trim())),
      String(markerId || "").trim(),
    ].filter(Boolean));
    const markerLat = Number(marker?.lat);
    const markerLng = Number(marker?.lng);
    const fallbackCoordsKey = Number.isFinite(markerLat) && Number.isFinite(markerLng)
      ? `${markerLat.toFixed(5)}:${markerLng.toFixed(5)}`
      : "";

    return domainRows.filter((row) => {
      const rowIncidentId = String(row?.incident_id || row?.light_id || "").trim();
      const rowLightId = String(row?.light_id || "").trim();
      if ((rowIncidentId && candidateIds.has(rowIncidentId)) || (rowLightId && candidateIds.has(rowLightId))) {
        return true;
      }
      if (!fallbackCoordsKey) return false;
      const rowLat = Number(row?.lat);
      const rowLng = Number(row?.lng);
      if (!Number.isFinite(rowLat) || !Number.isFinite(rowLng)) return false;
      return `${rowLat.toFixed(5)}:${rowLng.toFixed(5)}` === fallbackCoordsKey;
    });
  }, [incidentDrivenRowsByDomain, normalizeDomainKey, normalizeDomainKeyOrSlug]);
  const passivePopupLocationLookupAttemptedRef = useRef(new Set());
  const getDeferredIncidentPopupLocationSupportDeps = useCallback(() => ({
    adminReportDomain,
    incidentLocationCacheByKey,
    passivePopupLocationLookupAttemptedRef,
    persistIncidentLocationCacheEntry,
    reverseGeocodeRoadLabel,
    setSelectedDomainMarker,
  }), [
    adminReportDomain,
    incidentLocationCacheByKey,
    persistIncidentLocationCacheEntry,
    reverseGeocodeRoadLabel,
    setSelectedDomainMarker,
  ]);
  const selectedIncidentDrivenPopupInfo = useMemo(() => {
    if (!selectedDomainMarker || !incidentPopupSupportReady) return null;
    return incidentPopupSupport.buildSelectedIncidentPopupInfoShared({
      domainKeyRaw: selectedDomainMarkerDomain || selectedDomainMarker?.domain || adminReportDomain,
      marker: selectedDomainMarker,
      getIncidentDomainHelper,
      getIncidentSnapshot,
      incidentSnapshotCandidateDomains,
      isLifecycleStateOpen,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
      reportIdentityKey,
      resolveConfiguredDomainIssueLabel,
      resolveIncidentDrivenCandidateRows,
      resolveIncidentDrivenFixTsForId,
      resolveIncidentDrivenPopupLocationContext,
      resolveIncidentDrivenPopupMetaContext,
      resolveIncidentDrivenScopedIncidentIds,
      resolveIncidentIssueLabelForDomain,
      resolveReportDomainLabel,
      resolveReportTypeOptionDetails,
      viewerIdentityKey,
    });
  }, [
    adminReportDomain,
    getIncidentDomainHelper,
    getIncidentSnapshot,
    incidentPopupSupport,
    incidentPopupSupportReady,
    incidentSnapshotCandidateDomains,
    isLifecycleStateOpen,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
    reportIdentityKey,
    resolveConfiguredDomainIssueLabel,
    resolveIncidentDrivenCandidateRows,
    resolveIncidentDrivenFixTsForId,
    resolveIncidentDrivenPopupLocationContext,
    resolveIncidentDrivenPopupMetaContext,
    resolveIncidentDrivenScopedIncidentIds,
    resolveIncidentIssueLabelForDomain,
    resolveReportDomainLabel,
    resolveReportTypeOptionDetails,
    selectedDomainMarker,
    selectedDomainMarkerDomain,
    viewerIdentityKey,
  ]);
  const selectedIncidentDrivenPopupVariant = useMemo(() => {
    if (
      !selectedDomainMarker
      || !selectedIncidentDrivenPopupInfo
      || !incidentPopupSupportReady
    ) return null;
    const domainKey = String(
      selectedIncidentDrivenPopupInfo?.domainKey
      || selectedDomainMarkerDomain
      || selectedDomainMarker?.domain
      || ""
    ).trim();
    if (!domainKey) return null;
    return buildIncidentDrivenPopupVariant({
      domainKey,
      popupInfo: selectedIncidentDrivenPopupInfo,
      marker: selectedDomainMarker,
      mappingMode,
      isAdmin,
      prefersDarkMode,
      onDeleteOfficialSign: openDeleteOfficialSignConfirm,
    });
  }, [
    buildIncidentDrivenPopupVariant,
    incidentPopupSupportReady,
    selectedDomainMarker,
    selectedIncidentDrivenPopupInfo,
    selectedDomainMarkerDomain,
    mappingMode,
    isAdmin,
    prefersDarkMode,
    openDeleteOfficialSignConfirm,
  ]);
  const incidentPopupAutoEnsureAttemptedRef = useRef(new Set());

  useEffect(() => {
    if (selectedIncidentDrivenPopupVariant && selectedDomainMarker) return;
    incidentPopupAutoEnsureAttemptedRef.current.clear();
  }, [selectedIncidentDrivenPopupVariant, selectedDomainMarker]);

  useEffect(() => {
    if (!isReportsAdminView) return;
    if (!selectedIncidentDrivenPopupVariant?.popupInfo || !selectedDomainMarker) return;

    const domainKey = normalizeDomainKeyOrSlug(
      selectedIncidentDrivenPopupVariant.domainKey || selectedIncidentDrivenPopupVariant.popupInfo?.domainKey,
      { allowUnknown: true }
    );
    if (!domainKey || domainKey === "streetlights") return;

    const popupIncidentKey = [
      domainKey,
      String(
        selectedIncidentDrivenPopupVariant.popupInfo?.incidentId
        || selectedDomainMarker?.incident_id
        || selectedDomainMarker?.id
        || selectedIncidentDrivenPopupVariant.popupInfo?.displayId
        || ""
      ).trim(),
    ].filter(Boolean).join(":");
    if (!popupIncidentKey) return;
    if (incidentPopupAutoEnsureAttemptedRef.current.has(popupIncidentKey)) return;

    incidentPopupAutoEnsureAttemptedRef.current.add(popupIncidentKey);
    void loadDeferredIncidentPopupLocationSupportModule()
      .then((module) => {
        const ensureMode = String(
          module?.resolveIncidentPopupLocationEnsureModeForMarkerShared?.(domainKey, {
            popupInfo: selectedIncidentDrivenPopupVariant.popupInfo,
            marker: selectedDomainMarker,
          }) || ""
        ).trim();
        if (!ensureMode) return null;
        return module?.ensureIncidentPopupLocationInfoForDetailsShared?.({
          domainKey,
          popupInfo: selectedIncidentDrivenPopupVariant.popupInfo,
          marker: selectedDomainMarker,
        }, getDeferredIncidentPopupLocationSupportDeps()) || null;
      })
      .then((resolvedLocation) => {
        const resolvedAddress = String(resolvedLocation?.nearestAddress || "").trim();
        const resolvedCrossStreet = String(resolvedLocation?.nearestCrossStreet || "").trim();
        const resolvedIntersection = String(resolvedLocation?.nearestIntersection || "").trim();
        const resolvedLandmark = String(resolvedLocation?.nearestLandmark || "").trim();
        const resolvedLocationLabel = String(
          resolvedLocation?.locationLabel
          || resolvedAddress
          || ""
        ).trim();
        if (!(resolvedAddress || resolvedCrossStreet || resolvedIntersection || resolvedLandmark || resolvedLocationLabel)) {
          return;
        }
        setSelectedDomainMarker((prev) => {
          if (!prev) return prev;
          const prevDomainKey = normalizeDomainKeyOrSlug(prev?.domain, { allowUnknown: true });
          if (prevDomainKey !== domainKey) return prev;
          const prevIncidentId = String(
            prev?.incident_id
            || prev?.id
            || prev?.display_id
            || ""
          ).trim();
          const currentIncidentId = String(
            selectedDomainMarker?.incident_id
            || selectedDomainMarker?.id
            || selectedIncidentDrivenPopupVariant.popupInfo?.incidentId
            || selectedIncidentDrivenPopupVariant.popupInfo?.displayId
            || ""
          ).trim();
          if (prevIncidentId && currentIncidentId && prevIncidentId !== currentIncidentId) return prev;
          return {
            ...prev,
            _geoLocationPending: false,
            _geoNearestAddress: resolvedAddress || prev?._geoNearestAddress || prev?.nearest_address || "",
            _geoNearestCrossStreet: resolvedCrossStreet || prev?._geoNearestCrossStreet || prev?.nearest_cross_street || "",
            _geoNearestIntersection: resolvedIntersection || prev?._geoNearestIntersection || prev?.nearest_intersection || "",
            _geoNearestLandmark: resolvedLandmark || prev?._geoNearestLandmark || prev?.nearest_landmark || "",
            location_label: resolvedLocationLabel || prev?.location_label || "",
            nearest_address: resolvedAddress || prev?.nearest_address || "",
            nearest_cross_street: resolvedCrossStreet || prev?.nearest_cross_street || "",
            nearest_intersection: resolvedIntersection || prev?.nearest_intersection || "",
            nearest_landmark: resolvedLandmark || prev?.nearest_landmark || "",
          };
        });
      })
      .catch(() => {
        incidentPopupAutoEnsureAttemptedRef.current.delete(popupIncidentKey);
      });
  }, [
    getDeferredIncidentPopupLocationSupportDeps,
    isReportsAdminView,
    normalizeDomainKeyOrSlug,
    selectedDomainMarker,
    selectedIncidentDrivenPopupVariant,
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
  const markerPopupIdButtonStyle = {
    padding: 0,
    border: "none",
    background: "transparent",
    color: "var(--sl-ui-link-text)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    fontWeight: 800,
    cursor: "copy",
    fontSize: 12,
    lineHeight: 1.35,
    textAlign: "left",
    width: "fit-content",
  };
  const markerPopupCloseButtonStyle = {
    position: "absolute",
    marginLeft: "auto",
    right: 8,
    top: 8,
    width: 26,
    height: 26,
    borderRadius: 999,
    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
    background: "var(--sl-ui-modal-btn-secondary-bg)",
    color: "var(--sl-ui-modal-btn-secondary-text)",
    cursor: "pointer",
    fontWeight: 900,
    lineHeight: 1,
  };
  const getMarkerPopupPlacement = (pixel, { estimatedHeight = 320, maxWidth = 280 } = {}) => {
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
  };
  const selectedDomainPopupPixel = useMemo(() => (
    selectedDomainMarker
      ? projectPopupPixel?.(selectedDomainMarker.lat, selectedDomainMarker.lng) || null
      : null
  ), [
    mapCenter,
    mapInteracting,
    mapZoom,
    projectPopupPixel,
    selectedDomainMarker,
  ]);
  const selectedDomainPopupPlacement = getMarkerPopupPlacement(selectedDomainPopupPixel, { estimatedHeight: 340 });
  const markerPopupActionSecondary = {
    ...btnPopupSecondary,
    padding: "8px 10px",
    borderRadius: 9,
  };
  const markerPopupActionPrimary = {
    ...btnPopupPrimary,
    padding: "8px 10px",
    borderRadius: 9,
  };
  const markerPopupActionDanger = {
    ...markerPopupActionPrimary,
    background: "#d32f2f",
  };
  const markerPopupCopyValueStyle = {
    wordBreak: "break-word",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    color: "var(--sl-ui-link-text)",
    fontWeight: 700,
  };
  const markerPopupCopyRowStyle = {
    borderRadius: 7,
    padding: "2px 4px",
    cursor: "copy",
    userSelect: "text",
    fontSize: 12,
    opacity: 0.92,
    lineHeight: 1.35,
  };
  const renderSelectedDomainPopupFrame = (title, children) => (
    <div
      style={selectedDomainPopupPlacement.frameStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div style={{ ...markerPopupCardStyle, gap: 10 }}>
        <button
          type="button"
          onClick={() => setSelectedDomainMarker(null)}
          aria-label="Close"
          style={markerPopupCloseButtonStyle}
        >
          ×
        </button>
        <div style={{ fontWeight: 900, paddingRight: 26 }}>{title}</div>
        {children}
      </div>
      <div style={selectedDomainPopupPlacement.arrowStyle} />
    </div>
  );
  const openIncidentPopupLocationDetails = useCallback(async ({
    domainKey = "",
    popupInfo = null,
    marker = null,
    renderModel = null,
  } = {}) => {
    const normalizedDomainKey = normalizeDomainKeyOrSlug(domainKey, { allowUnknown: true })
      || String(domainKey || popupInfo?.domainKey || "").trim().toLowerCase();
    const incidentId = String(popupInfo?.incidentId || marker?.incident_id || marker?.id || "").trim();
    if (!normalizedDomainKey || !incidentId || !popupInfo) return;

    const fallbackLat = Number(marker?.lat);
    const fallbackLng = Number(marker?.lng);
    const domainLabel = singularizeDomainLabel(
      String(popupInfo?.domainLabel || resolveReportDomainLabel(normalizedDomainKey, "Incident")).trim() || "Incident",
      "Incident"
    );
    const displayId = String(renderModel?.displayId || popupInfo?.displayId || "").trim() || incidentId;
    const nearestAddress = String(renderModel?.nearestAddress || popupInfo?.nearestAddress || popupInfo?.locationDisplay || "").trim() || "Unavailable";
    const nearestCrossStreet = String(popupInfo?.nearestCrossStreet || "").trim() || "Unavailable";
    const nearestIntersection = String(popupInfo?.nearestIntersection || "").trim() || "Unavailable";
    const nearestLandmark = String(renderModel?.nearestLandmark || popupInfo?.nearestLandmark || "").trim() || "Unavailable";
    const coordinates = String(renderModel?.coordsText || popupInfo?.coordsText || "").trim() || "Unavailable";
    const incidentLocationKey = incidentLocationCacheKey(normalizedDomainKey, incidentId)
      || `${normalizedDomainKey}:${displayId || incidentId}`;
    const shouldLookupGeo =
      Number.isFinite(fallbackLat)
      && Number.isFinite(fallbackLng)
      && (
        !isUsableAddressText(nearestAddress)
        || isPlaceholderLocationText(nearestCrossStreet)
        || isPlaceholderLocationText(nearestIntersection)
        || isPlaceholderLocationText(nearestLandmark)
      );
    const buildLocationRows = (addressValue, crossStreetValue, intersectionValue, landmarkValue) => ([
      { label: "Nearest address", value: addressValue },
      { label: "Closest cross street", value: crossStreetValue },
      { label: "Closest intersection", value: intersectionValue },
      { label: "Closest landmark", value: landmarkValue },
      { label: "Coordinates", value: coordinates },
    ]);

    setIncidentLocationModal({
      open: true,
      title: `${domainLabel} ${displayId}`.trim(),
      rows: buildLocationRows(nearestAddress, nearestCrossStreet, nearestIntersection, nearestLandmark),
      loading: shouldLookupGeo,
      incidentKey: incidentLocationKey,
      domainKey: normalizedDomainKey,
      copyHint: normalizedDomainKey === "streetlights" ? "Tap or click any line below to copy." : "",
      showReportToUtility: normalizedDomainKey === "streetlights",
    });
    if (!shouldLookupGeo) return;

    try {
      const locationSupportModule = await loadDeferredIncidentPopupLocationSupportModule();
      const resolvedLocation =
        await locationSupportModule?.ensureIncidentPopupLocationInfoForDetailsShared?.({
          domainKey: normalizedDomainKey,
          popupInfo,
          marker,
          renderModel,
        }, getDeferredIncidentPopupLocationSupportDeps())
        || null;
      const resolvedAddress = String(resolvedLocation?.nearestAddress || "").trim() || nearestAddress;
      const resolvedCrossStreet = String(resolvedLocation?.nearestCrossStreet || "").trim() || nearestCrossStreet;
      const resolvedIntersection = String(resolvedLocation?.nearestIntersection || "").trim() || nearestIntersection;
      const resolvedLandmark = String(resolvedLocation?.nearestLandmark || "").trim() || nearestLandmark;
      setIncidentLocationModal((prev) => {
        if (!prev?.open || String(prev?.incidentKey || "").trim() !== incidentLocationKey) return prev;
        return {
          ...prev,
          rows: buildLocationRows(resolvedAddress, resolvedCrossStreet, resolvedIntersection, resolvedLandmark),
          loading: false,
        };
      });
    } catch {
      setIncidentLocationModal((prev) => {
        if (!prev?.open || String(prev?.incidentKey || "").trim() !== incidentLocationKey) return prev;
        return {
          ...prev,
          loading: false,
        };
      });
    }
  }, [
    getDeferredIncidentPopupLocationSupportDeps,
    resolveReportDomainLabel,
  ]);
  const renderIncidentPopupAdminDetails = ({
    domainKey,
    popupInfo,
    domainIdFallback = "Incident",
    currentState = "",
    issueTypes = [],
    location = "Unavailable",
    coordinates = "Unavailable",
    landmark = "Unavailable",
  }) => {
    const isOrgManagedDomain = isOrganizationManagedIncidentDomain(domainKey);
    const normalizedState = String(currentState || popupInfo?.currentState || "").trim() || "reported";
    const formattedCoordinates = String(coordinates || "").trim() || "Unavailable";
    return (
      <Suspense fallback={null}>
        <LazyAdminIncidentInfoWindowDetails
          domainId={popupInfo?.displayId || domainIdFallback}
          onCopyDomainId={() => {
            void copyIncidentPopupLocationField("Incident ID", popupInfo?.displayId || domainIdFallback);
          }}
          stateLabel={
            isOrgManagedDomain
              ? adminFacingIncidentStateLabel(normalizedState)
              : incidentStateLabel(normalizedState)
          }
          summaryLabel={isOrgManagedDomain ? "State" : "Status"}
          showReportCount={isOrgManagedDomain}
          reportCount={Number(popupInfo?.openCount || 0)}
          issueTypes={issueTypes}
          location={location || popupInfo?.locationDisplay || "Unavailable"}
          crossStreet={String(popupInfo?.nearestCrossStreet || "").trim() || "Unavailable"}
          intersection={String(popupInfo?.nearestIntersection || "").trim() || "Unavailable"}
          landmark={landmark || popupInfo?.nearestLandmark || "Unavailable"}
          coordinates={formattedCoordinates}
          onCopyCoordinates={() => {
            void copyIncidentPopupLocationField("Coordinates", formattedCoordinates);
          }}
        />
      </Suspense>
    );
  };
  const renderIncidentPopupResidentDetails = ({
    domainIdFallback = "Incident",
    popupInfo,
    issueLabel = "",
    typeOptionDetails = [],
    showIssueFallback = true,
    coordinates = "",
    currentState = "",
    showCoordinates = false,
    onOpenIncidentLocation = null,
  }) => {
    const DeferredReportTypeOptionDetails = incidentPopupSupport?.ReportTypeOptionDetails || null;
    const domainId = popupInfo?.displayId || domainIdFallback;
    const normalizedCoordinates = String(coordinates || "").trim() || popupInfo?.coordsText || "Unavailable";
    const normalizedState = String(currentState || popupInfo?.currentState || "").trim() || "reported";
    const details = Array.isArray(typeOptionDetails) ? typeOptionDetails : [];
    return (
      <>
        <div style={{ fontSize: 12, opacity: 0.95, lineHeight: 1.35 }}>
          <b>ID:</b>{" "}
          <button
            type="button"
            onClick={() => {
              if (typeof onOpenIncidentLocation === "function") {
                onOpenIncidentLocation();
                return;
              }
              void copyIncidentPopupLocationField("Incident ID", domainId);
            }}
            title={typeof onOpenIncidentLocation === "function" ? "Open incident location information" : "Click to copy incident ID"}
            style={markerPopupIdButtonStyle}
          >
            {domainId}
          </button>
        </div>
        {!!String(issueLabel || "").trim() && showIssueFallback && !hasIssueTypeOptionDetail(details) && (
          <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
            <span style={{ fontWeight: 800, color: "var(--sl-ui-text)" }}>Issue Type:</span>{" "}
            <span style={markerPopupCopyValueStyle}>{issueLabel}</span>
          </div>
        )}
        {details.length > 0 && DeferredReportTypeOptionDetails ? (
          <DeferredReportTypeOptionDetails
            details={details}
            textStyle={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}
          />
        ) : null}
        <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
          <span style={{ fontWeight: 800, color: "var(--sl-ui-text)" }}>Status:</span>{" "}
          <span style={markerPopupCopyValueStyle}>{incidentStateLabel(normalizedState)}</span>
        </div>
        {showCoordinates ? (
          <button
            type="button"
            onClick={() => {
              void copyIncidentPopupLocationField("Coordinates", normalizedCoordinates);
            }}
            title="Click to copy coordinates"
            style={{ ...markerPopupCopyRowStyle, width: "100%", textAlign: "left", border: "none", background: "transparent" }}
          >
            <span style={{ fontWeight: 800, opacity: 0.9, color: "var(--sl-ui-text)" }}>Coordinates:</span>{" "}
            <span style={markerPopupCopyValueStyle}>{normalizedCoordinates}</span>
          </button>
        ) : null}
      </>
    );
  };
  const renderIncidentPopupRepairButton = ({
    incidentId = "",
    domainKey = "",
    repairSnapshot = null,
  }) => {
    const normalizedIncidentId = String(incidentId || "").trim();
    const normalizedDomainKey = String(domainKey || "").trim();
    if (!normalizedIncidentId || !normalizedDomainKey) return null;
    const showPublicRepairAction = canShowPublicRepairAction(normalizedIncidentId, normalizedDomainKey);
    if (!showPublicRepairAction && !repairSnapshot?.viewerHasRepairSignal) return null;
    return (
      <button
        type="button"
        onClick={() => requestIncidentRepairConfirmation(normalizedIncidentId, normalizedDomainKey)}
        disabled={Boolean(repairSnapshot?.viewerHasRepairSignal)}
        style={repairActionButtonStyle(
          markerPopupActionPrimary,
          Boolean(repairSnapshot?.viewerHasRepairSignal),
          { background: "var(--sl-ui-brand-green)" }
        )}
      >
        Is fixed
      </button>
    );
  };
  const renderIncidentPopupViewReportButton = ({
    popupInfo = null,
    domainKey = "",
  }) => {
    if (!popupInfo?.viewerHasReport) return null;
    return (
      <button
        type="button"
        onClick={() => openMyReportsFromIncidentPopup(popupInfo, domainKey)}
        style={markerPopupActionSecondary}
      >
        View Report
      </button>
    );
  };
  const renderIncidentPopupAdminActionGroup = ({
    domainKey = "",
    popupInfo = null,
    incidentId = "",
    currentState = "",
    clusterReports = [],
    isOfficial = false,
    showAllReports = false,
    allowUpdateState = true,
  }) => {
    const normalizedDomainKey = String(domainKey || "").trim();
    const normalizedIncidentId = String(incidentId || "").trim();
    if (!normalizedDomainKey || !normalizedIncidentId || !popupInfo) return null;
    const publicRepairLifecycleEnabled = isPublicRepairEnabledForDomain(normalizedDomainKey);
    const repairSnapshot = publicRepairLifecycleEnabled && normalizedIncidentId
      ? getIncidentRepairSnapshot(normalizedDomainKey, normalizedIncidentId)
      : null;
    const showPublicRepairAction = canShowPublicRepairAction(normalizedIncidentId, normalizedDomainKey);
    const canShowOrganizationRepairAction = canManageIncidentDomainRepairs(normalizedDomainKey) && !showPublicRepairAction;
    const isOrgManagedDomain = isOrganizationManagedIncidentDomain(normalizedDomainKey);
    if (!canShowOrganizationRepairAction && !showPublicRepairAction && !repairSnapshot?.viewerHasRepairSignal && !showAllReports) {
      return null;
    }
    return (
      <>
        {showAllReports && isOrgManagedDomain ? (
          <button
            type="button"
            onClick={() => openIncidentAllReportsFromMarker(selectedDomainMarker, normalizedDomainKey, popupInfo)}
            style={markerPopupActionSecondary}
          >
            All Reports
          </button>
        ) : null}
        {allowUpdateState && canShowOrganizationRepairAction ? (
          <button
            type="button"
            onClick={() => {
              openIncidentStatusDialogForTarget({
                incidentId: normalizedIncidentId,
                domainKey: normalizedDomainKey,
                currentState: currentState || popupInfo?.currentState || "reported",
                clusterReports,
                incidentLabel: popupInfo?.displayId || normalizedIncidentId,
                isOfficial,
                marker: selectedDomainMarker,
              });
            }}
            style={{ ...markerPopupActionPrimary, background: "var(--sl-ui-brand-green)" }}
          >
            Update State
          </button>
        ) : null}
        {renderIncidentPopupRepairButton({
          incidentId: normalizedIncidentId,
          domainKey: normalizedDomainKey,
          repairSnapshot,
        })}
      </>
    );
  };
  const renderIncidentPopupResidentRepairGroup = ({
    domainKey = "",
    popupInfo = null,
    incidentId = "",
  }) => {
    const normalizedDomainKey = String(domainKey || "").trim();
    const normalizedIncidentId = String(incidentId || "").trim();
    if (!normalizedDomainKey || !normalizedIncidentId || !popupInfo) return null;
    const publicRepairLifecycleEnabled = isPublicRepairEnabledForDomain(normalizedDomainKey);
    const repairSnapshot = publicRepairLifecycleEnabled && normalizedIncidentId
      ? getIncidentRepairSnapshot(normalizedDomainKey, normalizedIncidentId)
      : null;
    const repairButton = renderIncidentPopupRepairButton({
      incidentId: normalizedIncidentId,
      domainKey: normalizedDomainKey,
      repairSnapshot,
    });
    if (!popupInfo?.viewerHasReport && !repairButton) return null;
    return (
      <>
        {renderIncidentPopupViewReportButton({ popupInfo, domainKey: normalizedDomainKey })}
        {repairButton}
      </>
    );
  };
  const renderIncidentPopupReportIssueButton = ({
    domainKey = "",
    popupInfo = null,
    marker = null,
    typeValue = "",
    signType = "",
    extraTarget = {},
  }) => {
    if (!popupInfo || popupInfo?.viewerHasReport) return null;
    const canReportHere = Number(mapZoom) >= REPORTING_MIN_ZOOM;
    return (
      <button
        type="button"
        disabled={!canReportHere}
        onClick={() => {
          void loadDeferredIncidentPopupReportTargetSupportModule().then((module) => {
            const nextTarget = module?.buildIncidentPopupReportTargetShared?.({
              domainKey,
              popupInfo,
              marker,
              typeValue,
              signType,
              extra: extraTarget,
              resolveReportDomainLabel,
            }) || null;
            if (!nextTarget) return;
            openDomainReportFlow(nextTarget);
          });
        }}
        style={{
          ...markerPopupActionPrimary,
          background: "var(--sl-ui-brand-blue)",
          cursor: canReportHere ? "pointer" : "not-allowed",
          opacity: canReportHere ? 1 : 0.6,
        }}
        title={canReportHere ? "Report issue" : "Zoom in closer to report"}
      >
        Report issue
      </button>
    );
  };
  const renderSelectedIncidentDrivenPopup = (variant) => {
    if (!variant?.popupInfo || !selectedDomainMarker) return null;
    const renderModel = buildIncidentPopupRenderModel({
      popupInfo: variant.popupInfo,
      marker: selectedDomainMarker,
      ...(variant.renderModelOptions || {}),
    });
    if (!renderModel) return null;
    return renderSelectedDomainPopupFrame(variant.title, (
      <>
        {isReportsAdminView ? (
          renderIncidentPopupAdminDetails({
            domainKey: variant.domainKey,
            popupInfo: {
              ...(renderModel.adminDetailsProps.popupInfo || {}),
              ...(variant.adminPopupInfoExtra || {}),
            },
            ...renderModel.adminDetailsProps,
          })
        ) : (
          renderIncidentPopupResidentDetails({
            ...renderModel.residentDetailsProps,
            onOpenIncidentLocation: () => {
              void openIncidentPopupLocationDetails({
                domainKey: variant.domainKey,
                popupInfo: variant.popupInfo,
                marker: selectedDomainMarker,
                renderModel,
              });
            },
          })
        )}
        {isReportsAdminView ? (
          <>
            {variant.adminAction
              ? renderIncidentPopupAdminActionGroup({
                domainKey: variant.domainKey,
                popupInfo: variant.popupInfo,
                ...variant.adminAction,
              })
              : null}
            {variant.adminExtrasDescriptor ? (
              <Suspense fallback={null}>
                <LazyIncidentPopupAdminExtras
                  descriptor={variant.adminExtrasDescriptor}
                  prefersDarkMode={prefersDarkMode}
                  onDeleteOfficialSignConfirm={openDeleteOfficialSignConfirm}
                />
              </Suspense>
            ) : typeof variant.renderAdminExtras === "function" ? variant.renderAdminExtras() : null}
          </>
        ) : (
          <>
            {variant.resident?.showZoomHintWhenUnreported
              && !variant.popupInfo?.viewerHasReport
              && Number(mapZoom) < REPORTING_MIN_ZOOM ? (
                <div style={{ fontSize: 11.5, opacity: 0.78, lineHeight: 1.25 }}>
                  Zoom in closer to report this sign.
                </div>
              ) : null}
            {variant.resident?.showActionSpacer ? <div style={{ height: 4 }} /> : null}
            {variant.resident?.reportIssue
              ? renderIncidentPopupReportIssueButton({
                domainKey: variant.domainKey,
                popupInfo: variant.popupInfo,
                marker: selectedDomainMarker,
                ...variant.resident.reportIssue,
              })
              : null}
            {variant.resident?.repairIncidentId
              ? renderIncidentPopupResidentRepairGroup({
                domainKey: variant.domainKey,
                popupInfo: variant.popupInfo,
                incidentId: variant.resident.repairIncidentId,
              })
              : null}
          </>
        )}
      </>
    ));
  };

  return (
    <>
      {!bulkMode && selectedIncidentDrivenPopupVariant && selectedDomainMarker && selectedDomainPopupPixel && (
        renderSelectedIncidentDrivenPopup(selectedIncidentDrivenPopupVariant)
      )}

      {!bulkMode
        && selectedDomainMarker
        && selectedDomainPopupPixel
        && !selectedIncidentDrivenPopupVariant
        && !incidentPopupSupportReady && (
          renderSelectedDomainPopupFrame(
            resolveReportDomainLabel(selectedDomainMarkerDomain || selectedDomainMarker?.domain || "", "Incident"),
            (
              <div style={{ fontSize: 12.5, opacity: 0.82, lineHeight: 1.4 }}>
                Loading incident details...
              </div>
            )
          )
        )}

      {Boolean(allReportsModal?.open) ? (
        <Suspense fallback={null}>
          <LazyAllReportsModal
            open={Boolean(allReportsModal?.open)}
            title={allReportsModal?.title || "All Reports"}
            items={allReportsModal?.items || []}
            reportRows={allReportsModal?.reportRows || []}
            fixActionRows={allReportsModal?.fixActionRows || []}
            issueStateByIncident={allReportsModal?.issueStateByIncident || {}}
            domainKey={allReportsModal?.domainKey || "streetlights"}
            incidentLabel={allReportsModal?.incidentLabel || ""}
            sharedLocation={allReportsModal?.sharedLocation || ""}
            sharedAddress={allReportsModal?.sharedAddress || ""}
            sharedCrossStreet={allReportsModal?.sharedCrossStreet || ""}
            sharedLandmark={allReportsModal?.sharedLandmark || ""}
            sharedCoordinates={allReportsModal?.sharedCoordinates || ""}
            geoLoading={Boolean(allReportsModal?.geoLoading)}
            currentState={allReportsModal?.currentState || ""}
            lastChangedAt={allReportsModal?.lastChangedAt || ""}
            onCopyField={copyIncidentPopupLocationField}
            onClose={() => setAllReportsModal((prev) => ({ ...prev, open: false }))}
            isMobile={Boolean(useAppShellLayout)}
            preferCompactBehavior={Boolean(isNativeAppRuntime)}
            hideSubmittedBy={Boolean(allReportsModal?.hideSubmittedBy)}
            useSubmittedReportFormat={Boolean(allReportsModal?.useSubmittedReportFormat)}
            isWorkingReportType={isWorkingReportType}
            resolveReportIssueLabel={resolveReportIssueLabel}
            runtimeDomainMeta={RUNTIME_DOMAIN_META}
          />
        </Suspense>
      ) : null}

      {!!incidentLocationCopyToast && incidentLocationCopyToast?.scope !== "incident_location_modal" && (
        <div
          style={{
            position: "fixed",
            top: incidentLocationCopyToast?.y ?? 48,
            left: incidentLocationCopyToast?.x ?? 18,
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
          {incidentLocationCopyToast?.text || "Copied to clipboard"}
        </div>
      )}

      {Boolean(incidentLocationModal?.open) ? (
        <Suspense fallback={null}>
          <LazyIncidentLocationModal
            open={Boolean(incidentLocationModal?.open)}
            title={incidentLocationModal?.title || "Incident Location"}
            rows={incidentLocationModal?.rows || []}
            loading={Boolean(incidentLocationModal?.loading)}
            copyHint={incidentLocationModal?.copyHint || ""}
            copyToast={incidentLocationCopyToast}
            onCopyRow={(row, anchorEl) => {
              void copyIncidentPopupLocationField(
                row?.label || "Location field",
                row?.value || "",
                anchorEl || null
              );
            }}
            showReportToUtility={Boolean(incidentLocationModal?.showReportToUtility)}
            onReportToUtility={() => {
              void loadPlatformExternalModule().then(({ openExternalUrl }) => openExternalUrl(STREETLIGHT_UTILITY_REPORT_URL));
            }}
            reportToUtilityLabel="Report to Utility"
            onClose={() => setIncidentLocationModal({
              open: false,
              title: "",
              rows: [],
              loading: false,
              incidentKey: "",
              domainKey: "",
              copyHint: "",
              showReportToUtility: false,
            })}
          />
        </Suspense>
      ) : null}
    </>
  );
}
