import React, { Fragment, Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildStreetlightUtilityRows,
  displayLightId,
  isPlaceholderLocationText,
  isUsableAddressText,
  stripSystemMetadataFromNote,
} from "./lib/mapPopupDetailSupport.jsx";
import {
  NO_REPORT_DOMAINS_KEY,
  REPORT_DOMAIN_OPTIONS,
  normalizeExplicitDomainSelection,
} from "./lib/mapDomainSelectionConfig.js";
import { REPORT_TYPES } from "./lib/mapDomainTypeOptionSupport.js";
import {
  isLifecycleStateOpen,
  incidentStateLabel,
} from "./lib/incidentLifecycle.js";
import {
  formattedIncidentDisplayIdShared,
  incidentIdLabelForDomainShared,
} from "./lib/mapIncidentDisplaySupport.js";
import {
  reportNumberForRowShared,
  resolveReportDomainLabelShared,
} from "./lib/mapReportDisplaySupport.js";
import {
  isWorkingReportType,
  reportIdentityKey,
} from "./lib/mapIncidentIdentitySupport.js";
import { STREETLIGHT_UTILITY_REPORT_URL } from "./lib/mapPopupSharedConfig.js";
import { getCoordsForLightId } from "./lib/mapLightCoordinateSupport.js";
import {
  incidentLocationCacheKey,
  incidentLocationCacheStorageKey,
  mergeIncidentLocationCacheMaps,
  readPersistedIncidentLocationCache,
  sanitizeIncidentLocationCacheMap,
} from "./lib/mapIncidentLocationCacheSupport.js";
import {
  incidentSnapshotKey,
  resolveIncidentRepairSnapshotShared,
} from "./lib/mapIncidentRepairSupport.js";
import {
  isMissingUtilityReportReferenceColumnError,
  normalizeUtilityReportReference,
} from "./lib/mapIncidentDeferredSupport.js";
import {
  resolveIncidentDrivenDomainMetaShared,
  resolveIncidentDrivenGroupMetaShared,
} from "./lib/mapIncidentPopupLocationSupport.js";
import {
  hydrateIncidentLocationFieldsShared,
  resolveIncidentDrivenLocationContextForRowShared,
  resolveStreetlightUtilityForIncidentShared,
} from "./lib/mapIncidentRowLocationSupport.js";
import {
  incidentDomainResolveLookupValueByModeShared,
  incidentSnapshotCandidateDomainsShared,
  searchableIncidentLookupIdsForDomainShared,
} from "./lib/mapIncidentDomainHelperSupport.js";
import {
  defaultMarkerColorForDomainShared,
  resolveHighConfidenceMarkerColorForDomainShared,
} from "./lib/mapDomainMarkerColorSupport.js";
import { getIncidentDomainHelperShared } from "./lib/mapIncidentDomainConfig.js";
import { prefixedIncidentDomainKeyShared } from "./lib/mapIncidentPrefixSupport.js";
import { RUNTIME_DOMAIN_META } from "./lib/mapRuntimeDomainMeta.js";
import {
  resolveConfiguredDomainIssueLabelShared,
  resolveReportIssueLabelShared,
} from "./lib/mapReportIssueLabelSupport.js";
import { resolveReportTypeOptionDetails as resolveReportTypeOptionDetailsShared } from "./lib/mapReportTypeOptionSupport.js";
import {
  activeTenantKey,
  normalizeDomainKey,
  normalizeDomainKeyOrSlug,
  normalizeEmail,
  normalizePhone,
  readAddressFromNote,
  readCrossStreetFromNote,
  readIntersectionFromNote,
  readLandmarkFromNote,
  readLocationFromNote,
  reportDomainForRow,
  reportDomainFromLightId,
  singularizeDomainLabel,
} from "./lib/mapReportParsingSupport.js";
import { formatTs } from "./lib/mapTimestampFormatSupport.js";
import { humanizeLabel } from "./lib/workspaceLabelSupport.js";
import {
  ActionButtonIcon,
  AppIcon,
} from "./mapUiIconComponentsSupport.jsx";
import {
  DomainAppIcon,
  DomainSelectorListIcon,
} from "./mapDomainIconComponentsSupport.jsx";
import { RUNTIME_UI_ICON_SRC as UI_ICON_SRC } from "./mapUiIconRuntimeSupport.js";
import { openExternalUrl } from "./platform/external.js";
import { supabase } from "./supabaseClient";

const LazyIncidentLocationModal = lazy(() => import("./mapLazyReportInspectors.jsx").then((module) => ({ default: module.IncidentLocationModal })));
const LazyAllReportsModal = lazy(() => import("./mapLazyReportInspectors.jsx").then((module) => ({ default: module.AllReportsModal })));
const LazyReporterDetailsModal = lazy(() => import("./mapLazyReportInspectors.jsx").then((module) => ({ default: module.ReporterDetailsModal })));
const LazyOpenReportsAdminListPanel = lazy(() => import("./mapLazyOpenReportsAdminListPanel.jsx"));
const LazyOpenReportsResidentListPanel = lazy(() => import("./mapLazyOpenReportsResidentListPanel.jsx"));
const LazyOpenReportsDatePickerModal = lazy(() => import("./mapLazyOpenReportsDialogs.jsx").then((module) => ({ default: module.OpenReportsDatePickerModal })));
const LazyOpenReportsSubmittedReportsModal = lazy(() => import("./mapLazyOpenReportsDialogs.jsx").then((module) => ({ default: module.OpenReportsSubmittedReportsModal })));
const LazyOpenReportsSavedStreetlightReportModal = lazy(() => import("./mapLazyOpenReportsDialogs.jsx").then((module) => ({ default: module.OpenReportsSavedStreetlightReportModal })));
const LazyOpenReportsUtilityReportDialogModal = lazy(() => import("./mapLazyOpenReportsDialogs.jsx").then((module) => ({ default: module.OpenReportsUtilityReportDialogModal })));

const EXPORT_SCHEMA_VERSION = "v1";
let deferredOpenReportsExportSupportModulePromise = null;
let deferredOpenReportsPersonalSupportModulePromise = null;

function loadDeferredOpenReportsExportSupportModule() {
  if (!deferredOpenReportsExportSupportModulePromise) {
    deferredOpenReportsExportSupportModulePromise = import("./lib/mapDeferredOpenReportsExportSupport.js");
  }
  return deferredOpenReportsExportSupportModulePromise;
}

function loadDeferredOpenReportsPersonalSupportModule() {
  if (!deferredOpenReportsPersonalSupportModulePromise) {
    deferredOpenReportsPersonalSupportModulePromise = import("./lib/mapDeferredOpenReportsPersonalSupport.js");
  }
  return deferredOpenReportsPersonalSupportModulePromise;
}

function isPointInBounds(lat, lng, bounds) {
  if (!bounds) return false;
  const north = Number(bounds.north);
  const south = Number(bounds.south);
  const east = Number(bounds.east);
  const west = Number(bounds.west);
  if (![lat, lng, north, south, east, west].every(Number.isFinite)) return false;
  const latOk = lat <= north && lat >= south;
  const lngOk = west <= east ? (lng >= west && lng <= east) : (lng >= west || lng <= east);
  return latOk && lngOk;
}

function ModalShell({ open, children, zIndex = 9999, panelStyle, fullScreen = false, overlayStyle = null }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: fullScreen ? "var(--sl-ui-modal-bg)" : "rgba(0,0,0,0.4)",
        display: "grid",
        placeItems: fullScreen ? "stretch" : "center",
        zIndex,
        padding: fullScreen ? 0 : 16,
        animation: fullScreen ? "none" : "sl-modal-overlay-enter 140ms ease-out both",
        ...(overlayStyle || {}),
      }}
    >
      <div
        style={{
          background: "var(--sl-ui-modal-bg)",
          border: fullScreen ? "none" : "1px solid var(--sl-ui-modal-border)",
          color: "var(--sl-ui-text)",
          fontFamily: "var(--app-header-font-family)",
          padding: fullScreen
            ? "calc(env(safe-area-inset-top) + 12px) 14px calc(env(safe-area-inset-bottom) + 12px)"
            : 18,
          borderRadius: fullScreen ? 0 : 10,
          width: fullScreen ? "100vw" : "min(360px, 100%)",
          maxWidth: fullScreen ? "100vw" : undefined,
          minWidth: fullScreen ? "100vw" : undefined,
          height: fullScreen ? "100dvh" : undefined,
          maxHeight: fullScreen ? "100dvh" : undefined,
          display: "grid",
          gap: 12,
          boxShadow: fullScreen ? "none" : "var(--sl-ui-modal-shadow)",
          pointerEvents: "auto",
          animation: fullScreen
            ? "sl-mobile-page-enter 155ms cubic-bezier(0.2, 0.8, 0.2, 1) both"
            : "sl-modal-panel-enter 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
          ...(panelStyle || {}),
        }}
      >
        {children}
      </div>
    </div>
  );
}

function toLocalIsoDate(value) {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalIsoDate(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const d = new Date(y, month - 1, day, 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function incidentDomainUsesAdminExportAllDomainReportsLocal(domainKeyRaw, deps = {}) {
  const { getIncidentDomainHelper, normalizeDomainKeyOrSlug } = deps;
  if (typeof getIncidentDomainHelper !== "function") return false;
  const domainKey = typeof normalizeDomainKeyOrSlug === "function"
    ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
    : String(domainKeyRaw || "").trim().toLowerCase();
  if (!domainKey) return false;
  return Boolean((getIncidentDomainHelper(domainKey) || {})?.adminExportUsesAllDomainReports);
}

function buildAdminIncidentLabelForDomain(
  incidentIdLabelForDomain,
  formattedIncidentDisplayId,
  domain,
  incidentId,
  reportNumber,
  slIdByUuid,
  displayId = "",
) {
  void reportNumber;
  const id = String(incidentId || "").trim();
  const shown = String(displayId || "").trim();
  if (!id) return "Unknown incident";
  const normalizedDisplayId =
    formattedIncidentDisplayId(domain, id, null, shown, slIdByUuid)
    || shown
    || id;
  return `${incidentIdLabelForDomain(domain)} ${normalizedDisplayId}`;
}

function buildIncidentDisplayValueForDomain(
  incidentIdLabelForDomain,
  formattedIncidentDisplayId,
  normalizeDomainKey,
  normalizeDomainKeyOrSlug,
  domainKeyRaw,
  incidentIdRaw,
  coords = null,
  incidentLabel = "",
  explicitDisplayId = "",
  slIdByUuid = null,
) {
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
  const labelText = String(incidentLabel || "").trim();
  const labelPrefix = incidentIdLabelForDomain(domainKey, "").trim();
  const derivedDisplayId =
    labelPrefix && labelText.toLowerCase().startsWith(labelPrefix.toLowerCase())
      ? labelText.slice(labelPrefix.length).trim()
      : labelText;
  return formattedIncidentDisplayId(
    domainKey,
    incidentIdRaw,
    coords,
    String(explicitDisplayId || derivedDisplayId || "").trim(),
    slIdByUuid,
  );
}

function buildIncidentHeaderTitleForDomain(
  incidentIdLabelForDomain,
  formattedIncidentDisplayId,
  normalizeDomainKey,
  normalizeDomainKeyOrSlug,
  domainKeyRaw,
  incidentIdRaw,
  coords = null,
  incidentLabel = "",
  explicitDisplayId = "",
  slIdByUuid = null,
) {
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
  const displayValue = buildIncidentDisplayValueForDomain(
    incidentIdLabelForDomain,
    formattedIncidentDisplayId,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
    domainKey,
    incidentIdRaw,
    coords,
    incidentLabel,
    explicitDisplayId,
    slIdByUuid,
  );
  return `${incidentIdLabelForDomain(domainKey)} ${displayValue || String(incidentIdRaw || "").trim()}`;
}

function buildIncidentReportsTitleForDomain(
  incidentIdLabelForDomain,
  formattedIncidentDisplayId,
  normalizeDomainKey,
  normalizeDomainKeyOrSlug,
  domainKeyRaw,
  incidentIdRaw,
  coords = null,
  incidentLabel = "",
  explicitDisplayId = "",
  slIdByUuid = null,
) {
  const displayValue = buildIncidentDisplayValueForDomain(
    incidentIdLabelForDomain,
    formattedIncidentDisplayId,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
    domainKeyRaw,
    incidentIdRaw,
    coords,
    incidentLabel,
    explicitDisplayId,
    slIdByUuid,
  );
  return `${displayValue || String(incidentIdRaw || "").trim() || "Incident"} Reports`;
}

export default function OpenReportsModal(props) {
  const { ...rest } = props;
  const getIncidentDomainHelper = getIncidentDomainHelperShared;
  const incidentDomainResolveLookupValueByMode = useCallback((modeRaw, row = null, domainKeyRaw = "") => (
    incidentDomainResolveLookupValueByModeShared(modeRaw, row, domainKeyRaw, {
      getIncidentDomainHelper,
    })
  ), [getIncidentDomainHelper]);
  const incidentSnapshotCandidateDomains = useCallback((domainKeyRaw, incidentIdRaw) => (
    incidentSnapshotCandidateDomainsShared(domainKeyRaw, incidentIdRaw, {
      getIncidentDomainHelper,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
    })
  ), [getIncidentDomainHelper, normalizeDomainKey, normalizeDomainKeyOrSlug]);
  const {
      open,
      onClose,
      isAdmin = false,
      allowReporterDetails = null,
      showDeveloperDiagnostics = false,
      publicRepairLifecycleEnabled = false,
      darkMode = false,
      allowIncidentMutations = false,
      canManageIncidentMutations = null,
      activeDomain = "streetlights",
      onSelectDomain,
      domainOptions = REPORT_DOMAIN_OPTIONS,
      selectedDomains = [],
      onToggleDomain = null,
      onSelectAllDomains = null,
      groups, // [{ lightId, rows, count, lastTs }]
      expandedSet,
      onToggleExpand,
      reports,
      allDomainReports = [],
      officialLights,
      slIdByUuid,
      fixedLights,
      lastFixByLightId,
      onFlyTo, // (posArray, zoom, lightId)
      onUpdateIncidentStatus, // (row, domainKey)
      actionsByLightId = {},
      session = null,
      profile = null,
      incidentStateByKey = {},
      reportKnownAssetIdSetsByDomainForExport = new Map(),
      cityBoundaryLoaded = false,
      isWithinCityLimits = null,
      modalTitle = "Reports",
      getStreetlightUtilityDetails = null,
      onUtilityReportedChange = null,
      onMarkWorkingIncident = null,
      streetlightConfidenceByLightId = {},
      incidentRepairProgressByKey = {},
      persistedIncidentRepairConfirmedKeySet = new Set(),
      canShowPublicRepairAction = null,
      onConfirmRepairIncident = null,
      focusIncidentId = "",
      initialSearchQuery = "",
      onInitialFocusApplied = null,
      mapBounds = null,
      inViewOnly = false,
      canToggleReportedBy = false,
      reportedByMode = "me",
      onReportedByModeChange = null,
      pageTopInset = "",
      pageBottomInset = "",
      preferAppShellBehavior = false,
      incidentLocationCacheSeed = {},
      persistIncidentLocationCacheEntry = null,
      isSharedIncidentDomain = null,
      incidentDrivenRecordMapByDomain = new Map(),
      configuredIncidentReportRowsByDomain = null,
      configuredIncidentSeededRowsByDomain = null,
      shouldIncludeDerivedSharedDomain = null,
      incidentIssueStateByDomain = new Map(),
      viewerIdentityKey = "",
  } = rest;
  const incidentDisplaySupportDeps = useMemo(() => ({
    getIncidentDomainHelper,
    reportDomainOptions: REPORT_DOMAIN_OPTIONS,
    runtimeDomainMeta: RUNTIME_DOMAIN_META,
  }), [getIncidentDomainHelper]);
  const formattedIncidentDisplayId = useCallback((...args) => (
    formattedIncidentDisplayIdShared(...args, incidentDisplaySupportDeps)
  ), [incidentDisplaySupportDeps]);
  const incidentIdLabelForDomain = useCallback((domainKey, fallback = "Incident ID") => (
    incidentIdLabelForDomainShared(domainKey, fallback, incidentDisplaySupportDeps)
  ), [incidentDisplaySupportDeps]);
  const reportNumberForRow = useCallback((row, domainHint = "") => (
    reportNumberForRowShared(row, domainHint, {
      getIncidentDomainHelper,
      reportDomainFromLightId,
      runtimeDomainMeta: RUNTIME_DOMAIN_META,
    })
  ), [getIncidentDomainHelper, reportDomainFromLightId]);
  const resolveReportDomainLabel = useCallback((domainKeyRaw, fallback = "Incident") => (
    resolveReportDomainLabelShared(domainKeyRaw, fallback, {
      runtimeDomainMeta: RUNTIME_DOMAIN_META,
      reportDomainOptions: domainOptions,
    })
  ), [domainOptions]);
  const searchableIncidentLookupIdsForDomain = useCallback((domainKeyRaw, incidentIdRaw) => (
    searchableIncidentLookupIdsForDomainShared(domainKeyRaw, incidentIdRaw, {
      getIncidentDomainHelper,
      normalizeDomainKeyOrSlug,
    })
  ), [getIncidentDomainHelper, normalizeDomainKeyOrSlug]);
  const resolveReportTypeOptionDetails = useCallback(
    (row, domainKeyRaw) => resolveReportTypeOptionDetailsShared(row, domainKeyRaw, RUNTIME_DOMAIN_META),
    []
  );
  const resolveConfiguredDomainIssueLabel = useCallback((domainKeyRaw, issueValueRaw, issueOptions = []) => (
    resolveConfiguredDomainIssueLabelShared(domainKeyRaw, issueValueRaw, issueOptions, {
      normalizeDomainKeyOrSlug,
      runtimeDomainMeta: RUNTIME_DOMAIN_META,
    })
  ), [normalizeDomainKeyOrSlug]);
  const resolveReportIssueLabel = useCallback((row, domainKeyRaw, issueStateByIncidentOverride = null) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
    const issueStateByIncident =
      issueStateByIncidentOverride && typeof issueStateByIncidentOverride === "object" && !Array.isArray(issueStateByIncidentOverride)
        ? issueStateByIncidentOverride
        : (domainKey ? (incidentIssueStateByDomain?.get?.(domainKey) || {}) : {});
    return resolveReportIssueLabelShared(row, domainKey, issueStateByIncident, {
      getIncidentDomainHelper,
      normalizeDomainKeyOrSlug,
      resolveConfiguredDomainIssueLabel,
    });
  }, [
    getIncidentDomainHelper,
    incidentIssueStateByDomain,
    normalizeDomainKeyOrSlug,
    resolveConfiguredDomainIssueLabel,
  ]);
  const resolveIncidentDrivenDomainMeta = useCallback((domainKeyRaw, incidentIdRaw) => (
    resolveIncidentDrivenDomainMetaShared(domainKeyRaw, incidentIdRaw, {
      getIncidentDomainHelper,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
      resolveIncidentDrivenRecord: (domainKey, incidentId) => {
        const normalizedDomainKey = normalizeDomainKeyOrSlug(domainKey, { allowUnknown: true }) || normalizeDomainKey(domainKey);
        const normalizedIncidentId = (
          searchableIncidentLookupIdsForDomainShared(domainKey, incidentId, {
            getIncidentDomainHelper,
            normalizeDomainKeyOrSlug,
          })[1]
          || String(incidentId || "").trim()
        );
        if (!(normalizedDomainKey && normalizedIncidentId)) return null;
        return incidentDrivenRecordMapByDomain?.get?.(normalizedDomainKey)?.get?.(normalizedIncidentId) || null;
      },
    })
  ), [
    getIncidentDomainHelper,
    incidentDrivenRecordMapByDomain,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
  ]);
  const resolveIncidentDrivenGroupMeta = useCallback((domainKeyRaw, incidentIdRaw, context = {}) => (
    resolveIncidentDrivenGroupMetaShared(domainKeyRaw, incidentIdRaw, context, {
      formattedIncidentDisplayId,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
      resolveIncidentDrivenDomainMeta,
      slIdByUuid,
    })
  ), [
    formattedIncidentDisplayId,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
    resolveIncidentDrivenDomainMeta,
    slIdByUuid,
  ]);
  const resolveIncidentDrivenLocationContextForRow = useCallback((domainKeyRaw, row) => (
    resolveIncidentDrivenLocationContextForRowShared(domainKeyRaw, row, {
      incidentLocationCacheByKey,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
      resolveIncidentDrivenDomainMeta,
      resolveDisplayId: ({ domainKey, incidentId, coords, row: sourceRow }) => (
        buildIncidentDisplayValueForDomain(
          incidentIdLabelForDomain,
          formattedIncidentDisplayId,
          normalizeDomainKey,
          normalizeDomainKeyOrSlug,
          domainKey,
          incidentId,
          coords,
          sourceRow?.incident_label,
          "",
          slIdByUuid,
        )
      ),
    })
  ), [
    formattedIncidentDisplayId,
    incidentIdLabelForDomain,
    incidentLocationCacheByKey,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
    resolveIncidentDrivenDomainMeta,
    slIdByUuid,
  ]);
  const [reporterDetails, setReporterDetails] = useState({ open: false, item: null });
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
  const handleOpenReporterDetails = useCallback((item) => {
    setReporterDetails({ open: true, item: item || null });
  }, []);
  const handleCloseReporterDetails = useCallback(() => {
    setReporterDetails({ open: false, item: null });
  }, []);
  const [personalReportsSupportModule, setPersonalReportsSupportModule] = useState(null);

  const useCompactAppBehavior = Boolean(preferAppShellBehavior);
  const canMutateIncidents = allowIncidentMutations && typeof onUpdateIncidentStatus === "function";
  const canViewReporterDetails = Boolean(allowReporterDetails ?? isAdmin);
  const canMarkWorkingIncidents = typeof onMarkWorkingIncident === "function";
  const normalizedReportedByMode = canToggleReportedBy && String(reportedByMode || "").trim().toLowerCase() === "all"
    ? "all"
    : "me";
  const showAllReportedByMode = normalizedReportedByMode === "all";
  const showCommunityRepairDiagnostics =
    showDeveloperDiagnostics
    && publicRepairLifecycleEnabled
    && activeDomain !== "streetlights"
    && !(typeof isSharedIncidentDomain === "function" && isSharedIncidentDomain(activeDomain));

  useEffect(() => {
    if (!open) handleCloseReporterDetails();
  }, [handleCloseReporterDetails, open]);
  const openAllReportsModal = useCallback((title, items, opts = {}) => {
    setAllReportsModal({
      open: true,
      incidentKey: String(opts?.incidentKey || "").trim(),
      title: title || "All Reports",
      items: Array.isArray(items) ? items : [],
      reportRows: Array.isArray(opts?.reportRows) ? opts.reportRows : [],
      fixActionRows: Array.isArray(opts?.fixActionRows) ? opts.fixActionRows : [],
      issueStateByIncident:
        opts?.issueStateByIncident && typeof opts.issueStateByIncident === "object" && !Array.isArray(opts.issueStateByIncident)
          ? opts.issueStateByIncident
          : {},
      domainKey: String(opts?.domainKey || "streetlights").trim() || "streetlights",
      incidentLabel: String(opts?.incidentLabel || "").trim(),
      sharedLocation: String(opts?.sharedLocation || "").trim(),
      sharedAddress: String(opts?.sharedAddress || "").trim(),
      sharedCrossStreet: String(opts?.sharedCrossStreet || "").trim(),
      sharedLandmark: String(opts?.sharedLandmark || "").trim(),
      sharedCoordinates: String(opts?.sharedCoordinates || "").trim(),
      geoLoading: Boolean(opts?.geoLoading),
      currentState: String(opts?.currentState || "").trim(),
      lastChangedAt: String(opts?.lastChangedAt || "").trim(),
      hideSubmittedBy: Boolean(opts?.hideSubmittedBy),
      useSubmittedReportFormat: Boolean(opts?.useSubmittedReportFormat),
    });
  }, [setAllReportsModal]);

  const locationInfoForReportDetail = useCallback((detail, groupRow = null) => {
    const rawNotes = String(detail?.raw_notes || detail?.notes || "");
    const fromNote = String(readLocationFromNote(rawNotes) || "").trim();
    if (fromNote) return fromNote;
    const groupLocation = String(groupRow?.location_label || groupRow?.locationLabel || "").trim();
    if (groupLocation) return groupLocation;
    const lat = Number(detail?.lat ?? groupRow?.coords?.lat ?? groupRow?.lat);
    const lng = Number(detail?.lng ?? groupRow?.coords?.lng ?? groupRow?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    return "Location unavailable";
  }, []);

  const reporterSummaryForReportDetail = useCallback((detail) => {
    const name = String(detail?.reporter_name || "").trim();
    const email = String(detail?.reporter_email || "").trim();
    const phone = String(detail?.reporter_phone || "").trim();
    const primary = name || email || phone || "Unknown";
    const secondary = [name ? "" : null, email, phone].filter(Boolean).join(" • ");
    return {
      primary,
      secondary,
    };
  }, []);
  const resolveIssueLabel = useCallback((row, domainKeyRaw, issueStateByIncidentOverride = null) => (
    resolveReportIssueLabel(row, domainKeyRaw, issueStateByIncidentOverride)
  ), [resolveReportIssueLabel]);
  const adminIncidentLabelForDomain = useCallback((...args) => {
    return buildAdminIncidentLabelForDomain(incidentIdLabelForDomain, formattedIncidentDisplayId, ...args);
  }, [formattedIncidentDisplayId, incidentIdLabelForDomain]);
  const incidentDisplayValueForDomain = useCallback((...args) => {
    return buildIncidentDisplayValueForDomain(
      incidentIdLabelForDomain,
      formattedIncidentDisplayId,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
      ...args,
    );
  }, [formattedIncidentDisplayId, incidentIdLabelForDomain, normalizeDomainKey, normalizeDomainKeyOrSlug]);
  const incidentHeaderTitleForDomain = useCallback((...args) => {
    return buildIncidentHeaderTitleForDomain(
      incidentIdLabelForDomain,
      formattedIncidentDisplayId,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
      ...args,
    );
  }, [formattedIncidentDisplayId, incidentIdLabelForDomain, normalizeDomainKey, normalizeDomainKeyOrSlug]);
  const incidentReportsTitleForDomain = useCallback((...args) => {
    return buildIncidentReportsTitleForDomain(
      incidentIdLabelForDomain,
      formattedIncidentDisplayId,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
      ...args,
    );
  }, [formattedIncidentDisplayId, incidentIdLabelForDomain, normalizeDomainKey, normalizeDomainKeyOrSlug]);
  const [sortMode, setSortMode] = useState("count"); // count | recent
  const [statusFilter, setStatusFilter] = useState("open"); // open | closed | all
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const DATE_PRESET_OPTIONS = useMemo(() => ([
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "thisMonth", label: "MTD" },
    { key: "last90", label: "90-Days" },
    { key: "last180", label: "180-Days" },
    { key: "ytd", label: "YTD" },
  ]), []);
  const defaultFromDate = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toLocalIsoDate(d);
  }, []);
  const defaultToDate = useCallback(() => {
    return toLocalIsoDate(new Date());
  }, []);
  const [exportFromDate, setExportFromDate] = useState(() => defaultFromDate());
  const [exportToDate, setExportToDate] = useState(() => defaultToDate());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [draftFromDate, setDraftFromDate] = useState("");
  const [draftToDate, setDraftToDate] = useState("");
  const [calendarLeftMonth, setCalendarLeftMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });
  const toIsoDate = useCallback((value) => {
    return toLocalIsoDate(value);
  }, []);
  const parseIsoDate = useCallback((value) => {
    return parseLocalIsoDate(value);
  }, []);
  const getPresetRange = useCallback((presetKey) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let from = new Date(today);
    let to = new Date(today);
    if (presetKey === "all") {
      return { from: "", to: "" };
    }
    if (presetKey === "today") {
      from = new Date(today);
      to = new Date(today);
    } else if (presetKey === "thisMonth") {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (presetKey === "lastMonth") {
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (presetKey === "last90") {
      from = new Date(today);
      from.setDate(from.getDate() - 89);
    } else if (presetKey === "last180") {
      from = new Date(today);
      from.setDate(from.getDate() - 179);
    } else if (presetKey === "ytd") {
      from = new Date(today.getFullYear(), 0, 1);
    }
    return {
      from: toIsoDate(from),
      to: toIsoDate(to),
    };
  }, [toIsoDate]);
  const dateRangeLabel = useCallback((from, to) => {
    if (!String(from || "").trim() && !String(to || "").trim()) return "All";
    const fromD = parseIsoDate(from);
    const toD = parseIsoDate(to);
    if (!fromD || !toD) return "Select range";
    const fmt = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${fmt.format(fromD)} - ${fmt.format(toD)}`;
  }, [parseIsoDate]);
  const openDatePicker = useCallback(() => {
    const from = String(exportFromDate || "").trim();
    const to = String(exportToDate || "").trim();
    setDraftFromDate(from);
    setDraftToDate(to);
    const toDate = parseIsoDate(to) || parseIsoDate(from) || new Date();
    setCalendarLeftMonth(new Date(toDate.getFullYear(), toDate.getMonth() - 1, 1));
    setDatePickerOpen(true);
  }, [exportFromDate, exportToDate, parseIsoDate]);
  const cancelDatePicker = useCallback(() => {
    setDatePickerOpen(false);
    setDraftFromDate("");
    setDraftToDate("");
  }, []);
  const applyDatePicker = useCallback(() => {
    const rawFrom = String(draftFromDate || "").trim();
    const rawTo = String(draftToDate || "").trim();
    if (!rawFrom && !rawTo) {
      setExportFromDate("");
      setExportToDate("");
      setDatePickerOpen(false);
      return;
    }
    const from = rawFrom || rawTo;
    const to = rawTo || rawFrom;
    if (!from || !to) {
      setDatePickerOpen(false);
      return;
    }
    if (from <= to) {
      setExportFromDate(from);
      setExportToDate(to);
    } else {
      setExportFromDate(to);
      setExportToDate(from);
    }
    setDatePickerOpen(false);
  }, [draftFromDate, draftToDate]);
  const applyPresetToDraft = useCallback((presetKey) => {
    const range = getPresetRange(presetKey);
    setDraftFromDate(range.from);
    setDraftToDate(range.to);
    const toDate = parseIsoDate(range.to);
    if (toDate) {
      setCalendarLeftMonth(new Date(toDate.getFullYear(), toDate.getMonth() - 1, 1));
    }
  }, [getPresetRange, parseIsoDate]);
  const shiftCalendarMonths = useCallback((delta) => {
    setCalendarLeftMonth((prev) => {
      const base = prev instanceof Date ? prev : new Date();
      return new Date(base.getFullYear(), base.getMonth() + Number(delta || 0), 1);
    });
  }, []);
  const formatMonthLabel = useCallback((value) => {
    const d = value instanceof Date ? value : new Date();
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }, []);
  const buildMonthCells = useCallback((value) => {
    const d = value instanceof Date ? value : new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i += 1) cells.push(null);
    for (let day = 1; day <= dim; day += 1) {
      cells.push(toIsoDate(new Date(y, m, day)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    while (cells.length < 42) cells.push(null);
    return cells;
  }, [toIsoDate]);
  const pickCalendarDate = useCallback((iso) => {
    const day = String(iso || "").trim();
    if (!day) return;
    const from = String(draftFromDate || "").trim();
    const to = String(draftToDate || "").trim();
    if (!from || (from && to)) {
      setDraftFromDate(day);
      setDraftToDate("");
      return;
    }
    if (day < from) {
      setDraftFromDate(day);
      setDraftToDate(from);
      return;
    }
    setDraftToDate(day);
  }, [draftFromDate, draftToDate]);
  const draftRangeFrom = String(draftFromDate || "").trim();
  const draftRangeTo = String(draftToDate || draftFromDate || "").trim();
  const isDateInDraftRange = useCallback((iso) => {
    const day = String(iso || "").trim();
    if (!day || !draftRangeFrom || !draftRangeTo) return false;
    return day >= draftRangeFrom && day <= draftRangeTo;
  }, [draftRangeFrom, draftRangeTo]);
  const leftMonthCells = useMemo(() => buildMonthCells(calendarLeftMonth), [buildMonthCells, calendarLeftMonth]);
  const [compactDomainPicker, setCompactDomainPicker] = useState(() => {
    if (useCompactAppBehavior) return true;
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 760;
  });
  const [compactDomainMenuOpen, setCompactDomainMenuOpen] = useState(false);
  const [compactFiltersOpen, setCompactFiltersOpen] = useState(false);
  const [compactSortMenuOpen, setCompactSortMenuOpen] = useState(false);
  const [metricsCollapsed, setMetricsCollapsed] = useState(() => {
    if (useCompactAppBehavior) return true;
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 760;
  });
  const listScrollRef = useRef(null);
  const compactSortMenuRef = useRef(null);
  const rowRefMap = useRef(new Map());
  const [tableSort, setTableSort] = useState({ key: "submitted_at", dir: "desc" });
  const [streetlightReportInfoByIncident, setStreetlightReportInfoByIncident] = useState({});
  const [streetlightUtilityExpandedSet, setStreetlightUtilityExpandedSet] = useState(() => new Set());
  const [streetlightUtilityLoadingByIncident, setStreetlightUtilityLoadingByIncident] = useState({});
  const [incidentLocationCacheByKey, setIncidentLocationCacheByKey] = useState({});
  const currentTenantLocationCacheKey = String(activeTenantKey() || "").trim().toLowerCase();
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
  const [submittedReportsModal, setSubmittedReportsModal] = useState({
    open: false,
    row: null,
    domainKey: "",
  });
  const [copyToast, setCopyToast] = useState(null);
  const copyToastTimerRef = useRef(null);
  useEffect(() => {
    setIncidentLocationCacheByKey(readPersistedIncidentLocationCache(currentTenantLocationCacheKey));
  }, [currentTenantLocationCacheKey]);
  useEffect(() => {
    setIncidentLocationCacheByKey((prev) => mergeIncidentLocationCacheMaps(incidentLocationCacheSeed, prev));
  }, [incidentLocationCacheSeed]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = incidentLocationCacheStorageKey(currentTenantLocationCacheKey);
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(sanitizeIncidentLocationCacheMap(incidentLocationCacheByKey)));
    } catch {
      // non-fatal: runtime cache still works even if persistent storage is unavailable
    }
  }, [currentTenantLocationCacheKey, incidentLocationCacheByKey]);
  const upsertIncidentLocationCacheEntry = useCallback((domainKeyRaw, incidentIdRaw, nextValues = {}) => {
    const key = incidentLocationCacheKey(domainKeyRaw, incidentIdRaw);
    if (!key) return;
    setIncidentLocationCacheByKey((prev) => {
      const existing = prev?.[key] || {};
      const merged = sanitizeIncidentLocationCacheMap({
        [key]: {
          ...existing,
          ...nextValues,
        },
      });
      if (!merged[key]) return prev || {};
      return {
        ...(prev || {}),
        [key]: merged[key],
      };
    });
  }, []);
  const persistIncidentLocationEntry = useCallback(async (domainKeyRaw, incidentIdRaw, nextValues = {}, extra = {}) => {
    upsertIncidentLocationCacheEntry(domainKeyRaw, incidentIdRaw, nextValues);
    if (typeof persistIncidentLocationCacheEntry === "function") {
      try {
        await persistIncidentLocationCacheEntry(domainKeyRaw, incidentIdRaw, nextValues, extra);
      } catch (error) {
        console.warn("[incident-location-cache] modal persistence warning:", error);
      }
    }
  }, [persistIncidentLocationCacheEntry, upsertIncidentLocationCacheEntry]);
  useEffect(() => {
    if (!compactSortMenuOpen || typeof window === "undefined") return undefined;
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      setCompactSortMenuOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [compactSortMenuOpen]);

  const officialIdSetForExport = useMemo(
    () => new Set((officialLights || []).map((l) => String(l?.id || "").trim()).filter(Boolean)),
    [officialLights]
  );
  const reportKnownAssetIdSetsByDomain = useMemo(() => {
    const normalized = new Map(reportKnownAssetIdSetsByDomainForExport instanceof Map
      ? Array.from(reportKnownAssetIdSetsByDomainForExport.entries())
      : []);
    normalized.set("streetlights", officialIdSetForExport);
    return normalized;
  }, [officialIdSetForExport, reportKnownAssetIdSetsByDomainForExport]);
  const getStreetlightConfidence = useCallback((incidentId) => {
    const id = String(incidentId || "").trim();
    if (!id) return null;
    return streetlightConfidenceByLightId?.[id] || null;
  }, [streetlightConfidenceByLightId]);
  const getWorkingActionStateForIncident = useCallback((incidentId, domainOverride = "") => {
    const domainKey = normalizeDomainKeyOrSlug(domainOverride || activeDomain, { allowUnknown: true })
      || String(activeDomain || "").trim()
      || "streetlights";
    if (domainKey !== "streetlights") return "hidden";
    if (!canMarkWorkingIncidents) return "hidden";
    const confidence = getStreetlightConfidence(incidentId);
    if (!confidence) return "hidden";
    if (confidence?.viewerHasWorkingAck && !confidence?.closed) return "confirmed";
    if (confidence?.canViewerMarkWorking) return "available";
    return "hidden";
  }, [activeDomain, canMarkWorkingIncidents, getStreetlightConfidence]);
  const getRepairSnapshotForIncident = useCallback((incidentId, domainOverride = "") => {
    const domainKey = normalizeDomainKeyOrSlug(domainOverride || activeDomain, { allowUnknown: true })
      || String(activeDomain || "streetlights").trim()
      || "streetlights";
    return resolveIncidentRepairSnapshotShared(domainKey, incidentId, {
      incidentRepairProgressByKey,
      persistedIncidentRepairConfirmedKeySet,
    });
  }, [activeDomain, incidentRepairProgressByKey, persistedIncidentRepairConfirmedKeySet]);


  const isMyReportsModal =
    String(modalTitle || "").trim().toLowerCase() === "my reports";
  const usesPersonalMyReportsLayout = isMyReportsModal && !showAllReportedByMode;
  const enabledDomainOptions = useMemo(
    () => (Array.isArray(domainOptions) ? domainOptions : []).filter((option) => option?.enabled !== false),
    [domainOptions]
  );
  const normalizedSelectedDomains = useMemo(
    () => normalizeExplicitDomainSelection(selectedDomains, enabledDomainOptions.map((option) => option.key)),
    [selectedDomains, enabledDomainOptions]
  );
  const isMultiDomainMyReports =
    typeof onToggleDomain === "function" && typeof onSelectAllDomains === "function";
  const hasNoSelectedDomains =
    isMultiDomainMyReports
    && normalizedSelectedDomains.length === 1
    && normalizedSelectedDomains[0] === NO_REPORT_DOMAINS_KEY;
  const activeDomainKeys = useMemo(() => {
    if (!isMultiDomainMyReports) return [String(activeDomain || "").trim() || "streetlights"];
    if (hasNoSelectedDomains) return [];
    return normalizedSelectedDomains.length
      ? normalizedSelectedDomains
      : enabledDomainOptions.map((option) => String(option?.key || "").trim()).filter(Boolean);
  }, [isMultiDomainMyReports, hasNoSelectedDomains, normalizedSelectedDomains, enabledDomainOptions, activeDomain]);
  const primaryActiveDomain = String(activeDomainKeys?.[0] || activeDomain || "streetlights").trim() || "streetlights";
  const hasExplicitDomainSelection = isMultiDomainMyReports && (hasNoSelectedDomains || normalizedSelectedDomains.length > 0);
  const isStreetlightMyReports =
    usesPersonalMyReportsLayout
    && activeDomainKeys.length === 1
    && activeDomainKeys[0] === "streetlights";
  const hasStreetlightsInMyReportsSelection =
    usesPersonalMyReportsLayout
    && activeDomainKeys.includes("streetlights");
  const isCompactMyReports = compactDomainPicker && isMyReportsModal;
  const modalTitleText = String(modalTitle || "").trim().toLowerCase() === "my reports"
    ? "Reports"
    : modalTitle;
  const selectedDomainLabel = useMemo(() => {
    if (isMultiDomainMyReports) {
      if (hasNoSelectedDomains) return "None";
      if (!hasExplicitDomainSelection) return "All";
      if (activeDomainKeys.length === 1) {
        return enabledDomainOptions.find((option) => option.key === activeDomainKeys[0])?.label || activeDomainKeys[0];
      }
      return `${activeDomainKeys.length} domains`;
    }
    return "";
  }, [isMultiDomainMyReports, hasNoSelectedDomains, hasExplicitDomainSelection, activeDomainKeys, enabledDomainOptions]);

  const resolveItemDomainKey = useCallback((group = null, row = null, fallback = primaryActiveDomain) => {
    const rawValue =
      group?.domainKey
      || group?.domain
      || row?.domainKey
      || row?.domain
      || fallback;
    return normalizeDomainKeyOrSlug(rawValue, { allowUnknown: true }) || String(fallback || "streetlights").trim() || "streetlights";
  }, [primaryActiveDomain]);
  const utilityReportUserId = String(session?.user?.id || "").trim();
  const [utilityReportedByIncident, setUtilityReportedByIncident] = useState({});
  const [utilityReportReferenceByIncident, setUtilityReportReferenceByIncident] = useState({});
  const [utilityReportDialogOpen, setUtilityReportDialogOpen] = useState(false);
  const [utilityReportDialogIncidentId, setUtilityReportDialogIncidentId] = useState("");
  const [utilityReportDialogReference, setUtilityReportDialogReference] = useState("");
  const [savedStreetlightReportIncidentId, setSavedStreetlightReportIncidentId] = useState("");
  const [inViewOnlyActive, setInViewOnlyActive] = useState(Boolean(inViewOnly));
  const [deferredDataActivation, setDeferredDataActivation] = useState(false);
  const searchQueryNormalizer = useCallback((rawValue = "") => {
    return String(rawValue || "").trim();
  }, []);
  const exactIncidentSearchDraft = useMemo(() => {
    const raw = searchQueryNormalizer(searchDraft);
    if (!raw) return "";
    const upper = raw.toUpperCase();
    if (/^[A-Z]{2}\d{10}$/.test(upper)) return upper;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
      return raw.toLowerCase();
    }
    return "";
  }, [searchDraft, searchQueryNormalizer]);
  useEffect(() => {
    if (!open) return;
    setInViewOnlyActive(Boolean(inViewOnly));
  }, [open, inViewOnly]);
  useEffect(() => {
    if (!open) {
      setDeferredDataActivation(false);
      return;
    }
    const activationDelayMs = useCompactAppBehavior ? 320 : 90;
    let timeoutId = 0;
    let idleId = 0;
    const activate = () => {
      startTransition(() => {
        setDeferredDataActivation(true);
      });
    };
    timeoutId = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(() => activate(), { timeout: activationDelayMs });
        return;
      }
      activate();
    }, activationDelayMs);
    return () => {
      window.clearTimeout(timeoutId);
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [open, useCompactAppBehavior]);
  useEffect(() => {
    let cancelled = false;
    if (!open || !deferredDataActivation || !usesPersonalMyReportsLayout) {
      return () => {
        cancelled = true;
      };
    }
    void loadDeferredOpenReportsPersonalSupportModule().then((module) => {
      if (!cancelled) setPersonalReportsSupportModule(module);
    });
    return () => {
      cancelled = true;
    };
  }, [deferredDataActivation, open, usesPersonalMyReportsLayout]);
  const hasSearchText = Boolean(String(searchDraft || "").trim() || String(searchQuery || "").trim());
  const showSearchClearButton = hasSearchText || inViewOnlyActive;
  const reportSearchPlaceholder = inViewOnlyActive
    ? "Reports in view"
    : "Search by incident ID, report #, name, phone, or email";
  const applySearchQuery = useCallback((nextRaw = searchDraft) => {
    const nextQuery = searchQueryNormalizer(nextRaw);
    startTransition(() => {
      setSearchQuery(nextQuery);
    });
  }, [searchDraft, searchQueryNormalizer]);
  const clearSearchField = useCallback(() => {
    setSearchDraft("");
    startTransition(() => {
      setSearchQuery("");
      setInViewOnlyActive(false);
    });
  }, []);
  const resetCompactFilters = useCallback(() => {
    clearSearchField();
    setStatusFilter("open");
    const range = getPresetRange("last90");
    setExportFromDate(range.from);
    setExportToDate(range.to);
  }, [clearSearchField, getPresetRange]);
  useEffect(() => {
    if (!open || !exactIncidentSearchDraft) return;
    if (searchQueryNormalizer(searchQuery) === exactIncidentSearchDraft) return;
    const timer = window.setTimeout(() => {
      applySearchQuery(exactIncidentSearchDraft);
    }, 90);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open, exactIncidentSearchDraft, searchQuery, searchQueryNormalizer, applySearchQuery]);
  const showInlineToast = useCallback((text) => {
    setCopyToast({ text: String(text || "Saved"), x: 18, y: 48 });
    if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    copyToastTimerRef.current = setTimeout(() => {
      setCopyToast(null);
      copyToastTimerRef.current = null;
    }, 1200);
  }, []);
  const copyStreetlightField = useCallback(async (label, value, anchorEl = null) => {
    const text = String(value || "").trim();
    if (!text || text.toLowerCase() === "unavailable") {
      showInlineToast(`${label || "Value"} unavailable`);
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
          setCopyToast({
            scope: "incident_location_modal",
            text: "Copied to clipboard",
            localX,
            localY,
          });
        } else {
          const x = rect
            ? Math.max(
              10,
              Math.min(
                window.innerWidth - toastWidth - 10,
                rect.left + (rect.width / 2) - (toastWidth / 2)
              )
            )
            : null;
          const y = rect ? Math.max(10, rect.top - toastHeight - toastGap) : null;
          setCopyToast({ text: "Copied to clipboard", x, y });
        }
        if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
        copyToastTimerRef.current = setTimeout(() => {
          setCopyToast(null);
          copyToastTimerRef.current = null;
        }, 900);
      } else {
        showInlineToast("Copy unavailable");
      }
    } catch {
      showInlineToast("Copy failed");
    }
  }, [showInlineToast]);
  const copyReportField = useCallback(async (label, value, anchorEl = null) => {
    await copyStreetlightField(label, value, anchorEl);
  }, [copyStreetlightField]);
  const getStreetlightUtilityRows = useCallback((util, coords) => buildStreetlightUtilityRows(util, coords), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setCompactDomainPicker(useCompactAppBehavior || window.innerWidth <= 760);
    sync();
    window.addEventListener("resize", sync, { passive: true });
    return () => window.removeEventListener("resize", sync);
  }, [useCompactAppBehavior]);

  useEffect(() => {
    if (!open || !compactDomainPicker) {
      setCompactDomainMenuOpen(false);
      setCompactFiltersOpen(false);
    }
  }, [open, compactDomainPicker]);
  useEffect(() => {
    if (!open) setCopyToast(null);
  }, [open]);
  useEffect(() => {
    if (open) return;
    setDatePickerOpen(false);
    setDraftFromDate("");
    setDraftToDate("");
  }, [open]);
  useEffect(() => {
    if (!datePickerOpen) return;
    const onKey = (ev) => {
      if (ev.key === "Escape") cancelDatePicker();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [datePickerOpen, cancelDatePicker]);
  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    };
  }, []);
  useEffect(() => {
    if (useCompactAppBehavior) {
      setMetricsCollapsed(true);
      return;
    }
    if (!compactDomainPicker) setMetricsCollapsed(false);
  }, [compactDomainPicker, useCompactAppBehavior]);
  useEffect(() => {
    if (!open) return;
    const targetIncidentId = String(focusIncidentId || "").trim();
    if (!targetIncidentId) return;
    setStatusFilter("all");
  }, [open, focusIncidentId]);
  useEffect(() => {
    if (!open) return;
    const q = String(initialSearchQuery || "").trim();
    if (!q) return;
    setStatusFilter("all");
    setSearchDraft(q);
    startTransition(() => {
      setSearchQuery(q);
    });
    if (typeof onInitialFocusApplied === "function") onInitialFocusApplied();
  }, [open, initialSearchQuery]);
  const shouldLoadUtilityReportedState = activeDomainKeys.includes("streetlights");
  useEffect(() => {
    let cancelled = false;
    async function loadUtilityReportedState() {
      if (!open || !deferredDataActivation || !utilityReportUserId || !shouldLoadUtilityReportedState) {
        if (!cancelled) {
          setUtilityReportedByIncident({});
          setUtilityReportReferenceByIncident({});
        }
        return;
      }
      let { data, error } = await supabase
        .from("utility_report_status")
        .select("incident_id, report_reference")
        .eq("user_id", utilityReportUserId)
        .eq("tenant_key", activeTenantKey())
        .order("updated_at", { ascending: false });
      if (error && isMissingUtilityReportReferenceColumnError(error)) {
        const fallback = await supabase
          .from("utility_report_status")
          .select("incident_id")
          .eq("user_id", utilityReportUserId)
          .eq("tenant_key", activeTenantKey())
          .order("updated_at", { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }
      if (cancelled) return;
      if (error) {
        console.warn("[utility_report_status] load warning:", error?.message || error);
        setUtilityReportedByIncident({});
        setUtilityReportReferenceByIncident({});
        return;
      }
      const next = {};
      const nextRefs = {};
      for (const row of data || []) {
        const id = String(row?.incident_id || "").trim();
        if (!id) continue;
        next[id] = true;
        nextRefs[id] = normalizeUtilityReportReference(row?.report_reference);
      }
      setUtilityReportedByIncident(next);
      setUtilityReportReferenceByIncident(nextRefs);
    }
    loadUtilityReportedState();
    return () => {
      cancelled = true;
    };
  }, [open, deferredDataActivation, utilityReportUserId, shouldLoadUtilityReportedState]);
  const openUtilityReportDialog = useCallback((incidentId) => {
    const id = String(incidentId || "").trim();
    if (!id || !utilityReportUserId) return;
    setUtilityReportDialogIncidentId(id);
    setUtilityReportDialogReference(String(utilityReportReferenceByIncident?.[id] || "").trim());
    setUtilityReportDialogOpen(true);
  }, [utilityReportUserId, utilityReportReferenceByIncident]);
  const clearUtilityReported = useCallback(async (incidentId) => {
    const id = String(incidentId || "").trim();
    if (!id || !utilityReportUserId) return;
    setUtilityReportedByIncident((prev) => ({
      ...(prev || {}),
      [id]: false,
    }));
    setUtilityReportReferenceByIncident((prev) => {
      const next = { ...(prev || {}) };
      delete next[id];
      return next;
    });
    onUtilityReportedChange?.(id, false, { reportReference: "" });
    const { error } = await supabase
      .from("utility_report_status")
      .delete()
      .eq("tenant_key", activeTenantKey())
      .eq("user_id", utilityReportUserId)
      .eq("incident_id", id);
    if (error) {
      console.warn("[utility_report_status] delete warning:", error?.message || error);
      setUtilityReportedByIncident((prev) => ({
        ...(prev || {}),
        [id]: true,
      }));
      onUtilityReportedChange?.(id, true, {
        reportReference: utilityReportReferenceByIncident?.[id] || "",
      });
    }
  }, [utilityReportUserId, onUtilityReportedChange, utilityReportReferenceByIncident]);
  const saveUtilityReported = useCallback(async () => {
    const id = String(utilityReportDialogIncidentId || "").trim();
    if (!id || !utilityReportUserId) return;
    const normalizedReference = normalizeUtilityReportReference(utilityReportDialogReference);
    const hadReported = Boolean(utilityReportedByIncident?.[id]);
    const previousReference = String(utilityReportReferenceByIncident?.[id] || "").trim();
    setUtilityReportedByIncident((prev) => ({
      ...(prev || {}),
      [id]: true,
    }));
    setUtilityReportReferenceByIncident((prev) => ({
      ...(prev || {}),
      [id]: normalizedReference,
    }));
    onUtilityReportedChange?.(id, true, { reportReference: normalizedReference });
    setUtilityReportDialogOpen(false);
    setUtilityReportDialogIncidentId("");
    setUtilityReportDialogReference("");
    let { error } = await supabase
      .from("utility_report_status")
      .upsert(
        [{
          tenant_key: activeTenantKey(),
          user_id: utilityReportUserId,
          incident_id: id,
          reported_at: new Date().toISOString(),
          report_reference: normalizedReference || null,
        }],
        { onConflict: "tenant_key,user_id,incident_id" }
      );
    if (error && isMissingUtilityReportReferenceColumnError(error)) {
      const fallback = await supabase
        .from("utility_report_status")
        .upsert(
          [{
            tenant_key: activeTenantKey(),
            user_id: utilityReportUserId,
            incident_id: id,
            reported_at: new Date().toISOString(),
          }],
          { onConflict: "tenant_key,user_id,incident_id" }
        );
      error = fallback.error || null;
    }
    if (error) {
      console.warn("[utility_report_status] upsert warning:", error?.message || error);
      setUtilityReportedByIncident((prev) => ({
        ...(prev || {}),
        [id]: hadReported,
      }));
      setUtilityReportReferenceByIncident((prev) => {
        const next = { ...(prev || {}) };
        if (hadReported) next[id] = previousReference;
        else delete next[id];
        return next;
      });
      onUtilityReportedChange?.(id, hadReported, { reportReference: previousReference });
      return;
    }
    showInlineToast("Utility report saved");
  }, [
    utilityReportDialogIncidentId,
    utilityReportDialogReference,
    utilityReportUserId,
    onUtilityReportedChange,
    utilityReportedByIncident,
    utilityReportReferenceByIncident,
    showInlineToast,
  ]);

  const openSavedStreetlightReport = useCallback((row) => {
    const incidentId = String(row?.incident_id || "").trim();
    if (!incidentId) return;
    setSavedStreetlightReportIncidentId(incidentId);
  }, []);

  const closeSavedStreetlightReport = useCallback(() => {
    setSavedStreetlightReportIncidentId("");
  }, []);

  const getStreetlightUtilityForIncident = useCallback((incidentId) => {
    return resolveStreetlightUtilityForIncidentShared(incidentId, {
      streetlightReportInfoByIncident,
      incidentLocationCacheByKey,
      officialLights,
    });
  }, [streetlightReportInfoByIncident, incidentLocationCacheByKey, officialLights]);

  const ensureStreetlightUtilityForIncident = useCallback(async (incidentId, coords) => {
    const key = String(incidentId || "").trim();
    const lat = Number(coords?.lat);
    const lng = Number(coords?.lng);
    if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const existing = getStreetlightUtilityForIncident(key);
    const hasSavedLocation = Boolean(
      String(existing?.nearestAddress || "").trim() ||
      String(existing?.nearestCrossStreet || "").trim() ||
      String(existing?.nearestLandmark || "").trim()
    );
    if (hasSavedLocation || typeof getStreetlightUtilityDetails !== "function") return;

    setStreetlightUtilityLoadingByIncident((prev) => ({ ...(prev || {}), [key]: true }));
    try {
      const geo = await getStreetlightUtilityDetails(lat, lng, { mode: "full" });
      const nextLocation = {
        nearestAddress: String(geo?.nearestAddress || "").trim(),
        nearestStreet: String(geo?.nearestStreet || "").trim(),
        nearestCrossStreet: String(geo?.nearestCrossStreet || "").trim(),
        nearestIntersection: String(geo?.nearestIntersection || "").trim(),
        nearestLandmark: String(geo?.nearestLandmark || "").trim(),
      };
      setStreetlightReportInfoByIncident((prev) => ({
        ...(prev || {}),
        [key]: {
          ...(prev?.[key] || {}),
          ...nextLocation,
        },
      }));
      if (
        nextLocation.nearestAddress
        || nextLocation.nearestCrossStreet
        || nextLocation.nearestIntersection
        || nextLocation.nearestLandmark
      ) {
        await persistIncidentLocationEntry("streetlights", key, {
          nearestAddress: nextLocation.nearestAddress,
          nearestCrossStreet: nextLocation.nearestCrossStreet,
          nearestIntersection: nextLocation.nearestIntersection,
          nearestLandmark: nextLocation.nearestLandmark,
          locationLabel: nextLocation.nearestAddress,
        }, {
          lat,
          lng,
        });
      }
    } catch {
      // best-effort detail lookup for utility info
    } finally {
      setStreetlightUtilityLoadingByIncident((prev) => ({ ...(prev || {}), [key]: false }));
    }
  }, [getStreetlightUtilityDetails, getStreetlightUtilityForIncident, persistIncidentLocationEntry]);

  const toggleStreetlightUtilityExpanded = useCallback((incidentId, coords) => {
    const key = String(incidentId || "").trim();
    if (!key) return;
    setStreetlightUtilityExpandedSet((prev) => {
      const next = new Set(prev || []);
      const opening = !next.has(key);
      if (opening) next.add(key);
      else next.delete(key);
      return next;
    });
    void ensureStreetlightUtilityForIncident(key, coords);
  }, [ensureStreetlightUtilityForIncident]);

  useEffect(() => {
    if (!open) {
      setStreetlightUtilityExpandedSet(new Set());
      setStreetlightUtilityLoadingByIncident({});
    }
  }, [open]);

  const selectedDomainMeta = useMemo(() => {
    const opts = enabledDomainOptions.length ? enabledDomainOptions : REPORT_DOMAIN_OPTIONS;
    if (isMultiDomainMyReports && activeDomainKeys.length !== 1) return null;
    return opts.find((d) => d.key === primaryActiveDomain) || opts[0] || REPORT_DOMAIN_OPTIONS[0];
  }, [enabledDomainOptions, isMultiDomainMyReports, activeDomainKeys, primaryActiveDomain]);

  const scrollGroupToTop = useCallback((lightId) => {
    const lid = (lightId || "").trim();
    if (!lid) return;
    const scroller = listScrollRef.current;
    const row = rowRefMap.current.get(lid);
    if (!scroller || !row) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const top = Math.max(0, scroller.scrollTop + (rowRect.top - scrollerRect.top) - 2);
    scroller.scrollTo({ top, behavior: "smooth" });
  }, []);

  const handleToggleExpand = useCallback((lightId) => {
    const lid = (lightId || "").trim();
    if (!lid) return;
    const wasOpen = expandedSet?.has?.(lid);
    if (wasOpen) {
      onToggleExpand?.(lid);
      return;
    }
    const openIds = Array.from(expandedSet || [])
      .map((id) => String(id || "").trim())
      .filter((id) => id && id !== lid);
    for (const id of openIds) onToggleExpand?.(id);
    onToggleExpand?.(lid);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollGroupToTop(lid));
    });
  }, [expandedSet, onToggleExpand, scrollGroupToTop]);

  const deriveIncidentStateFromTimeline = useCallback((incidentId, rows = []) => {
    const id = String(incidentId || "").trim();
    const timeline = Array.isArray(actionsByLightId?.[id]) ? actionsByLightId[id] : [];
    let lastFixTs = Number(lastFixByLightId?.[id] || 0);
    let lastReopenTs = 0;
    for (const a of timeline) {
      const t = Number(a?.ts || 0);
      if (!Number.isFinite(t) || t <= 0) continue;
      const kind = String(a?.action || "").toLowerCase();
      if (kind === "fix") lastFixTs = Math.max(lastFixTs, t);
      if (kind === "reopen") lastReopenTs = Math.max(lastReopenTs, t);
    }
    let lastReportTs = 0;
    for (const r of rows || []) {
      const t = Number(r?.ts || 0);
      if (!Number.isFinite(t) || t <= 0) continue;
      if (t > lastReportTs) lastReportTs = t;
    }

    // Canonical cross-domain rule:
    // report newer than last fix => reported/open
    // reopen newer than last fix => reported/open
    // otherwise if last fix exists => fixed/closed
    if (lastReportTs > lastFixTs) {
      return { state: "reported", fixedAtIso: "", lastChangedAtIso: new Date(lastReportTs).toISOString() };
    }
    if (lastReopenTs > lastFixTs) {
      return { state: "reported", fixedAtIso: "", lastChangedAtIso: new Date(lastReopenTs).toISOString() };
    }
    if (lastFixTs > 0) {
      return { state: "fixed", fixedAtIso: new Date(lastFixTs).toISOString(), lastChangedAtIso: new Date(lastFixTs).toISOString() };
    }
    if (lastReportTs > 0) {
      return { state: "reported", fixedAtIso: "", lastChangedAtIso: new Date(lastReportTs).toISOString() };
    }
    return { state: "", fixedAtIso: "", lastChangedAtIso: "" };
  }, [actionsByLightId, lastFixByLightId]);

  const sortedGroups = useMemo(() => {
    const arr = Array.isArray(effectiveGroups) ? [...effectiveGroups] : [];
    if (sortMode === "recent") {
      arr.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
      return arr;
    }
    arr.sort((a, b) => (b.count - a.count) || ((b.lastTs || 0) - (a.lastTs || 0)));
    return arr;
  }, [effectiveGroups, sortMode]);
  const groupCoordsForViewFilter = useCallback((g) => {
    if (!g) return null;
    const domainKey = resolveItemDomainKey(g, g?.rows?.[0] || g?.mineRows?.[0] || null);
    const incidentId = String(g?.incidentId || g?.lightId || "").trim();
    if (domainKey === "streetlights") {
      return getCoordsForLightId(incidentId || g.lightId, reports, officialLights);
    }
    const centerLat = Number(g?.center?.lat);
    const centerLng = Number(g?.center?.lng);
    if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
      return { lat: centerLat, lng: centerLng, isOfficial: false };
    }
    const lat = Number(g?.lat ?? g?.rows?.[0]?.lat);
    const lng = Number(g?.lng ?? g?.rows?.[0]?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, isOfficial: false };
    }
    return null;
  }, [resolveItemDomainKey, reports, officialLights]);
  const visibleGroups = useMemo(() => {
    const base = Array.isArray(sortedGroups) ? sortedGroups : [];
    if (!(inViewOnlyActive && mapBounds)) return base;
    return base.filter((g) => {
      const coords = groupCoordsForViewFilter(g);
      const lat = Number(coords?.lat);
      const lng = Number(coords?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      return isPointInBounds(lat, lng, mapBounds);
    });
  }, [sortedGroups, inViewOnlyActive, mapBounds, groupCoordsForViewFilter]);
  const inViewIncidentIdSet = useMemo(() => {
    if (!(inViewOnlyActive && mapBounds)) return null;
    const ids = new Set();
    for (const g of visibleGroups || []) {
      const incidentId = String(g?.incidentId || g?.lightId || "").trim();
      const domainKey = resolveItemDomainKey(g, g?.rows?.[0] || g?.mineRows?.[0] || null);
      if (incidentId && domainKey) ids.add(`${domainKey}::${incidentId}`);
    }
    return ids;
  }, [inViewOnlyActive, mapBounds, visibleGroups, resolveItemDomainKey]);
  const exactIncidentSearch = useMemo(() => {
    const raw = String(searchQuery || "").trim();
    if (!raw) return "";
    const upper = raw.toUpperCase();
    if (/^[A-Z]{2}\d{10}$/.test(upper)) return upper;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
      return raw.toLowerCase();
    }
    return "";
  }, [searchQuery]);
  const bypassDateRangeForExactIncidentSearch = Boolean(exactIncidentSearch);

  const matchedSearchRows = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) return [];
    const from = (() => {
      const s = String(exportFromDate || "").trim();
      if (!s) return null;
      return parseIsoDate(s);
    })();
    const toExclusive = (() => {
      const s = String(exportToDate || "").trim();
      if (!s) return null;
      const d = parseIsoDate(s);
      if (!d) return null;
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      return next;
    })();
    const inRange = (ts) => {
      if (bypassDateRangeForExactIncidentSearch) return true;
      const n = Number(ts || 0);
      if (!n) return false;
      const d = new Date(n);
      if (from && d < from) return false;
      if (toExclusive && d >= toExclusive) return false;
      return true;
    };
    const digitsQ = normalizePhone(q);
    const out = [];
    for (const g of visibleGroups || []) {
      const domainKey = resolveItemDomainKey(g, g?.rows?.[0] || null);
      const isStreetlights = domainKey === "streetlights";
      const coords = isStreetlights
        ? getCoordsForLightId(String(g?.incidentId || g?.lightId || "").trim() || g.lightId, reports, officialLights)
        : groupCoordsForViewFilter(g);
      const locationLabel =
        String(g.location_label || "").trim() ||
        readLocationFromNote(g.rows?.[0]?.note) ||
        (Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng)
          ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
          : "Location unavailable");
      for (const r of g?.rows || []) {
        const ts = Number(r?.ts || 0);
        if (!inRange(ts)) continue;
        const rowDomainKey = resolveItemDomainKey(g, r, domainKey);
        const reportNo = reportNumberForRow(r, rowDomainKey).toLowerCase();
        const name = String(r?.reporter_name || "").toLowerCase();
        const email = String(r?.reporter_email || "").toLowerCase();
        const phoneNorm = normalizePhone(r?.reporter_phone || "");
        const lightId = String(g?.lightId || "").toLowerCase();
        const incidentIdRaw = String(r?.incident_id || g?.incidentId || g?.lightId || "").trim();
        const groupDisplayIdRaw = String(g?.displayId || "").trim();
        const displayId = formattedIncidentDisplayId(
          rowDomainKey,
          incidentIdRaw || g?.lightId,
          coords,
          groupDisplayIdRaw,
          slIdByUuid
        );
        const incidentLabel = adminIncidentLabelForDomain(
          rowDomainKey,
          incidentIdRaw || g?.lightId,
          r?.report_number || "",
          slIdByUuid,
          displayId
        );
        const issueLabel = resolveIssueLabel(r, rowDomainKey);
        const incidentIdNorm = String(incidentIdRaw || "").trim().toLowerCase();
        const groupIncidentIdNorm = String(g?.incidentId || "").trim().toLowerCase();
        const searchableLookupIds = searchableIncidentLookupIdsForDomain(rowDomainKey, incidentIdNorm);
        const displayIdNorm = String(displayId || "").toLowerCase();
        const matches =
          reportNo.includes(q) ||
          name.includes(q) ||
          email.includes(q) ||
          lightId.includes(q) ||
          incidentIdNorm.includes(q) ||
          groupIncidentIdNorm.includes(q) ||
          searchableLookupIds.some((candidateId) => candidateId.includes(q)) ||
          incidentLabel.toLowerCase().includes(q) ||
          String(issueLabel || "").toLowerCase().includes(q) ||
          displayIdNorm.includes(q) ||
          (digitsQ && phoneNorm.includes(digitsQ));
        if (!matches) continue;
        out.push({
          id: `${g.lightId}:${r.id}`,
          lightId: g.lightId,
          row: r,
          coords,
          displayId,
          locationLabel,
          count: Number(g?.count || 0),
          isStreetlights,
          domainKey: rowDomainKey,
          incidentLabel,
          issueLabel,
        });
      }
    }
    return out.sort((a, b) => Number(b?.row?.ts || 0) - Number(a?.row?.ts || 0));
  }, [
    searchQuery,
    sortedGroups,
    visibleGroups,
    activeDomain,
    reports,
    officialLights,
    slIdByUuid,
    exportFromDate,
    exportToDate,
    parseIsoDate,
    bypassDateRangeForExactIncidentSearch,
    groupCoordsForViewFilter,
    resolveItemDomainKey,
    resolveIssueLabel,
  ]);

  const parseLocalDateStart = useCallback((v) => {
    return parseIsoDate(v);
  }, [parseIsoDate]);

  const parseLocalDateEndExclusive = useCallback((v) => {
    const d = parseIsoDate(v);
    if (!d) return null;
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return next;
  }, [parseIsoDate]);

  const isOpenLifecycleState = useCallback((state) => {
    return isLifecycleStateOpen(state);
  }, []);
  const buildPersonalMyReportsGroupsForDomain = personalReportsSupportModule?.buildPersonalMyReportsGroupsForDomainShared;
  const personalReportsSupportPending =
    usesPersonalMyReportsLayout
    && open
    && deferredDataActivation
    && typeof buildPersonalMyReportsGroupsForDomain !== "function";
  const derivedPersonalMyReports = useMemo(() => {
    if (!usesPersonalMyReportsLayout || Array.isArray(groups) || !open || !deferredDataActivation) {
      return { groups: [], rows: [] };
    }
    if (typeof buildPersonalMyReportsGroupsForDomain !== "function") {
      return { groups: [], rows: [] };
    }
    const identityKey = String(viewerIdentityKey || "").trim();
    if (!identityKey) return { groups: [], rows: [] };
    const selectedDomainKeys = new Set(
      (activeDomainKeys || []).map((key) => String(key || "").trim()).filter(Boolean)
    );
    if (!selectedDomainKeys.size) return { groups: [], rows: [] };

    const builtGroups = [];
    for (const domainKey of selectedDomainKeys) {
      builtGroups.push(
        ...buildPersonalMyReportsGroupsForDomain(domainKey, {
          identityKey,
          reportRows: configuredIncidentReportRowsByDomain?.get?.(domainKey) || [],
          seededRows: configuredIncidentSeededRowsByDomain?.get?.(domainKey) || [],
          slIdByUuid,
        }, {
          formattedIncidentDisplayId,
          getIncidentDomainHelper,
          incidentDomainResolveLookupValueByMode,
          normalizeDomainKeyOrSlug,
          reportIdentityKey,
        })
      );
    }

    const mine = (Array.isArray(reports) ? reports : []).filter((row) => (
      reportIdentityKey(row) === identityKey
      && selectedDomainKeys.has(reportDomainForRow(row, reportKnownAssetIdSetsByDomainForExport))
    ));
    const byScopedIncidentId = new Map();
    for (const row of mine) {
      const domainKey = reportDomainForRow(row, reportKnownAssetIdSetsByDomainForExport);
      const incidentId = String(row?.light_id || "").trim();
      if (!incidentId) continue;
      const scopedLightId = domainKey === "streetlights"
        ? incidentId
        : `${domainKey}:${incidentId}`;
      if (!byScopedIncidentId.has(scopedLightId)) byScopedIncidentId.set(scopedLightId, []);
      byScopedIncidentId.get(scopedLightId).push({ ...row, domainKey, domain: domainKey });
    }
    for (const rows of byScopedIncidentId.values()) {
      rows.sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
    }

    builtGroups.push(...Array.from(byScopedIncidentId.entries()).map(([lightId, mineRows]) => {
      const domainKey = String(mineRows?.[0]?.domainKey || "").trim() || "streetlights";
      const incidentId = String(mineRows?.[0]?.light_id || lightId || "").trim() || lightId;
      const firstRow = mineRows?.[0] || null;
      return {
        domainKey,
        lightId,
        incidentId,
        displayId: formattedIncidentDisplayId(
          domainKey,
          incidentId,
          firstRow ? { lat: Number(firstRow?.lat), lng: Number(firstRow?.lng) } : null,
          "",
          slIdByUuid
        ),
        mineRows,
        lastTs: mineRows?.[0]?.ts || 0,
        totalCount: mineRows?.length || 0,
      };
    }));

    builtGroups.sort((a, b) => Number(b?.lastTs || 0) - Number(a?.lastTs || 0));
    const standardGroups = builtGroups.map((group) => {
      const rows = Array.isArray(group?.mineRows) ? group.mineRows : [];
      const domainKey = String(group?.domainKey || rows?.[0]?.domainKey || "").trim();
      const lightId = String(group?.lightId || "").trim();
      const incidentId = String(group?.incidentId || "").trim() || lightId;
      return {
        ...group,
        domainKey,
        incidentId,
        rows,
        count: Number(group?.totalCount || rows.length || 0),
        lastTs: Number(group?.lastTs || rows?.[0]?.ts || 0),
      };
    });

    return {
      groups: standardGroups,
      rows: builtGroups.flatMap((group) => (Array.isArray(group?.mineRows) ? group.mineRows : [])),
    };
  }, [
    activeDomainKeys,
    configuredIncidentReportRowsByDomain,
    configuredIncidentSeededRowsByDomain,
    deferredDataActivation,
    formattedIncidentDisplayId,
    getIncidentDomainHelper,
    groups,
    incidentDomainResolveLookupValueByMode,
    normalizeDomainKeyOrSlug,
    open,
    reportDomainForRow,
    reportIdentityKey,
    reportKnownAssetIdSetsByDomainForExport,
    reports,
    slIdByUuid,
    usesPersonalMyReportsLayout,
    viewerIdentityKey,
    buildPersonalMyReportsGroupsForDomain,
  ]);
  const derivedSharedIncidentSelection = useMemo(() => {
    if ((Array.isArray(groups) && Array.isArray(allDomainReports)) || usesPersonalMyReportsLayout || !open || !deferredDataActivation) {
      return { groups: [], rows: [] };
    }
    if (
      typeof configuredIncidentReportRowsByDomain?.get !== "function"
      || typeof hydrateIncidentLocationFieldsShared !== "function"
      || typeof resolveIncidentDrivenGroupMeta !== "function"
    ) {
      return { groups: [], rows: [] };
    }

    const selectedDomainKeys = (activeDomainKeys || []).filter((domainKey) => {
      const normalizedDomainKey = String(domainKey || "").trim();
      if (!normalizedDomainKey) return false;
      if (typeof isSharedIncidentDomain === "function" && !isSharedIncidentDomain(normalizedDomainKey)) return false;
      if (typeof shouldIncludeDerivedSharedDomain === "function" && !shouldIncludeDerivedSharedDomain(normalizedDomainKey)) return false;
      return true;
    });
    if (!selectedDomainKeys.length) return { groups: [], rows: [] };

    const sharedReportHydrationContext = {
      incidentLocationCacheByKey: incidentLocationCacheSeed,
      officialLights,
      resolveIncidentDrivenLocationContextForRow,
    };
    const rowsByScopedIncident = new Map();
    const pushRow = (row, domainKeyRaw = "") => {
      const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw || row?.domainKey || row?.domain, { allowUnknown: true })
        || String(domainKeyRaw || row?.domainKey || row?.domain || "").trim();
      const incidentId = String(row?.incident_id || row?.light_id || "").trim();
      if (!domainKey || !incidentId) return;
      const hydratedRow = hydrateIncidentLocationFieldsShared({
        ...row,
        incident_id: incidentId,
      }, domainKey, sharedReportHydrationContext);
      const scopedLightId = `${domainKey}:${incidentId}`;
      if (!rowsByScopedIncident.has(scopedLightId)) rowsByScopedIncident.set(scopedLightId, []);
      rowsByScopedIncident.get(scopedLightId).push({
        ...hydratedRow,
        domainKey,
        domain: domainKey,
        incident_id: incidentId,
      });
    };

    for (const domainKey of selectedDomainKeys) {
      for (const row of configuredIncidentReportRowsByDomain.get(domainKey) || []) {
        pushRow(row, domainKey);
      }
    }
    for (const row of Array.isArray(reports) ? reports : []) {
      const domainKey = reportDomainForRow(row, reportKnownAssetIdSetsByDomainForExport);
      if (!selectedDomainKeys.includes(domainKey)) continue;
      pushRow(row, domainKey);
    }

    const derivedGroups = [];
    const derivedRows = [];
    for (const [scopedLightId, rows] of rowsByScopedIncident.entries()) {
      rows.sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
      const firstRow = rows?.[0] || null;
      const domainKey = String(firstRow?.domainKey || "").trim();
      const incidentId = String(firstRow?.incident_id || firstRow?.light_id || scopedLightId || "").trim() || scopedLightId;
      const groupMeta = resolveIncidentDrivenGroupMeta(domainKey, incidentId, { rows });
      const lat = Number(groupMeta?.lat);
      const lng = Number(groupMeta?.lng);
      if (
        typeof isSharedIncidentDomain === "function"
        && isSharedIncidentDomain(domainKey)
        && cityBoundaryLoaded
        && typeof isWithinCityLimits === "function"
        && !isWithinCityLimits(lat, lng)
      ) {
        continue;
      }
      derivedGroups.push({
        groupKey: `${domainKey}::${incidentId}`,
        lightId: `${domainKey}::${incidentId}`,
        incidentId,
        displayId: String(groupMeta?.displayId || "").trim() || incidentId,
        rows,
        count: Number(rows.length || 0),
        lastTs: Number(rows?.[0]?.ts || 0),
        lat,
        lng,
        location_label: String(groupMeta?.locationLabel || "").trim(),
        domain: domainKey,
        domainKey,
      });
      derivedRows.push(...rows);
    }

    derivedGroups.sort((a, b) => (Number(b?.lastTs || 0) - Number(a?.lastTs || 0)) || (Number(b?.count || 0) - Number(a?.count || 0)));
    return { groups: derivedGroups, rows: derivedRows };
  }, [
    activeDomainKeys,
    allDomainReports,
    cityBoundaryLoaded,
    configuredIncidentReportRowsByDomain,
    deferredDataActivation,
    groups,
    hydrateIncidentLocationFieldsShared,
    incidentLocationCacheSeed,
    isSharedIncidentDomain,
    isWithinCityLimits,
    normalizeDomainKeyOrSlug,
    officialLights,
    open,
    reportDomainForRow,
    reportKnownAssetIdSetsByDomainForExport,
    reports,
    resolveIncidentDrivenGroupMeta,
    shouldIncludeDerivedSharedDomain,
    usesPersonalMyReportsLayout,
  ]);
  const effectiveGroups = Array.isArray(groups)
    ? groups
    : (usesPersonalMyReportsLayout ? derivedPersonalMyReports.groups : derivedSharedIncidentSelection.groups);
  const effectiveAllDomainReports = Array.isArray(allDomainReports)
    ? allDomainReports
    : (usesPersonalMyReportsLayout ? derivedPersonalMyReports.rows : derivedSharedIncidentSelection.rows);

  const getIncidentStateForDisplay = useCallback((incidentId, rows = [], domainOverride = "") => {
    const id = String(incidentId || "").trim();
    if (!id) return { state: "", fixedAtIso: "", lastChangedAtIso: "" };
    const domainKey = resolveItemDomainKey(null, { domain: domainOverride || activeDomain }, activeDomain);

    if (domainKey === "streetlights") {
      const confidence = getStreetlightConfidence(id);
      if (confidence) {
        const closedAtMs = Number(confidence?.latestWorkingTs || confidence?.lastSignalTs || 0);
        const lastChangedMs = Number(confidence?.lastSignalTs || 0);
        return {
          state: String(confidence?.state || "").trim(),
          fixedAtIso: confidence?.closed && closedAtMs ? new Date(closedAtMs).toISOString() : "",
          lastChangedAtIso: lastChangedMs ? new Date(lastChangedMs).toISOString() : "",
        };
      }
    }

    return deriveIncidentStateFromTimeline(id, rows);
  }, [activeDomain, deriveIncidentStateFromTimeline, getStreetlightConfidence, resolveItemDomainKey]);

  const matchesStatusFilter = useCallback((state) => {
    if (statusFilter === "all") return true;
    const isOpen = isOpenLifecycleState(state);
    return statusFilter === "open" ? isOpen : !isOpen;
  }, [statusFilter, isOpenLifecycleState]);

  const getIncidentSnapshotForDisplay = useCallback((domainKeyRaw, incidentIdRaw) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      || String(domainKeyRaw || "").trim().toLowerCase();
    const incidentId = String(incidentIdRaw || "").trim();
    if (!domainKey || !incidentId) return null;

    for (const candidateDomain of incidentSnapshotCandidateDomains(domainKey, incidentId)) {
      const key = incidentSnapshotKey(candidateDomain, incidentId);
      if (!key) continue;
      const hit = incidentStateByKey?.[key] || null;
      if (hit) return hit;
    }

    for (const [key, value] of Object.entries(incidentStateByKey || {})) {
      if (String(key || "").endsWith(`:${incidentId}`)) return value || null;
    }

    return null;
  }, [incidentStateByKey]);

  const buildLocalIncidentDetailRow = useCallback((row, {
    domainKeyRaw = "",
    incidentIdRaw = "",
    incidentPublicId = "",
    timelineRows = [],
    coords = null,
    locationLabelOverride = "",
  } = {}) => {
    const domainKey = resolveItemDomainKey(null, row, domainKeyRaw || activeDomain);
    const incidentId = String(incidentIdRaw || row?.incident_id || row?.light_id || "").trim();
    const effectiveTimelineRows = Array.isArray(timelineRows) && timelineRows.length
      ? timelineRows
      : [row].filter(Boolean);
    const timelineState = getIncidentStateForDisplay(incidentId, effectiveTimelineRows, domainKey);
    const snapshot = getIncidentSnapshotForDisplay(domainKey, incidentId);
    const ts = Number(row?.ts || 0);

    return {
      report_id: String(row?.id || ""),
      report_number: reportNumberForRow(row, domainKey),
      report_type: String(row?.type || row?.report_type || ""),
      domain: domainKey,
      incident_id: incidentId,
      incident_public_id: String(incidentPublicId || "").trim(),
      submitted_at: ts ? new Date(ts).toISOString() : "",
      fixed_at:
        String(timelineState?.fixedAtIso || "")
        || (snapshot?.state === "fixed" ? String(snapshot?.last_changed_at || "") : ""),
      time_to_close_seconds: "",
      current_state: String(timelineState?.state || snapshot?.state || ""),
      reporter_name: String(row?.reporter_name || ""),
      reporter_email: String(row?.reporter_email || ""),
      reporter_phone: String(row?.reporter_phone || ""),
      raw_notes: String(row?.note || ""),
      notes: String(stripSystemMetadataFromNote(row?.note || "") || ""),
      lat: Number.isFinite(Number(coords?.lat)) ? Number(coords.lat) : null,
      lng: Number.isFinite(Number(coords?.lng)) ? Number(coords.lng) : null,
      location_label:
        String(locationLabelOverride || "").trim()
        || String(row?.location_label || row?.nearest_address || "").trim(),
      nearest_address: String(row?.nearest_address || "").trim(),
      nearest_cross_street: String(row?.nearest_cross_street || "").trim(),
      nearest_landmark: String(row?.nearest_landmark || "").trim(),
    };
  }, [activeDomain, getIncidentSnapshotForDisplay, getIncidentStateForDisplay, resolveItemDomainKey]);

  const localExportDetailRows = useMemo(() => {
    const from = parseLocalDateStart(exportFromDate);
    const toExclusive = parseLocalDateEndExclusive(exportToDate);
    const inRange = (ts) => {
      if (bypassDateRangeForExactIncidentSearch) return true;
      const n = Number(ts || 0);
      if (!n) return false;
      const d = new Date(n);
      if (from && d < from) return false;
      if (toExclusive && d >= toExclusive) return false;
      return true;
    };

    const detail = [];
    if (String(searchQuery || "").trim()) {
      const incidentRowsByKey = new Map();
      for (const g of visibleGroups || []) {
        const groupDomainKey = resolveItemDomainKey(g, g?.rows?.[0] || null, activeDomain);
        const rawIncidentId = String(g?.incidentId || (groupDomainKey === "streetlights" ? g?.lightId : "")).trim();
        const incidentId = groupDomainKey === "streetlights"
          ? rawIncidentId
          : canonicalIncidentDrivenIncidentIdShared(groupDomainKey, g?.rows?.[0] || null, rawIncidentId, {
            getIncidentDomainHelper,
            normalizeDomainKeyOrSlug,
          });
        if (!groupDomainKey || !incidentId) continue;
        incidentRowsByKey.set(`${groupDomainKey}::${incidentId}`, Array.isArray(g?.rows) ? g.rows : []);
      }
      for (const item of matchedSearchRows) {
        const ts = Number(item?.row?.ts || 0);
        if (!inRange(ts)) continue;
        const rowDomainKey = resolveItemDomainKey(null, item?.row, item?.domainKey || activeDomain);
        const rawIncidentId = item?.isStreetlights
          ? String(item.lightId || "")
          : String(item.row?.incident_id || item.lightId || "");
        const incidentId = rowDomainKey === "streetlights"
          ? rawIncidentId
          : canonicalIncidentDrivenIncidentIdShared(rowDomainKey, item?.row, rawIncidentId, {
            getIncidentDomainHelper,
            normalizeDomainKeyOrSlug,
          });
        const incidentRows = incidentRowsByKey.get(`${rowDomainKey}::${incidentId}`) || [];
        detail.push(buildLocalIncidentDetailRow(item?.row, {
          domainKeyRaw: rowDomainKey,
          incidentIdRaw: incidentId,
          incidentPublicId: item?.displayId,
          timelineRows: incidentRows,
          coords: item?.coords,
          locationLabelOverride: item?.locationLabel,
        }));
      }
      return detail;
    }

    if (
      !isMyReportsModal
      && !isMultiDomainMyReports
      && isAdmin
      && incidentDomainUsesAdminExportAllDomainReportsLocal(activeDomain, {
        getIncidentDomainHelper,
        normalizeDomainKeyOrSlug,
      })
    ) {
      const byIncident = new Map();
      for (const r of effectiveAllDomainReports || []) {
        const incidentId = canonicalIncidentDrivenIncidentIdShared(activeDomain, r, "", {
          getIncidentDomainHelper,
          normalizeDomainKeyOrSlug,
        });
        if (!incidentId) continue;
        if (!byIncident.has(incidentId)) byIncident.set(incidentId, []);
        byIncident.get(incidentId).push(r);
      }

      for (const [incidentId, rows] of byIncident.entries()) {
        if (inViewIncidentIdSet && !inViewIncidentIdSet.has(String(incidentId || "").trim())) continue;
        const sortedRows = [...rows].sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
        for (const r of sortedRows) {
          const ts = Number(r?.ts || 0);
          if (!inRange(ts)) continue;
          detail.push(buildLocalIncidentDetailRow(r, {
            domainKeyRaw: activeDomain,
            incidentIdRaw: incidentId,
            timelineRows: sortedRows,
          }));
        }
      }
    } else {
      for (const g of visibleGroups || []) {
        const domainKey = resolveItemDomainKey(g, g?.rows?.[0] || null);
        const incidentId = String(g?.incidentId || g?.lightId || "");
        for (const r of g?.rows || []) {
          const ts = Number(r?.ts || 0);
          if (!inRange(ts)) continue;
          detail.push(buildLocalIncidentDetailRow(r, {
            domainKeyRaw: domainKey,
            incidentIdRaw: incidentId,
            timelineRows: g?.rows || [],
          }));
        }
      }
    }
    return detail.sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
  }, [
    isAdmin,
    effectiveAllDomainReports,
    buildLocalIncidentDetailRow,
    getIncidentStateForDisplay,
    parseLocalDateStart,
    parseLocalDateEndExclusive,
    exportFromDate,
    exportToDate,
    searchQuery,
    matchedSearchRows,
    visibleGroups,
    inViewIncidentIdSet,
    activeDomain,
    bypassDateRangeForExactIncidentSearch,
    isMyReportsModal,
    isMultiDomainMyReports,
    resolveItemDomainKey,
  ]);

  const exportDetailRows = useMemo(() => {
    const resolveIncidentPublicId = (domain, incidentId) => {
      const d = String(domain || "").trim().toLowerCase();
      const id = String(incidentId || "").trim();
      if (!id) return "";
      if (d === "streetlights") {
        return formattedIncidentDisplayId("streetlights", id, null, "", slIdByUuid);
      }
      const domainMeta = resolveIncidentDrivenDomainMeta(d, id);
      const coords = Number.isFinite(Number(domainMeta?.center?.lat)) && Number.isFinite(Number(domainMeta?.center?.lng))
        ? { lat: Number(domainMeta.center.lat), lng: Number(domainMeta.center.lng) }
        : null;
      const displayIdHint = String(domainMeta?.displayIdHint || "").trim();
      return formattedIncidentDisplayId(d, id, coords, displayIdHint, slIdByUuid);
    };

    const baseRows = (localExportDetailRows || []).map((r) => {
      const domain = String(r?.domain ?? activeDomain);
      const incidentId = String(r?.incident_id ?? "");
      return {
        ...r,
        incident_public_id: String(r?.incident_public_id || "").trim() || resolveIncidentPublicId(domain, incidentId),
      };
    });

    // Hygiene: drop stale incidents tied to deleted/missing official assets for asset-backed domains
    // when we have a current canonical official-id set for that domain.
    const officialExportIdSetByDomain = reportKnownAssetIdSetsByDomain;
    const activeOfficialIdSet = officialExportIdSetByDomain.get(activeDomain) || null;
    if (!isMyReportsModal && activeOfficialIdSet instanceof Set) {
      return baseRows.filter((r) => activeOfficialIdSet.has(String(r?.incident_id || "").trim()));
    }
    return baseRows;
  }, [
    isMyReportsModal,
    localExportDetailRows,
    activeDomain,
    reportKnownAssetIdSetsByDomain,
  ]);

  const filteredExportDetailRows = useMemo(
    () => (exportDetailRows || []).filter((r) => matchesStatusFilter(r?.current_state)),
    [exportDetailRows, matchesStatusFilter]
  );

  const exportSummaryRows = useMemo(() => {
    const byIncident = new Map();
    for (const r of filteredExportDetailRows) {
      const key = `${r.domain}::${r.incident_id}`;
      const prev = byIncident.get(key);
      if (!prev) {
        byIncident.set(key, {
          domain: r.domain,
          incident_id: r.incident_id,
          incident_public_id: r.incident_public_id,
          first_reported_at: r.submitted_at,
          latest_reported_at: r.submitted_at,
          fixed_at: r.fixed_at,
          time_to_close_seconds: r.time_to_close_seconds,
          current_state: r.current_state,
          report_count: 1,
        });
        continue;
      }
      prev.report_count += 1;
      if (String(r.submitted_at) < String(prev.first_reported_at)) prev.first_reported_at = r.submitted_at;
      if (String(r.submitted_at) > String(prev.latest_reported_at)) prev.latest_reported_at = r.submitted_at;
      if (!prev.fixed_at && r.fixed_at) prev.fixed_at = r.fixed_at;
      if (!prev.current_state && r.current_state) prev.current_state = r.current_state;
    }
    const rows = Array.from(byIncident.values()).map((r) => {
      const firstMs = Date.parse(String(r.first_reported_at || ""));
      const fixedMs = Date.parse(String(r.fixed_at || ""));
      const ttc =
        Number.isFinite(firstMs) && Number.isFinite(fixedMs) && fixedMs >= firstMs
          ? Math.round((fixedMs - firstMs) / 1000)
          : "";
      return { ...r, time_to_close_seconds: ttc };
    });
    return rows.sort((a, b) =>
      String(b.latest_reported_at).localeCompare(String(a.latest_reported_at))
    );
  }, [filteredExportDetailRows]);

  const groupByIncidentId = useMemo(() => {
    const m = new Map();
    for (const g of effectiveGroups || []) {
      const incidentId = String(g?.incidentId || "").trim();
      const domainKey = String(g?.domainKey || g?.domain || "").trim();
      const key = String(g?.groupKey || `${domainKey}::${incidentId || String(g?.lightId || "").trim()}`).trim();
      if (!key || !incidentId) continue;
      m.set(key, g);
    }
    return m;
  }, [effectiveGroups]);

  const adminTableRows = useMemo(() => {
    const grouped = new Map();
    for (const r of filteredExportDetailRows || []) {
      const incidentId = String(r?.incident_id || "").trim();
      if (!incidentId) continue;
      const rowDomainKey = isMultiDomainMyReports
        ? resolveItemDomainKey(null, { domain: r?.domain || r?.domainKey }, activeDomain)
        : activeDomain;
      const incidentKey = `${rowDomainKey}::${incidentId}`;
      if (!grouped.has(incidentKey)) {
        const g = groupByIncidentId.get(incidentKey);
        const isStreetlights = rowDomainKey === "streetlights";
        let coords = isStreetlights
          ? getCoordsForLightId(incidentId, reports, officialLights)
          : {
              lat: Number(g?.lat ?? g?.rows?.[0]?.lat),
              lng: Number(g?.lng ?? g?.rows?.[0]?.lng),
              isOfficial: false,
            };
        grouped.set(incidentKey, {
          incident_key: incidentKey,
          domainKey: rowDomainKey,
          incident_id: incidentId,
          incident_display_id:
            String(g?.displayId || r?.incident_public_id || "").trim()
            || incidentDisplayValueForDomain(rowDomainKey, incidentId, coords, "", "", slIdByUuid)
            || incidentId,
          incident_public_id: String(r?.incident_public_id || "").trim(),
          incident_label: "",
          primary_report_number: "",
          current_state: String(r?.current_state || ""),
          fixed_at: String(r?.fixed_at || ""),
          report_count: 0,
          latest_submitted_at: "",
          coords,
          location_label: String(g?.location_label || g?.locationLabel || "").trim(),
          nearest_address: "",
          nearest_cross_street: "",
          nearest_landmark: "",
          rows: [],
        });
      }
      const item = grouped.get(incidentKey);
      item.report_count += 1;
      item.rows.push({
        report_id: String(r?.report_id || ""),
        report_number: String(r?.report_number || ""),
        report_type: String(r?.report_type || ""),
        submitted_at: String(r?.submitted_at || ""),
        reporter_user_id: String(r?.reporter_user_id || ""),
        reporter_name: String(r?.reporter_name || ""),
        reporter_email: String(r?.reporter_email || ""),
        reporter_phone: String(r?.reporter_phone || ""),
        raw_notes: String(r?.raw_notes || ""),
        notes: String(r?.notes || ""),
        location_label: String(r?.location_label || r?.nearest_address || "").trim(),
        nearest_address: String(r?.nearest_address || "").trim(),
        nearest_cross_street: String(r?.nearest_cross_street || "").trim(),
        nearest_landmark: String(r?.nearest_landmark || "").trim(),
      });
      if (!item.latest_submitted_at || String(r?.submitted_at || "") > String(item.latest_submitted_at)) {
        item.latest_submitted_at = String(r?.submitted_at || "");
      }
      if (!item.incident_public_id && String(r?.incident_public_id || "").trim()) {
        item.incident_public_id = String(r.incident_public_id || "").trim();
      }
      if (!item.incident_display_id && String(r?.incident_public_id || "").trim()) {
        item.incident_display_id = String(r.incident_public_id || "").trim();
      }
      if (!item.fixed_at || String(r?.fixed_at || "") > String(item.fixed_at)) {
        item.fixed_at = String(r?.fixed_at || "");
      }
    }

    const rows = Array.from(grouped.values());
    for (const row of rows) {
      const rowDomainKey = isMultiDomainMyReports
        ? resolveItemDomainKey(null, { domain: row?.domainKey || row?.domain }, activeDomain)
        : activeDomain;
      if (!Number.isFinite(Number(row?.coords?.lat)) || !Number.isFinite(Number(row?.coords?.lng))) {
        const domainMeta = typeof resolveIncidentDrivenDomainMeta === "function"
          ? resolveIncidentDrivenDomainMeta(rowDomainKey, row?.incident_id)
          : null;
        if (Number.isFinite(Number(domainMeta?.center?.lat)) && Number.isFinite(Number(domainMeta?.center?.lng))) {
          row.coords = {
            lat: Number(domainMeta.center.lat),
            lng: Number(domainMeta.center.lng),
            isOfficial: Boolean(domainMeta?.center?.isOfficial),
          };
        }
      }
      if (!String(row.location_label || "").trim()) {
        row.location_label = String(row.rows?.[0]?.location_label || row.rows?.[0]?.nearest_address || "").trim();
      }
      if (!String(row.nearest_address || "").trim()) {
        row.nearest_address = String(row.rows?.[0]?.nearest_address || "").trim();
      }
      if (!String(row.nearest_cross_street || "").trim()) {
        row.nearest_cross_street = String(row.rows?.[0]?.nearest_cross_street || "").trim();
      }
      if (!String(row.nearest_landmark || "").trim()) {
        row.nearest_landmark = String(row.rows?.[0]?.nearest_landmark || "").trim();
      }
      Object.assign(
        row,
        hydrateIncidentLocationFieldsShared(row, rowDomainKey, {
          incidentLocationCacheByKey,
          officialLights,
          resolveIncidentDrivenLocationContextForRow,
        }) || row
      );
      row.rows.sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
      row.primary_report_number = String(row.rows?.[0]?.report_number || "").trim();
      row.incident_label = adminIncidentLabelForDomain(
        rowDomainKey,
        row.incident_id,
        row.primary_report_number,
        slIdByUuid,
        row.incident_display_id || row.incident_public_id
      );
      const fixAction = (actionsByLightId?.[row.incident_id] || [])
        .filter((a) => String(a?.action || "").toLowerCase() === "fix")
        .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0))[0] || null;
      const reopenActionsRaw = (actionsByLightId?.[row.incident_id] || [])
        .filter((a) => String(a?.action || "").toLowerCase() === "reopen")
        .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0))
        .map((a) => ({
          ts: Number(a?.ts || 0),
          note: String(a?.note || "").trim(),
          reporter_user_id: a?.actor_user_id || a?.reporter_user_id || null,
          reporter_name: String(a?.actor_name || a?.reporter_name || "").trim() || null,
          reporter_email: String(a?.actor_email || a?.reporter_email || "").trim() || null,
          reporter_phone: String(a?.actor_phone || a?.reporter_phone || "").trim() || null,
        }));
      const seenReopen = new Set();
      row.reopen_events = reopenActionsRaw.filter((ev) => {
        const key = [
          String(Math.floor(Number(ev.ts || 0) / 1000)),
          String(ev.note || ""),
          String(ev.reporter_user_id || ""),
          String(ev.reporter_name || ""),
        ].join("|");
        if (seenReopen.has(key)) return false;
        seenReopen.add(key);
        return true;
      });
      if (fixAction || row.fixed_at) {
        const fixedByUserId = fixAction?.actor_user_id || fixAction?.reporter_user_id || null;
        const isCurrentUserFixer = Boolean(
          fixedByUserId &&
          session?.user?.id &&
          String(fixedByUserId) === String(session.user.id)
        );
        const fallbackName =
          (isCurrentUserFixer
            ? (
              String(profile?.full_name || "").trim() ||
              String(session?.user?.user_metadata?.full_name || "").trim() ||
              String(session?.user?.email || "").split("@")[0]
            )
            : "") ||
          "";
        const fallbackEmail =
          (isCurrentUserFixer
            ? (normalizeEmail(profile?.email || session?.user?.email || "") || "")
            : "") ||
          "";
        const fallbackPhone =
          (isCurrentUserFixer
            ? (normalizePhone(profile?.phone || "") || "")
            : "") ||
          "";
        const fixTs = Number(fixAction?.ts || Date.parse(String(row.fixed_at || "")) || 0);
        row.fixed_event = {
          ts: fixTs,
          note: String(fixAction?.note || "").trim(),
          reporter_user_id: fixedByUserId,
          reporter_name: String(fixAction?.actor_name || fixAction?.reporter_name || "").trim() || fallbackName || null,
          reporter_email: String(fixAction?.actor_email || fixAction?.reporter_email || "").trim() || fallbackEmail || null,
          reporter_phone: String(fixAction?.actor_phone || fixAction?.reporter_phone || "").trim() || fallbackPhone || null,
        };
      } else {
        row.fixed_event = null;
      }
      row.latest_activity_at = String(
        row.fixed_event?.ts && Number(row.fixed_event.ts) > 0
          ? new Date(Number(row.fixed_event.ts)).toISOString()
          : row.latest_submitted_at || ""
      );
      if (row.latest_submitted_at && row.fixed_event?.ts) {
        const reportTs = Date.parse(String(row.latest_submitted_at || "")) || 0;
        const fixedTs = Number(row.fixed_event.ts || 0);
        if (fixedTs <= reportTs) {
          row.latest_activity_at = String(row.latest_submitted_at || "");
        }
      }
    }

    const cityFilteredRows = rows.filter((row) => {
      if (!cityBoundaryLoaded) return true;
      if (typeof isWithinCityLimits !== "function") return true;
      const rowDomainKey = isMultiDomainMyReports
        ? resolveItemDomainKey(null, { domain: row?.domainKey || row?.domain }, activeDomain)
        : activeDomain;
      if (typeof isSharedIncidentDomain !== "function" || !isSharedIncidentDomain(rowDomainKey)) return true;
      const lat = Number(row?.coords?.lat);
      const lng = Number(row?.coords?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      return Boolean(isWithinCityLimits(lat, lng));
    });
    const inViewRows = inViewIncidentIdSet
      ? cityFilteredRows.filter((row) => {
          const rowDomainKey = isMultiDomainMyReports
            ? resolveItemDomainKey(null, { domain: row?.domainKey || row?.domain }, activeDomain)
            : activeDomain;
          return inViewIncidentIdSet.has(`${rowDomainKey}::${String(row?.incident_id || "").trim()}`);
        })
      : cityFilteredRows;

    const dir = tableSort?.dir === "asc" ? 1 : -1;
    const key = String(tableSort?.key || "submitted_at");
    inViewRows.sort((a, b) => {
      if (key === "report_count") return (Number(a.report_count || 0) - Number(b.report_count || 0)) * dir;
      if (key === "utility_reported") {
        const aa = Boolean(utilityReportedByIncident?.[a?.incident_id]) ? 1 : 0;
        const bb = Boolean(utilityReportedByIncident?.[b?.incident_id]) ? 1 : 0;
        return (aa - bb) * dir;
      }
      if (key === "submitted_at") {
        const ta = Date.parse(String(a.latest_activity_at || a.latest_submitted_at || "")) || 0;
        const tb = Date.parse(String(b.latest_activity_at || b.latest_submitted_at || "")) || 0;
        return (ta - tb) * dir;
      }
      if (key === "incident_id") {
        const la = String(a?.incident_label || a?.incident_id || "").toLowerCase();
        const lb = String(b?.incident_label || b?.incident_id || "").toLowerCase();
        if (la < lb) return -1 * dir;
        if (la > lb) return 1 * dir;
        return 0;
      }
      const sa = String(a?.[key] || "").toLowerCase();
      const sb = String(b?.[key] || "").toLowerCase();
      if (sa < sb) return -1 * dir;
      if (sa > sb) return 1 * dir;
      return 0;
    });
    return inViewRows;
  }, [
    filteredExportDetailRows,
    groupByIncidentId,
    inViewIncidentIdSet,
    activeDomain,
    reports,
    officialLights,
    slIdByUuid,
    actionsByLightId,
    tableSort,
    utilityReportedByIncident,
    resolveIssueLabel,
    cityBoundaryLoaded,
    isWithinCityLimits,
    isSharedIncidentDomain,
    isMyReportsModal,
    isMultiDomainMyReports,
    resolveItemDomainKey,
  ]);

  const isAdminMultiDomainAllReports = isAdmin && isMultiDomainMyReports && !isMyReportsModal;

  const matchedSearchRowsByIncidentKey = useMemo(() => {
    if (!isAdminMultiDomainAllReports || !String(searchQuery || "").trim()) return new Map();
    const grouped = new Map();
    for (const item of matchedSearchRows || []) {
      const domainKey = resolveItemDomainKey(null, item?.row, item?.domainKey || activeDomain);
      const incidentId = canonicalIncidentDrivenIncidentIdShared(
        domainKey,
        item?.row,
        String(item?.lightId || "").trim(),
        {
          getIncidentDomainHelper,
          normalizeDomainKeyOrSlug,
        }
      );
      if (!incidentId) continue;
      const incidentKey = `${domainKey}::${incidentId}`;
      if (!grouped.has(incidentKey)) grouped.set(incidentKey, []);
      grouped.get(incidentKey).push(item);
    }
    return grouped;
  }, [isAdminMultiDomainAllReports, matchedSearchRows, searchQuery, resolveItemDomainKey, activeDomain]);

  const adminMultiDomainDisplayRows = useMemo(() => {
    if (!isAdminMultiDomainAllReports) return [];

    const from = parseLocalDateStart(exportFromDate);
    const toExclusive = parseLocalDateEndExclusive(exportToDate);
    const inRange = (ts) => {
      const n = Number(ts || 0);
      if (!n) return false;
      const d = new Date(n);
      if (from && d < from) return false;
      if (toExclusive && d >= toExclusive) return false;
      return true;
    };

    const rows = [];

    for (const g of visibleGroups || []) {
      const domainKey = resolveItemDomainKey(g, g?.rows?.[0] || null, activeDomain);
      const incidentId = String(g?.incidentId || (domainKey === "streetlights" ? g?.lightId : "")).trim();
      if (!incidentId) continue;
      const incidentKey = `${domainKey}::${incidentId}`;
      const sourceRows = String(searchQuery || "").trim()
        ? (matchedSearchRowsByIncidentKey.get(incidentKey) || []).map((item) => item?.row).filter(Boolean)
        : (Array.isArray(g?.rows) ? g.rows.filter((r) => inRange(r?.ts)) : []);
      if (!sourceRows.length) continue;

      const orderedRows = [...sourceRows].sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
      const timelineState = getIncidentStateForDisplay(incidentId, orderedRows, domainKey);
      if (!matchesStatusFilter(timelineState?.state || "")) continue;

      const coords = groupCoordsForViewFilter(g) || {
        lat: Number(g?.lat ?? orderedRows?.[0]?.lat),
        lng: Number(g?.lng ?? orderedRows?.[0]?.lng),
        isOfficial: false,
      };
      const detailRows = orderedRows.map((r) => ({
        report_id: String(r?.id || ""),
        report_number: reportNumberForRow(r, domainKey),
        report_type: String(r?.type || r?.report_type || ""),
        incident_public_id:
          incidentDisplayValueForDomain(domainKey, incidentId, coords, "", String(g?.displayId || "").trim(), slIdByUuid)
          || String(incidentId || "").trim(),
        submitted_at: Number(r?.ts || 0) ? new Date(Number(r.ts)).toISOString() : "",
        reporter_user_id: String(r?.reporter_user_id || ""),
        reporter_name: String(r?.reporter_name || ""),
        reporter_email: String(r?.reporter_email || ""),
        reporter_phone: String(r?.reporter_phone || ""),
        raw_notes: String(r?.note || ""),
        notes: String(stripSystemMetadataFromNote(r?.note || "") || ""),
        location_label: String(r?.location_label || r?.nearest_address || "").trim(),
        nearest_address: String(r?.nearest_address || "").trim(),
        nearest_cross_street: String(r?.nearest_cross_street || "").trim(),
        nearest_landmark: String(r?.nearest_landmark || "").trim(),
      }));
      const latestSubmittedAt = String(detailRows?.[0]?.submitted_at || "");
      const row = {
        incident_key: incidentKey,
        domainKey,
        incident_id: incidentId,
        incident_display_id:
          String(g?.displayId || detailRows?.[0]?.incident_public_id || "").trim()
          || incidentDisplayValueForDomain(domainKey, incidentId, coords, "", "", slIdByUuid)
          || incidentId,
        incident_public_id: "",
        incident_label: "",
        primary_report_number: String(detailRows?.[0]?.report_number || "").trim(),
        current_state: String(timelineState?.state || ""),
        fixed_at: String(timelineState?.fixedAtIso || ""),
        report_count: detailRows.length,
        latest_submitted_at: latestSubmittedAt,
        latest_activity_at: String(timelineState?.lastChangedAtIso || latestSubmittedAt || ""),
        coords,
        location_label: String(g?.location_label || g?.locationLabel || detailRows?.[0]?.location_label || detailRows?.[0]?.nearest_address || "").trim(),
        nearest_address: String(detailRows?.[0]?.nearest_address || "").trim(),
        nearest_cross_street: String(detailRows?.[0]?.nearest_cross_street || "").trim(),
        nearest_landmark: String(detailRows?.[0]?.nearest_landmark || "").trim(),
        rows: detailRows,
      };

      Object.assign(
        row,
        hydrateIncidentLocationFieldsShared(row, domainKey, {
          incidentLocationCacheByKey,
          officialLights,
          resolveIncidentDrivenLocationContextForRow,
        }) || row
      );
      if (!row.incident_public_id && String(detailRows?.[0]?.incident_public_id || "").trim()) {
        row.incident_public_id = String(detailRows[0].incident_public_id || "").trim();
      }
      if (!row.incident_display_id && row.incident_public_id) {
        row.incident_display_id = row.incident_public_id;
      }

      if (!Number.isFinite(Number(row?.coords?.lat)) || !Number.isFinite(Number(row?.coords?.lng))) {
        const domainMeta = typeof resolveIncidentDrivenDomainMeta === "function"
          ? resolveIncidentDrivenDomainMeta(domainKey, incidentId)
          : null;
        if (Number.isFinite(Number(domainMeta?.center?.lat)) && Number.isFinite(Number(domainMeta?.center?.lng))) {
          row.coords = {
            lat: Number(domainMeta.center.lat),
            lng: Number(domainMeta.center.lng),
            isOfficial: Boolean(domainMeta?.center?.isOfficial),
          };
        }
      }
      row.incident_label = adminIncidentLabelForDomain(
        domainKey,
        row.incident_id,
        row.primary_report_number,
        slIdByUuid,
        row.incident_display_id || row.incident_public_id
      );

      const fixAction = (actionsByLightId?.[incidentId] || [])
        .filter((a) => String(a?.action || "").toLowerCase() === "fix")
        .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0))[0] || null;
      const reopenActionsRaw = (actionsByLightId?.[incidentId] || [])
        .filter((a) => String(a?.action || "").toLowerCase() === "reopen")
        .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0))
        .map((a) => ({
          ts: Number(a?.ts || 0),
          note: String(a?.note || "").trim(),
          reporter_user_id: a?.actor_user_id || a?.reporter_user_id || null,
          reporter_name: String(a?.actor_name || a?.reporter_name || "").trim() || null,
          reporter_email: String(a?.actor_email || a?.reporter_email || "").trim() || null,
          reporter_phone: String(a?.actor_phone || a?.reporter_phone || "").trim() || null,
        }));
      const seenReopen = new Set();
      row.reopen_events = reopenActionsRaw.filter((ev) => {
        const key = [
          String(Math.floor(Number(ev.ts || 0) / 1000)),
          String(ev.note || ""),
          String(ev.reporter_user_id || ""),
          String(ev.reporter_name || ""),
        ].join("|");
        if (seenReopen.has(key)) return false;
        seenReopen.add(key);
        return true;
      });
      row.fixed_event = (fixAction || row.fixed_at)
        ? {
            ts: Number(fixAction?.ts || Date.parse(String(row.fixed_at || "")) || 0),
            note: String(fixAction?.note || "").trim(),
            reporter_user_id: fixAction?.actor_user_id || fixAction?.reporter_user_id || null,
            reporter_name: String(fixAction?.actor_name || fixAction?.reporter_name || "").trim() || null,
            reporter_email: String(fixAction?.actor_email || fixAction?.reporter_email || "").trim() || null,
            reporter_phone: String(fixAction?.actor_phone || fixAction?.reporter_phone || "").trim() || null,
          }
        : null;

      rows.push(row);
    }

    const dir = tableSort?.dir === "asc" ? 1 : -1;
    const key = String(tableSort?.key || "submitted_at");
    rows.sort((a, b) => {
      if (key === "report_count") return (Number(a.report_count || 0) - Number(b.report_count || 0)) * dir;
      if (key === "utility_reported") {
        const aa = Boolean(utilityReportedByIncident?.[a?.incident_id]) ? 1 : 0;
        const bb = Boolean(utilityReportedByIncident?.[b?.incident_id]) ? 1 : 0;
        return (aa - bb) * dir;
      }
      if (key === "submitted_at") {
        const ta = Date.parse(String(a.latest_activity_at || a.latest_submitted_at || "")) || 0;
        const tb = Date.parse(String(b.latest_activity_at || b.latest_submitted_at || "")) || 0;
        return (ta - tb) * dir;
      }
      if (key === "incident_id") {
        const la = String(a?.incident_label || a?.incident_id || "").toLowerCase();
        const lb = String(b?.incident_label || b?.incident_id || "").toLowerCase();
        if (la < lb) return -1 * dir;
        if (la > lb) return 1 * dir;
        return 0;
      }
      const sa = String(a?.[key] || "").toLowerCase();
      const sb = String(b?.[key] || "").toLowerCase();
      if (sa < sb) return -1 * dir;
      if (sa > sb) return 1 * dir;
      return 0;
    });
    return rows;
  }, [
    isAdminMultiDomainAllReports,
    visibleGroups,
    activeDomain,
    searchQuery,
    matchedSearchRowsByIncidentKey,
    parseLocalDateStart,
    parseLocalDateEndExclusive,
    exportFromDate,
    exportToDate,
    getIncidentStateForDisplay,
    matchesStatusFilter,
    groupCoordsForViewFilter,
    resolveIssueLabel,
    slIdByUuid,
    actionsByLightId,
    tableSort,
    utilityReportedByIncident,
    resolveItemDomainKey,
  ]);

  const displayedAdminRows = isAdminMultiDomainAllReports ? adminMultiDomainDisplayRows : adminTableRows;

  const savedStreetlightReportRow = useMemo(() => {
    const incidentId = String(savedStreetlightReportIncidentId || "").trim();
    if (!incidentId) return null;
    return (displayedAdminRows || []).find((row) => String(row?.incident_id || "").trim() === incidentId) || null;
  }, [displayedAdminRows, savedStreetlightReportIncidentId]);
  const submittedReportsRow = submittedReportsModal?.row || null;
  const submittedReportsRowDomainKey = submittedReportsRow
    ? (String(submittedReportsModal?.domainKey || resolveDisplayedRowDomainKey(submittedReportsRow, activeDomain)).trim() || "streetlights")
    : "";
  const submittedReportsRepairSnapshot = submittedReportsRow
    ? getRepairSnapshotForIncident(submittedReportsRow.incident_id, submittedReportsRowDomainKey)
    : null;
  const submittedReportsTitleLabel = submittedReportsRow
    ? singularizeDomainLabel(
      enabledDomainOptions.find((option) => option.key === submittedReportsRowDomainKey)?.label || humanizeLabel(submittedReportsRowDomainKey),
      "Incident"
    )
    : "";
  const submittedReportsTitleValue = submittedReportsRow
    ? (
      incidentDisplayValueForDomain(
        submittedReportsRowDomainKey,
        submittedReportsRow?.incident_id,
        submittedReportsRow?.coords,
        submittedReportsRow?.incident_label,
        "",
        slIdByUuid
      ) || submittedReportsRow?.incident_id
    )
    : "";

  useEffect(() => {
    if (!savedStreetlightReportRow) return;
    void ensureStreetlightUtilityForIncident(savedStreetlightReportRow.incident_id, savedStreetlightReportRow.coords || null);
  }, [savedStreetlightReportRow, ensureStreetlightUtilityForIncident]);

  useEffect(() => {
    // Cost guardrail: disable passive streetlight hydration in reports views.
    // Streetlight utility details should come from persisted DB fields.
  }, [open, activeDomain, displayedAdminRows, getStreetlightUtilityDetails, streetlightReportInfoByIncident]);

  const toggleTableSort = useCallback((key) => {
    setTableSort((prev) => {
      if (prev?.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: key === "submitted_at" || key === "report_count" || key === "utility_reported" ? "desc" : "asc" };
    });
  }, []);

  const sortPresetValue = useMemo(() => {
    const key = String(tableSort?.key || "");
    const dir = String(tableSort?.dir || "desc");
    if (key === "submitted_at") return dir === "asc" ? "recent_asc" : "recent_desc";
    if (key === "report_count") return dir === "asc" ? "reports_asc" : "reports_desc";
    if (key === "incident_id") return dir === "asc" ? "id_asc" : "id_desc";
    if (key === "utility_reported") return dir === "asc" ? "utility_asc" : "utility_desc";
    return "recent_desc";
  }, [tableSort]);

  const reportSortOptions = useMemo(() => {
    const nextOptions = [
      { value: "recent_desc", label: "Most recently reported (desc)" },
      { value: "recent_asc", label: "Most recently reported (asc)" },
      { value: "reports_desc", label: "Most reports (desc)" },
      { value: "reports_asc", label: "Most reports (asc)" },
    ];
    if (hasStreetlightsInMyReportsSelection) {
      nextOptions.push(
        { value: "utility_desc", label: "Utility reported: true first" },
        { value: "utility_asc", label: "Utility reported: false first" },
      );
    }
    return nextOptions;
  }, [hasStreetlightsInMyReportsSelection]);

  const applySortPreset = useCallback((preset) => {
    const p = String(preset || "").trim().toLowerCase();
    if (p === "recent_asc") return setTableSort({ key: "submitted_at", dir: "asc" });
    if (p === "recent_desc") return setTableSort({ key: "submitted_at", dir: "desc" });
    if (p === "reports_asc") return setTableSort({ key: "report_count", dir: "asc" });
    if (p === "reports_desc") return setTableSort({ key: "report_count", dir: "desc" });
    if (p === "id_asc") return setTableSort({ key: "incident_id", dir: "asc" });
    if (p === "id_desc") return setTableSort({ key: "incident_id", dir: "desc" });
    if (p === "utility_asc") return setTableSort({ key: "utility_reported", dir: "asc" });
    if (p === "utility_desc") return setTableSort({ key: "utility_reported", dir: "desc" });
    setTableSort({ key: "submitted_at", dir: "desc" });
  }, []);

  const resolveDisplayedRowDomainKey = useCallback((row, fallback = activeDomain) => {
    const direct = normalizeDomainKeyOrSlug(row?.domainKey || row?.domain, { allowUnknown: true });
    if (direct) return direct;

    const detailRows = Array.isArray(row?.rows) ? row.rows : [];
    for (const detail of detailRows) {
      const explicit = normalizeDomainKeyOrSlug(
        detail?.domainKey || detail?.domain || detail?.report_domain,
        { allowUnknown: true }
      );
      if (explicit) return explicit;

      const inferred = reportDomainForRow(detail, reportKnownAssetIdSetsByDomain);
      if (inferred) return inferred;
    }

    const incidentId = String(row?.incident_id || "").trim();
    const prefixedDomain = prefixedIncidentDomainKeyShared(incidentId) || reportDomainFromLightId(incidentId);
    if (prefixedDomain && prefixedDomain !== "streetlights") return prefixedDomain;

    return normalizeDomainKeyOrSlug(fallback, { allowUnknown: true })
      || String(fallback || "streetlights").trim()
      || "streetlights";
  }, [activeDomain, reportKnownAssetIdSetsByDomain]);

  const openAdminSubmittedReportsModal = useCallback((row, domainOverride = "") => {
    if (!row) return;
    const domainKey = resolveDisplayedRowDomainKey(row, domainOverride || activeDomain);
    setSubmittedReportsModal({
      open: true,
      row,
      domainKey,
    });
  }, [activeDomain, resolveDisplayedRowDomainKey]);

  const resolveReportRowLocationContext = useCallback((row, domainKey) => {
    const incidentId = String(row?.incident_id || "").trim();
    const rawNotes = String(row?.rows?.[0]?.raw_notes || row?.rows?.[0]?.notes || "");
    const isStreetlights = domainKey === "streetlights";
    const streetlightUtility = isStreetlights ? getStreetlightUtilityForIncident(incidentId) : null;
    const sharedLocationContext = isStreetlights ? null : resolveIncidentDrivenLocationContextForRow(domainKey, row);
    const domainLabel = singularizeDomainLabel(
      enabledDomainOptions.find((option) => option.key === domainKey)?.label || humanizeLabel(domainKey),
      "Incident"
    );
    const displayId = isStreetlights
      ? (
        incidentDisplayValueForDomain(
          domainKey,
          incidentId,
          row?.coords,
          row?.incident_label,
          "",
          slIdByUuid
        ) || incidentId
      )
      : (sharedLocationContext?.displayId || incidentId);
    const nearestAddress = isStreetlights
      ? (
        String(streetlightUtility?.nearestAddress || "").trim()
        || String(row?.nearest_address || "").trim()
        || readAddressFromNote(rawNotes)
        || String(row?.location_label || row?.locationLabel || "").trim()
        || readLocationFromNote(rawNotes)
        || "Unavailable"
      )
      : (sharedLocationContext?.nearestAddress || "Unavailable");
    const nearestCrossStreet = isStreetlights
      ? (
        String(streetlightUtility?.nearestCrossStreet || "").trim()
        || String(row?.nearest_cross_street || "").trim()
        || readCrossStreetFromNote(rawNotes)
        || "Unavailable"
      )
      : (sharedLocationContext?.nearestCrossStreet || "Unavailable");
    const nearestLandmark = isStreetlights
      ? (
        String(streetlightUtility?.nearestLandmark || "").trim()
        || String(row?.nearest_landmark || "").trim()
        || readLandmarkFromNote(rawNotes)
        || "Unavailable"
      )
      : (sharedLocationContext?.nearestLandmark || "Unavailable");
    const coordinates = isStreetlights
      ? (
        Number.isFinite(Number(row?.coords?.lat)) && Number.isFinite(Number(row?.coords?.lng))
          ? `${Number(row.coords.lat).toFixed(5)}, ${Number(row.coords.lng).toFixed(5)}`
          : "Unavailable"
      )
      : (sharedLocationContext?.coordinatesText || "Unavailable");
    const fallbackLat = isStreetlights
      ? (Number.isFinite(Number(row?.coords?.lat)) ? Number(row.coords.lat) : NaN)
      : Number(sharedLocationContext?.fallbackLat);
    const fallbackLng = isStreetlights
      ? (Number.isFinite(Number(row?.coords?.lng)) ? Number(row.coords.lng) : NaN)
      : Number(sharedLocationContext?.fallbackLng);

    return {
      incidentId,
      domainLabel,
      displayId,
      nearestAddress,
      nearestCrossStreet,
      nearestLandmark,
      coordinates,
      fallbackLat,
      fallbackLng,
    };
  }, [
    enabledDomainOptions,
    getStreetlightUtilityForIncident,
    resolveIncidentDrivenLocationContextForRow,
    slIdByUuid,
  ]);

  const openIncidentLocationDetailsFromContext = useCallback(async ({
    domainKey: domainKeyRaw = "",
    incidentId: incidentIdRaw = "",
    domainLabel: domainLabelRaw = "",
    displayId: displayIdRaw = "",
    nearestAddress: nearestAddressRaw = "",
    nearestCrossStreet: nearestCrossStreetRaw = "",
    nearestLandmark: nearestLandmarkRaw = "",
    coordinates: coordinatesRaw = "",
    fallbackLat: fallbackLatRaw = Number.NaN,
    fallbackLng: fallbackLngRaw = Number.NaN,
    incidentLabelFallback = "",
    copyHint = "",
    showReportToUtility = false,
  } = {}) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      || String(domainKeyRaw || "").trim().toLowerCase();
    const incidentId = String(incidentIdRaw || "").trim();
    if (!domainKey || !incidentId) return;
    const domainLabel = singularizeDomainLabel(
      String(domainLabelRaw || resolveReportDomainLabel(domainKey, "Incident")).trim() || "Incident",
      "Incident"
    );
    const displayId = String(displayIdRaw || "").trim() || incidentId || String(incidentLabelFallback || "").trim();
    const nearestAddress = String(nearestAddressRaw || "").trim() || "Unavailable";
    const nearestCrossStreet = String(nearestCrossStreetRaw || "").trim() || "Unavailable";
    const nearestLandmark = String(nearestLandmarkRaw || "").trim() || "Unavailable";
    const coordinates = String(coordinatesRaw || "").trim() || "Unavailable";
    const fallbackLat = Number(fallbackLatRaw);
    const fallbackLng = Number(fallbackLngRaw);
    const incidentLocationKey = incidentLocationCacheKey(domainKey, incidentId)
      || `${domainKey}:${incidentId || String(incidentLabelFallback || "").trim()}`;
    const shouldLookupGeo =
      typeof getStreetlightUtilityDetails === "function"
      && Number.isFinite(fallbackLat)
      && Number.isFinite(fallbackLng)
      && (
        !isUsableAddressText(nearestAddress)
        || isPlaceholderLocationText(nearestCrossStreet)
        || isPlaceholderLocationText(nearestLandmark)
      );
    const modalTitle = `${domainLabel} ${displayId}`.trim();
    const buildLocationRows = (addressValue, crossStreetValue, landmarkValue) => ([
      { label: "Nearest address", value: addressValue },
      { label: "Closest cross street", value: crossStreetValue },
      { label: "Closest landmark", value: landmarkValue },
      { label: "Coordinates", value: coordinates },
    ]);

    setIncidentLocationModal({
      open: true,
      title: modalTitle,
      rows: buildLocationRows(nearestAddress, nearestCrossStreet, nearestLandmark),
      loading: shouldLookupGeo,
      incidentKey: incidentLocationKey,
      domainKey,
      copyHint: String(copyHint || "").trim() || (domainKey === "streetlights" ? "Tap or click any line below to copy." : ""),
      showReportToUtility: Boolean(showReportToUtility || domainKey === "streetlights"),
    });
    if (!shouldLookupGeo) return;

    try {
      const geo = await getStreetlightUtilityDetails(fallbackLat, fallbackLng, { mode: "full" });
      const resolvedAddress = String(geo?.nearestAddress || "").trim() || nearestAddress;
      const resolvedCrossStreet = String(geo?.nearestCrossStreet || "").trim() || nearestCrossStreet;
      const resolvedLandmark = String(geo?.nearestLandmark || "").trim() || nearestLandmark;
      const resolvedLocationLabel = String(geo?.locationLabel || "").trim() || resolvedAddress;

      await persistIncidentLocationEntry(domainKey, incidentId, {
        nearestAddress: resolvedAddress,
        nearestCrossStreet: resolvedCrossStreet,
        nearestIntersection: "",
        nearestLandmark: resolvedLandmark,
        locationLabel: resolvedLocationLabel,
      }, {
        lat: fallbackLat,
        lng: fallbackLng,
      });
      setIncidentLocationModal((prev) => {
        if (!prev?.open || String(prev?.incidentKey || "").trim() !== incidentLocationKey) return prev;
        return {
          ...prev,
          rows: buildLocationRows(resolvedAddress, resolvedCrossStreet, resolvedLandmark),
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
    getStreetlightUtilityDetails,
    persistIncidentLocationEntry,
    resolveReportDomainLabel,
  ]);

  const openIncidentLocationDetails = useCallback(async (row, domainOverride = "") => {
    if (!row) return;
    const domainKey = resolveDisplayedRowDomainKey(row, domainOverride || activeDomain);
    const {
      incidentId,
      domainLabel,
      displayId,
      nearestAddress,
      nearestCrossStreet,
      nearestLandmark,
      coordinates,
      fallbackLat,
      fallbackLng,
    } = resolveReportRowLocationContext(row, domainKey);

    await openIncidentLocationDetailsFromContext({
      domainKey,
      incidentId,
      domainLabel,
      displayId,
      nearestAddress,
      nearestCrossStreet,
      nearestLandmark,
      coordinates,
      fallbackLat,
      fallbackLng,
      incidentLabelFallback: String(row?.incident_label || row?.incident_id || "").trim(),
      copyHint: domainKey === "streetlights" ? "Tap or click any line below to copy." : "",
      showReportToUtility: domainKey === "streetlights",
    });
  }, [
    activeDomain,
    openIncidentLocationDetailsFromContext,
    resolveDisplayedRowDomainKey,
    resolveReportRowLocationContext,
  ]);

  const openSubmittedReportsForRow = useCallback(async (row) => {
    if (!usesPersonalMyReportsLayout || !row) return;
    const history = [];
    const domainKey = resolveDisplayedRowDomainKey(row, activeDomain);

    for (const detail of row.rows || []) {
      const issueLabel = resolveIssueLabel(detail, domainKey);
      history.push({
        kind: "report",
        ts: Date.parse(String(detail?.submitted_at || "")) || 0,
        label: issueLabel || REPORT_TYPES?.[String(detail?.report_type || "").trim()] || String(detail?.report_type || "").trim() || "Report",
        issueLabel,
        note: String(detail?.raw_notes || detail?.notes || ""),
        type: String(detail?.report_type || ""),
        report_number: detail?.report_number || null,
        reporter_user_id: detail?.reporter_user_id || null,
        reporter_name: detail?.reporter_name || null,
        reporter_phone: detail?.reporter_phone || null,
        reporter_email: detail?.reporter_email || null,
      });
    }

    for (const ev of row.reopen_events || []) {
      history.push({
        kind: "reopen",
        ts: Number(ev?.ts || 0),
        label: "Reported again",
        note: String(ev?.note || ""),
        actor_user_id: ev?.reporter_user_id || null,
        actor_name: ev?.reporter_name || null,
        actor_email: ev?.reporter_email || null,
        actor_phone: ev?.reporter_phone || null,
      });
    }

    if (row.fixed_event) {
      history.push({
        kind: "fix",
        ts: Number(row.fixed_event?.ts || 0),
        label: "Marked fixed",
        note: String(row.fixed_event?.note || ""),
        actor_user_id: row.fixed_event?.reporter_user_id || null,
        actor_name: row.fixed_event?.reporter_name || null,
        actor_email: row.fixed_event?.reporter_email || null,
        actor_phone: row.fixed_event?.reporter_phone || null,
      });
    }

    history.sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
    const {
      incidentId,
      nearestAddress,
      nearestCrossStreet,
      nearestLandmark,
      coordinates,
      fallbackLat,
      fallbackLng,
    } = resolveReportRowLocationContext(row, domainKey);
    const incidentAddress = String(nearestAddress || "").trim().replace(/^Unavailable$/i, "");
    const incidentCrossStreet = String(nearestCrossStreet || "").trim().replace(/^Unavailable$/i, "");
    const incidentLandmark = String(nearestLandmark || "").trim().replace(/^Unavailable$/i, "");
    const incidentCoordinates = String(coordinates || "").trim().replace(/^Unavailable$/i, "");
    const incidentModalKey = incidentLocationCacheKey(domainKey, incidentId)
      || `${domainKey}:${incidentId || String(row?.incident_label || row?.incident_id || "").trim()}`;
    const shouldLookupGeo =
      typeof getStreetlightUtilityDetails === "function" &&
      Number.isFinite(fallbackLat) &&
      Number.isFinite(fallbackLng) &&
      (!incidentAddress || !incidentCrossStreet || !incidentLandmark);
    const incidentModalTitle = incidentReportsTitleForDomain(
      domainKey,
      incidentId,
      Number.isFinite(fallbackLat) && Number.isFinite(fallbackLng) ? { lat: fallbackLat, lng: fallbackLng } : row?.coords,
      row?.incident_label,
      "",
      slIdByUuid
    );
    openAllReportsModal(
      incidentModalTitle || String(row.incident_label || row.incident_id || "Incident"),
      history,
      {
        incidentKey: incidentModalKey,
        domainKey,
        incidentLabel: "",
        sharedLocation: "",
        sharedAddress: incidentAddress,
        sharedCrossStreet: incidentCrossStreet,
        sharedLandmark: incidentLandmark,
        sharedCoordinates: incidentCoordinates,
        geoLoading: shouldLookupGeo,
        currentState: String(row?.current_state || "").trim(),
        lastChangedAt: String(row?.latest_activity_at || row?.latest_submitted_at || "").trim(),
        hideSubmittedBy: true,
        useSubmittedReportFormat: true,
      }
    );
    if (!shouldLookupGeo) return;
    try {
      const geo = await getStreetlightUtilityDetails(fallbackLat, fallbackLng, { mode: "full" });
      const resolvedAddress = String(geo?.nearestAddress || "").trim() || incidentAddress;
      const resolvedCrossStreet = String(geo?.nearestCrossStreet || "").trim() || incidentCrossStreet;
      const resolvedLandmark = String(geo?.nearestLandmark || "").trim() || incidentLandmark;
      await persistIncidentLocationEntry(domainKey, incidentId, {
        nearestAddress: resolvedAddress,
        nearestCrossStreet: resolvedCrossStreet,
        nearestIntersection: "",
        nearestLandmark: resolvedLandmark,
        locationLabel: resolvedAddress,
      }, {
        lat: fallbackLat,
        lng: fallbackLng,
      });
      setAllReportsModal((prev) => {
        if (!prev?.open || String(prev?.incidentKey || "").trim() !== incidentModalKey) return prev;
        return {
          ...prev,
          sharedAddress: resolvedAddress,
          sharedCrossStreet: resolvedCrossStreet,
          sharedLandmark: resolvedLandmark,
          geoLoading: false,
        };
      });
    } catch {
      setAllReportsModal((prev) => {
        if (!prev?.open || String(prev?.incidentKey || "").trim() !== incidentModalKey) return prev;
        return { ...prev, geoLoading: false };
      });
    }
  }, [activeDomain, getStreetlightUtilityDetails, openAllReportsModal, persistIncidentLocationEntry, resolveDisplayedRowDomainKey, resolveIssueLabel, resolveReportRowLocationContext, slIdByUuid, usesPersonalMyReportsLayout]);

  const adminIncidentDotForRow = useCallback((row) => {
    const incidentId = String(row?.incident_id || "").trim();
    if (!incidentId) return { color: "#9e9e9e", label: "Unknown incident" };
    const rowDomainKey = resolveDisplayedRowDomainKey(row, activeDomain);
    const repairSnapshot = getRepairSnapshotForIncident(incidentId, rowDomainKey);

    if (rowDomainKey === "streetlights") {
      const confidence = getStreetlightConfidence(incidentId);
      const stateText = String(confidence?.state || row?.current_state || "").trim().toLowerCase();
      if (stateText === "likely_resolved" || stateText === "archived") {
        return { color: "var(--sl-ui-brand-green)", label: "Fixed incident" };
      }
      if (stateText === "high_confidence_outage") {
        return {
          color: resolveHighConfidenceMarkerColorForDomainShared("streetlights", {
            runtimeDomainMeta: RUNTIME_DOMAIN_META,
            getIncidentDomainHelper,
          }),
          label: "High-confidence outage",
        };
      }
      return {
        color: defaultMarkerColorForDomainShared("streetlights", {
          runtimeDomainMeta: RUNTIME_DOMAIN_META,
          getIncidentDomainHelper,
        }),
        label: "Operational",
      };
    }

    if (typeof isSharedIncidentDomain === "function" && isSharedIncidentDomain(rowDomainKey)) {
      if (publicRepairLifecycleEnabled && (repairSnapshot?.archived || repairSnapshot?.likelyFixed)) {
        return { color: "var(--sl-ui-brand-green)", label: "Community likely fixed" };
      }
      if (!isOpenLifecycleState(row?.current_state || "")) {
        return { color: "var(--sl-ui-brand-green)", label: "Fixed incident" };
      }
      return {
        color: defaultMarkerColorForDomainShared(rowDomainKey, {
            runtimeDomainMeta: RUNTIME_DOMAIN_META,
            getIncidentDomainHelper,
        }),
        label: `${typeof resolveReportDomainLabel === "function" ? resolveReportDomainLabel(rowDomainKey, "Incident") : "Incident"} incident`,
      };
    }
    if (rowDomainKey === "power_outage") {
      return {
        color: defaultMarkerColorForDomainShared("power_outage", {
          runtimeDomainMeta: RUNTIME_DOMAIN_META,
          getIncidentDomainHelper,
        }),
        label: "Power outage incident",
      };
    }
    if (rowDomainKey === "water_main") {
      return {
        color: defaultMarkerColorForDomainShared("water_main", {
          runtimeDomainMeta: RUNTIME_DOMAIN_META,
          getIncidentDomainHelper,
        }),
        label: "Water main incident",
      };
    }
    return {
      color: defaultMarkerColorForDomainShared(rowDomainKey, {
        runtimeDomainMeta: RUNTIME_DOMAIN_META,
        getIncidentDomainHelper,
      }),
      label: "Incident",
    };
  }, [activeDomain, getIncidentDomainHelper, getStreetlightConfidence, getRepairSnapshotForIncident, isOpenLifecycleState, publicRepairLifecycleEnabled, resolveDisplayedRowDomainKey, isSharedIncidentDomain, resolveReportDomainLabel]);

  const adminMetrics = useMemo(() => {
    if (isAdmin) {
      const rows = Array.isArray(displayedAdminRows) ? displayedAdminRows : [];
      const totalIncidents = rows.length;
      const fixedIncidents = rows.filter((row) => !isOpenLifecycleState(row?.current_state || "")).length;
      const openIncidents = Math.max(0, totalIncidents - fixedIncidents);
      const totalReports = rows.reduce((sum, row) => sum + Number(row?.report_count || 0), 0);
      let avgTimeToFixSeconds = 0;
      let closeCount = 0;
      for (const row of rows) {
        const fixedMs = Date.parse(String(row?.fixed_at || "")) || 0;
        if (!fixedMs) continue;
        const detailRows = Array.isArray(row?.rows) ? row.rows : [];
        let firstSubmittedMs = 0;
        for (const detail of detailRows) {
          const submittedMs = Date.parse(String(detail?.submitted_at || "")) || 0;
          if (!submittedMs) continue;
          if (!firstSubmittedMs || submittedMs < firstSubmittedMs) firstSubmittedMs = submittedMs;
        }
        if (!firstSubmittedMs || fixedMs < firstSubmittedMs) continue;
        avgTimeToFixSeconds += Math.round((fixedMs - firstSubmittedMs) / 1000);
        closeCount += 1;
      }
      avgTimeToFixSeconds = closeCount > 0 ? Math.round(avgTimeToFixSeconds / closeCount) : 0;
      return {
        totalReports,
        totalIncidents,
        openIncidents,
        fixedIncidents,
        avgTimeToFixSeconds,
        topRecurring: [...rows]
          .sort((a, b) => Number(b?.report_count || 0) - Number(a?.report_count || 0))
          .slice(0, 5)
          .map((row) => ({
            domain: row?.domainKey || "",
            incident_id: row?.incident_id || "",
            report_count: Number(row?.report_count || 0),
          })),
      };
    }

    const summary = exportSummaryRows || [];
    const filteredDetails = filteredExportDetailRows || [];
    const allDetails = exportDetailRows || [];
    const totalReports = filteredDetails.length;

    const incidentLatestState = new Map();
    for (const r of allDetails) {
      const incidentId = String(r?.incident_id || "").trim();
      if (!incidentId) continue;
      const ts = Date.parse(String(r?.submitted_at || "")) || 0;
      const prev = incidentLatestState.get(incidentId);
      if (!prev || ts >= prev.ts) {
        incidentLatestState.set(incidentId, {
          ts,
          state: String(r?.current_state || "").trim().toLowerCase(),
        });
      }
    }
    const totalIncidents = incidentLatestState.size;
    let fixedIncidents = 0;
    for (const x of incidentLatestState.values()) {
      if (!isOpenLifecycleState(x?.state || "")) fixedIncidents += 1;
    }
    const openIncidents = Math.max(0, totalIncidents - fixedIncidents);

    // Search/filter average time-to-fix based on filtered rows grouped by incident.
    const byIncident = new Map();
    for (const r of filteredDetails) {
      const incidentId = String(r?.incident_id || "").trim();
      if (!incidentId) continue;
      const submittedMs = Date.parse(String(r?.submitted_at || "")) || 0;
      const fixedMs = Date.parse(String(r?.fixed_at || "")) || 0;
      const prev = byIncident.get(incidentId) || { firstSubmittedMs: 0, fixedMs: 0 };
      if (!prev.firstSubmittedMs || (submittedMs && submittedMs < prev.firstSubmittedMs)) prev.firstSubmittedMs = submittedMs;
      if (!prev.fixedMs || (fixedMs && fixedMs > prev.fixedMs)) prev.fixedMs = fixedMs;
      byIncident.set(incidentId, prev);
    }
    let avgTimeToFixSeconds = 0;
    let closeCount = 0;
    for (const x of byIncident.values()) {
      if (!x.firstSubmittedMs || !x.fixedMs || x.fixedMs < x.firstSubmittedMs) continue;
      avgTimeToFixSeconds += Math.round((x.fixedMs - x.firstSubmittedMs) / 1000);
      closeCount += 1;
    }
    avgTimeToFixSeconds = closeCount > 0 ? Math.round(avgTimeToFixSeconds / closeCount) : 0;

    const topRecurring = [...summary]
      .sort((a, b) => Number(b?.report_count || 0) - Number(a?.report_count || 0))
      .slice(0, 5);
    return {
      totalReports,
      totalIncidents,
      openIncidents,
      fixedIncidents,
      avgTimeToFixSeconds,
      topRecurring,
    };
  }, [
    isAdminMultiDomainAllReports,
    displayedAdminRows,
    exportSummaryRows,
    filteredExportDetailRows,
    exportDetailRows,
    isOpenLifecycleState,
  ]);
  const adminMetricSummaryItems = useMemo(() => ([
    { key: "incidents", label: "Incidents", value: adminMetrics.totalIncidents },
    { key: "open", label: "Open", value: adminMetrics.openIncidents },
    { key: "fixed", label: "Fixed", value: adminMetrics.fixedIncidents },
    { key: "reports", label: "Reports", value: adminMetrics.totalReports },
  ]), [
    adminMetrics.totalIncidents,
    adminMetrics.openIncidents,
    adminMetrics.fixedIncidents,
    adminMetrics.totalReports,
  ]);

  const exportDetailCsv = useCallback(async () => {
    const {
      buildExportMetadataShared,
      downloadCsvShared,
      logExportAuditShared,
      toCsvShared,
    } = await loadDeferredOpenReportsExportSupportModule();
    const cols = [
      "report_id",
      "report_number",
      "domain",
      "incident_id",
      "incident_public_id",
      "submitted_at",
      "fixed_at",
      "time_to_close_seconds",
      "current_state",
      "reporter_name",
      "reporter_email",
      "reporter_phone",
      "notes",
    ];
    const csv = toCsvShared(filteredExportDetailRows, cols, buildExportMetadataShared({
      exportSchemaVersion: EXPORT_SCHEMA_VERSION,
      parseLocalDateStart,
      parseLocalDateEndExclusive,
      exportFromDate,
      exportToDate,
      activeDomain,
      adminMetrics,
    }));
    downloadCsvShared(`reports_detail_${activeDomain}_${Date.now()}.csv`, csv);
    void logExportAuditShared({
      supabase,
      isAdmin,
      exportKind: "detail",
      activeDomain,
      exportFromDate,
      exportToDate,
      searchQuery,
      sortMode,
      statusFilter,
      rowCount: filteredExportDetailRows.length,
    });
  }, [
    filteredExportDetailRows,
    parseLocalDateStart,
    parseLocalDateEndExclusive,
    exportFromDate,
    exportToDate,
    activeDomain,
    adminMetrics,
    isAdmin,
    searchQuery,
    sortMode,
    statusFilter,
  ]);

  const exportSummaryCsv = useCallback(async () => {
    const {
      buildExportMetadataShared,
      downloadCsvShared,
      logExportAuditShared,
      toCsvShared,
    } = await loadDeferredOpenReportsExportSupportModule();
    const cols = [
      "domain",
      "incident_id",
      "incident_public_id",
      "first_reported_at",
      "latest_reported_at",
      "fixed_at",
      "time_to_close_seconds",
      "current_state",
      "report_count",
    ];
    const csv = toCsvShared(exportSummaryRows, cols, buildExportMetadataShared({
      exportSchemaVersion: EXPORT_SCHEMA_VERSION,
      parseLocalDateStart,
      parseLocalDateEndExclusive,
      exportFromDate,
      exportToDate,
      activeDomain,
      adminMetrics,
    }));
    downloadCsvShared(`reports_summary_${activeDomain}_${Date.now()}.csv`, csv);
    void logExportAuditShared({
      supabase,
      isAdmin,
      exportKind: "summary",
      activeDomain,
      exportFromDate,
      exportToDate,
      searchQuery,
      sortMode,
      statusFilter,
      rowCount: exportSummaryRows.length,
    });
  }, [
    exportSummaryRows,
    parseLocalDateStart,
    parseLocalDateEndExclusive,
    exportFromDate,
    exportToDate,
    activeDomain,
    adminMetrics,
    isAdmin,
    searchQuery,
    sortMode,
    statusFilter,
  ]);

  if (!open) return null;
  const openReportsModalMaxHeight =
    "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px)";
  const hasReportsPageInsets = Boolean(String(pageTopInset || "").trim() || String(pageBottomInset || "").trim());
  const useFullPageReportsLayout = useCompactAppBehavior && hasReportsPageInsets;
  const isWideReportsPage = useFullPageReportsLayout && (typeof window !== "undefined" ? window.innerWidth >= 900 : false);
  const reportsPageTopInset = String(pageTopInset || "").trim() || "0px";
  const reportsPageBottomInset = String(pageBottomInset || "").trim() || "0px";
  const compactDomainMenuMaxHeight = !useFullPageReportsLayout
    ? "min(320px, calc(100dvh - 180px))"
    : `calc(100dvh - (${reportsPageTopInset}) - (${reportsPageBottomInset}) - 132px)`;
  const titleModeSelector = isAdmin && canToggleReportedBy ? (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        minWidth: 0,
        maxWidth: "100%",
        borderBottom: "1px solid currentColor",
        paddingBottom: 1,
      }}
    >
      <select
        value={normalizedReportedByMode}
        onChange={(e) => onReportedByModeChange?.(String(e.target.value || "me"))}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          border: "none",
          background: "transparent",
          color: "var(--sl-ui-text)",
          fontSize: isWideReportsPage ? 30 : 24,
          fontWeight: 900,
          lineHeight: 1.05,
          padding: "0 16px 0 0",
          margin: 0,
          cursor: "pointer",
          outline: "none",
          boxShadow: "none",
          whiteSpace: "nowrap",
          maxWidth: "100%",
        }}
        aria-label="Report view"
        title="Report view"
      >
        <option value="me">My Reports</option>
        <option value="all">All Reports</option>
      </select>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 1,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          fontSize: isWideReportsPage ? 17 : 15,
          fontWeight: 900,
          lineHeight: 1,
          opacity: 0.82,
        }}
      >
        ▾
      </span>
    </div>
  ) : null;
  const compactAdminFiltersPanel = compactFiltersOpen ? (
    <div
      style={{
        marginTop: 6,
        border: "1px solid var(--sl-ui-modal-border)",
        borderRadius: 10,
        padding: 8,
        display: "grid",
        gap: 8,
        background: "var(--sl-ui-modal-subtle-bg)",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "40px minmax(0, 1fr)",
          gap: 8,
          alignItems: "start",
        }}
      >
        <button
          type="button"
          onClick={resetCompactFilters}
          style={{
            width: 36,
            minWidth: 36,
            height: 36,
            borderRadius: 8,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            lineHeight: 1,
            alignSelf: "end",
          }}
          aria-label="Reset filters"
          title="Reset filters"
        >
          ↺
        </button>
        <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85, minWidth: 0 }}>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(String(e.target.value || "open"))}
            style={{
              marginTop: 4,
              width: "100%",
              minHeight: 40,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--sl-ui-modal-input-border)",
              background: "var(--sl-ui-modal-input-bg)",
              color: "var(--sl-ui-text)",
              fontWeight: 800,
            }}
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearchQuery();
            }}
            placeholder={reportSearchPlaceholder}
            style={{
              width: "100%",
              padding: "9px 30px 9px 10px",
              borderRadius: 10,
              border: "1px solid var(--sl-ui-modal-input-border)",
              background: "var(--sl-ui-modal-input-bg)",
              color: "var(--sl-ui-text)",
              fontSize: 12.5,
            }}
          />
          {showSearchClearButton ? (
            <button
              type="button"
              onClick={clearSearchField}
              style={{
                position: "absolute",
                right: 7,
                top: "50%",
                transform: "translateY(-50%)",
                width: 18,
                height: 18,
                borderRadius: 999,
                border: "none",
                background: "transparent",
                color: "var(--sl-ui-text)",
                opacity: 0.55,
                fontSize: 15,
                lineHeight: 1,
                cursor: "pointer",
                padding: 0,
              }}
              aria-label={inViewOnlyActive ? "Clear search and in-view filter" : "Clear search"}
              title={inViewOnlyActive ? "Clear search and in-view filter" : "Clear search"}
            >
              ×
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => applySearchQuery()}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Apply
        </button>
      </div>
      <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
        Date range
        <button
          type="button"
          onClick={openDatePicker}
          style={{
            marginTop: 4,
            width: "100%",
            minHeight: 40,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--sl-ui-modal-input-border)",
            background: "var(--sl-ui-modal-input-bg)",
            color: "var(--sl-ui-text)",
            fontWeight: 800,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          {dateRangeLabel(exportFromDate, exportToDate)} <span style={{ opacity: 0.75 }}>▾</span>
        </button>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8 }}>
        <button
          type="button"
          onClick={exportSummaryCsv}
          style={{
            padding: "7px 10px",
            borderRadius: 9,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
            minWidth: 0,
          }}
        >
          Export summary CSV
        </button>
        <button
          type="button"
          onClick={exportDetailCsv}
          style={{
            padding: "7px 10px",
            borderRadius: 9,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
            minWidth: 0,
          }}
        >
          Export detail CSV
        </button>
      </div>
    </div>
  ) : null;

  return (
    <Fragment>
      <ModalShell
      open={open}
      zIndex={10004}
      fullScreen={useFullPageReportsLayout}
      overlayStyle={
        useFullPageReportsLayout
          ? {
            background: "transparent",
            pointerEvents: "none",
          }
          : null
      }
      panelStyle={
        useFullPageReportsLayout
          ? {
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            height: `calc(100dvh - (${reportsPageTopInset}) - (${reportsPageBottomInset}))`,
            maxHeight: `calc(100dvh - (${reportsPageTopInset}) - (${reportsPageBottomInset}))`,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            gap: 0,
            marginTop: reportsPageTopInset,
            marginBottom: 0,
            padding: isWideReportsPage ? "18px 20px 0" : "10px 12px 0",
            borderTop: "none",
            borderBottom: "none",
          }
          : {
            width: "min(980px, calc(100vw - 32px))",
            maxWidth: "980px",
            minWidth: "min(680px, calc(100vw - 32px))",
            height: openReportsModalMaxHeight,
            maxHeight: openReportsModalMaxHeight,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }
      }
    >
      {isCompactMyReports ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div
              style={{
                width: isWideReportsPage ? 54 : 46,
                height: isWideReportsPage ? 54 : 46,
                borderRadius: isWideReportsPage ? 18 : 16,
                background: "var(--sl-ui-feed-card-bg)",
                border: "1px solid var(--sl-ui-feed-card-border)",
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
              }}
            >
              <AppIcon src={UI_ICON_SRC.openReports} iconKey="openReports" darkMode={darkMode} size={isWideReportsPage ? 30 : 26} />
            </div>
            {titleModeSelector || (
              <div style={{ fontSize: isWideReportsPage ? 30 : 24, fontWeight: 900, lineHeight: 1.05, whiteSpace: "nowrap" }}>
                {modalTitleText || "Reports"}
              </div>
            )}
            {!(isAdmin && compactDomainPicker) ? (
              <div style={{ position: "relative", zIndex: compactDomainMenuOpen ? 40 : "auto" }}>
                <button
                  type="button"
                  onClick={() => {
                    setCompactDomainMenuOpen((p) => {
                      const next = !p;
                      if (next) setCompactFiltersOpen(false);
                      return next;
                    });
                  }}
                  style={{
                    width: 48,
                    minWidth: 48,
                    height: 48,
                    borderRadius: 13,
                    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: "var(--sl-ui-modal-btn-secondary-bg)",
                    color: "var(--sl-ui-modal-btn-secondary-text)",
                    fontWeight: 900,
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                  aria-label="Report domain"
                  title={`Report domain: ${isMultiDomainMyReports ? selectedDomainLabel : (selectedDomainMeta?.label || activeDomain)}`}
                >
                  <AppIcon
                    src={UI_ICON_SRC.incidentReportingLayer}
                    iconKey="incidentReportingLayer"
                    darkMode={darkMode}
                    active={compactDomainMenuOpen}
                    size={28}
                  />
                </button>
                {compactDomainMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: "min(190px, calc(100vw - 56px))",
                      maxHeight: compactDomainMenuMaxHeight,
                      overflowY: "auto",
                      overscrollBehavior: "contain",
                      background: "var(--sl-ui-modal-bg)",
                      border: "1px solid var(--sl-ui-modal-border)",
                      borderRadius: 10,
                      boxShadow: "var(--sl-ui-modal-shadow)",
                      padding: 6,
                      display: "grid",
                      gap: 6,
                      zIndex: 40,
                    }}
                  >
                    {isMultiDomainMyReports && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectAllDomains?.();
                        }}
                        style={{
                          borderRadius: 9,
                          border: !hasExplicitDomainSelection
                            ? "1px solid var(--sl-ui-brand-green-border)"
                            : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                          background: !hasExplicitDomainSelection
                            ? "var(--sl-ui-brand-green)"
                            : "var(--sl-ui-modal-btn-secondary-bg)",
                          color: !hasExplicitDomainSelection ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                          fontWeight: 900,
                          cursor: "pointer",
                          padding: "7px 9px",
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          justifyContent: "flex-start",
                          width: "100%",
                          minWidth: 0,
                          textAlign: "left",
                        }}
                        aria-label="All domains"
                        title="All domains"
                      >
                        <AppIcon src={UI_ICON_SRC.allIncidentReports} iconKey="allIncidentReports" darkMode={darkMode} active={!hasExplicitDomainSelection} size={22} />
                        <span style={{ fontSize: 12, lineHeight: 1.2 }}>All</span>
                      </button>
                    )}
                    {enabledDomainOptions.map((d) => {
                      const selected = isMultiDomainMyReports ? activeDomainKeys.includes(d.key) : activeDomain === d.key;
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => {
                            if (isMultiDomainMyReports) onToggleDomain?.(d.key);
                            else {
                              onSelectDomain?.(d.key);
                              setCompactDomainMenuOpen(false);
                            }
                          }}
                          style={{
                            borderRadius: 9,
                            border: selected
                              ? "1px solid var(--sl-ui-brand-green-border)"
                              : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                            background: selected
                              ? "var(--sl-ui-brand-green)"
                              : "var(--sl-ui-modal-btn-secondary-bg)",
                            color: selected ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                            fontWeight: 900,
                            cursor: "pointer",
                            padding: "7px 9px",
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            justifyContent: "flex-start",
                            width: "100%",
                            minWidth: 0,
                            textAlign: "left",
                          }}
                          aria-label={d.label}
                          title={d.label}
                        >
                          <DomainAppIcon domainKey={d.key} src={d.iconSrc} size={26} />
                          <span style={{ fontSize: 12, lineHeight: 1.2, whiteSpace: "normal", overflowWrap: "anywhere" }}>{d.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          {!useFullPageReportsLayout ? (
            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: isWideReportsPage ? 54 : 46,
                height: isWideReportsPage ? 54 : 46,
                borderRadius: isWideReportsPage ? 18 : 16,
                background: "var(--sl-ui-feed-card-bg)",
                border: "1px solid var(--sl-ui-feed-card-border)",
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
              }}
            >
              <AppIcon src={UI_ICON_SRC.openReports} iconKey="openReports" darkMode={darkMode} size={isWideReportsPage ? 30 : 26} />
            </div>
            {titleModeSelector || (
              <div style={{ fontSize: isWideReportsPage ? 30 : 24, fontWeight: 900, lineHeight: 1.05 }}>
                {modalTitleText || "Reports"}
              </div>
            )}
          </div>
          {!useFullPageReportsLayout ? (
            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          ) : null}
        </div>
      )}

      {isAdmin && !isCompactMyReports && (
        <div
          style={{
            display: "grid",
            gap: 6,
            marginTop: 2,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {compactDomainPicker ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                position: "relative",
                zIndex: compactDomainMenuOpen ? 40 : "auto",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setCompactDomainMenuOpen((p) => {
                    const next = !p;
                    if (next) setCompactFiltersOpen(false);
                    return next;
                  });
                }}
                style={{
                  width: "100%",
                  minHeight: 40,
                  borderRadius: 10,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  padding: "7px 10px",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  cursor: "pointer",
                }}
                aria-label="Report domain"
                title={`Report domain: ${isMultiDomainMyReports ? selectedDomainLabel : (selectedDomainMeta?.label || activeDomain)}`}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <AppIcon
                    src={UI_ICON_SRC.incidentReportingLayer}
                    iconKey="incidentReportingLayer"
                    darkMode={darkMode}
                    active={compactDomainMenuOpen}
                    size={20}
                  />
                  <span>{isMultiDomainMyReports ? selectedDomainLabel : (selectedDomainMeta?.label || activeDomain)}</span>
                </span>
                  <span style={{ opacity: 0.85 }}>▾</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompactFiltersOpen((p) => !p);
                  setCompactDomainMenuOpen(false);
                  setCompactSortMenuOpen(false);
                }}
                style={{
                  width: 48,
                  minWidth: 48,
                  height: 40,
                  borderRadius: 10,
                  border: compactFiltersOpen
                    ? "1px solid var(--sl-ui-brand-green-border)"
                    : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: compactFiltersOpen
                    ? "var(--sl-ui-brand-green)"
                    : "var(--sl-ui-modal-btn-secondary-bg)",
                  color: compactFiltersOpen ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label="Search and filters"
                title="Search and filters"
              >
                <AppIcon src={UI_ICON_SRC.filter} iconKey="filter" darkMode={darkMode} active={compactFiltersOpen} size={24} />
              </button>
              {compactDomainMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                    maxHeight: compactDomainMenuMaxHeight,
                    overflowY: "auto",
                    overscrollBehavior: "contain",
                    background: "var(--sl-ui-modal-bg)",
                    border: "1px solid var(--sl-ui-modal-border)",
                    borderRadius: 10,
                    boxShadow: "var(--sl-ui-modal-shadow)",
                    padding: 6,
                    display: "grid",
                    gap: 6,
                    zIndex: 40,
                  }}
                >
                  {isMultiDomainMyReports && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAllDomains?.();
                      }}
                      style={{
                        borderRadius: 9,
                        border: !hasExplicitDomainSelection
                          ? "1px solid var(--sl-ui-brand-green-border)"
                          : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                        background: !hasExplicitDomainSelection
                          ? "var(--sl-ui-brand-green)"
                          : "var(--sl-ui-modal-btn-secondary-bg)",
                        color: !hasExplicitDomainSelection ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                        fontWeight: 900,
                        cursor: "pointer",
                        padding: "7px 9px",
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        justifyContent: "flex-start",
                        width: "100%",
                        minWidth: 0,
                        textAlign: "left",
                      }}
                      aria-label="All domains"
                      title="All domains"
                    >
                      <AppIcon src={UI_ICON_SRC.allIncidentReports} iconKey="allIncidentReports" darkMode={darkMode} active={!hasExplicitDomainSelection} size={22} />
                      <span style={{ fontSize: 12, lineHeight: 1.2 }}>All</span>
                    </button>
                  )}
                  {enabledDomainOptions.map((d) => {
                    const selected = isMultiDomainMyReports ? activeDomainKeys.includes(d.key) : activeDomain === d.key;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => {
                          if (isMultiDomainMyReports) onToggleDomain?.(d.key);
                          else {
                            onSelectDomain?.(d.key);
                            setCompactDomainMenuOpen(false);
                          }
                        }}
                        style={{
                          borderRadius: 9,
                          border: selected
                            ? "1px solid var(--sl-ui-brand-green-border)"
                            : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                          background: selected
                            ? "var(--sl-ui-brand-green)"
                            : "var(--sl-ui-modal-btn-secondary-bg)",
                          color: selected ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                          fontWeight: 900,
                          cursor: "pointer",
                          padding: "7px 9px",
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          justifyContent: "flex-start",
                          width: "100%",
                          minWidth: 0,
                          textAlign: "left",
                        }}
                        aria-label={d.label}
                        title={d.label}
                      >
                        <DomainAppIcon domainKey={d.key} src={d.iconSrc} size={26} />
                        <span style={{ fontSize: 12, lineHeight: 1.2, whiteSpace: "normal", overflowWrap: "anywhere" }}>{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {isMultiDomainMyReports ? (
                <button
                  type="button"
                  onClick={onSelectAllDomains}
                  style={{
                    borderRadius: 10,
                    border: !hasExplicitDomainSelection
                      ? "1px solid var(--sl-ui-brand-green-border)"
                      : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: !hasExplicitDomainSelection
                      ? "var(--sl-ui-brand-green)"
                      : "var(--sl-ui-modal-btn-secondary-bg)",
                    color: !hasExplicitDomainSelection ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                    fontWeight: 900,
                    cursor: "pointer",
                    padding: "8px 10px",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <AppIcon src={UI_ICON_SRC.allIncidentReports} iconKey="allIncidentReports" darkMode={darkMode} active={!hasExplicitDomainSelection} size={18} />
                  <span style={{ fontSize: 12.5 }}>All</span>
                </button>
              ) : null}
              {(domainOptions || []).map((d) => {
                const selected = isMultiDomainMyReports ? activeDomainKeys.includes(d.key) : activeDomain === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => {
                      if (!d.enabled) return;
                      if (isMultiDomainMyReports) onToggleDomain?.(d.key);
                      else onSelectDomain?.(d.key);
                    }}
                    disabled={!d.enabled}
                    style={{
                      borderRadius: 10,
                      border: selected
                        ? "1px solid var(--sl-ui-brand-green-border)"
                        : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: selected
                        ? "var(--sl-ui-brand-green)"
                        : "var(--sl-ui-modal-btn-secondary-bg)",
                      color: selected ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                      fontWeight: 900,
                      cursor: d.enabled ? "pointer" : "not-allowed",
                      opacity: d.enabled ? 1 : 0.55,
                      padding: "8px 10px",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    aria-label={d.label}
                    title={d.enabled ? d.label : `${d.label} (Soon)`}
                  >
                    <DomainAppIcon domainKey={d.key} src={d.iconSrc} size={32} />
                    <span style={{ fontSize: 12.5 }}>{d.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {compactDomainPicker && !isAdmin ? (
        <div style={{ marginTop: 6, position: "relative" }}>
          <button
            type="button"
            onClick={() => setCompactFiltersOpen((p) => !p)}
            style={{
              width: "100%",
              minHeight: 40,
              borderRadius: 10,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              padding: "8px 10px",
              fontSize: 12.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <span>Search & Filters</span>
            <span style={{ opacity: 0.85 }}>{compactFiltersOpen ? "▴" : "▾"}</span>
          </button>
          {compactFiltersOpen && (
            <div
              style={{
                marginTop: 6,
                border: "1px solid var(--sl-ui-modal-border)",
                borderRadius: 10,
                padding: 8,
                display: "grid",
                gap: 8,
                background: "var(--sl-ui-modal-subtle-bg)",
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applySearchQuery();
                    }}
                    placeholder={reportSearchPlaceholder}
                    style={{
                      width: "100%",
                      padding: "9px 30px 9px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--sl-ui-modal-input-border)",
                      background: "var(--sl-ui-modal-input-bg)",
                      color: "var(--sl-ui-text)",
                      fontSize: 12.5,
                    }}
                  />
                  {showSearchClearButton ? (
                    <button
                      type="button"
                      onClick={clearSearchField}
                      style={{
                        position: "absolute",
                        right: 7,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        border: "none",
                        background: "transparent",
                        color: "var(--sl-ui-text)",
                        opacity: 0.55,
                        fontSize: 15,
                        lineHeight: 1,
                        cursor: "pointer",
                        padding: 0,
                      }}
                      aria-label={inViewOnlyActive ? "Clear search and in-view filter" : "Clear search"}
                      title={inViewOnlyActive ? "Clear search and in-view filter" : "Clear search"}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => applySearchQuery()}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: "var(--sl-ui-modal-btn-secondary-bg)",
                    color: "var(--sl-ui-modal-btn-secondary-text)",
                    fontWeight: 900,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Apply
                </button>
              </div>
              {isAdmin && (
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                    Status
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(String(e.target.value || "open"))}
                      style={{
                        marginTop: 4,
                        width: "100%",
                        minHeight: 36,
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid var(--sl-ui-modal-input-border)",
                        background: "var(--sl-ui-modal-input-bg)",
                        color: "var(--sl-ui-text)",
                        fontWeight: 800,
                      }}
                    >
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                      <option value="all">All</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                    Date range
                    <button
                      type="button"
                      onClick={openDatePicker}
                      style={{
                        marginTop: 4,
                        width: "100%",
                        minHeight: 40,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid var(--sl-ui-modal-input-border)",
                        background: "var(--sl-ui-modal-input-bg)",
                        color: "var(--sl-ui-text)",
                        fontWeight: 800,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      {dateRangeLabel(exportFromDate, exportToDate)} <span style={{ opacity: 0.75 }}>▾</span>
                    </button>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      ) : compactDomainPicker && !(isAdmin && isCompactMyReports) ? (
        compactAdminFiltersPanel
      ) : !compactDomainPicker ? (
        <>
          <div style={{ marginTop: 6, minHeight: 42, display: "flex", gap: 8 }}>
            {isMultiDomainMyReports ? (
              <div style={{ position: "relative", zIndex: compactDomainMenuOpen ? 40 : "auto" }}>
                <button
                  type="button"
                  onClick={() => {
                    setCompactDomainMenuOpen((p) => {
                      const next = !p;
                      if (next) setCompactFiltersOpen(false);
                      return next;
                    });
                  }}
                  style={{
                    width: 42,
                    minWidth: 42,
                    height: 42,
                    borderRadius: 10,
                    border: compactDomainMenuOpen
                      ? "1px solid var(--sl-ui-tool-active-border)"
                      : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: compactDomainMenuOpen
                      ? "var(--sl-ui-tool-active-bg)"
                      : "var(--sl-ui-modal-btn-secondary-bg)",
                    color: compactDomainMenuOpen
                      ? "var(--sl-ui-tool-active-text)"
                      : "var(--sl-ui-modal-btn-secondary-text)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  aria-label="Incident filters"
                  title={
                    hasNoSelectedDomains
                      ? "Incident filters: none selected"
                      : hasExplicitDomainSelection
                        ? `Incident filters: ${selectedDomainLabel}`
                        : "Incident filters: all domains"
                  }
                >
                  <AppIcon
                    src={UI_ICON_SRC.incidentReportingLayer}
                    iconKey="incidentReportingLayer"
                    darkMode={darkMode}
                    active={compactDomainMenuOpen}
                    size={26}
                  />
                </button>
                {compactDomainMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      background: "var(--sl-ui-modal-bg)",
                      border: "1px solid var(--sl-ui-modal-border)",
                      borderRadius: 12,
                      boxShadow: "var(--sl-ui-modal-shadow)",
                      padding: 8,
                      display: "grid",
                      gap: 6,
                      zIndex: 40,
                      minWidth: 190,
                      maxHeight: compactDomainMenuMaxHeight,
                      overflowY: "auto",
                      overscrollBehavior: "contain",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAllDomains?.();
                      }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "22px minmax(0, 1fr)",
                        alignItems: "center",
                        columnGap: 8,
                        padding: "6px 9px",
                        borderRadius: 8,
                        border: !hasExplicitDomainSelection
                          ? "1px solid var(--sl-ui-tool-active-border)"
                          : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                        background: !hasExplicitDomainSelection
                          ? "var(--sl-ui-tool-active-bg)"
                          : "var(--sl-ui-surface-bg)",
                        color: !hasExplicitDomainSelection
                          ? "var(--sl-ui-tool-active-text)"
                          : "var(--sl-ui-text)",
                        fontWeight: !hasExplicitDomainSelection ? 900 : 700,
                        cursor: "pointer",
                        justifyContent: "flex-start",
                      }}
                    >
                      <span style={{ width: 22, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <AppIcon src={UI_ICON_SRC.allIncidentReports} iconKey="allIncidentReports" darkMode={darkMode} active={!hasExplicitDomainSelection} size={18} />
                      </span>
                      <span style={{ fontSize: 11.5, textAlign: "left" }}>All</span>
                    </button>
                    {enabledDomainOptions.map((d) => {
                      const selected = activeDomainKeys.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => onToggleDomain?.(d.key)}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "22px minmax(0, 1fr)",
                            alignItems: "center",
                            columnGap: 8,
                            padding: "6px 9px",
                            borderRadius: 8,
                            border: selected
                              ? "1px solid var(--sl-ui-tool-active-border)"
                              : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                            background: selected
                              ? "var(--sl-ui-tool-active-bg)"
                              : "var(--sl-ui-surface-bg)",
                            color: selected
                              ? "var(--sl-ui-tool-active-text)"
                              : "var(--sl-ui-text)",
                            fontWeight: selected ? 900 : 700,
                            cursor: "pointer",
                            justifyContent: "flex-start",
                          }}
                        >
                          <DomainSelectorListIcon
                            domainKey={d.key}
                            src={d.iconSrc || UI_ICON_SRC.incidentReportingLayer}
                            size={18}
                            containerSize={22}
                          />
                          <span style={{ fontSize: 11.5, textAlign: "left" }}>{d.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
            <div style={{ position: "relative", flex: 1 }}>
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearchQuery();
                }}
                placeholder={reportSearchPlaceholder}
                style={{
                  width: "100%",
                  padding: "9px 30px 9px 10px",
                  borderRadius: 10,
                  border: "1px solid var(--sl-ui-modal-input-border)",
                  background: "var(--sl-ui-modal-input-bg)",
                  color: "var(--sl-ui-text)",
                  fontSize: 12.5,
                }}
              />
              {showSearchClearButton ? (
                <button
                  type="button"
                  onClick={clearSearchField}
                  style={{
                    position: "absolute",
                    right: 7,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: "none",
                    background: "transparent",
                    color: "var(--sl-ui-text)",
                    opacity: 0.55,
                    fontSize: 15,
                    lineHeight: 1,
                    cursor: "pointer",
                    padding: 0,
                  }}
                  aria-label={inViewOnlyActive ? "Clear search and in-view filter" : "Clear search"}
                  title={inViewOnlyActive ? "Clear search and in-view filter" : "Clear search"}
                >
                  ×
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => applySearchQuery()}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Apply
            </button>
          </div>

          {isAdmin && (
            <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                Status{" "}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(String(e.target.value || "open"))}
                  style={{
                    marginLeft: 6,
                    minHeight: 34,
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid var(--sl-ui-modal-input-border)",
                    background: "var(--sl-ui-modal-input-bg)",
                    color: "var(--sl-ui-text)",
                    fontWeight: 800,
                  }}
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                Date range{" "}
                <button
                  type="button"
                  onClick={openDatePicker}
                  style={{
                    marginLeft: 6,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--sl-ui-modal-input-border)",
                    background: "var(--sl-ui-modal-input-bg)",
                    color: "var(--sl-ui-text)",
                    fontWeight: 800,
                    cursor: "pointer",
                    minWidth: 250,
                    textAlign: "left",
                  }}
                >
                  {dateRangeLabel(exportFromDate, exportToDate)} <span style={{ opacity: 0.75 }}>▾</span>
                </button>
              </label>
              <button
                type="button"
                onClick={exportSummaryCsv}
                style={{
                  padding: "7px 10px",
                  borderRadius: 9,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Export summary CSV
              </button>
              <button
                type="button"
                onClick={exportDetailCsv}
                style={{
                  padding: "7px 10px",
                  borderRadius: 9,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Export detail CSV
              </button>
            </div>
          )}
        </>
      ) : null}

      <Suspense fallback={null}>
        <LazyOpenReportsDatePickerModal
          open={datePickerOpen}
          onClose={cancelDatePicker}
          compactDomainPicker={compactDomainPicker}
          presetOptions={DATE_PRESET_OPTIONS}
          onApplyPreset={applyPresetToDraft}
          onShiftMonths={shiftCalendarMonths}
          rangeLabel={dateRangeLabel(draftRangeFrom || exportFromDate, draftRangeTo || exportToDate)}
          monthDate={calendarLeftMonth}
          cells={leftMonthCells}
          formatMonthLabel={formatMonthLabel}
          isDateInRange={isDateInDraftRange}
          draftRangeFrom={draftRangeFrom}
          draftRangeTo={draftRangeTo}
          onPickDate={pickCalendarDate}
          onApply={applyDatePicker}
        />
      </Suspense>

      {isAdmin && (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: compactDomainPicker ? 8 : 12,
            border: "1px solid var(--sl-ui-metrics-panel-border)",
            borderRadius: 10,
            padding: compactDomainPicker ? "8px 10px" : "9px 12px",
            boxShadow: "inset 0 0 0 1px var(--sl-ui-metrics-panel-border)",
            background: "var(--sl-ui-modal-subtle-bg)",
            fontSize: compactDomainPicker ? 11.25 : 11.75,
            lineHeight: 1.25,
          }}
        >
          {adminMetricSummaryItems.map((metric, index) => (
            <Fragment key={`metric-inline-${metric.key}`}>
              {index > 0 ? (
                <span style={{ opacity: 0.4, fontWeight: 700 }} aria-hidden="true">|</span>
              ) : null}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 4,
                  minWidth: 0,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontWeight: 900, opacity: 0.92 }}>{metric.label}</span>
                <span style={{ fontWeight: 800 }}>{metric.value}</span>
              </span>
            </Fragment>
          ))}
        </div>
      )}

      {isAdmin && compactDomainPicker && (
        <div style={{ marginTop: 6, width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minWidth: 0 }}>
            <div style={{ position: "relative", flex: "0 0 auto", zIndex: compactDomainMenuOpen ? 40 : "auto" }}>
              <button
                type="button"
                onClick={() => {
                  setCompactDomainMenuOpen((p) => {
                    const next = !p;
                    if (next) {
                      setCompactFiltersOpen(false);
                      setCompactSortMenuOpen(false);
                    }
                    return next;
                  });
                }}
                style={{
                  width: 48,
                  minWidth: 48,
                  height: 36,
                  borderRadius: 8,
                  border: compactDomainMenuOpen
                    ? "1px solid var(--sl-ui-brand-green-border)"
                    : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: compactDomainMenuOpen
                    ? "var(--sl-ui-brand-green)"
                    : "var(--sl-ui-modal-btn-secondary-bg)",
                  color: compactDomainMenuOpen ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label="Report domain"
                title={`Report domain: ${isMultiDomainMyReports ? selectedDomainLabel : (selectedDomainMeta?.label || activeDomain)}`}
              >
                <AppIcon
                  src={UI_ICON_SRC.incidentReportingLayer}
                  iconKey="incidentReportingLayer"
                  darkMode={darkMode}
                  active={compactDomainMenuOpen}
                  size={22}
                />
              </button>
              {compactDomainMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    background: "var(--sl-ui-modal-bg)",
                    border: "1px solid var(--sl-ui-modal-border)",
                    borderRadius: 10,
                    boxShadow: "var(--sl-ui-modal-shadow)",
                    padding: 6,
                    display: "grid",
                    gap: 6,
                    zIndex: 40,
                    minWidth: 190,
                    maxHeight: compactDomainMenuMaxHeight,
                    overflowY: "auto",
                    overscrollBehavior: "contain",
                  }}
                >
                  {isMultiDomainMyReports && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAllDomains?.();
                      }}
                      style={{
                        borderRadius: 9,
                        border: !hasExplicitDomainSelection
                          ? "1px solid var(--sl-ui-brand-green-border)"
                          : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                        background: !hasExplicitDomainSelection
                          ? "var(--sl-ui-brand-green)"
                          : "var(--sl-ui-modal-btn-secondary-bg)",
                        color: !hasExplicitDomainSelection ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                        fontWeight: 900,
                        cursor: "pointer",
                        padding: "7px 9px",
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        justifyContent: "flex-start",
                        width: "100%",
                        minWidth: 0,
                        textAlign: "left",
                      }}
                      aria-label="All domains"
                      title="All domains"
                    >
                      <AppIcon src={UI_ICON_SRC.allIncidentReports} iconKey="allIncidentReports" darkMode={darkMode} active={!hasExplicitDomainSelection} size={22} />
                      <span style={{ fontSize: 12, lineHeight: 1.2 }}>All</span>
                    </button>
                  )}
                  {enabledDomainOptions.map((d) => {
                    const selected = isMultiDomainMyReports ? activeDomainKeys.includes(d.key) : activeDomain === d.key;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => {
                          if (isMultiDomainMyReports) onToggleDomain?.(d.key);
                          else {
                            onSelectDomain?.(d.key);
                            setCompactDomainMenuOpen(false);
                          }
                        }}
                        style={{
                          borderRadius: 9,
                          border: selected
                            ? "1px solid var(--sl-ui-brand-green-border)"
                            : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                          background: selected
                            ? "var(--sl-ui-brand-green)"
                            : "var(--sl-ui-modal-btn-secondary-bg)",
                          color: selected ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                          fontWeight: 900,
                          cursor: "pointer",
                          padding: "7px 9px",
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          justifyContent: "flex-start",
                          width: "100%",
                          minWidth: 0,
                          textAlign: "left",
                        }}
                        aria-label={d.label}
                        title={d.label}
                      >
                        <DomainAppIcon domainKey={d.key} src={d.iconSrc} size={26} />
                        <span style={{ fontSize: 12, lineHeight: 1.2, whiteSpace: "normal", overflowWrap: "anywhere" }}>{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {isCompactMyReports ? (
              <button
                type="button"
                onClick={() => {
                  setCompactFiltersOpen((p) => !p);
                  setCompactDomainMenuOpen(false);
                  setCompactSortMenuOpen(false);
                }}
                style={{
                  width: 48,
                  minWidth: 48,
                  height: 36,
                  borderRadius: 8,
                  border: compactFiltersOpen
                    ? "1px solid var(--sl-ui-brand-green-border)"
                    : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: compactFiltersOpen
                    ? "var(--sl-ui-brand-green)"
                    : "var(--sl-ui-modal-btn-secondary-bg)",
                  color: compactFiltersOpen ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                  alignSelf: "flex-end",
                }}
                aria-label="Search and filters"
                title="Search and filters"
              >
                <AppIcon src={UI_ICON_SRC.filter} iconKey="filter" darkMode={darkMode} active={compactFiltersOpen} size={22} />
              </button>
            ) : null}
            <div
              ref={compactSortMenuRef}
              style={{ display: "grid", gap: 0, fontSize: 12, fontWeight: 800, flex: 1, minWidth: 0, position: "relative" }}
            >
              <button
                type="button"
                onClick={() => {
                  setCompactSortMenuOpen((prev) => !prev);
                  setCompactDomainMenuOpen(false);
                  setCompactFiltersOpen(false);
                }}
                style={{
                  width: "100%",
                  height: 36,
                  minHeight: 36,
                  padding: "0 10px",
                  borderRadius: 8,
                  border: "1px solid var(--sl-ui-modal-input-border)",
                  background: "var(--sl-ui-modal-input-bg)",
                  color: "var(--sl-ui-text)",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                aria-haspopup="menu"
                aria-expanded={compactSortMenuOpen ? "true" : "false"}
              >
                <span>Sort Reports</span>
                <span style={{ opacity: 0.75 }}>{compactSortMenuOpen ? "▴" : "▾"}</span>
              </button>
              {compactSortMenuOpen ? (
                <>
                  <button
                    type="button"
                    aria-label="Close sort menu"
                    onClick={() => setCompactSortMenuOpen(false)}
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 3,
                      border: "none",
                      padding: 0,
                      margin: 0,
                      background: "transparent",
                      cursor: "default",
                    }}
                  />
                  <div
                    role="menu"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      right: 0,
                      zIndex: 4,
                      borderRadius: 10,
                      border: "1px solid var(--sl-ui-modal-border)",
                      background: "var(--sl-ui-modal-bg)",
                      boxShadow: "var(--sl-ui-modal-shadow)",
                      padding: 6,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    {reportSortOptions.map((option) => {
                      const selected = sortPresetValue === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected ? "true" : "false"}
                          onClick={() => {
                            applySortPreset(option.value);
                            setCompactSortMenuOpen(false);
                          }}
                          style={{
                            width: "100%",
                            borderRadius: 8,
                            border: selected
                              ? "1px solid var(--sl-ui-brand-green-border)"
                              : "1px solid transparent",
                            background: selected
                              ? "color-mix(in srgb, var(--sl-ui-brand-green) 16%, var(--sl-ui-modal-bg))"
                              : "transparent",
                            color: "var(--sl-ui-text)",
                            fontWeight: selected ? 900 : 700,
                            cursor: "pointer",
                            padding: "8px 10px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            textAlign: "left",
                          }}
                        >
                          <span>{option.label}</span>
                          <span aria-hidden="true" style={{ minWidth: 14, textAlign: "right", opacity: selected ? 1 : 0.2 }}>
                            {selected ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {isAdmin && compactDomainPicker && isCompactMyReports ? compactAdminFiltersPanel : null}

      <div
        ref={listScrollRef}
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 6,
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
          alignContent: "start",
        }}
      >
        {isAdmin ? (
          <Suspense
            fallback={(
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                Loading reports...
              </div>
            )}
          >
            <LazyOpenReportsAdminListPanel
              activeDomain={activeDomain}
              adminIncidentDotForRow={adminIncidentDotForRow}
              canManageIncidentMutations={canManageIncidentMutations}
              canMutateIncidents={canMutateIncidents}
              canShowPublicRepairAction={canShowPublicRepairAction}
              clearUtilityReported={clearUtilityReported}
              compactDomainPicker={compactDomainPicker}
              darkMode={darkMode}
              displayedAdminRows={displayedAdminRows}
              enabledDomainOptions={enabledDomainOptions}
              formatTs={formatTs}
              getRepairSnapshotForIncident={getRepairSnapshotForIncident}
              getWorkingActionStateForIncident={getWorkingActionStateForIncident}
              hasStreetlightsInMyReportsSelection={hasStreetlightsInMyReportsSelection}
              humanizeLabel={humanizeLabel}
              incidentDisplayValueForDomain={incidentDisplayValueForDomain}
              incidentHeaderTitleForDomain={incidentHeaderTitleForDomain}
              incidentStateLabel={incidentStateLabel}
              isOpenLifecycleState={isOpenLifecycleState}
              onConfirmRepairIncident={onConfirmRepairIncident}
              onFlyTo={onFlyTo}
              onMarkWorkingIncident={onMarkWorkingIncident}
              onUpdateIncidentStatus={onUpdateIncidentStatus}
              openAdminSubmittedReportsModal={openAdminSubmittedReportsModal}
              openExternalUrl={openExternalUrl}
              openIncidentLocationDetails={openIncidentLocationDetails}
              openSubmittedReportsForRow={openSubmittedReportsForRow}
              openUtilityReportDialog={openUtilityReportDialog}
              resolveDisplayedRowDomainKey={resolveDisplayedRowDomainKey}
              singularizeDomainLabel={singularizeDomainLabel}
              slIdByUuid={slIdByUuid}
              displayLightId={displayLightId}
              showCommunityRepairDiagnostics={showCommunityRepairDiagnostics}
              streetlightUtilityReportUrl={STREETLIGHT_UTILITY_REPORT_URL}
              tableSort={tableSort}
              toggleTableSort={toggleTableSort}
              utilityReportedByIncident={utilityReportedByIncident}
              utilityReportReferenceByIncident={utilityReportReferenceByIncident}
              usesPersonalMyReportsLayout={usesPersonalMyReportsLayout}
            />
          </Suspense>
        ) : (
          <Suspense
            fallback={(
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                Loading reports...
              </div>
            )}
          >
            <LazyOpenReportsResidentListPanel
              activeDomain={activeDomain}
              adminIncidentLabelForDomain={adminIncidentLabelForDomain}
              canViewReporterDetails={canViewReporterDetails}
              displayLightId={displayLightId}
              domainOptions={domainOptions}
              expandedSet={expandedSet}
              formatTs={formatTs}
              getIncidentDomainHelper={getIncidentDomainHelper}
              getIncidentStateForDisplay={getIncidentStateForDisplay}
              getStreetlightConfidence={getStreetlightConfidence}
              handleOpenReporterDetails={handleOpenReporterDetails}
              incidentStateLabel={incidentStateLabel}
              isOpenLifecycleState={isOpenLifecycleState}
              matchedSearchRows={matchedSearchRows}
              officialLights={officialLights}
              onFlyTo={onFlyTo}
              onToggleExpand={handleToggleExpand}
              openExternalUrl={openExternalUrl}
              personalReportsSupportPending={personalReportsSupportPending}
              reportNumberForRow={reportNumberForRow}
              reporterSummaryForReportDetail={reporterSummaryForReportDetail}
              reports={reports}
              resolveItemDomainKey={resolveItemDomainKey}
              resolveIssueLabel={resolveIssueLabel}
              resolveReportTypeOptionDetails={resolveReportTypeOptionDetails}
              searchQuery={searchQuery}
              setRowRefForLightId={(lightId, el) => {
                if (el) rowRefMap.current.set(lightId, el);
                else rowRefMap.current.delete(lightId);
              }}
              slIdByUuid={slIdByUuid}
              streetlightUtilityReportUrl={STREETLIGHT_UTILITY_REPORT_URL}
              visibleGroups={visibleGroups}
            />
          </Suspense>
        )}
      </div>
      {!!copyToast && copyToast?.scope !== "incident_location_modal" && (
        <div
          style={{
            position: "fixed",
            top: copyToast?.y ?? 48,
            left: copyToast?.x ?? 18,
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
          {copyToast?.text || "Copied to clipboard"}
        </div>
      )}
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
          onCopyField={copyReportField}
          onClose={() => setAllReportsModal((prev) => ({ ...prev, open: false }))}
          isMobile={Boolean(useCompactAppBehavior)}
          preferCompactBehavior={Boolean(useCompactAppBehavior)}
          hideSubmittedBy={Boolean(allReportsModal?.hideSubmittedBy)}
          useSubmittedReportFormat={Boolean(allReportsModal?.useSubmittedReportFormat)}
          isWorkingReportType={isWorkingReportType}
          resolveReportIssueLabel={resolveReportIssueLabel}
          runtimeDomainMeta={RUNTIME_DOMAIN_META}
          reportNumberForRow={reportNumberForRow}
          reportTypes={REPORT_TYPES}
        />
      </Suspense>

      <Suspense fallback={null}>
        <LazyIncidentLocationModal
          open={Boolean(incidentLocationModal?.open)}
          title={incidentLocationModal?.title || "Incident Location"}
          rows={incidentLocationModal?.rows || []}
          loading={Boolean(incidentLocationModal?.loading)}
          copyHint={incidentLocationModal?.copyHint || ""}
          copyToast={copyToast}
          onCopyRow={(row, anchorEl) => {
            if (incidentLocationModal?.domainKey === "streetlights") {
              void copyStreetlightField(
                row?.label || "Location field",
                row?.value || "",
                anchorEl || null
              );
              return;
            }
            void copyReportField(row?.label || "Location field", row?.value || "", anchorEl || null);
          }}
          showReportToUtility={Boolean(incidentLocationModal?.showReportToUtility)}
          onReportToUtility={() => {
            void openExternalUrl(STREETLIGHT_UTILITY_REPORT_URL);
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
      <Suspense fallback={null}>
        <LazyOpenReportsSubmittedReportsModal
          open={Boolean(submittedReportsModal?.open)}
          row={submittedReportsRow}
          rowDomainKey={submittedReportsRowDomainKey}
          modalTitleLabel={submittedReportsTitleLabel}
          modalTitleValue={submittedReportsTitleValue}
          showCommunityRepairDiagnostics={showCommunityRepairDiagnostics}
          repairSnapshot={submittedReportsRepairSnapshot}
          onClose={() => setSubmittedReportsModal({ open: false, row: null, domainKey: "" })}
          onReporterDetails={handleOpenReporterDetails}
          resolveItemDomainKey={resolveItemDomainKey}
          resolveIssueLabel={resolveIssueLabel}
          resolveReportTypeOptionDetails={resolveReportTypeOptionDetails}
          reportNumberForRow={reportNumberForRow}
          canViewReporterDetails={canViewReporterDetails}
          reportTypes={REPORT_TYPES}
          streetlightUtilityExpandedSet={streetlightUtilityExpandedSet}
          streetlightUtilityLoadingByIncident={streetlightUtilityLoadingByIncident}
          getStreetlightUtilityForIncident={getStreetlightUtilityForIncident}
          getStreetlightUtilityRows={getStreetlightUtilityRows}
          toggleStreetlightUtilityExpanded={toggleStreetlightUtilityExpanded}
          copyStreetlightField={copyStreetlightField}
        />

        <LazyOpenReportsSavedStreetlightReportModal
          open={Boolean(savedStreetlightReportRow)}
          row={savedStreetlightReportRow}
          onClose={closeSavedStreetlightReport}
          darkMode={darkMode}
          getStreetlightUtilityForIncident={getStreetlightUtilityForIncident}
          getStreetlightUtilityRows={getStreetlightUtilityRows}
          utilityReportedByIncident={utilityReportedByIncident}
          utilityReportReferenceByIncident={utilityReportReferenceByIncident}
          openUtilityReportDialog={openUtilityReportDialog}
          clearUtilityReported={clearUtilityReported}
          slIdByUuid={slIdByUuid}
          resolveIssueLabel={resolveIssueLabel}
          activeDomain={activeDomain}
          reportTypes={REPORT_TYPES}
          copyStreetlightField={copyStreetlightField}
          openExternalUrl={openExternalUrl}
          streetlightUtilityReportUrl={STREETLIGHT_UTILITY_REPORT_URL}
        />

        <LazyOpenReportsUtilityReportDialogModal
          open={utilityReportDialogOpen}
          reference={utilityReportDialogReference}
          setReference={setUtilityReportDialogReference}
          onSave={saveUtilityReported}
          onCancel={() => {
            setUtilityReportDialogOpen(false);
            setUtilityReportDialogIncidentId("");
            setUtilityReportDialogReference("");
          }}
        />
      </Suspense>

      {!useFullPageReportsLayout ? (
        <div
          style={{
            marginTop: 6,
            display: "grid",
            gap: 8,
            gridTemplateColumns: hasStreetlightsInMyReportsSelection ? "1fr 1fr" : "1fr",
          }}
        >
          {hasStreetlightsInMyReportsSelection && (
            <button
              type="button"
              onClick={() => {
                void openExternalUrl(STREETLIGHT_UTILITY_REPORT_URL);
              }}
              style={{
                padding: 10,
                width: "100%",
                borderRadius: 10,
                border: "1px solid var(--sl-ui-brand-blue-border)",
                background: "var(--sl-ui-brand-blue)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Report Outage to Utility
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: 10,
              width: "100%",
              borderRadius: 10,
              border: "none",
              background: "#111",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      ) : null}
      </ModalShell>
      <Suspense fallback={null}>
        <LazyReporterDetailsModal
          open={reporterDetails.open}
          reportItem={reporterDetails.item}
          onClose={handleCloseReporterDetails}
        />
      </Suspense>
    </Fragment>
  );
}

export function OpenReportsModalController(props) {
  const {
    controllerMode = "generic",
    launchOptions = null,
    onInitialFocusApplied = null,
    inViewOnly = false,
  } = props;
  const [expandedSet, setExpandedSet] = useState(() => new Set());
  const [focusIncidentId, setFocusIncidentId] = useState("");
  const [initialSearchQuery, setInitialSearchQuery] = useState("");
  const [localInViewOnly, setLocalInViewOnly] = useState(false);
  const lastLaunchTokenRef = useRef("");
  const filterResetKey = useMemo(() => {
    const activeDomain = String(props.activeDomain || "").trim();
    const selectedDomains = Array.isArray(props.selectedDomains) ? props.selectedDomains.join("|") : "";
    return `${activeDomain}::${selectedDomains}`;
  }, [props.activeDomain, props.selectedDomains]);
  const lastFilterResetKeyRef = useRef(filterResetKey);

  const toggleExpand = useCallback((lightId) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(lightId)) next.delete(lightId);
      else next.add(lightId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (props.open) return;
    setExpandedSet(new Set());
    setFocusIncidentId("");
    setInitialSearchQuery("");
    setLocalInViewOnly(false);
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    const nextToken = String(launchOptions?.token || "").trim();
    if (!nextToken || nextToken === lastLaunchTokenRef.current) return;
    lastLaunchTokenRef.current = nextToken;
    setExpandedSet(() => {
      const focusId = String(launchOptions?.focusIncidentId || "").trim();
      return focusId ? new Set([focusId]) : new Set();
    });
    setFocusIncidentId(String(launchOptions?.focusIncidentId || "").trim());
    setInitialSearchQuery(controllerMode === "my" ? String(launchOptions?.focusQuery || "").trim() : "");
    setLocalInViewOnly(Boolean(launchOptions?.inViewOnly));
  }, [controllerMode, launchOptions, props.open]);

  useEffect(() => {
    if (!props.open) {
      lastFilterResetKeyRef.current = filterResetKey;
      return;
    }
    if (filterResetKey === lastFilterResetKeyRef.current) return;
    lastFilterResetKeyRef.current = filterResetKey;
    setExpandedSet(new Set());
  }, [filterResetKey, props.open]);

  const handleInitialFocusApplied = useCallback(() => {
    setFocusIncidentId("");
    setInitialSearchQuery("");
    if (typeof onInitialFocusApplied === "function") onInitialFocusApplied();
  }, [onInitialFocusApplied]);

  return (
    <OpenReportsModal
      {...props}
      expandedSet={expandedSet}
      onToggleExpand={toggleExpand}
      focusIncidentId={focusIncidentId}
      initialSearchQuery={initialSearchQuery}
      onInitialFocusApplied={handleInitialFocusApplied}
      inViewOnly={controllerMode === "my" ? localInViewOnly : Boolean(inViewOnly)}
    />
  );
}
