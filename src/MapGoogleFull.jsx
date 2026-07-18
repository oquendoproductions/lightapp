// ==================================================
// App.jsx — Full file
// ==================================================
import React, { Suspense, lazy, memo, startTransition, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CircleF, GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import "./MapGoogleFull.css";
import "./headerStandards.css";
import { readCrossTenantAuthBridgeStateHint } from "./lib/mapAuthBridgeHintSupport.js";
import { getSupabaseTenantKey, hasPersistedSupabaseSessionHint, supabase } from "./supabaseClient";
import { TenantContext } from "./tenant/contextObject";
import { getPlatformName, isNativeAppRuntime } from "./platform/runtime.js";
import { APP_VERSION } from "./appMeta";
import AppLaunchScreen from "./AppLaunchScreen.jsx";
import { resolvePublicHeaderDisplayName } from "./lib/headerDisplayName";
import { useHeaderOrganizationProfile } from "./lib/useHeaderOrganizationProfile";
import {
  MAP_UI_ICON_PUBLISHED_CONFIG_KEY,
  RUNTIME_UI_ICON_SRC as UI_ICON_SRC,
  isRuntimeUiIconEnabled,
  setResolvedRuntimeUiIconMetaState,
} from "./mapUiIconRuntimeCoreSupport.js";
import {
  MAP_UI_THEME_PUBLISHED_CONFIG_KEY,
  mergeMapUiNoticeConfig,
  mergeMapUiTheme,
  listMapUiThemeBoundaryTimestamps,
} from "./mapUiThemeRuntimeCoreSupport.js";
import { RUNTIME_DOMAIN_META } from "./lib/mapRuntimeDomainMeta";
import { buildDomainMarkerIconPresentationShared } from "./lib/mapDomainMarkerPresentationSupport";
import {
  DOMAIN_MARKER_GLYPHS,
  DOMAIN_MARKER_ICON_SRCS,
  POTHOLE_MERGE_RADIUS_METERS,
} from "./lib/mapIncidentDomainStartupConfig.js";
import {
  INCIDENT_DOMAIN_HELPERS,
  getIncidentDomainHelperShared as getIncidentDomainHelper,
  incidentDomainHelperKeysForConfiguredFieldShared as incidentDomainHelperKeysForConfiguredField,
} from "./lib/mapIncidentDomainConfig.js";
import {
  normalizeDomainIconRenderMode,
  normalizeDomainIconTintColor,
  normalizeDomainIconTintMode,
} from "./domainIconRendering";
import {
  defaultDomainType,
  isAssetBackedDomainType,
  isIncidentDrivenDomainType,
  resolveDomainType,
} from "./lib/domainCatalog";
import { domainDisclosureAckKey } from "./lib/mapIncidentDisclosureSupport";
import {
  isLifecycleStateOpen,
} from "./lib/incidentLifecycle";
import {
  defaultDomainHighConfidenceMinReports,
  defaultDomainPublicVisibilityMinReports,
  sanitizeIncidentReportThreshold,
} from "./lib/mapIncidentThresholdSupport";
import {
  hasRenderableMapRuntimeDataShared,
  isIncidentMapSnapshotReadyShared,
  isMapReadAccessReadyShared,
  shouldHydratePublicMapCoreCacheShared,
  shouldWaitForAuthenticatedMapAccessShared,
} from "./lib/mapStartupAccessSupport.js";
import {
  isExpectedPermissionErrorShared as isExpectedPermissionError,
  isMissingFunctionErrorShared as isMissingFunctionError,
} from "./lib/mapErrorClassifierSupport.js";
import {
  BUILT_IN_DOMAIN_DISPLAY_PREFIXES,
  DEFAULT_PUBLIC_DOMAINS,
  INCIDENT_REPORTING_LAYER_KEY,
  NO_REPORT_DOMAINS_KEY,
  REPORT_DOMAIN_OPTIONS,
  STREET_SIGN_TYPE_OPTIONS,
  STREET_SIGN_TYPE_VALUES,
  UUID_LIKE_RE,
  normalizeExplicitDomainSelection,
} from "./lib/mapDomainSelectionConfig.js";
import {
  defaultRoadRequiredForDomainShared as defaultRoadRequiredForDomain,
  resolveRuntimeDomainParkRequiredShared,
  resolveRuntimeDomainRoadRequiredShared,
} from "./lib/mapRuntimeDomainPlacementSupport.js";
import {
  activeTenantKey,
  boundaryViewportFromPolygons,
  normalizeDomainKey,
  normalizeDomainKeyOrSlug,
  normalizeEmail,
  normalizePhone,
  reportDomainForRow,
  reportDomainFromLightId,
  shortIncidentKey,
  tenantBoundaryConfigKey,
  viewportFromPoints,
} from "./lib/mapReportParsingCoreSupport.js";
import {
  INCIDENT_CLUSTER_MAX_ZOOM,
  INCIDENT_DOMAIN_ICON_SIZE,
  INCIDENT_STACK_LOCATION_DECIMALS,
  MAP_MARKER_CENTER,
  MAP_MARKER_GLYPH_SIZE,
  MAP_MARKER_SIZE,
  MAP_MARKER_STROKE,
} from "./lib/mapMarkerSharedConfig.js";
import {
  incidentDomainBuildLastFixByIncidentMap as incidentDomainBuildLastFixByIncidentMapShared,
  isOutageReportType,
  isWorkingReportType,
  normalizeReportQuality,
  reportIdentityKey,
  reporterIdentityKey,
} from "./lib/mapIncidentIdentityCoreSupport.js";
import {
  defaultMarkerColorForDomainShared,
  resolveHighConfidenceMarkerColorForDomainShared,
} from "./lib/mapDomainMarkerColorSupport.js";
import { prefixedIncidentDomainKeyShared } from "./lib/mapIncidentPrefixSupport.js";
import { REPORTING_MIN_ZOOM, STREETLIGHT_UTILITY_REPORT_URL, clamp } from "./lib/mapPopupSharedConfig.js";
import {
  incidentSnapshotKey,
  resolveIncidentRepairSnapshotShared,
} from "./lib/mapIncidentRepairSupport.js";
import {
  canonicalIncidentDrivenIncidentIdShared,
  hasIncidentIdPrefixShared,
  incidentSnapshotCandidateDomainsShared,
  incidentDomainResolveLookupValueByModeShared,
  normalizeIncidentDrivenLookupIdShared,
  readIncidentDomainConfiguredCollectionHelperStringShared,
  readIncidentDomainHelperBooleanShared,
  readIncidentDomainHelperStringShared,
  resolveIncidentDomainHelperEntryShared,
} from "./lib/mapIncidentDomainHelperCoreSupport.js";
import {
  dedupeIncidentMarkerRenderSourceShared,
  summarizeCanonicalIncidentMarkersInViewportShared,
} from "./lib/mapIncidentMarkerSourceSupport.js";
import { resolveReportDomainLabelShared } from "./lib/mapReportDisplaySupport.js";
import { createTenantScopedAuthedClient, createTenantScopedReadClient } from "./lib/tenantScopedSupabase";
import { focusMapMarkerSelectionShared } from "./lib/mapMarkerSelectionInteractionSupport.js";

const LazyAccountMenuPanel = lazy(() => import("./mapLazyAccountPanels.jsx").then((module) => ({ default: module.AccountMenuPanel })));
const LazyMobileHeaderMenuPanel = lazy(() => import("./mapLazyAccountFlows.jsx").then((module) => ({ default: module.MobileHeaderMenuPanel })));
const LazyAuthGateModal = lazy(() => import("./mapLazyAuthShell.jsx").then((module) => ({ default: module.AuthGateModal })));
const LazyTermsOfUseModal = lazy(() => import("./mapLazyAuthShell.jsx").then((module) => ({ default: module.TermsOfUseModal })));
const LazyPrivacyPolicyModal = lazy(() => import("./mapLazyAuthShell.jsx").then((module) => ({ default: module.PrivacyPolicyModal })));
const LazyForgotPasswordModal = lazy(() => import("./mapLazyAuthShell.jsx").then((module) => ({ default: module.ForgotPasswordModal })));
const LazyGuestInfoModal = lazy(() => import("./mapLazyAuthShell.jsx").then((module) => ({ default: module.GuestInfoModal })));
const LazyLocationPromptModal = lazy(() => import("./mapLazyAuthShell.jsx").then((module) => ({ default: module.LocationPromptModal })));
const LazyContactRequiredModal = lazy(() => import("./mapLazyAuthShell.jsx").then((module) => ({ default: module.ContactRequiredModal })));
const LazyCitySwitcherModal = lazy(() => import("./mapLazyAuthShell.jsx").then((module) => ({ default: module.CitySwitcherController })));
const LazyNoticeModal = lazy(() => import("./mapLazyAuthShell.jsx").then((module) => ({ default: module.NoticeModal })));
const loadMapReportFlowModule = () => import("./mapLazyReportFlow.jsx");
const loadReportSuccessModalModule = () => import("./mapLazyReportSuccessModal.jsx");
const loadStreetlightConfirmReportModalModule = () => import("./mapLazyStreetlightConfirmReportModal.jsx");
const LazyReportSuccessModal = lazy(() => loadReportSuccessModalModule());
const LazyDomainDisclosureGateModal = lazy(() => loadMapReportFlowModule().then((module) => ({ default: module.DomainDisclosureGateModal })));
const LazyConfirmReportModal = lazy(() => loadStreetlightConfirmReportModalModule());
const LazyDomainReportModal = lazy(() => loadMapReportFlowModule().then((module) => ({ default: module.DomainReportModal })));
const loadReportInspectorsModule = () => import("./mapLazyReportInspectors.jsx");
const LazyLocationDiagnosticsModal = lazy(() => loadReportInspectorsModule().then((module) => ({ default: module.LocationDiagnosticsModal })));
const loadDeferredIncidentSupportModule = () => import("./lib/mapDeferredIncidentSupport.js");
const loadDeferredIncidentAdminActionRuntimeModule = () => import("./lib/mapDeferredIncidentAdminActionRuntime.js");
const loadDeferredAdminMappingRuntimeModule = () => import("./lib/mapDeferredAdminMappingRuntime.js");
const loadDeferredMappingSupportModule = () => import("./lib/mapDeferredMappingSupport.js");
const loadDeferredGeoSupportModule = () => import("./lib/mapDeferredGeoSupport.js");
const loadDeferredTouchInteractionRuntimeModule = () => import("./lib/mapDeferredTouchInteractionRuntime.js");
const loadDeferredWakeLockRuntimeModule = () => import("./lib/mapDeferredWakeLockRuntime.js");
const loadDeferredMapInteractionRuntimeModule = () => import("./lib/mapDeferredMapInteractionRuntime.js");
const loadDeferredFollowCameraRuntimeModule = () => import("./lib/mapDeferredFollowCameraRuntime.js");
const loadDeferredMapFlyRuntimeModule = () => import("./lib/mapDeferredMapFlyRuntime.js");
const loadDeferredMapTapRuntimeModule = () => import("./lib/mapDeferredMapTapRuntime.js");
const loadDeferredAbuseSupportModule = () => import("./lib/mapDeferredAbuseSupport.js");
const loadDeferredIncidentLocationRuntimeModule = () => import("./lib/mapDeferredIncidentLocationRuntime.js");
const loadDeferredIncidentDomainRuntimeSupportModule = () => import("./lib/mapDeferredIncidentDomainRuntimeSupport.js");
const loadDeferredIncidentIdentityRuntimeModule = () => import("./lib/mapDeferredIncidentIdentityRuntime.js");
const loadIncidentLocationCacheSupportModule = () => import("./lib/mapIncidentLocationCacheSupport.js");
const loadDeferredReportSubmitSupportModule = () => import("./lib/mapDeferredReportSubmitSupport.js");
const loadDeferredIncidentDomainSubmitRuntimeModule = () => import("./lib/mapDeferredIncidentDomainSubmitRuntime.js");
const loadDeferredStreetlightSubmitRuntimeModule = () => import("./lib/mapDeferredStreetlightSubmitRuntime.js");
const loadDeferredConfiguredIncidentDataSupportModule = () => import("./lib/mapDeferredConfiguredIncidentDataSupport.js");
const loadDeferredConfiguredIncidentStateRuntimeModule = () => import("./lib/mapDeferredConfiguredIncidentStateRuntime.js");
const loadIncidentDeferredSupportModule = () => import("./lib/mapIncidentDeferredSupport.js");
const loadDeferredAccountRuntimeModule = () => import("./lib/mapDeferredAccountRuntime.js");
const loadDeferredPublicMapLoadSupportModule = () => import("./lib/mapDeferredPublicMapLoadSupport.js");
const loadDeferredPublicMapFollowupSupportModule = () => import("./lib/mapDeferredPublicMapFollowupSupport.js");
const loadDeferredPublicMapStreetlightStartupSupportModule = () => import("./lib/mapDeferredPublicMapStreetlightStartupSupport.js");
const loadDeferredIncidentRepairActionSupportModule = () => import("./lib/mapDeferredIncidentRepairActionSupport.js");
const loadDeferredTenantDomainConfigSupportModule = () => import("./lib/mapDeferredTenantDomainConfigSupport.js");
const loadDeferredTenantUiConfigSupportModule = () => import("./lib/mapDeferredTenantUiConfigSupport.js");
const loadDeferredRuntimeUiBundleSupportModule = () => import("./lib/mapDeferredRuntimeUiBundleSupport.js");
const loadDeferredTenantParkSupportModule = () => import("./lib/mapDeferredTenantParkSupport.js");
const loadReportFlowSelectionSupportModule = () => import("./lib/mapReportFlowSelectionSupport.js");
const loadDeferredReportFlowOpenSupportModule = () => import("./lib/mapDeferredReportFlowOpenSupport.js");
const loadRuntimeDomainReportConfigSupportModule = () => import("./lib/mapRuntimeDomainReportConfigSupport.js");
const loadReportParsingDeferredSupportModule = () => import("./lib/mapReportParsingDeferredSupport.js");
const loadIncidentReportTargetSupportModule = () => import("./lib/mapIncidentReportTargetSupport.js");
const loadAuthBootstrapControllerModule = () => import("./mapLazyAuthBootstrapController.jsx");
const loadPlatformExternalModule = () => import("./platform/external.js");
const loadStreetlightConfidenceModule = () => import("./streetlightConfidence");
const loadAccountWorkspaceModule = () => import("./mapLazyAccountWorkspaceBridge.jsx");
const loadAccountAccessControllerModule = () => import("./mapLazyAccountAccessController.jsx");
const loadTenantRuntimeControllerModule = () => import("./mapLazyTenantRuntimeController.jsx");
const loadAbuseSummaryControllerModule = () => import("./mapLazyAbuseSummaryController.jsx");
const loadRealtimeControllerModule = () => import("./mapLazyRealtimeControllerBridge.jsx");
const loadDesktopOverlayModule = () => import("./mapLazyDesktopOverlayBridge.jsx");
const loadDesktopAdminControlsModule = () => import("./mapLazyDesktopAdminControlsBridge.jsx");
const loadDesktopMapControlsModule = () => import("./mapLazyDesktopMapControlsBridge.jsx");
const loadIncidentRepairProgressControllerModule = () => import("./mapLazyIncidentRepairProgressController.jsx");
const loadMobileChromeModule = () => import("./mapLazyMobileChromeBridge.jsx");
const loadResidentFeedBadgeControllerModule = () => import("./mapLazyResidentFeedBadgeController.jsx");
const loadStreetlightPopupWorkspaceModule = () => import("./mapLazyStreetlightPopupWorkspace.jsx");
const loadIncidentDomainPopupWorkspaceModule = () => import("./mapLazyIncidentDomainPopupWorkspace.jsx");
const loadMapSelectionPopupsModule = () => import("./mapLazyMapSelectionPopups.jsx");
const loadMapLayersModule = () => import("./mapLazyMapLayers.jsx");
const loadOfficialLightsCanvasOverlayModule = () => import("./mapLazyOfficialLightsCanvasOverlay.jsx");
const loadWorkspaceHostModule = () => import("./mapLazyWorkspaceHostBridge.jsx");
const LazyIncidentTypePickerModal = lazy(() => import("./mapLazyIncidentTypePicker.jsx").then((module) => ({ default: module.IncidentTypePickerModal })));
const LazyInfoMenuModal = lazy(() => import("./mapLazyInfoPanels.jsx").then((module) => ({ default: module.InfoMenuModal })));
const loadOpenReportsModalModule = () => import("./mapLazyOpenReportsModal.jsx");
const loadDeferredSelectionPopupIncidentSupportModule = () => import("./lib/mapDeferredSelectionPopupIncidentSupport.js");
const LazyMapAuthBootstrapController = lazy(() => loadAuthBootstrapControllerModule());
const LazyMapAccountWorkspace = lazy(() => loadAccountWorkspaceModule());
const LazyMapAccountAccessController = lazy(() => loadAccountAccessControllerModule());
const LazyMapTenantRuntimeController = lazy(() => loadTenantRuntimeControllerModule());
const LazyMapAbuseSummaryController = lazy(() => loadAbuseSummaryControllerModule());
const LazyMapRealtimeController = lazy(() => loadRealtimeControllerModule());
const LazyMapDesktopOverlay = lazy(() => loadDesktopOverlayModule());
const LazyMapDesktopAdminControls = lazy(() => loadDesktopAdminControlsModule());
const LazyMapDesktopMapControls = lazy(() => loadDesktopMapControlsModule());
const LazyMapIncidentRepairProgressController = lazy(() => loadIncidentRepairProgressControllerModule());
const LazyMapMobileChrome = lazy(() => loadMobileChromeModule());
const LazyResidentFeedBadgeController = lazy(() => loadResidentFeedBadgeControllerModule());
const LazyBoundaryAndParksLayer = lazy(() => loadMapLayersModule().then((module) => ({ default: module.BoundaryAndParksLayer })));
const LazyIncidentDomainMarkersLayer = lazy(() => loadMapLayersModule().then((module) => ({ default: module.IncidentDomainMarkersLayer })));
const LazyOfficialLightsCanvasOverlay = lazy(() => loadOfficialLightsCanvasOverlayModule());
const LazyMapWorkspaceHost = lazy(() => loadWorkspaceHostModule());
const loadUserLocationOverlayModule = () => import("./lib/mapUserLocationOverlay.jsx");
const LazySmoothUserMarker = lazy(() => loadUserLocationOverlayModule().then((module) => ({ default: module.SmoothUserMarker })));
const loadCapacitorGeolocationModule = () => import("@capacitor/geolocation");
// Icon validation reference: "filter" now also lives in mapLazyOpenReportsModal.jsx.
// Icon validation reference: "utilityReportReference" now also lives in mapLazyMapSelectionPopups.jsx.
// Icon validation reference: "allLocations" now lives in mapLazyResidentFeeds.jsx.
// Icon validation reference: "info" now also lives in mapLazyCommunityFeedEditor.jsx.

// ✅ Google Maps API key
const GMAPS_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_KEY ||
  "";
const GMAPS_KEY_DEV = import.meta.env.VITE_GOOGLE_MAPS_API_KEY_DEV || "";
const GMAPS_KEY_NATIVE = import.meta.env.VITE_GOOGLE_MAPS_API_KEY_NATIVE || "";
const GMAPS_KEY_IOS = import.meta.env.VITE_GOOGLE_MAPS_API_KEY_IOS || "";
const GMAPS_KEY_ANDROID = import.meta.env.VITE_GOOGLE_MAPS_API_KEY_ANDROID || "";
const GMAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || "";
const GMAPS_LIBRARIES = [];

async function validateStrongPasswordDeferred(password) {
  const { validateStrongPassword } = await loadReportParsingDeferredSupportModule();
  return validateStrongPassword(password);
}

async function writeCachedTenantPublicMapCoreSnapshotDeferred(tenantKey, snapshot) {
  const [
    { writeCachedTenantPublicMapCoreSnapshotShared },
    configuredIncidentStateRuntimeHelpers,
  ] = await Promise.all([
    loadDeferredPublicMapLoadSupportModule(),
    loadDeferredConfiguredIncidentStateRuntimeModule().then((module) => (
      module.createDeferredConfiguredIncidentStateRuntimeHelpers({
        INCIDENT_DOMAIN_HELPERS,
        getIncidentDomainHelper,
        isValidLatLng,
        normalizeDomainKeyOrSlug,
        readIncidentDomainConfiguredCollectionHelperString,
        readIncidentDomainHelperString,
        resolveIncidentDomainHelperEntry,
      })
    )),
  ]);
  writeCachedTenantPublicMapCoreSnapshotShared(tenantKey, snapshot, {
    tenantPublicMapCoreCacheStorageKey,
    normalizeOfficialLightRow,
    normalizeCachedPublicMapReports,
    normalizeCachedStreetlightOutageTsByLightId,
    derivePublicMapReportRuntimeState,
    normalizeCachedIncidentStateByKey,
    normalizeCachedFixedLights,
    normalizeCachedConfiguredIncidentRowsByDomain:
      configuredIncidentStateRuntimeHelpers?.normalizeCachedConfiguredIncidentRowsByDomainShared,
    normalizeCachedPersistedIncidentRecordStateByDomain:
      configuredIncidentStateRuntimeHelpers?.normalizeCachedPersistedIncidentRecordStateByDomainShared,
    normalizeDomainKeyOrSlug,
    incidentDomainNormalizeConfiguredReportRecord:
      configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizeConfiguredReportRecord,
  });
}

async function loadPersistedIncidentRepairConfirmedKeysDeferred(tenantKey) {
  const { loadPersistedIncidentRepairConfirmedKeysShared } = await loadDeferredIncidentRepairActionSupportModule();
  return loadPersistedIncidentRepairConfirmedKeysShared(tenantKey);
}

async function savePersistedIncidentRepairConfirmedKeysDeferred(tenantKey, keys = []) {
  const { savePersistedIncidentRepairConfirmedKeysShared } = await loadDeferredIncidentRepairActionSupportModule();
  savePersistedIncidentRepairConfirmedKeysShared(tenantKey, keys);
}

const DEV_MAPS_HOST_SUFFIXES = [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.io", ".ngrok.app"];
const TENANT_BOUNDARY_DEBUG_STORAGE_KEY = "cityreport.debug.tenantBoundary";
const TENANT_BOUNDARY_DEBUG_QUERY_PARAM = "debugTenantBoundary";

function isPrivateIpv4Host(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return false;
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  const octets = host.split(".").map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  if (octets[0] === 10) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  return false;
}

function isTenantBoundaryDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search || "");
    const queryValue = String(params.get(TENANT_BOUNDARY_DEBUG_QUERY_PARAM) || "").trim().toLowerCase();
    if (queryValue === "1" || queryValue === "true" || queryValue === "yes") return true;
  } catch {
    // ignore query parsing issues
  }
  try {
    const stored = String(window.localStorage.getItem(TENANT_BOUNDARY_DEBUG_STORAGE_KEY) || "").trim().toLowerCase();
    return stored === "1" || stored === "true" || stored === "yes";
  } catch {
    return false;
  }
}

function isAppleTouchBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = String(navigator.userAgent || "");
  const platform = String(navigator.platform || "");
  const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

function summarizeTenantMapFeaturesRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    show_boundary_border: row.show_boundary_border !== false,
    shade_outside_boundary: row.shade_outside_boundary !== false,
    show_alert_icon: row.show_alert_icon !== false,
    show_event_icon: row.show_event_icon !== false,
    outside_shade_opacity: row.outside_shade_opacity,
    boundary_border_color: String(row.boundary_border_color || "").trim().toLowerCase() || "",
    boundary_border_width: row.boundary_border_width,
  };
}

function pushTenantBoundaryDiagnostic(event, payload, { forceWarn = false } = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event: String(event || "").trim() || "unknown",
    payload: payload && typeof payload === "object" ? payload : { value: payload },
  };
  if (typeof window !== "undefined") {
    try {
      const prev = Array.isArray(window.__CITYREPORT_TENANT_BOUNDARY_DEBUG__)
        ? window.__CITYREPORT_TENANT_BOUNDARY_DEBUG__
        : [];
      window.__CITYREPORT_TENANT_BOUNDARY_DEBUG__ = [...prev.slice(-49), entry];
    } catch {
      // ignore window instrumentation failures
    }
  }
  if (forceWarn || isTenantBoundaryDebugEnabled()) {
    console.warn("[tenant boundary debug]", entry);
  }
}

function defaultIconSrcForDomain(domainKey) {
  const key = String(domainKey || "").trim().toLowerCase();
  return (
    REPORT_DOMAIN_OPTIONS.find((option) => String(option?.key || "").trim().toLowerCase() === key)?.iconSrc
    || UI_ICON_SRC.incidentReportingLayer
  );
}

function resolveRuntimeDomainIconSrc(domainKey, iconSrc, iconKey) {
  const src = String(iconSrc || "").trim();
  if (/^(https?:|\/|data:)/i.test(src)) return src;
  const token = String(iconKey || src || "").trim().toLowerCase();
  if (token) {
    const builtIn = REPORT_DOMAIN_OPTIONS.find(
      (option) => String(option?.key || "").trim().toLowerCase() === token
    );
    if (builtIn?.iconSrc) return builtIn.iconSrc;
  }
  return defaultIconSrcForDomain(domainKey);
}

function isDevMapsHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") return true;
  if (host.endsWith(".local")) return true;
  if (isPrivateIpv4Host(host)) return true;
  return DEV_MAPS_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function currentRuntimeHost() {
  if (typeof window === "undefined") return "";
  return String(window.location.hostname || "").trim().toLowerCase();
}

const GMAPS_RUNTIME_HOST = currentRuntimeHost();
const GMAPS_PLATFORM = getPlatformName();
const GMAPS_NATIVE_ACTIVE_KEY =
  GMAPS_PLATFORM === "ios"
    ? (GMAPS_KEY_IOS || GMAPS_KEY_NATIVE)
    : GMAPS_PLATFORM === "android"
      ? (GMAPS_KEY_ANDROID || GMAPS_KEY_NATIVE)
      : GMAPS_KEY_NATIVE;
const GMAPS_ACTIVE_KEY =
  isNativeAppRuntime()
    ? (GMAPS_NATIVE_ACTIVE_KEY || GMAPS_KEY)
    : GMAPS_KEY_DEV && isDevMapsHost(GMAPS_RUNTIME_HOST)
      ? GMAPS_KEY_DEV
      : GMAPS_KEY;



// ==================================================
// SECTION 2 — App Settings
// ==================================================
const containerStyle = { height: "100%", width: "100%" };
const USA_OVERVIEW = [39.5, -98.35];
const INITIAL_OVERVIEW_ZOOM = 5;
const GROUP_RADIUS_METERS = 25;
const GROUP_BUCKET_DEGREES = GROUP_RADIUS_METERS / 111320;
const GROUP_BUCKET_LAT_RANGE = 2;
// All road-required domains, including potholes, use the same shared
// tolerance for "tap landed on the road" validation.
// Shared road-hit tolerance for every road-required incident domain.
// Keep this tight enough to reject yard/driveway taps near a street,
// while still accepting normal taps on the visible road surface.
const ROAD_VALIDATION_HIT_METERS = 5;
let GEO_TRACE_SEQUENCE = 0;
const INCIDENT_REPAIR_ARCHIVE_MS = 14 * 24 * 60 * 60 * 1000;

// 💡 OFFICIAL LIGHTS (admin-only mapping layer)
const OFFICIAL_LIGHTS_MIN_ZOOM = 13;
const LOCATE_ZOOM = 17;
const MAPPING_MIN_ZOOM = 17;
const TRAVEL_FOLLOW_LOOKAHEAD_METERS = 150;
const STREETLIGHT_STALENESS_ROLLOUT_START = new Date(2026, 2, 24, 0, 0, 0, 0).getTime();
const TITLE_LOGO_SRC = import.meta.env.VITE_TITLE_LOGO_SRC || "/Logos/cityreport_logo.svg";
const TITLE_LOGO_DARK_SRC =
  import.meta.env.VITE_TITLE_LOGO_DARK_SRC || "/Logos/cityreport_logo_dark_mode.svg";
const MOBILE_TITLE_LOGO_SRC =
  import.meta.env.VITE_MOBILE_TITLE_LOGO_SRC || "/Logos/cityreport_pin_logo.svg";
const MOBILE_TITLE_LOGO_DARK_SRC =
  import.meta.env.VITE_MOBILE_TITLE_LOGO_DARK_SRC || "/Logos/cityreport_pin_logo_dark_mode.svg";
const ENABLE_TENANT_VISIBILITY_CONFIG = true;
const ENABLE_LEGACY_PLACES_SERVICE =
  String(import.meta.env.VITE_ENABLE_LEGACY_PLACES_SERVICE || "").trim().toLowerCase() === "true";
const TITLE_LOGO_ALT = "CityReport.io";
let UI_NOTICE_META = mergeMapUiNoticeConfig({});
let UI_ICON_THEME_SOURCE = {};
let UI_ICON_THEME = mergeMapUiTheme({});
const cachedRuntimeUiIconManifest = (() => {
  if (typeof window === "undefined") return null;
  try {
    const raw = String(window.localStorage.getItem("cityreport.public_map_ui_bundle.v2") || "").trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
})();
const hasCachedRuntimeUiIconManifest = Boolean(cachedRuntimeUiIconManifest);
if (cachedRuntimeUiIconManifest) {
  setRuntimeUiIconManifest(
    cachedRuntimeUiIconManifest?.icon_bundle || cachedRuntimeUiIconManifest?.icons || cachedRuntimeUiIconManifest,
    cachedRuntimeUiIconManifest?.theme_bundle || cachedRuntimeUiIconManifest
  );
}

function setRuntimeUiIconManifest(rawIcons, rawTheme = {}) {
  UI_ICON_THEME_SOURCE = rawTheme && typeof rawTheme === "object" ? rawTheme : {};
  UI_NOTICE_META = mergeMapUiNoticeConfig(rawIcons);
  const resolvedIconMeta = rawIcons && typeof rawIcons === "object" && rawIcons.icons && typeof rawIcons.icons === "object"
    ? rawIcons.icons
    : rawIcons;
  setResolvedRuntimeUiIconMetaState(resolvedIconMeta);
  UI_ICON_THEME = mergeMapUiTheme(UI_ICON_THEME_SOURCE);
}

const ABUSE_RATE_KEY = "cityreport_abuse_rate_v1";
const ABUSE_GATE_FUNCTION = "rate-limit-gate";
const ABUSE_WINDOW_MS = 60 * 1000; // 1 minute
const ABUSE_MAX_EVENTS_PER_WINDOW = 7;
const ABUSE_MAX_LIGHTS_PER_WINDOW = 20;
const DOMAIN_SUBMIT_DEDUPE_WINDOW_MS = 60 * 1000;
const BULK_MAX_LIGHTS_PER_SUBMIT = 10;
const ABUSE_BACKOFF_KEY = "cityreport_abuse_backoff_v1";
const ABUSE_BACKOFF_MAX_MS = 15 * 60 * 1000;
const MAP_COMMUNITY_FEED_READ_KEY = "cityreport_map_community_feed_read_v2";
// v3 excludes snapshots that may contain account-specific report visibility.
const TENANT_PUBLIC_MAP_CORE_CACHE_KEY = "cityreport_public_map_core_v3";
const MAP_COMMUNITY_FEED_REMOTE_TABLE = "resident_community_feed_views";
const NATIVE_PUSH_REGISTERED_KEY = "cityreport_native_push_registered_v1";
const NATIVE_PUSH_DEFAULT_ENABLED = "false";
const EMPTY_MAP_COMMUNITY_FEED_READ_STATE = Object.freeze({
  alertsLastViewedAt: 0,
  eventsLastViewedAt: 0,
  alertsReadKeys: [],
  eventsReadKeys: [],
  alertsReadIds: [],
  eventsReadIds: [],
});
const DEFAULT_TENANT_MAP_FEATURES = {
  show_boundary_border: true,
  shade_outside_boundary: true,
  show_alert_icon: true,
  show_event_icon: true,
  outside_shade_opacity: 0.42,
  boundary_border_color: "#e53935",
  boundary_border_width: 4,
};
const TRANSPARENT_MARKER_DATA_URI = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const NATIVE_PUSH_ENABLED = String(
  import.meta.env.VITE_NATIVE_PUSH_ENABLED || NATIVE_PUSH_DEFAULT_ENABLED
).trim().toLowerCase() === "true";
const PUBLIC_APP_ONBOARDING_PENDING_AUTH_KEY = "cityreport.public_onboarding_pending_auth_v1";
const PUBLIC_ACCOUNT_DELETE_PENDING_AUTH_KEY = "cityreport.public_account_delete_pending_v1";

function hasAuthBootstrapUrlHint(searchValue = "", hashValue = "") {
  const search = String(searchValue || "");
  const hash = String(hashValue || "");
  const combined = `${search}${hash}`;
  return Boolean(
    /type=signup/i.test(combined)
    || /type=recovery/i.test(combined)
    || /(^|[?#&])code=/i.test(search)
    || /(^|[?#&])token_hash=/i.test(combined)
    || /(^|[?#&])access_token=/i.test(combined)
    || /(^|[?#&])refresh_token=/i.test(combined)
  );
}

// Location request prompt upon opening page
const LOC_PROMPTED_APP_KEY = "streetlight_loc_prompted_app_v1";
function isIncidentDrivenDomainKey(domainKey) {
  const key = String(domainKey || "").trim().toLowerCase();
  if (!key) return false;
  return isIncidentDrivenDomainType(key);
}

function isAssetBackedDomainKey(domainKey) {
  const key = String(domainKey || "").trim().toLowerCase();
  if (!key) return false;
  return isAssetBackedDomainType(key);
}

function isMissingRelationError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || msg.includes("relation") || msg.includes("does not exist");
}

function buildProfileFallbackFromSession(session) {
  if (!session?.user?.id) return null;
  const metadata = session?.user?.user_metadata || {};
  return {
    full_name:
      String(metadata?.full_name || metadata?.name || "").trim() || null,
    phone:
      String(metadata?.phone || metadata?.phone_number || "").trim() || null,
    email: String(session?.user?.email || "").trim() || null,
  };
}

function tenantPublicMapCoreCacheStorageKey(tenantKey) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  if (!normalizedTenantKey) return "";
  return `${TENANT_PUBLIC_MAP_CORE_CACHE_KEY}:${normalizedTenantKey}`;
}

function normalizeCachedPublicMapReports(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const lat = Number(row?.lat);
      const lng = Number(row?.lng);
      const ts = Number(row?.ts || 0);
      if (!isValidLatLng(lat, lng) || !Number.isFinite(ts)) return null;
      return {
        id: row?.id ?? null,
        lat,
        lng,
        type: String(row?.type || row?.report_type || "").trim(),
        report_domain: normalizeDomainKeyOrSlug(row?.report_domain, { allowUnknown: true }) || null,
        domain: normalizeDomainKeyOrSlug(row?.domain || row?.report_domain, { allowUnknown: true }) || null,
        report_quality: normalizeReportQuality(row?.report_quality),
        note: String(row?.note || "").trim(),
        ts,
        light_id: String(row?.light_id || "").trim() || null,
        report_number: String(row?.report_number || "").trim() || null,
        reporter_user_id: row?.reporter_user_id || null,
        reporter_name: row?.reporter_name || null,
        reporter_phone: row?.reporter_phone || null,
        reporter_email: row?.reporter_email || null,
      };
    })
    .filter(Boolean);
}

function appendGenericIncidentBaseMarkerRow(byIncident, domainKey, row) {
  if (!(byIncident instanceof Map)) return;
  const lat = Number(row?.lat);
  const lng = Number(row?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const incidentId = String(row?.incident_id || row?.light_id || lightIdFor(lat, lng) || "").trim();
  if (!incidentId) return;
  const existing = byIncident.get(incidentId);
  if (!existing) {
    byIncident.set(incidentId, {
      id: incidentId,
      incident_id: incidentId,
      domain: domainKey,
      lat,
      lng,
      count: 1,
      lastTs: Number(row?.ts || 0) || 0,
      rows: [row],
    });
    return;
  }
  existing.count += 1;
  const ts = Number(row?.ts || 0) || 0;
  if (ts > Number(existing.lastTs || 0)) {
    existing.lastTs = ts;
    existing.lat = lat;
    existing.lng = lng;
  }
  if (!Array.isArray(existing.rows)) existing.rows = [];
  existing.rows.push(row);
}

function finalizeGenericIncidentBaseMarkers(byIncident) {
  if (!(byIncident instanceof Map) || byIncident.size === 0) return [];
  return Array.from(byIncident.values()).sort((a, b) => (b.count - a.count) || (b.lastTs - a.lastTs));
}

function derivePublicMapReportRuntimeState(
  rows,
  officialLightIdSet = null,
  { assumeNormalized = false, assumeSorted = false } = {}
) {
  const normalizedRows = assumeNormalized
    ? (Array.isArray(rows) ? rows.filter(Boolean) : [])
    : normalizeCachedPublicMapReports(rows);
  const reports = assumeSorted
    ? normalizedRows
    : [...normalizedRows].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const allowedOfficialLightIds = officialLightIdSet instanceof Set ? officialLightIdSet : null;
  const streetlightOutageTsByLightId = {};
  const sharedIncidentReportRowsStateByDomain = {};
  const sharedIncidentBaseMarkerMapsByDomain = new Map();

  for (const row of reports) {
    const lightId = String(row?.light_id || "").trim();
    const ts = Number(row?.ts || 0);
    if (lightId && Number.isFinite(ts) && ts > 0 && (!allowedOfficialLightIds || allowedOfficialLightIds.has(lightId)) && isOutageReportType(row)) {
      if (!streetlightOutageTsByLightId[lightId]) streetlightOutageTsByLightId[lightId] = [];
      streetlightOutageTsByLightId[lightId].push(ts);
    }

    const domainKey = reportDomainForRow(row);
    if (!domainKey || domainKey === "streetlights") continue;
    if (isAssetBackedDomainType(domainKey, resolveRuntimeDomainTypeForMap(domainKey))) continue;
    if (!sharedIncidentReportRowsStateByDomain[domainKey]) sharedIncidentReportRowsStateByDomain[domainKey] = [];
    sharedIncidentReportRowsStateByDomain[domainKey].push(row);
    let byIncident = sharedIncidentBaseMarkerMapsByDomain.get(domainKey);
    if (!byIncident) {
      byIncident = new Map();
      sharedIncidentBaseMarkerMapsByDomain.set(domainKey, byIncident);
    }
    appendGenericIncidentBaseMarkerRow(byIncident, domainKey, row);
  }

  for (const values of Object.values(streetlightOutageTsByLightId)) {
    values.sort((a, b) => b - a);
  }

  const sharedIncidentBaseMarkersStateByDomain = {};
  for (const [domainKey, byIncident] of sharedIncidentBaseMarkerMapsByDomain.entries()) {
    const markers = finalizeGenericIncidentBaseMarkers(byIncident);
    if (markers.length) sharedIncidentBaseMarkersStateByDomain[domainKey] = markers;
  }

  return {
    reports,
    streetlightOutageTsByLightId,
    sharedIncidentReportRowsStateByDomain,
    sharedIncidentBaseMarkersStateByDomain,
  };
}

function buildGenericIncidentBaseMarkersForDomain(domainKeyRaw, rows) {
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
  if (!domainKey) return [];
  const byIncident = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    appendGenericIncidentBaseMarkerRow(byIncident, domainKey, row);
  }
  return finalizeGenericIncidentBaseMarkers(byIncident);
}

function buildSharedIncidentBaseMarkersStateByDomain(rowsByDomain) {
  const next = {};
  for (const [domainKeyRaw, rows] of Object.entries(rowsByDomain || {})) {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
    if (!domainKey || domainKey === "streetlights") continue;
    if (isAssetBackedDomainType(domainKey, resolveRuntimeDomainTypeForMap(domainKey))) continue;
    const markers = buildGenericIncidentBaseMarkersForDomain(domainKey, rows);
    if (markers.length) next[domainKey] = markers;
  }
  return next;
}

function mergeGenericIncidentBaseMarkers(baseMarkers = [], extraMarkers = []) {
  const next = new Map();
  const mergeMarker = (marker) => {
    const incidentId = String(marker?.incident_id || marker?.id || "").trim();
    if (!incidentId) return;
    const existing = next.get(incidentId);
    if (!existing) {
      next.set(incidentId, {
        ...marker,
        rows: Array.isArray(marker?.rows) ? [...marker.rows] : [],
      });
      return;
    }
    const currentLastTs = Number(existing?.lastTs || 0);
    const incomingLastTs = Number(marker?.lastTs || 0);
    next.set(incidentId, {
      ...existing,
      ...(incomingLastTs > currentLastTs
        ? {
            lat: Number(marker?.lat),
            lng: Number(marker?.lng),
            lastTs: incomingLastTs,
          }
        : {}),
      count: Number(existing?.count || 0) + Number(marker?.count || 0),
      rows: [...(Array.isArray(existing?.rows) ? existing.rows : []), ...(Array.isArray(marker?.rows) ? marker.rows : [])]
        .sort((a, b) => (Number(b?.ts || 0) - Number(a?.ts || 0))),
    });
  };
  for (const marker of Array.isArray(baseMarkers) ? baseMarkers : []) mergeMarker(marker);
  for (const marker of Array.isArray(extraMarkers) ? extraMarkers : []) mergeMarker(marker);
  return Array.from(next.values()).sort((a, b) => (Number(b?.count || 0) - Number(a?.count || 0)) || (Number(b?.lastTs || 0) - Number(a?.lastTs || 0)));
}

function normalizeCachedStreetlightOutageTsByLightId(value) {
  if (!value || typeof value !== "object") return {};
  const next = {};
  for (const [lightIdRaw, values] of Object.entries(value)) {
    const lightId = String(lightIdRaw || "").trim();
    if (!lightId || !Array.isArray(values)) continue;
    const normalizedValues = values
      .map((value) => Number(value || 0))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => b - a);
    if (!normalizedValues.length) continue;
    next[lightId] = normalizedValues;
  }
  return next;
}

function normalizeCachedIncidentStateByKey(value) {
  if (!value || typeof value !== "object") return {};
  const next = {};
  for (const [keyRaw, row] of Object.entries(value)) {
    const key = String(keyRaw || "").trim();
    if (!key || !row || typeof row !== "object") continue;
    const state = String(row?.state || "").trim();
    const lastChangedAt = row?.last_changed_at ? String(row.last_changed_at).trim() : null;
    if (!state && !lastChangedAt) continue;
    next[key] = {
      state,
      last_changed_at: lastChangedAt || null,
    };
  }
  return next;
}

function normalizeCachedFixedLights(value) {
  if (!value || typeof value !== "object") return {};
  const next = {};
  for (const [lightIdRaw, tsRaw] of Object.entries(value)) {
    const lightId = String(lightIdRaw || "").trim();
    const ts = Number(tsRaw || 0);
    if (!lightId || !Number.isFinite(ts) || ts <= 0) continue;
    next[lightId] = ts;
  }
  return next;
}

function normalizeCachedActionsByLightId(value) {
  if (!value || typeof value !== "object") return {};
  const next = {};
  for (const [lightIdRaw, rows] of Object.entries(value)) {
    const lightId = String(lightIdRaw || "").trim();
    if (!lightId || !Array.isArray(rows)) continue;
    const normalizedRows = rows
      .map((row) => {
        const ts = Number(row?.ts || 0);
        if (!Number.isFinite(ts) || ts <= 0) return null;
        return {
          action: String(row?.action || "").trim(),
          ts,
          note: row?.note ?? null,
          actor_user_id: row?.actor_user_id || null,
          actor_email: row?.actor_email || null,
          actor_phone: row?.actor_phone || null,
          actor_name: row?.actor_name || null,
          reporter_user_id: row?.reporter_user_id || null,
          reporter_name: row?.reporter_name || null,
          reporter_email: row?.reporter_email || null,
          reporter_phone: row?.reporter_phone || null,
        };
      })
      .filter(Boolean);
    if (!normalizedRows.length) continue;
    next[lightId] = normalizedRows;
  }
  return next;
}

function readCachedTenantPublicMapCoreSnapshot(tenantKey) {
  if (typeof window === "undefined") return null;
  const storageKey = tenantPublicMapCoreCacheStorageKey(tenantKey);
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const officialLights = Array.isArray(parsed.officialLights)
      ? parsed.officialLights.map((row) => normalizeOfficialLightRow(row)).filter(Boolean)
      : [];
    const officialLightIdSet = new Set(officialLights.map((row) => String(row?.id || "").trim()).filter(Boolean));
    const reportRuntimeState = derivePublicMapReportRuntimeState(parsed.reports, officialLightIdSet);
    const reports = reportRuntimeState.reports;
    const streetlightOutageTsByLightId = parsed.streetlightOutageTsByLightId && typeof parsed.streetlightOutageTsByLightId === "object"
      ? normalizeCachedStreetlightOutageTsByLightId(parsed.streetlightOutageTsByLightId)
      : reportRuntimeState.streetlightOutageTsByLightId;
    return {
      officialLights,
      reports,
      streetlightOutageTsByLightId,
      sharedIncidentReportRowsStateByDomain: reportRuntimeState.sharedIncidentReportRowsStateByDomain,
      sharedIncidentBaseMarkersStateByDomain: reportRuntimeState.sharedIncidentBaseMarkersStateByDomain,
      incidentStateByKey: normalizeCachedIncidentStateByKey(parsed.incidentStateByKey),
      fixedLights: normalizeCachedFixedLights(parsed.fixedLights),
      actionsByLightId: normalizeCachedActionsByLightId(parsed.actionsByLightId),
      configuredIncidentSeededRowsStateByDomain:
        parsed.configuredIncidentSeededRowsStateByDomain
        && typeof parsed.configuredIncidentSeededRowsStateByDomain === "object"
          ? parsed.configuredIncidentSeededRowsStateByDomain
          : {},
      configuredIncidentReportRowsStateByDomain:
        parsed.configuredIncidentReportRowsStateByDomain
        && typeof parsed.configuredIncidentReportRowsStateByDomain === "object"
          ? parsed.configuredIncidentReportRowsStateByDomain
          : {},
      persistedIncidentRecordStateByDomain:
        parsed.persistedIncidentRecordStateByDomain
        && typeof parsed.persistedIncidentRecordStateByDomain === "object"
          ? parsed.persistedIncidentRecordStateByDomain
          : {},
    };
  } catch {
    return null;
  }
}

let deferredWarmupChain = Promise.resolve();
let deferredIncidentIdentityRuntimeDepsPromise = null;

function runDeferredWarmupSerialized(warm) {
  const invoke = async () => {
    try {
      await warm();
    } catch {
      // Deferred warmups are opportunistic; failures should not
      // surface to runtime behavior or break later warmups.
    }
  };
  const scheduled = deferredWarmupChain.then(invoke, invoke);
  deferredWarmupChain = scheduled.then(
    () => undefined,
    () => undefined
  );
  return scheduled;
}

function scheduleDeferredWarmup(warm, {
  startDelayMs = 0,
  idleTimeoutMs = 3000,
  fallbackDelayMs = 1200,
} = {}) {
  if (typeof window === "undefined" || typeof warm !== "function") {
    return () => {};
  }

  let cancelled = false;
  let startHandle = null;
  let idleHandle = null;
  let fallbackHandle = null;

  const runWarmSerialized = () => {
    if (cancelled) return;
    void runDeferredWarmupSerialized(async () => {
      if (cancelled) return;
      await warm();
    });
  };

  const runWarm = () => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(() => {
        runWarmSerialized();
      }, { timeout: idleTimeoutMs });
      return;
    }
    fallbackHandle = window.setTimeout(() => {
      runWarmSerialized();
    }, fallbackDelayMs);
  };

  if (startDelayMs > 0) {
    startHandle = window.setTimeout(runWarm, startDelayMs);
  } else {
    runWarm();
  }

  return () => {
    cancelled = true;
    if (startHandle != null) {
      window.clearTimeout(startHandle);
    }
    if (idleHandle != null && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleHandle);
    }
    if (fallbackHandle != null) {
      window.clearTimeout(fallbackHandle);
    }
  };
}

function getDeferredIncidentIdentityRuntimeDeps() {
  if (!deferredIncidentIdentityRuntimeDepsPromise) {
    deferredIncidentIdentityRuntimeDepsPromise = loadDeferredIncidentIdentityRuntimeModule().then((module) => ({
      canIdentityReportLight: module.buildCanIdentityReportLightRuntimeShared({
        normalizeIncidentDrivenLookupId,
        getIncidentDomainHelper,
      }),
      bearingBetween: module.bearingBetweenShared,
      predictedMovingDisplayPosition: module.predictedMovingDisplayPositionShared,
    }));
  }
  return deferredIncidentIdentityRuntimeDepsPromise;
}

function resolveBackgroundWarmupPolicy() {
  if (typeof navigator === "undefined") {
    return {
      allowWarmup: true,
      reducedWarmup: false,
    };
  }
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData) {
    return {
      allowWarmup: false,
      reducedWarmup: true,
    };
  }
  const effectiveType = String(connection?.effectiveType || "").trim().toLowerCase();
  const downlink = Number(connection?.downlink);
  const rtt = Number(connection?.rtt);
  if (effectiveType === "slow-2g" || effectiveType === "2g") {
    return {
      allowWarmup: false,
      reducedWarmup: true,
    };
  }
  if (Number.isFinite(downlink) && downlink > 0 && downlink < 0.8) {
    return {
      allowWarmup: false,
      reducedWarmup: true,
    };
  }
  if (Number.isFinite(rtt) && rtt >= 1200) {
    return {
      allowWarmup: false,
      reducedWarmup: true,
    };
  }

  const deviceMemory = Number(navigator.deviceMemory);
  const hardwareConcurrency = Number(navigator.hardwareConcurrency);
  const lowMemoryDevice = Number.isFinite(deviceMemory) && deviceMemory > 0 && deviceMemory <= 2;
  const lowCpuDevice = Number.isFinite(hardwareConcurrency) && hardwareConcurrency > 0 && hardwareConcurrency <= 4;
  const moderateNetwork =
    effectiveType === "3g"
    || (Number.isFinite(downlink) && downlink > 0 && downlink < 1.5)
    || (Number.isFinite(rtt) && rtt >= 450);

  if (lowMemoryDevice || lowCpuDevice || moderateNetwork) {
    return {
      allowWarmup: true,
      reducedWarmup: true,
    };
  }

  return {
    allowWarmup: true,
    reducedWarmup: false,
  };
}

function resolveDomainMarkerIconPresentation(domainKeyRaw, markerColor = "", iconSrc = "", options = {}) {
  const helper = getIncidentDomainHelper(domainKeyRaw);
  const basePresentation = buildDomainMarkerIconPresentationShared(domainKeyRaw, markerColor, iconSrc, options);
  return {
    ...basePresentation,
    glyphTextY: Number.isFinite(Number(helper?.markerIconTextY)) ? Number(helper.markerIconTextY) : undefined,
    glyphTextSize: Number.isFinite(Number(helper?.markerIconTextSize)) ? Number(helper.markerIconTextSize) : undefined,
    hideFallbackGlyphWhenSourcePresent: helper?.markerIconHideFallbackGlyphWhenSourcePresent === true,
  };
}

function firstConfiguredFieldValue(source, fieldNames = []) {
  const target = source && typeof source === "object" ? source : null;
  const fields = Array.isArray(fieldNames)
    ? fieldNames.map((fieldName) => String(fieldName || "").trim()).filter(Boolean)
    : [];
  if (!(target && fields.length)) return "";
  return fields
    .map((fieldName) => String(target?.[fieldName] || "").trim())
    .find(Boolean) || "";
}

function signMarkerGlyphForType(raw) {
  const key = String(raw || "").trim().toLowerCase();
  if (key === "stop") return "🛑";
  if (key === "yield") return "Y";
  if (key === "speed_limit") return "SL";
  if (key === "warning") return "⚠️";
  if (key === "no_parking") return "NP";
  if (key === "one_way") return "→";
  if (key === "school_zone") return "SZ";
  if (key === "crosswalk") return "🚸";
  if (key === "street_name") return "St";
  return "🪧";
}

// ==================================================
// SECTION 4 — Geometry Helpers
// ==================================================
function metersBetween(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(s));
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

function parseGeoJsonValue(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parseGeoJsonValue(parsed);
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") {
    const type = String(raw?.type || "");
    if (type === "FeatureCollection" || type === "Feature" || type === "Polygon" || type === "MultiPolygon") {
      return raw;
    }
    // Allow app_config payload wrappers, e.g. { geojson: {...} } / { value: {...} } / { boundary: {...} }.
    if (raw?.geojson) return parseGeoJsonValue(raw.geojson);
    if (raw?.value) return parseGeoJsonValue(raw.value);
    if (raw?.boundary) return parseGeoJsonValue(raw.boundary);
    if (raw?.geometry) return parseGeoJsonValue(raw.geometry);
  }
  return null;
}

function normalizePolygonRings(coords) {
  if (!Array.isArray(coords)) return [];
  return coords
    .map((ring) => {
      if (!Array.isArray(ring)) return [];
      return ring
        .map((pt) => {
          const lng = Number(pt?.[0]);
          const lat = Number(pt?.[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return { lat, lng };
        })
        .filter(Boolean);
    })
    .filter((ring) => ring.length >= 3);
}

function extractPolygonsFromGeoJson(raw) {
  const geo = parseGeoJsonValue(raw);
  if (!geo || typeof geo !== "object") return [];
  const out = [];

  const addGeometry = (geometry) => {
    const g = parseGeoJsonValue(geometry);
    if (!g || typeof g !== "object") return;
    const type = String(g.type || "");
    if (type === "Polygon") {
      const rings = normalizePolygonRings(g.coordinates);
      if (rings.length) out.push(rings);
      return;
    }
    if (type === "MultiPolygon") {
      for (const poly of g.coordinates || []) {
        const rings = normalizePolygonRings(poly);
        if (rings.length) out.push(rings);
      }
    }
  };

  const type = String(geo.type || "");
  if (type === "FeatureCollection") {
    for (const f of geo.features || []) addGeometry(f?.geometry);
  } else if (type === "Feature") {
    addGeometry(geo.geometry);
  } else {
    addGeometry(geo);
  }

  return out;
}

function sanitizeHexColor(value, fallback = "#234a72") {
  const raw = String(value || "").trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
  const safeFallback = String(fallback || "").trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(safeFallback)) return safeFallback;
  return "#234a72";
}

function normalizeSegmentPointKey(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  return `${lat.toFixed(7)},${lng.toFixed(7)}`;
}

function buildCanonicalSegmentKey(a, b) {
  const aKey = normalizeSegmentPointKey(a);
  const bKey = normalizeSegmentPointKey(b);
  if (!aKey || !bKey || aKey === bKey) return "";
  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}

function buildParkExteriorBorderSegments(polygons) {
  const segmentMap = new Map();
  for (const polygon of polygons || []) {
    for (const ring of polygon || []) {
      const cleanedRing = (ring || [])
        .map((point) => ({
          lat: Number(point?.lat),
          lng: Number(point?.lng),
        }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
      if (cleanedRing.length < 3) continue;
      const firstKey = normalizeSegmentPointKey(cleanedRing[0]);
      const lastKey = normalizeSegmentPointKey(cleanedRing[cleanedRing.length - 1]);
      const ringPoints = firstKey && firstKey === lastKey
        ? cleanedRing.slice(0, -1)
        : cleanedRing;
      if (ringPoints.length < 3) continue;
      for (let index = 0; index < ringPoints.length; index += 1) {
        const start = ringPoints[index];
        const end = ringPoints[(index + 1) % ringPoints.length];
        const key = buildCanonicalSegmentKey(start, end);
        if (!key) continue;
        const current = segmentMap.get(key);
        if (current) {
          current.count += 1;
        } else {
          segmentMap.set(key, {
            count: 1,
            path: [start, end],
          });
        }
      }
    }
  }
  return Array.from(segmentMap.values())
    .filter((segment) => segment.count === 1)
    .map((segment) => segment.path);
}

function parseOptionalCoordinate(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parkLabelBaseFontSizePx(parkName) {
  const length = String(parkName || "").trim().length;
  if (length >= 28) return 9;
  if (length >= 20) return 10;
  if (length >= 14) return 11;
  return 12;
}

function parkLabelVisualConfig(parkName, zoom) {
  const baseSize = parkLabelBaseFontSizePx(parkName);
  const numericZoom = Number(zoom);
  if (!Number.isFinite(numericZoom) || numericZoom < 15) {
    return { visible: false, fontSizePx: 0 };
  }
  if (numericZoom < 16) {
    return { visible: true, fontSizePx: Math.max(9, baseSize - 1) };
  }
  if (numericZoom < 17) {
    return { visible: true, fontSizePx: baseSize };
  }
  if (numericZoom < 18) {
    return { visible: true, fontSizePx: baseSize + 2 };
  }
  if (numericZoom < 19) {
    return { visible: true, fontSizePx: baseSize + 4 };
  }
  return { visible: true, fontSizePx: baseSize + 6 };
}

function isPointInRing(lat, lng, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i]?.lng);
    const yi = Number(ring[i]?.lat);
    const xj = Number(ring[j]?.lng);
    const yj = Number(ring[j]?.lat);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isPointInPolygons(lat, lng, polygons) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  for (const poly of polygons || []) {
    const outer = poly?.[0];
    if (!outer || !isPointInRing(lat, lng, outer)) continue;
    const holes = poly.slice(1);
    const inHole = holes.some((h) => isPointInRing(lat, lng, h));
    if (!inHole) return true;
  }
  return false;
}

function ringSignedArea(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ax = Number(a?.lng);
    const ay = Number(a?.lat);
    const bx = Number(b?.lng);
    const by = Number(b?.lat);
    if (![ax, ay, bx, by].every(Number.isFinite)) continue;
    sum += ax * by - bx * ay;
  }
  return sum / 2;
}

function orientRing(ring, direction = "clockwise") {
  if (!Array.isArray(ring)) return [];
  const copy = ring
    .map((pt) => ({
      lat: Number(pt?.lat),
      lng: Number(pt?.lng),
    }))
    .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng));
  if (copy.length < 3) return copy;
  const area = ringSignedArea(copy);
  const shouldClockwise = direction === "clockwise";
  const isClockwise = area < 0;
  if (shouldClockwise === isClockwise) return copy;
  return [...copy].reverse();
}

function buildWorldMaskRing() {
  const topLat = 85;
  const bottomLat = -85;
  const westLng = -179.999;
  const eastLng = 179.999;
  const lngStep = 20;
  const latStep = 20;
  const pts = [];

  for (let lng = westLng; lng <= eastLng; lng += lngStep) {
    pts.push({ lat: topLat, lng: Math.min(eastLng, lng) });
  }
  for (let lat = topLat; lat >= bottomLat; lat -= latStep) {
    pts.push({ lat: Math.max(bottomLat, lat), lng: eastLng });
  }
  for (let lng = eastLng; lng >= westLng; lng -= lngStep) {
    pts.push({ lat: bottomLat, lng: Math.max(westLng, lng) });
  }
  for (let lat = bottomLat; lat <= topLat; lat += latStep) {
    pts.push({ lat: Math.min(topLat, lat), lng: westLng });
  }
  return orientRing(pts, "clockwise");
}

function lightIdFor(lat, lng) {
  return `${lat.toFixed(5)}:${lng.toFixed(5)}`;
}

function normalizeSubmitTextForKey(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

function domainSubmitIdempotencyKey({ target, issue, note }) {
  const domain = normalizeDomainKeyOrSlug(target?.domain || "streetlights", { allowUnknown: true }) || "streetlights";
  const incidentId = String(target?.incident_id || target?.lightId || "").trim().toLowerCase();
  const srcLat = Number.isFinite(Number(target?.sourceLat)) ? Number(target?.sourceLat) : Number(target?.lat);
  const srcLng = Number.isFinite(Number(target?.sourceLng)) ? Number(target?.sourceLng) : Number(target?.lng);
  const coordKey = Number.isFinite(srcLat) && Number.isFinite(srcLng)
    ? `${srcLat.toFixed(5)},${srcLng.toFixed(5)}`
    : "";
  const issueKey = normalizeSubmitTextForKey(issue || "");
  const noteKey = normalizeSubmitTextForKey(note || "");
  return [domain, incidentId || coordKey, issueKey, noteKey].filter(Boolean).join("|").slice(0, 220);
}

function defaultMarkerGlyphSrcForDomain(domainKeyRaw, fallback = "") {
  const key = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
  return DOMAIN_MARKER_ICON_SRCS[key] || String(fallback || "").trim();
}

function defaultMarkerGlyphForDomain(domainKeyRaw, options = {}) {
  const key = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
  const helper = getIncidentDomainHelper(key);
  const markerGlyphMode = String(helper?.markerGlyphMode || "").trim();
  if (markerGlyphMode === "option_type_glyph") {
    return signMarkerGlyphForType(options?.signType);
  }
  return DOMAIN_MARKER_GLYPHS[key] || String(options?.fallback || "").trim();
}

function resolveIncidentDomainHelperEntry(domainKeyRaw) {
  return resolveIncidentDomainHelperEntryShared(domainKeyRaw, {
    normalizeDomainKeyOrSlug,
    getIncidentDomainHelper,
  });
}

function readIncidentDomainHelperString(domainKeyRaw, fieldName, fallback = "") {
  return readIncidentDomainHelperStringShared(domainKeyRaw, fieldName, fallback, {
    normalizeDomainKeyOrSlug,
    getIncidentDomainHelper,
  });
}

function readIncidentDomainHelperBoolean(domainKeyRaw, fieldName) {
  return readIncidentDomainHelperBooleanShared(domainKeyRaw, fieldName, {
    normalizeDomainKeyOrSlug,
    getIncidentDomainHelper,
  });
}

function readIncidentDomainConfiguredCollectionHelperString(domainKeyRaw, kindRaw, reportsField, seededField) {
  return readIncidentDomainConfiguredCollectionHelperStringShared(
    domainKeyRaw,
    kindRaw,
    reportsField,
    seededField,
    {
      normalizeDomainKeyOrSlug,
      getIncidentDomainHelper,
    }
  );
}

function incidentDomainResolveLookupValueByMode(modeRaw, row = null, domainKeyRaw = "") {
  return incidentDomainResolveLookupValueByModeShared(modeRaw, row, domainKeyRaw, {
    getIncidentDomainHelper,
  });
}

function lookupIncidentIdForDomain(domainKeyRaw, incidentIdRaw) {
  return normalizeIncidentDrivenLookupIdShared(domainKeyRaw, incidentIdRaw, {
    getIncidentDomainHelper,
    normalizeDomainKeyOrSlug,
  });
}

function normalizeIncidentDrivenLookupId(domainKeyRaw, incidentIdRaw) {
  return lookupIncidentIdForDomain(domainKeyRaw, incidentIdRaw);
}

function incidentDrivenViewerLookupId(domainKeyRaw, incidentIdRaw) {
  return normalizeIncidentDrivenLookupId(domainKeyRaw, incidentIdRaw);
}

function incidentDomainCanonicalIncidentId(domainKeyRaw, row = null, fallbackIncidentIdRaw = "") {
  const canonicalIncidentId = canonicalIncidentDrivenIncidentIdShared(domainKeyRaw, row, fallbackIncidentIdRaw, {
    getIncidentDomainHelper,
    normalizeDomainKeyOrSlug,
  });
  if (canonicalIncidentId) return canonicalIncidentId;
  const lat = Number(row?.lat);
  const lng = Number(row?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? lightIdFor(lat, lng)
    : "";
}

function incidentDomainBuildIncidentRows(domainKeyRaw, context = {}) {
  const resolved = resolveIncidentDomainHelperEntry(domainKeyRaw);
  if (!resolved) return [];
  const helper = resolved.helper || {};
  const reportRows = Array.isArray(context?.reportRows) ? context.reportRows : [];
  if (typeof helper?.buildIncidentRows === "function") {
    return helper.buildIncidentRows(context, resolved) || [];
  }
  const mode = String(helper?.buildIncidentRowsMode || "").trim();
  if (mode === "canonical_incident_rows_from_lookup") {
    const rows = [];
    for (const row of reportRows) {
      const lookupId = incidentDomainResolveLookupValueByMode(
        "incident_or_domain_report_id",
        row,
        resolved.domainKey
      );
      if (!lookupId) continue;
      const incidentId = incidentDomainCanonicalIncidentId(resolved.domainKey, { incident_id: lookupId });
      rows.push({
        ...row,
        domainKey: resolved.domainKey,
        domain: resolved.domainKey,
        incident_id: incidentId,
        light_id: incidentId,
      });
    }
    return rows;
  }
  return reportRows.map((row) => {
    const lat = Number(row?.lat);
    const lng = Number(row?.lng);
    const fallbackIncidentId =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? String(lightIdFor(lat, lng) || "").trim()
        : "";
    const incidentId = String(
      row?.incident_id
      || row?.light_id
      || incidentDomainResolveLookupValueByMode(
        "incident_or_domain_report_id",
        row,
        resolved.domainKey
      )
      || fallbackIncidentId
      || ""
    ).trim();
    if (!incidentId) return null;
    return {
      ...row,
      domainKey: resolved.domainKey,
      domain: resolved.domainKey,
      incident_id: incidentId,
      light_id: String(row?.light_id || incidentId).trim() || incidentId,
      ts: Number(row?.ts || 0) || Date.parse(String(row?.created_at || "")) || 0,
    };
  }).filter(Boolean);
}

function incidentDomainBuildCoordsDisplayId(domainKeyRaw, { incidentId = "", lat = Number.NaN, lng = Number.NaN } = {}) {
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) return "";
  return String(
    genericIncidentDisplayId(domainKey, Number(lat), Number(lng), String(incidentId || "").trim()) || ""
  ).trim();
}

function incidentDomainAdminMappingQueueVariant(domainKeyRaw) {
  return readIncidentDomainHelperString(domainKeyRaw, "adminMappingQueueVariant");
}

function incidentDomainQueueItemMatchesVariant(queueItem = null, variantRaw = "") {
  const variant = String(variantRaw || "").trim();
  if (!variant) return false;
  const domainKey = normalizeDomainKeyOrSlug(queueItem?.domain, { allowUnknown: true }) || "streetlights";
  return incidentDomainAdminMappingQueueVariant(domainKey) === variant;
}

function configuredIncidentHasSourceTableSync(domainKeyRaw, kindRaw = "seeded") {
  return Boolean(
    readIncidentDomainConfiguredCollectionHelperString(
      domainKeyRaw,
      kindRaw,
      "reportsSourceTable",
      "seededSourceTable"
    )
  );
}

function configuredIncidentPersistedStateSupportedDomainKeysSync() {
  return Object.keys(INCIDENT_DOMAIN_HELPERS).filter((domainKey) => (
    Boolean(readIncidentDomainHelperString(domainKey, "persistedRecordStateSourceTable"))
  ));
}

async function createDeferredIncidentDomainSubmitHelpersRuntime(deps = {}) {
  const { createDeferredIncidentDomainSubmitHelpers } =
    await loadDeferredIncidentDomainRuntimeSupportModule();
  return createDeferredIncidentDomainSubmitHelpers(deps);
}

async function createDeferredIncidentDomainMarkerHelpersRuntime(deps = {}) {
  const { createDeferredIncidentDomainMarkerHelpers } =
    await loadDeferredIncidentDomainRuntimeSupportModule();
  return createDeferredIncidentDomainMarkerHelpers(deps);
}

async function createDeferredConfiguredIncidentStateRuntimeHelpersRuntime(deps = {}) {
  const { createDeferredConfiguredIncidentStateRuntimeHelpers } =
    await loadDeferredConfiguredIncidentStateRuntimeModule();
  return createDeferredConfiguredIncidentStateRuntimeHelpers(deps);
}

function readReportDeepLinkRequest(search = "") {
  const params = new URLSearchParams(String(search || ""));
  const requestedDomain = normalizeDomainKeyOrSlug(params.get("report_domain"), { allowUnknown: true });
  const focusIncidentId = String(params.get("focus_incident_id") || "").trim();
  const flyLatRaw = String(params.get("fly_lat") || "").trim();
  const flyLngRaw = String(params.get("fly_lng") || "").trim();
  const flyZoomParam = String(params.get("fly_zoom") || "").trim();
  const flyLat = flyLatRaw ? Number(flyLatRaw) : Number.NaN;
  const flyLng = flyLngRaw ? Number(flyLngRaw) : Number.NaN;
  const flyZoomRaw = flyZoomParam ? Number(flyZoomParam) : Number.NaN;

  return {
    requestedDomain,
    focusIncidentId,
    flyLat,
    flyLng,
    flyZoom: Number.isFinite(flyZoomRaw) ? flyZoomRaw : 18,
    hasFlyTarget: Number.isFinite(flyLat) && Number.isFinite(flyLng),
  };
}

function readDeleteAccountDeepLinkRequest(search = "") {
  const params = new URLSearchParams(String(search || ""));
  const raw = String(params.get("deleteAccount") || "").trim().toLowerCase();
  if (!params.has("deleteAccount")) return false;
  if (!raw) return true;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "y";
}

const OFFICIAL_LIGHT_CANONICALIZE_RADIUS_METERS = 35;

function canonicalOfficialLightId(rawLightId, lat, lng, officialIdByAlias, officialIdByCoordKey, officialLights = null) {
  const raw = String(rawLightId || "").trim();
  if (raw && officialIdByAlias?.has(raw)) return officialIdByAlias.get(raw);

  const nLat = Number(lat);
  const nLng = Number(lng);
  if (Number.isFinite(nLat) && Number.isFinite(nLng)) {
    const k5 = `${nLat.toFixed(5)}:${nLng.toFixed(5)}`;
    if (officialIdByCoordKey?.has(k5)) return officialIdByCoordKey.get(k5);
    const k4 = `${nLat.toFixed(4)}:${nLng.toFixed(4)}`;
    if (officialIdByCoordKey?.has(k4)) return officialIdByCoordKey.get(k4);
  }

  if (Number.isFinite(nLat) && Number.isFinite(nLng) && Array.isArray(officialLights) && officialLights.length) {
    const nearest = findNearestOfficialWithinRadius(
      officialLights,
      nLat,
      nLng,
      OFFICIAL_LIGHT_CANONICALIZE_RADIUS_METERS
    );
    if (nearest?.id) return String(nearest.id).trim();
  }

  return raw || lightIdFor(nLat, nLng);
}

function domainIssueNoteTag(domainKeyRaw) {
  return "Issue Type";
}

function incidentDomainBuildLastFixByIncidentMap(domainKeyRaw, {
  actionsByLightId = {},
  incidentStateByKey = {},
} = {}) {
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  return incidentDomainBuildLastFixByIncidentMapShared({
    domainKey,
    actionsByLightId,
    incidentStateByKey,
    hasIncidentIdPrefix: (incidentIdRaw, candidateDomainKeyRaw) => (
      hasIncidentIdPrefixShared(incidentIdRaw, candidateDomainKeyRaw, {
        getIncidentDomainHelper,
        normalizeDomainKeyOrSlug,
      })
    ),
    normalizeIncidentDrivenLookupId,
  });
}

// ==================================================
// SECTION 5 — Group reports into streetlights
// ==================================================
function groupLightBucketKey(latBucket, lngBucket) {
  return `${latBucket}:${lngBucket}`;
}

function groupLightBucketCoords(lat, lng) {
  return {
    latBucket: Math.floor(Number(lat) / GROUP_BUCKET_DEGREES),
    lngBucket: Math.floor(Number(lng) / GROUP_BUCKET_DEGREES),
  };
}

function groupLightBucketLngRange(lat) {
  const latRad = Number(lat) * (Math.PI / 180);
  const cosLat = Math.max(0.2, Math.abs(Math.cos(latRad)));
  return Math.max(1, Math.ceil(1 / cosLat) + 1);
}

function addGroupLightIndexToBucket(bucketIndex, lightIndex, lat, lng) {
  const { latBucket, lngBucket } = groupLightBucketCoords(lat, lng);
  const key = groupLightBucketKey(latBucket, lngBucket);
  if (!bucketIndex.has(key)) {
    bucketIndex.set(key, new Set());
  }
  bucketIndex.get(key).add(lightIndex);
  return key;
}

function removeGroupLightIndexFromBucket(bucketIndex, lightIndex, bucketKey) {
  if (!bucketKey || !bucketIndex.has(bucketKey)) return;
  const bucket = bucketIndex.get(bucketKey);
  bucket.delete(lightIndex);
  if (!bucket.size) {
    bucketIndex.delete(bucketKey);
  }
}

function nearbyGroupLightIndexes(bucketIndex, lat, lng) {
  const candidateIndexes = new Set();
  const { latBucket, lngBucket } = groupLightBucketCoords(lat, lng);
  const lngRange = groupLightBucketLngRange(lat);
  for (let latOffset = -GROUP_BUCKET_LAT_RANGE; latOffset <= GROUP_BUCKET_LAT_RANGE; latOffset += 1) {
    for (let lngOffset = -lngRange; lngOffset <= lngRange; lngOffset += 1) {
      const bucket = bucketIndex.get(groupLightBucketKey(latBucket + latOffset, lngBucket + lngOffset));
      if (!bucket?.size) continue;
      for (const lightIndex of bucket) {
        candidateIndexes.add(lightIndex);
      }
    }
  }
  return candidateIndexes;
}

function groupIntoLights(reports) {
  const lights = [];
  const bucketIndex = new Map();

  for (const r of reports) {
    let matchedLightIndex = -1;
    for (const lightIndex of nearbyGroupLightIndexes(bucketIndex, r.lat, r.lng)) {
      const light = lights[lightIndex];
      if (!light) continue;
      const dist = metersBetween(
        { lat: r.lat, lng: r.lng },
        { lat: light.lat, lng: light.lng }
      );

      if (dist <= GROUP_RADIUS_METERS) {
        if (matchedLightIndex < 0 || lightIndex < matchedLightIndex) {
          matchedLightIndex = lightIndex;
        }
      }
    }

    if (matchedLightIndex >= 0) {
      const light = lights[matchedLightIndex];
      light.reports.push(r);

      const n = light.reports.length;
      const nextLat = (light.lat * (n - 1) + r.lat) / n;
      const nextLng = (light.lng * (n - 1) + r.lng) / n;
      if (nextLat !== light.lat || nextLng !== light.lng) {
        removeGroupLightIndexFromBucket(bucketIndex, matchedLightIndex, light.bucketKey);
        light.lat = nextLat;
        light.lng = nextLng;
        light.bucketKey = addGroupLightIndexToBucket(bucketIndex, matchedLightIndex, nextLat, nextLng);
      }
      continue;
    }

    const light = {
        lat: r.lat,
        lng: r.lng,
        reports: [r],
      };
    const lightIndex = lights.push(light) - 1;
    light.bucketKey = addGroupLightIndexToBucket(bucketIndex, lightIndex, light.lat, light.lng);
  }

  return lights.map((l) => {
    const counts = new Map();
    for (const r of l.reports) {
      const id = r.light_id || lightIdFor(r.lat, r.lng);
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    let primary = null;
    let best = -1;
    for (const [id, n] of counts.entries()) {
      if (n > best) {
        best = n;
        primary = id;
      }
    }
    return { ...l, lightId: primary };
  });
}

function findNearestLightWithinRadius(lights, lat, lng) {
  let best = null;
  let bestDist = Infinity;

  for (const l of lights) {
    const dist = metersBetween({ lat, lng }, { lat: l.lat, lng: l.lng });
    if (dist <= GROUP_RADIUS_METERS && dist < bestDist) {
      bestDist = dist;
      best = l;
    }
  }
  return best;
}

function findNearestOfficialWithinRadius(officialLights, lat, lng) {
  let best = null;
  let bestDist = Infinity;

  for (const ol of officialLights || []) {
    const dist = metersBetween({ lat, lng }, { lat: ol.lat, lng: ol.lng });
    if (dist <= GROUP_RADIUS_METERS && dist < bestDist) {
      bestDist = dist;
      best = ol;
    }
  }
  return best;
}


// ==================================================
// SECTION 6 — Marker helpers
// ==================================================
function incidentClusterRadiusMetersForZoom(zoom) {
  const z = Number(zoom || 0);
  if (z <= 10) return 1200;
  if (z <= 12) return 700;
  if (z <= 13) return 420;
  if (z <= 14) return 260;
  return 160;
}

function incidentLocationKey(lat, lng, decimals = INCIDENT_STACK_LOCATION_DECIMALS) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return "";
  return `${nLat.toFixed(decimals)}:${nLng.toFixed(decimals)}`;
}

function incidentClusterBucketKey(latBucket, lngBucket) {
  return `${latBucket}:${lngBucket}`;
}

function incidentClusterBucketCoords(lat, lng, bucketDegrees) {
  return {
    latBucket: Math.floor(Number(lat) / bucketDegrees),
    lngBucket: Math.floor(Number(lng) / bucketDegrees),
  };
}

function incidentClusterBucketLngRange(lat, bucketDegrees) {
  const latRad = Number(lat) * (Math.PI / 180);
  const cosLat = Math.max(0.2, Math.abs(Math.cos(latRad)));
  const lngBucketDegrees = bucketDegrees * cosLat;
  if (!(lngBucketDegrees > 0)) return 2;
  return Math.max(1, Math.ceil(bucketDegrees / lngBucketDegrees) + 1);
}

function incidentClusterNearbyIndexes(bucketIndex, lat, lng, bucketDegrees) {
  const candidateIndexes = new Set();
  const { latBucket, lngBucket } = incidentClusterBucketCoords(lat, lng, bucketDegrees);
  const lngRange = incidentClusterBucketLngRange(lat, bucketDegrees);
  for (let latOffset = -2; latOffset <= 2; latOffset += 1) {
    for (let lngOffset = -lngRange; lngOffset <= lngRange; lngOffset += 1) {
      const bucket = bucketIndex.get(incidentClusterBucketKey(latBucket + latOffset, lngBucket + lngOffset));
      if (!bucket?.size) continue;
      for (const candidateIndex of bucket) {
        candidateIndexes.add(candidateIndex);
      }
    }
  }
  return candidateIndexes;
}

function clusterMarkersByDistance(markers = [], radiusMeters = 0) {
  const radius = Number(radiusMeters || 0);
  if (!(radius > 0)) {
    return (Array.isArray(markers) ? markers : []).map((marker) => ({
      lat: Number(marker?.lat),
      lng: Number(marker?.lng),
      markers: [marker],
      north: Number(marker?.lat),
      south: Number(marker?.lat),
      east: Number(marker?.lng),
      west: Number(marker?.lng),
    }));
  }

  const source = (Array.isArray(markers) ? markers : [])
    .map((marker) => ({
      marker,
      lat: Number(marker?.lat),
      lng: Number(marker?.lng),
    }))
    .filter((entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lng));
  const bucketDegrees = radius / 111320;
  const bucketIndex = new Map();
  for (let index = 0; index < source.length; index += 1) {
    const entry = source[index];
    if (!entry) continue;
    const { latBucket, lngBucket } = incidentClusterBucketCoords(entry.lat, entry.lng, bucketDegrees);
    const key = incidentClusterBucketKey(latBucket, lngBucket);
    if (!bucketIndex.has(key)) bucketIndex.set(key, new Set());
    bucketIndex.get(key).add(index);
  }

  const visited = new Set();
  const clusters = [];

  for (let index = 0; index < source.length; index += 1) {
    if (visited.has(index)) continue;
    visited.add(index);

    const queue = [index];
    const members = [];

    while (queue.length) {
      const currentIndex = queue.shift();
      const current = source[currentIndex];
      if (!current) continue;
      members.push(current);

      for (const candidateIndex of incidentClusterNearbyIndexes(bucketIndex, current.lat, current.lng, bucketDegrees)) {
        if (visited.has(candidateIndex)) continue;
        const candidate = source[candidateIndex];
        if (!candidate) continue;
        const distance = metersBetween(
          { lat: current.lat, lng: current.lng },
          { lat: candidate.lat, lng: candidate.lng }
        );
        if (distance > radius) continue;
        visited.add(candidateIndex);
        queue.push(candidateIndex);
      }
    }

    if (!members.length) continue;
    const latSum = members.reduce((sum, entry) => sum + entry.lat, 0);
    const lngSum = members.reduce((sum, entry) => sum + entry.lng, 0);
    clusters.push({
      lat: latSum / members.length,
      lng: lngSum / members.length,
      north: members.reduce((max, entry) => Math.max(max, entry.lat), -Infinity),
      south: members.reduce((min, entry) => Math.min(min, entry.lat), Infinity),
      east: members.reduce((max, entry) => Math.max(max, entry.lng), -Infinity),
      west: members.reduce((min, entry) => Math.min(min, entry.lng), Infinity),
      markers: members.map((entry) => entry.marker),
    });
  }

  return clusters;
}

function defaultMarkerColorForDomain(domainKey) {
  return defaultMarkerColorForDomainShared(domainKey, {
    runtimeDomainMeta: RUNTIME_DOMAIN_META,
    getIncidentDomainHelper,
  });
}

function resolveRuntimeDomainTypeForMap(domainKeyRaw) {
  const domainKey = String(domainKeyRaw || "").trim().toLowerCase();
  if (!domainKey) return resolveDomainType(domainKeyRaw, "");
  const runtimeType = String(RUNTIME_DOMAIN_META.domainTypeByDomain.get(domainKey) || "").trim().toLowerCase();
  return resolveDomainType(domainKey, runtimeType);
}

function resolveHighConfidenceThresholdForDomain(domainKeyRaw) {
  const domainKey = String(domainKeyRaw || "").trim().toLowerCase();
  if (!domainKey) return defaultDomainHighConfidenceMinReports(domainKeyRaw);
  const publicMin = sanitizeIncidentReportThreshold(
    RUNTIME_DOMAIN_META.publicVisibilityMinReportsByDomain.get(domainKey),
    defaultDomainPublicVisibilityMinReports(domainKey)
  );
  return sanitizeIncidentReportThreshold(
    RUNTIME_DOMAIN_META.highConfidenceMinReportsByDomain.get(domainKey),
    defaultDomainHighConfidenceMinReports(domainKey),
    { min: publicMin }
  );
}

function resolveHighConfidenceMarkerColorForDomain(domainKeyRaw) {
  return resolveHighConfidenceMarkerColorForDomainShared(domainKeyRaw, {
    runtimeDomainMeta: RUNTIME_DOMAIN_META,
    getIncidentDomainHelper,
  });
}

function projectDestinationPointMeters(start, distanceMeters, bearingDeg) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const toDeg = (radians) => (radians * 180) / Math.PI;
  const earthRadius = 6378137;

  const distance = Math.max(0, Number(distanceMeters) || 0);
  const bearing = toRad(Number(bearingDeg) || 0);
  const lat1 = toRad(start.lat);
  const lon1 = toRad(start.lng);
  const angDist = distance / earthRadius;

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAng = Math.sin(angDist);
  const cosAng = Math.cos(angDist);

  const lat2 = Math.asin(sinLat1 * cosAng + cosLat1 * sinAng * Math.cos(bearing));
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * sinAng * cosLat1,
    cosAng - sinLat1 * Math.sin(lat2)
  );

  return {
    lat: toDeg(lat2),
    lng: ((toDeg(lon2) + 540) % 360) - 180,
  };
}

function resolveFollowCameraCenter({ lat, lng, heading, travelFollowMode = false }) {
  const targetLat = Number(lat);
  const targetLng = Number(lng);
  const headingNum = Number(heading);
  const hasHeading = Number.isFinite(headingNum);
  if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return null;
  if (!(travelFollowMode && hasHeading)) {
    return { lat: targetLat, lng: targetLng };
  }
  return projectDestinationPointMeters(
    { lat: targetLat, lng: targetLng },
    TRAVEL_FOLLOW_LOOKAHEAD_METERS,
    headingNum
  );
}

function buildRuntimeMapUiCssVariables(runtimeUiTheme, darkMode = false) {
  const theme = runtimeUiTheme?.[darkMode ? "dark" : "light"] || {};
  return {
    "--sl-ui-brand-green": "#2a7262",
    "--sl-ui-brand-green-border": "#2a7262",
    "--sl-ui-brand-blue": "#1a3153",
    "--sl-ui-brand-blue-border": "#1a3153",
    "--sl-ui-surface-bg": String(theme.surface_bg || ""),
    "--sl-ui-surface-border": String(theme.surface_border || ""),
    "--sl-ui-surface-shadow": darkMode ? "0 12px 28px rgba(0,0,0,0.45)" : "0 10px 22px rgba(0,0,0,0.18)",
    "--sl-ui-surface-shadow-bottom": darkMode ? "0 -12px 26px rgba(0,0,0,0.42)" : "0 -10px 22px rgba(0,0,0,0.18)",
    "--sl-ui-text": String(theme.surface_text || ""),
    "--sl-ui-link-text": darkMode ? "#9bdcff" : "var(--sl-ui-brand-blue)",
    "--sl-ui-zoom-bg": darkMode ? "rgba(28,31,35,0.94)" : "rgba(255,255,255,0.96)",
    "--sl-ui-zoom-border": darkMode ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.28)",
    "--sl-ui-zoom-shadow": darkMode
      ? "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.24), 0 10px 22px rgba(0,0,0,0.50), 0 2px 6px rgba(0,0,0,0.26)"
      : "inset 0 1px 0 rgba(255,255,255,0.75), 0 8px 18px rgba(0,0,0,0.22)",
    "--sl-ui-zoom-shadow-mobile": darkMode
      ? "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.24), 0 8px 18px rgba(0,0,0,0.50), 0 2px 5px rgba(0,0,0,0.24)"
      : "inset 0 1px 0 rgba(255,255,255,0.75), 0 6px 14px rgba(0,0,0,0.22)",
    "--sl-ui-header-bg-primary": String(theme.header_bg_primary || ""),
    "--sl-ui-header-bg-secondary": String(theme.header_bg_secondary || ""),
    "--sl-ui-header-bg": "linear-gradient(112deg, var(--sl-ui-header-bg-primary), var(--sl-ui-header-bg-secondary))",
    "--sl-ui-header-border": String(theme.header_border || ""),
    "--sl-ui-header-text": String(theme.header_text || ""),
    "--sl-ui-header-eyebrow": String(theme.header_eyebrow || ""),
    "--sl-ui-header-menu-bg": String(theme.header_menu_bg || ""),
    "--sl-ui-header-menu-border": String(theme.header_menu_border || ""),
    "--sl-ui-header-menu-shadow": darkMode ? "0 10px 24px rgba(0,0,0,0.22)" : "none",
    "--sl-ui-tool-btn-bg": String(theme.tool_button_bg || ""),
    "--sl-ui-tool-btn-border": String(theme.tool_button_border || ""),
    "--sl-ui-tool-btn-text": String(theme.tool_button_text || ""),
    "--sl-ui-tool-btn-shadow": darkMode
      ? "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.24), 0 4px 10px rgba(0,0,0,0.42), 0 10px 18px rgba(0,0,0,0.34), 0 1px 3px rgba(0,0,0,0.22)"
      : "inset 0 1px 0 rgba(255,255,255,0.78), inset 0 -2px 0 rgba(0,0,0,0.10), 0 4px 10px rgba(0,0,0,0.22), 0 10px 18px rgba(0,0,0,0.14)",
    "--sl-ui-modal-bg": String(theme.modal_bg || ""),
    "--sl-ui-modal-border": String(theme.modal_border || ""),
    "--sl-ui-modal-shadow": darkMode ? "0 14px 34px rgba(0,0,0,0.45)" : "0 10px 30px rgba(0,0,0,0.25)",
    "--sl-ui-modal-input-bg": String(theme.modal_input_bg || ""),
    "--sl-ui-modal-input-border": String(theme.modal_input_border || ""),
    "--sl-ui-modal-btn-secondary-bg": String(theme.modal_secondary_bg || ""),
    "--sl-ui-modal-btn-secondary-border": String(theme.modal_secondary_border || ""),
    "--sl-ui-modal-btn-secondary-text": String(theme.modal_secondary_text || ""),
    "--sl-ui-modal-btn-dark-bg": String(theme.modal_filled_bg || ""),
    "--sl-ui-modal-btn-dark-text": String(theme.modal_filled_text || ""),
    "--sl-ui-modal-subtle-bg": String(theme.modal_subtle_bg || ""),
    "--sl-ui-feed-card-bg": String(theme.feed_card_bg || ""),
    "--sl-ui-feed-card-border": String(theme.feed_card_border || ""),
    "--sl-ui-feed-muted-text": String(theme.feed_muted_text || ""),
    "--sl-ui-feed-badge-bg": String(theme.feed_badge_bg || ""),
    "--sl-ui-feed-badge-border": String(theme.feed_badge_border || ""),
    "--sl-ui-feed-badge-text": String(theme.feed_badge_text || ""),
    "--sl-ui-feed-new-badge-bg": String(theme.feed_new_badge_bg || ""),
    "--sl-ui-feed-new-badge-border": String(theme.feed_new_badge_border || ""),
    "--sl-ui-feed-new-badge-text": String(theme.feed_new_badge_text || ""),
    "--sl-ui-feed-alert-info-bg": String(theme.feed_alert_info_bg || ""),
    "--sl-ui-feed-alert-info-border": String(theme.feed_alert_info_border || ""),
    "--sl-ui-feed-alert-info-text": String(theme.feed_alert_info_text || ""),
    "--sl-ui-feed-alert-advisory-bg": String(theme.feed_alert_advisory_bg || ""),
    "--sl-ui-feed-alert-advisory-border": String(theme.feed_alert_advisory_border || ""),
    "--sl-ui-feed-alert-advisory-text": String(theme.feed_alert_advisory_text || ""),
    "--sl-ui-feed-alert-urgent-bg": String(theme.feed_alert_urgent_bg || ""),
    "--sl-ui-feed-alert-urgent-border": String(theme.feed_alert_urgent_border || ""),
    "--sl-ui-feed-alert-urgent-text": String(theme.feed_alert_urgent_text || ""),
    "--sl-ui-feed-alert-emergency-bg": String(theme.feed_alert_emergency_bg || ""),
    "--sl-ui-feed-alert-emergency-border": String(theme.feed_alert_emergency_border || ""),
    "--sl-ui-feed-alert-emergency-text": String(theme.feed_alert_emergency_text || ""),
    "--sl-ui-feed-status-published-bg": String(theme.feed_status_published_bg || ""),
    "--sl-ui-feed-status-published-border": String(theme.feed_status_published_border || ""),
    "--sl-ui-feed-status-published-text": String(theme.feed_status_published_text || ""),
    "--sl-ui-feed-status-scheduled-bg": String(theme.feed_status_scheduled_bg || ""),
    "--sl-ui-feed-status-scheduled-border": String(theme.feed_status_scheduled_border || ""),
    "--sl-ui-feed-status-scheduled-text": String(theme.feed_status_scheduled_text || ""),
    "--sl-ui-feed-status-archived-bg": String(theme.feed_status_archived_bg || ""),
    "--sl-ui-feed-status-archived-border": String(theme.feed_status_archived_border || ""),
    "--sl-ui-feed-status-archived-text": String(theme.feed_status_archived_text || ""),
    "--sl-ui-feed-status-draft-bg": String(theme.feed_status_draft_bg || ""),
    "--sl-ui-feed-status-draft-border": String(theme.feed_status_draft_border || ""),
    "--sl-ui-feed-status-draft-text": String(theme.feed_status_draft_text || ""),
    "--sl-ui-contact-tile-bg": String(theme.contact_tile_bg || ""),
    "--sl-ui-contact-tile-border": String(theme.contact_tile_border || ""),
    "--sl-ui-alert-danger-bg": darkMode ? "rgba(183,28,28,1)" : "rgba(183,28,28,0.08)",
    "--sl-ui-alert-danger-border": darkMode ? "rgba(183,28,28,0.455)" : "rgba(183,28,28,0.35)",
    "--sl-ui-alert-danger-text": darkMode ? "#fff" : "#b71c1c",
    "--sl-ui-open-reports-item-border": darkMode ? "#ffffff" : "rgba(0,0,0,0.10)",
    "--sl-ui-metrics-panel-border": darkMode ? "rgba(255,255,255,0.46)" : "rgba(0,0,0,0.22)",
    "--sl-ui-tool-active-bg": String(theme.tool_active_bg || ""),
    "--sl-ui-tool-active-border": String(theme.tool_active_border || ""),
    "--sl-ui-tool-active-text": String(theme.tool_active_text || ""),
    "--mobile-header-background": "var(--sl-ui-header-bg)",
    "--mobile-header-border": "1px solid var(--sl-ui-header-border)",
    "--mobile-header-menu-background": "var(--sl-ui-header-menu-bg)",
    "--mobile-header-menu-border": "1px solid var(--sl-ui-header-menu-border)",
    "--mobile-header-shadow": "0 12px 28px rgba(7, 25, 45, 0.18)",
  };
}

const inputStyle = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid var(--sl-ui-modal-input-border)",
  background: "var(--sl-ui-modal-input-bg)",
  color: "var(--sl-ui-text)",
  fontSize: 16,
  lineHeight: 1.3,
};
const btnPrimary = { padding: 10, borderRadius: 10, border: "none", background: "var(--sl-ui-brand-blue)", color: "white", fontWeight: 900, cursor: "pointer", width: "100%" };
const btnPrimaryDark = { padding: 10, borderRadius: 10, border: "none", background: "var(--sl-ui-modal-btn-dark-bg)", color: "var(--sl-ui-modal-btn-dark-text)", fontWeight: 900, cursor: "pointer", width: "100%" };
const btnSecondary = { padding: 10, borderRadius: 10, border: "1px solid var(--sl-ui-modal-btn-secondary-border)", background: "var(--sl-ui-modal-btn-secondary-bg)", color: "var(--sl-ui-modal-btn-secondary-text)", fontWeight: 900, cursor: "pointer", width: "100%" };

const btnPopupPrimary = btnPrimary;
const btnPopupSecondary = btnSecondary;

function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState(() => {
    try {
      return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let mql;
    try {
      mql = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    } catch {
      return;
    }

    const onChange = (e) => setIsMobile(e.matches);
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);

    setIsMobile(mql.matches);

    return () => {
      if (!mql) return;
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [breakpointPx]);

  return isMobile;
}

// CMD+F: function makeLightIdFromCoords
function makeLightIdFromCoords(lat, lng) {
  const lat5 = Math.abs(Number(lat)).toFixed(5).split(".")[1] || "00000";
  const lng5 = Math.abs(Number(lng)).toFixed(5).split(".")[1] || "00000";
  // ✅ order: lng then lat (per your spec)
  return `SL${lng5}${lat5}`;
}

function isUuidLike(value) {
  return UUID_LIKE_RE.test(String(value || "").trim());
}

function displayIdDigitsFromCoords(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return "";
  const lat5 = String(Math.abs(nLat).toFixed(5).split(".")[1] || "00000").slice(0, 5).padEnd(5, "0");
  const lng5 = String(Math.abs(nLng).toFixed(5).split(".")[1] || "00000").slice(0, 5).padEnd(5, "0");
  if (!/^\d{5}$/.test(lat5) || !/^\d{5}$/.test(lng5)) return "";
  return `${lng5}${lat5}`;
}

function displayIdDigitsFromIncidentId(incidentId) {
  const s = String(incidentId || "").trim();
  if (!s) return "";
  const m = s.match(/^[^:]+:([-]?\d+(?:\.\d+)?):([-]?\d+(?:\.\d+)?)$/);
  if (!m) return "";
  return displayIdDigitsFromCoords(Number(m[1]), Number(m[2]));
}

function incidentDisplayPrefixForDomain(domainKey) {
  const domain = normalizeDomainKeyOrSlug(domainKey, { allowUnknown: true }) || String(domainKey || "").trim().toLowerCase();
  const runtimePrefix = String(RUNTIME_DOMAIN_META.reportPrefixByDomain.get(domain) || "").trim().toUpperCase();
  if (runtimePrefix) return runtimePrefix.replace(/[^A-Z0-9]/g, "") || runtimePrefix;
  const builtInPrefix = String(BUILT_IN_DOMAIN_DISPLAY_PREFIXES[domain] || "").trim().toUpperCase();
  if (builtInPrefix) return builtInPrefix.replace(/[^A-Z0-9]/g, "") || builtInPrefix;
  const fallback = String(domain || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  return (fallback.slice(0, 3) || "INC");
}

function genericIncidentDisplayId(domainKey, lat, lng, incidentId = "") {
  const prefix = incidentDisplayPrefixForDomain(domainKey);
  const digits = displayIdDigitsFromCoords(lat, lng) || displayIdDigitsFromIncidentId(incidentId);
  if (digits) return `${prefix}${digits}`;
  return `${prefix}${shortIncidentKey(incidentId || `${domainKey || ""}|${lat || ""}|${lng || ""}`)}`;
}

function nearestDomainMarkerForPoint(lat, lng, markers, radiusMeters = GROUP_RADIUS_METERS) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  const arr = Array.isArray(markers) ? markers : [];
  let best = null;
  let bestMeters = Infinity;
  for (const marker of arr) {
    const mLat = Number(marker?.lat);
    const mLng = Number(marker?.lng);
    if (!Number.isFinite(mLat) || !Number.isFinite(mLng)) continue;
    const d = metersBetween({ lat: nLat, lng: nLng }, { lat: mLat, lng: mLng });
    if (d <= radiusMeters && d < bestMeters) {
      bestMeters = d;
      best = marker;
    }
  }
  if (!best) return null;
  return { marker: best, distance: bestMeters };
}

function nearestSeededIncidentForPoint(lat, lng, rows, radiusMeters = POTHOLE_MERGE_RADIUS_METERS) {
  const arr = Array.isArray(rows) ? rows : [];
  let best = null;
  let bestMeters = Infinity;
  for (const row of arr) {
    const plat = Number(row?.lat);
    const plng = Number(row?.lng);
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
    const d = metersBetween({ lat, lng }, { lat: plat, lng: plng });
    if (d < bestMeters) {
      bestMeters = d;
      best = row;
    }
  }
  if (!best || bestMeters > radiusMeters) return null;
  return best;
}

function buildConfiguredIncidentDomainCollections(entries = []) {
  const seededRowsByDomain = new Map();
  const reportRowsByDomain = new Map();
  const seededByIdByDomain = new Map();
  const seededDomainKeysWithRows = [];
  const reportDomainKeysWithRows = [];

  for (const entry of entries || []) {
    const domainKey =
      normalizeDomainKeyOrSlug(entry?.domainKey, { allowUnknown: true }) || normalizeDomainKey(entry?.domainKey);
    if (!domainKey) continue;

    const seededRows = Array.isArray(entry?.seededRows) ? entry.seededRows : [];
    const reportRows = Array.isArray(entry?.reportRows) ? entry.reportRows : [];
    const helper = getIncidentDomainHelper(domainKey) || {};
    const aliasFieldNames = Array.from(new Set([
      "id",
      "incident_id",
      String(helper?.seededLookupField || "").trim(),
      String(helper?.normalizeSeededRecordExternalIdField || "").trim(),
      String(helper?.displayIdHintField || "").trim(),
      ...(Array.isArray(helper?.normalizeSeededRecordExternalDisplayFields)
        ? helper.normalizeSeededRecordExternalDisplayFields
        : []),
      ...(Array.isArray(helper?.seededMarkerExternalDisplaySourceFields)
        ? helper.seededMarkerExternalDisplaySourceFields
        : []),
    ].map((fieldName) => String(fieldName || "").trim()).filter(Boolean)));
    const seededById = new Map();
    for (const row of seededRows) {
      if (!row || typeof row !== "object") continue;
      const aliasValues = new Set();
      for (const fieldName of aliasFieldNames) {
        const rawValue = String(row?.[fieldName] || "").trim();
        if (!rawValue) continue;
        aliasValues.add(rawValue);
        const normalizedLookupValue = lookupIncidentIdForDomain(domainKey, rawValue);
        if (normalizedLookupValue) aliasValues.add(normalizedLookupValue);
      }
      const canonicalIncidentId = incidentDomainCanonicalIncidentId(domainKey, row);
      if (canonicalIncidentId) aliasValues.add(canonicalIncidentId);
      for (const aliasValue of aliasValues) {
        seededById.set(aliasValue, row);
      }
    }

    seededRowsByDomain.set(domainKey, seededRows);
    reportRowsByDomain.set(domainKey, reportRows);
    seededByIdByDomain.set(domainKey, seededById);
    if (seededRows.length > 0) seededDomainKeysWithRows.push(domainKey);
    if (reportRows.length > 0) reportDomainKeysWithRows.push(domainKey);
  }

  return {
    seededRowsByDomain,
    reportRowsByDomain,
    seededByIdByDomain,
    seededDomainKeysWithRows,
    reportDomainKeysWithRows,
  };
}

function buildConfiguredIncidentDomainRuntimeEntry(domainKeyRaw, context = {}) {
  const resolved = resolveIncidentDomainHelperEntry(domainKeyRaw);
  if (!resolved) return null;
  const helper = resolved.helper || {};
  const seededRecordsContextKey = String(helper?.seededRecordsContextKey || "").trim();
  const reportRowsContextKey = String(helper?.reportRowsContextKey || "").trim();
  const lastFixByIncidentMapContextKey = String(helper?.lastFixByIncidentMapContextKey || "").trim();
  const seededRowsSetterContextKey = String(helper?.seededRowsSetterContextKey || "").trim();
  const reportRowsSetterContextKey = String(helper?.reportRowsSetterContextKey || "").trim();
  const seededRowsByDomain = context?.seededRowsByDomain instanceof Map ? context.seededRowsByDomain : null;
  const reportRowsByDomain = context?.reportRowsByDomain instanceof Map ? context.reportRowsByDomain : null;
  const lastFixByIncidentMapByDomain = context?.lastFixByIncidentMapByDomain instanceof Map ? context.lastFixByIncidentMapByDomain : null;
  const setSeededRowsByDomain = context?.setSeededRowsByDomain instanceof Map ? context.setSeededRowsByDomain : null;
  const setReportRowsByDomain = context?.setReportRowsByDomain instanceof Map ? context.setReportRowsByDomain : null;
  const hasDomainMapBinding = Boolean(
    seededRowsByDomain?.has?.(resolved.domainKey)
    || reportRowsByDomain?.has?.(resolved.domainKey)
    || lastFixByIncidentMapByDomain?.has?.(resolved.domainKey)
    || setSeededRowsByDomain?.has?.(resolved.domainKey)
    || setReportRowsByDomain?.has?.(resolved.domainKey)
  );

  const seededRows = seededRowsByDomain?.has(resolved.domainKey)
    ? (Array.isArray(seededRowsByDomain.get(resolved.domainKey)) ? seededRowsByDomain.get(resolved.domainKey) : [])
    : seededRecordsContextKey
      ? (Array.isArray(context?.[seededRecordsContextKey]) ? context[seededRecordsContextKey] : [])
      : [];
  const reportRows = reportRowsByDomain?.has(resolved.domainKey)
    ? (Array.isArray(reportRowsByDomain.get(resolved.domainKey)) ? reportRowsByDomain.get(resolved.domainKey) : [])
    : reportRowsContextKey
      ? (Array.isArray(context?.[reportRowsContextKey]) ? context[reportRowsContextKey] : [])
      : [];
  const lastFixByIncidentMap = lastFixByIncidentMapByDomain?.has(resolved.domainKey)
    ? (lastFixByIncidentMapByDomain.get(resolved.domainKey) || {})
    : lastFixByIncidentMapContextKey
    ? (context?.[lastFixByIncidentMapContextKey] || {})
    : {};
  const setSeededRows = setSeededRowsByDomain?.has(resolved.domainKey)
    ? setSeededRowsByDomain.get(resolved.domainKey)
    : seededRowsSetterContextKey
      ? context?.[seededRowsSetterContextKey]
      : null;
  const setReportRows = setReportRowsByDomain?.has(resolved.domainKey)
    ? setReportRowsByDomain.get(resolved.domainKey)
    : reportRowsSetterContextKey
      ? context?.[reportRowsSetterContextKey]
      : null;

  if (
    !hasDomainMapBinding
    && !seededRecordsContextKey
    && !reportRowsContextKey
    && !lastFixByIncidentMapContextKey
    && !seededRowsSetterContextKey
    && !reportRowsSetterContextKey
  ) return null;
  return {
    domainKey: resolved.domainKey,
    seededRows,
    reportRows,
    lastFixByIncidentMap,
    setSeededRows,
    setReportRows,
  };
}

function buildConfiguredIncidentDomainRuntimeEntries(context = {}, domainKeysRaw = null) {
  const domainKeys = Array.isArray(domainKeysRaw)
    ? domainKeysRaw
    : domainKeysRaw instanceof Set
      ? Array.from(domainKeysRaw)
      : Object.keys(INCIDENT_DOMAIN_HELPERS);
  return domainKeys
    .map((domainKey) => buildConfiguredIncidentDomainRuntimeEntry(domainKey, context))
    .filter(Boolean);
}

function buildConfiguredIncidentDomainLastFixRuntimeContext(context = {}, domainKeysRaw = null) {
  const domainKeys = Array.isArray(domainKeysRaw)
    ? domainKeysRaw
    : domainKeysRaw instanceof Set
      ? Array.from(domainKeysRaw)
      : Object.keys(INCIDENT_DOMAIN_HELPERS);
  const lastFixByIncidentMapByDomain = new Map();
  for (const domainKey of domainKeys) {
    lastFixByIncidentMapByDomain.set(domainKey, incidentDomainBuildLastFixByIncidentMap(domainKey, context));
  }
  return { lastFixByIncidentMapByDomain };
}

function buildConfiguredIncidentLastFixCollections(entries = []) {
  const lastFixByDomain = new Map();

  for (const entry of entries || []) {
    const domainKey =
      normalizeDomainKeyOrSlug(entry?.domainKey, { allowUnknown: true }) || normalizeDomainKey(entry?.domainKey);
    if (!domainKey) continue;
    lastFixByDomain.set(domainKey, entry?.lastFixByIncidentMap || {});
  }

  return lastFixByDomain;
}


// Build "All Reports" timeline: reports + fix events
function isValidCoord(n) {
  const x = Number(n);
  return Number.isFinite(x);
}

function isValidLatLng(lat, lng) {
  return isValidCoord(lat) && isValidCoord(lng);
}

function lngInBounds(lng, west, east) {
  if (west <= east) return lng >= west && lng <= east;
  // antimeridian crossing
  return lng >= west || lng <= east;
}

function pointInBoundsWithPadding(lat, lng, bounds, padLat = 0, padLng = 0) {
  if (!bounds) return true;
  const north = Number(bounds.north) + padLat;
  const south = Number(bounds.south) - padLat;
  const west = Number(bounds.west) - padLng;
  const east = Number(bounds.east) + padLng;
  return lat >= south && lat <= north && lngInBounds(lng, west, east);
}

function normalizeOfficialLightRow(row) {
  if (!row || !row.id) return null;

  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!isValidLatLng(lat, lng)) return null;

  return {
    id: row.id,
    sl_id: row.sl_id || null,
    lat,
    lng,
    nearest_address: String(row?.nearest_address || "").trim() || "",
    nearest_cross_street: String(row?.nearest_cross_street || "").trim() || "",
    nearest_landmark: String(row?.nearest_landmark || "").trim() || "",
  };
}

function normalizeOfficialSignRow(row) {
  if (!row || !row.id) return null;

  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!isValidLatLng(lat, lng)) return null;

  return {
    id: String(row.id).trim(),
    sign_type: String(row.sign_type || "other").trim().toLowerCase() || "other",
    lat,
    lng,
    nearest_address: String(row?.nearest_address || "").trim() || "",
    nearest_cross_street: String(row?.nearest_cross_street || "").trim() || "",
    nearest_landmark: String(row?.nearest_landmark || "").trim() || "",
    active: row.active !== false,
  };
}




// ==================================================
// SECTION 8 — Main App
// ==================================================
export default function App({
  onBackToHub = null,
  initialReportView = "",
}) {
  const tenant = useContext(TenantContext);
  const mapRef = useRef(null);
  const desktopAccountMenuAnchorRef = useRef(null);
  const desktopAccountMenuPanelRef = useRef(null);
  const domainMenuAnchorRef = useRef(null);
  const domainMenuPanelRef = useRef(null);
  const flyAnimRef = useRef(null);
  const flyInfoTimerRef = useRef(null);
  const officialCanvasOverlayRef = useRef(null);
  const smoothedHeadingRef = useRef(null);
  const navigationHeadingRef = useRef(null);
  const lastFollowCameraRef = useRef({ lat: null, lng: null, heading: null });
  const followAnimatedCameraRef = useRef({ lat: null, lng: null, heading: null });
  const followTargetRef = useRef(null);
  const followRafRef = useRef(null);
  const followLastFrameAtRef = useRef(0);
  const lastFollowStateSyncRef = useRef(0);
  const liveMotionRef = useRef({ lat: null, lng: null, heading: null, speed: 0, ts: 0 });
  const wakeLockRef = useRef(null);
  const animatedUserLocRef = useRef({ lat: null, lng: null });
  const userLocTargetRef = useRef(null);
  const userLocRafRef = useRef(null);
  const stationaryAnchorRef = useRef(null);
  const stationaryReleaseStreakRef = useRef(0);
  const lastUserLocUiRef = useRef({ lat: null, lng: null, ts: 0 });
  const locationDiagnosticsLastStateAtRef = useRef(0);
  const boundaryCameraSignatureRef = useRef("");
  const pendingTenantHomeRecenterRef = useRef("");
  const reportDeepLinkHandledRef = useRef(false);
  const initialReportViewHandledRef = useRef(false);
  const initialReportDeepLinkRef = useRef(
    typeof window === "undefined" ? readReportDeepLinkRequest("") : readReportDeepLinkRequest(window.location.search || "")
  );
  const preserveReportFlyTargetCameraRef = useRef(Boolean(initialReportDeepLinkRef.current?.hasFlyTarget));
  const isMobile = useIsMobile(640);
  const useAppShellLayout = isMobile || isNativeAppRuntime();
  const useNativeAppBehavior = useAppShellLayout;
  const [backgroundWarmupPolicy, setBackgroundWarmupPolicy] = useState(() => resolveBackgroundWarmupPolicy());
  const [prefersDarkMode, setPrefersDarkMode] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [contactUsOpen, setContactUsOpen] = useState(false);
  const [headerOrganizationProfileWarmupReady, setHeaderOrganizationProfileWarmupReady] = useState(false);
  const [titleLogoError, setTitleLogoError] = useState(false);
  const [googleMapsAuthError, setGoogleMapsAuthError] = useState("");
  const suppressMapClickRef = useRef({ until: 0 });
  const clickDelayRef = useRef({ lastTs: 0, timer: null, lastLatLng: null });
  useEffect(() => {
    return () => {
      const ref = clickDelayRef.current;
      if (ref?.timer) {
        clearTimeout(ref.timer);
        ref.timer = null;
      }
    };
  }, []);
  const titleLogoSrc = prefersDarkMode ? TITLE_LOGO_DARK_SRC : TITLE_LOGO_SRC;
  const mobileTitleLogoSrc = prefersDarkMode ? MOBILE_TITLE_LOGO_DARK_SRC : MOBILE_TITLE_LOGO_SRC;
  const headerTenantKey = useMemo(() => String(tenant?.tenantKey || activeTenantKey() || "").trim(), [tenant?.tenantKey]);
  const { profile: headerOrganizationProfile, loaded: headerOrganizationProfileLoaded } = useHeaderOrganizationProfile(
    headerTenantKey,
    {
      enabled: contactUsOpen || headerOrganizationProfileWarmupReady,
      deferUntilIdle: !contactUsOpen,
      idleTimeoutMs: backgroundWarmupPolicy?.reducedWarmup === true ? 2800 : 1800,
      fallbackDelayMs: backgroundWarmupPolicy?.reducedWarmup === true ? 900 : 180,
    }
  );
  const organizationDisplayName = useMemo(
    () =>
      resolvePublicHeaderDisplayName({
        organizationProfile: headerOrganizationProfileLoaded ? headerOrganizationProfile : null,
        tenantConfig: tenant?.tenantConfig,
        tenantKey: headerTenantKey,
      }),
    [headerOrganizationProfile, headerOrganizationProfileLoaded, headerTenantKey, tenant?.tenantConfig]
  );
  const environmentGuardrailLabel = useMemo(() => {
    if (!isNativeAppRuntime() || tenant?.appScope !== "map") return "";

    const configuredLabel = String(
      import.meta.env.VITE_PUBLIC_APP_BUILD_LABEL ||
        import.meta.env.VITE_NATIVE_BUILD_LABEL ||
        import.meta.env.VITE_MOBILE_BUILD_LABEL ||
        ""
    ).trim();
    if (configuredLabel) return configuredLabel;

    const testSignals = [
      tenant?.tenantKey,
      tenant?.tenantConfig?.name,
      tenant?.tenantConfig?.primary_subdomain,
      organizationDisplayName,
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
      .join(" ");

    return /\b(test|testing|demo|staging|sandbox|sample|qa|dev)\b/.test(testSignals) ? "TEST CITY" : "";
  }, [organizationDisplayName, tenant?.appScope, tenant?.tenantConfig?.name, tenant?.tenantConfig?.primary_subdomain, tenant?.tenantKey]);
  const citySwitchAvailable =
    isNativeAppRuntime() &&
    tenant?.appScope === "map" &&
    Array.isArray(tenant?.availableTenants) &&
    tenant.availableTenants.length > 1;
  const useWideAppShellHeader = useAppShellLayout && !isMobile;
  const useWideIosTabletShell = useWideAppShellHeader && GMAPS_PLATFORM === "ios";
  const mobileBottomRailBaseHeight = useWideIosTabletShell ? 78 : 60;
  const mobileBottomRailHeight = `calc(env(safe-area-inset-bottom) + ${mobileBottomRailBaseHeight}px)`;
  const mobileBottomRailOffset = `calc(env(safe-area-inset-bottom) + ${mobileBottomRailBaseHeight + 18}px)`;
  const mobileReportsPageBottomInset = mobileBottomRailHeight;
  const mobileTabPageTopInset = useWideAppShellHeader
    ? `calc(var(--mobile-header-height) + env(safe-area-inset-top) + ${useWideIosTabletShell ? "14px" : "var(--mobile-header-overlay-wide-page-gap)"})`
    : "calc(var(--mobile-header-height) + env(safe-area-inset-top) + var(--mobile-header-overlay-page-gap))";
  const mobileHeaderContentTopInset = useWideAppShellHeader
    ? "calc(env(safe-area-inset-top) + var(--mobile-header-overlay-wide-top-content-inset))"
    : "calc(env(safe-area-inset-top) + var(--mobile-header-overlay-top-content-inset))";
  const mobileHeaderBottomInset = useWideAppShellHeader
    ? "var(--mobile-header-overlay-wide-bottom-inset)"
    : "var(--mobile-header-overlay-bottom-inset)";
  const mobileHeaderMinHeight = useWideAppShellHeader
    ? `calc(var(--mobile-header-height) + env(safe-area-inset-top) + ${useWideIosTabletShell ? "14px" : "var(--mobile-header-overlay-wide-min-height-extra)"})`
    : "calc(var(--mobile-header-height) + env(safe-area-inset-top) + var(--mobile-header-overlay-min-height-extra))";
  const mobileHeaderCopyMaxWidth = useWideAppShellHeader
    ? "min(560px, calc(100vw - 220px))"
    : "min(420px, calc(100vw - 132px))";
  const mobileHeaderCopyPadding = useWideAppShellHeader ? "0 12px" : "0 20px";
  const mobileHeaderCopyBottomPadding = useWideAppShellHeader
    ? 2
    : (GMAPS_PLATFORM === "ios" ? 2 : 6);
  const mobileHeaderCopyTranslateY = !useWideAppShellHeader && GMAPS_PLATFORM === "ios"
    ? -10
    : 0;
  const mobileHeaderTitleSize = useWideAppShellHeader ? "clamp(18px, 2vw, 24px)" : undefined;
  const mobileHeaderEyebrowSize = useWideAppShellHeader ? 9 : 10;
  const mobileHeaderGuardrailMarginTop = useWideAppShellHeader ? 0 : 2;
  const mobileHeaderGuardrailPadding = useWideAppShellHeader ? "2px 7px" : "3px 8px";
  const mobileHeaderGuardrailFontSize = useWideAppShellHeader ? 9 : 10;
  const mobileHeaderTitleMarginTop = useWideAppShellHeader && environmentGuardrailLabel ? -3 : 0;
  const mobileMapToolButtonStyle = useMemo(() => ({
    width: 40,
    height: 40,
    borderRadius: 13,
    border: "1px solid var(--sl-ui-tool-btn-border)",
    background: "var(--sl-ui-tool-btn-bg)",
    boxShadow: prefersDarkMode
      ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 22px rgba(0,0,0,0.34)"
      : "inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 22px rgba(17,39,64,0.20)",
    color: "var(--sl-ui-tool-btn-text)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  }), [prefersDarkMode]);
  const mobileMapLayerButtonStyle = useMemo(() => ({
    ...mobileMapToolButtonStyle,
    width: 40,
    height: 40,
    borderRadius: 13,
  }), [mobileMapToolButtonStyle]);
  const mapHeaderTheme = useMemo(
    () => ({
      eyebrowColor: "var(--sl-ui-header-eyebrow)",
      textColor: "var(--sl-ui-header-text)",
      desktopBackground: "var(--sl-ui-header-bg)",
      desktopBorder: "1px solid var(--sl-ui-header-border)",
      desktopMenuBorder: "1px solid var(--sl-ui-header-menu-border)",
      desktopMenuBackground: "var(--sl-ui-header-menu-bg)",
      desktopMenuShadow: "var(--sl-ui-header-menu-shadow)",
      mobileBackground: "var(--sl-ui-header-bg)",
      mobileBorder: "1px solid var(--sl-ui-header-border)",
      mobileMenuBorder: "1px solid var(--sl-ui-header-menu-border)",
      mobileMenuBackground: "var(--sl-ui-header-menu-bg)",
    }),
    []
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      setPrefersDarkMode(Boolean(e.matches));
      setTitleLogoError(false);
    };
    setPrefersDarkMode(Boolean(media.matches));
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const previousHandler = window.gm_authFailure;
    window.gm_authFailure = () => {
      const host = String(window.location.host || "").trim();
      setGoogleMapsAuthError(`Google Maps key is not authorized for ${host || "this host"}.`);
      if (typeof previousHandler === "function") {
        try {
          previousHandler();
        } catch {
          // no-op
        }
      }
    };
    return () => {
      if (typeof previousHandler === "function") {
        window.gm_authFailure = previousHandler;
      } else {
        try {
          delete window.gm_authFailure;
        } catch {
          // no-op
        }
      }
    };
  }, []);

  function cancelFlyAnimation() {
    if (flyAnimRef.current) {
      cancelAnimationFrame(flyAnimRef.current);
      flyAnimRef.current = null;
    }
  }

  function clearFlyInfoTimer() {
    if (flyInfoTimerRef.current) {
      clearTimeout(flyInfoTimerRef.current);
      flyInfoTimerRef.current = null;
    }
  }

  function updateUserLocUi(lat, lng, force = false) {
    const now = Date.now();
    const prev = lastUserLocUiRef.current;
    const next = { lat: Number(lat), lng: Number(lng) };
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;

    const movedMeters =
      Number.isFinite(prev?.lat) && Number.isFinite(prev?.lng)
        ? metersBetween({ lat: prev.lat, lng: prev.lng }, next)
        : Infinity;
    const elapsedMs = now - Number(prev?.ts || 0);

    // Keep the blue dot responsive, but avoid re-rendering on every noisy GPS tick.
    if (!force && movedMeters < 0.9 && elapsedMs < 120) return;

    lastUserLocUiRef.current = { lat: next.lat, lng: next.lng, ts: now };
    userLocTargetRef.current = next;

    if (force || !Number.isFinite(animatedUserLocRef.current?.lat) || !Number.isFinite(animatedUserLocRef.current?.lng)) {
      animatedUserLocRef.current = { lat: next.lat, lng: next.lng };
      setUserLoc([next.lat, next.lng]);
      if (userLocRafRef.current) {
        cancelAnimationFrame(userLocRafRef.current);
        userLocRafRef.current = null;
      }
      return;
    }

    if (userLocRafRef.current) return;

    const animate = () => {
      const target = userLocTargetRef.current;
      const current = animatedUserLocRef.current;
      if (!target || !Number.isFinite(current?.lat) || !Number.isFinite(current?.lng)) {
        userLocRafRef.current = null;
        return;
      }

      const remainingMeters = metersBetween(current, target);
      if (remainingMeters <= 0.6) {
        animatedUserLocRef.current = { lat: target.lat, lng: target.lng };
        setUserLoc([target.lat, target.lng]);
        userLocRafRef.current = null;
        return;
      }

      const alpha =
        remainingMeters >= 18 ? 0.34 :
        remainingMeters >= 8 ? 0.28 :
        remainingMeters >= 3 ? 0.22 :
        0.16;
      const nextLat = current.lat + (target.lat - current.lat) * alpha;
      const nextLng = current.lng + (target.lng - current.lng) * alpha;
      animatedUserLocRef.current = { lat: nextLat, lng: nextLng };
      setUserLoc([nextLat, nextLng]);
      userLocRafRef.current = requestAnimationFrame(animate);
    };

    userLocRafRef.current = requestAnimationFrame(animate);
  }

  function stopFollowCameraAnimation() {
    if (followRafRef.current) {
      cancelAnimationFrame(followRafRef.current);
      followRafRef.current = null;
    }
    followLastFrameAtRef.current = 0;
    followTargetRef.current = null;
    followAnimatedCameraRef.current = { lat: null, lng: null, heading: null };
  }

  function requestCurrentPositionReliable({
    enableHighAccuracy = true,
    timeout = 12000,
    maximumAge = 0,
  } = {}) {
    return loadDeferredGeoSupportModule().then(
      ({ requestCurrentPositionReliableRuntimeShared }) =>
        requestCurrentPositionReliableRuntimeShared(
          {
            enableHighAccuracy,
            timeout,
            maximumAge,
          },
          {
            isNativeAppRuntime,
            loadCapacitorGeolocationModule,
            navigatorLike: navigator,
            setTimeoutImpl: window.setTimeout.bind(window),
            clearTimeoutImpl: window.clearTimeout.bind(window),
          }
        )
    );
  }

  // Suppress popups
  const [popupsSuppressed, setPopupsSuppressed] = useState(false);
  const popupSuppressTimerRef = useRef(null);

  function getInitials(nameOrEmail = "") {
    if (!nameOrEmail) return "";

    // If email, use prefix
    const base = nameOrEmail.includes("@")
      ? nameOrEmail.split("@")[0]
      : nameOrEmail;

    const parts = base
      .replace(/[^a-zA-Z\s]/g, " ")
      .trim()
      .split(/\s+/);

    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function suppressPopups(ms = 1200) {
    setPopupsSuppressed(true);

    if (popupSuppressTimerRef.current) {
      clearTimeout(popupSuppressTimerRef.current);
      popupSuppressTimerRef.current = null;
    }

    popupSuppressTimerRef.current = setTimeout(() => {
      setPopupsSuppressed(false);
      popupSuppressTimerRef.current = null;
    }, ms);
  }
  
  useEffect(() => {
    return () => {
      if (popupSuppressTimerRef.current) {
        clearTimeout(popupSuppressTimerRef.current);
      }
    };
  }, []);

  // OFFICIAL LIGHTS (admin-only)
  const [officialLights, setOfficialLights] = useState([]); // rows: {id, lat, lng}
  const [configuredIncidentSeededRowsStateByDomain, setConfiguredIncidentSeededRowsStateByDomain] = useState({});
  const [configuredIncidentReportRowsStateByDomain, setConfiguredIncidentReportRowsStateByDomain] = useState({});
  const [configuredIncidentLoadedDomainKeys, setConfiguredIncidentLoadedDomainKeys] = useState([]);
  const [configuredIncidentPersistedStateLoadedDomainKeys, setConfiguredIncidentPersistedStateLoadedDomainKeys] = useState([]);
  const configuredIncidentLoadingDomainKeysRef = useRef(new Set());
  const configuredIncidentPersistedStateLoadingDomainKeysRef = useRef(new Set());
  const cachedConfiguredIncidentSeededRowsByDomainRef = useRef({});
  const cachedConfiguredIncidentReportRowsByDomainRef = useRef({});
  const cachedPersistedIncidentRecordStateByDomainRef = useRef({});
  const [cityBoundaryGeojson, setCityBoundaryGeojson] = useState(null);
  const [incidentStateByKey, setIncidentStateByKey] = useState({});
  const [tenantDomainPublicConfigByDomain, setTenantDomainPublicConfigByDomain] = useState({});
  const [tenantRegistryIncidentDomains, setTenantRegistryIncidentDomains] = useState([]);
  const [tenantParks, setTenantParks] = useState([]);
  const [tenantParksLoaded, setTenantParksLoaded] = useState(false);
  const tenantParksLoadPromiseRef = useRef(null);
  const [domainIconRenderTick, setDomainIconRenderTick] = useState(0);
  const [mapUiThemeRenderTick, setMapUiThemeRenderTick] = useState(0);
  const preloadedDomainIconUrlsRef = useRef(new Set());
  const [incidentRepairProgressByKey, setIncidentRepairProgressByKey] = useState({});
  const [incidentRepairProgressReadyContextKey, setIncidentRepairProgressReadyContextKey] = useState("");
  const [incidentRepairProgressAttemptedContextKey, setIncidentRepairProgressAttemptedContextKey] = useState("");
  const [persistedIncidentRepairConfirmedKeySet, setPersistedIncidentRepairConfirmedKeySet] = useState(
    () => new Set(),
  );
  const [persistedIncidentRecordStateByDomain, setPersistedIncidentRecordStateByDomain] = useState({});
  // Google Maps InfoWindow selection
  const [selectedOfficialId, setSelectedOfficialId] = useState(null);
  const [selectedQueuedTempId, setSelectedQueuedTempId] = useState(null);
  const [selectedIncidentStackMarker, setSelectedIncidentStackMarker] = useState(null);
  // Bulk select toggle for official lights
  const toggleBulkSelect = useCallback((lightId) => {
    setBulkSelectedIds((prev) => {
      const has = prev.includes(lightId);
      if (!has && Number(mapZoomRef.current) < 17) {
        openConfiguredNotice("zoom_to_select", {
          icon: "🔎",
          title: "Zoom in to select",
          message: "To improve accuracy of bulk selection, zoom in further before selecting lights.",
        });
        return prev;
      }
      if (!has && prev.length >= BULK_MAX_LIGHTS_PER_SUBMIT) {
        openNotice("⚠️", "Selection limit", `You can select up to ${BULK_MAX_LIGHTS_PER_SUBMIT} lights per bulk report.`);
        return prev;
      }
      return has ? prev.filter((x) => x !== lightId) : [...prev, lightId];
    });
  }, []);
  // Google Maps map instance (optional, but your onLoad uses it)
  const [gmapsRef, setGmapsRef] = useState(null);

  const [mappingMode, setMappingMode] = useState(false);
  // Map type (Google Maps)
  const [mapType, setMapType] = useState("roadmap"); // "roadmap" | "satellite"
  const [mapZoom, setMapZoom] = useState(INITIAL_OVERVIEW_ZOOM);
  const mapZoomRef = useRef(INITIAL_OVERVIEW_ZOOM);
  const lastZoomGestureAtRef = useRef(0);
  const dragFollowOffTimerRef = useRef(null);
  const [mapInteracting, setMapInteracting] = useState(false);
  const mapInteractIdleTimerRef = useRef(null);
  const userDragPanRef = useRef(false);
  const [nonCriticalStartupReady, setNonCriticalStartupReady] = useState(false);
  const [mapTilesReady, setMapTilesReady] = useState(false);
  const backgroundWarmupAllowed = backgroundWarmupPolicy?.allowWarmup !== false;
  const backgroundWarmupReduced = backgroundWarmupPolicy?.reducedWarmup === true;
  const startupWarmupReady = backgroundWarmupAllowed && nonCriticalStartupReady && mapTilesReady;
  const [selectionPopupWarmupReady, setSelectionPopupWarmupReady] = useState(false);
  const [primaryReportFlowWarmupReady, setPrimaryReportFlowWarmupReady] = useState(false);
  const [accountAccessWarmupReady, setAccountAccessWarmupReady] = useState(false);
  const [residentFeedBadgeWarmupReady, setResidentFeedBadgeWarmupReady] = useState(false);
  const [deferredRealtimeReady, setDeferredRealtimeReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mapDataReloadToken, setMapDataReloadToken] = useState(0);
  const [resumeRefreshActive, setResumeRefreshActive] = useState(false);

  // Google Maps center (actual camera center)
  const [mapCenter, setMapCenter] = useState({ lat: USA_OVERVIEW[0], lng: USA_OVERVIEW[1] });
  const [mapBounds, setMapBounds] = useState(null);

  const loadPublishedMapUiBundle = useCallback(async ({ preferCacheOnError = true } = {}) => {
    const {
      loadPublishedMapUiBundleRuntimeShared,
      readCachedRuntimeUiIconManifestShared,
      writeCachedRuntimeUiIconManifestShared,
      clearCachedRuntimeUiIconManifestShared,
    } = await loadDeferredRuntimeUiBundleSupportModule();
    await loadPublishedMapUiBundleRuntimeShared({
      supabase,
      preferCacheOnError,
      iconConfigKey: MAP_UI_ICON_PUBLISHED_CONFIG_KEY,
      themeConfigKey: MAP_UI_THEME_PUBLISHED_CONFIG_KEY,
      readCachedRuntimeUiIconManifest: readCachedRuntimeUiIconManifestShared,
      writeCachedRuntimeUiIconManifest: writeCachedRuntimeUiIconManifestShared,
      clearCachedRuntimeUiIconManifest: clearCachedRuntimeUiIconManifestShared,
      setRuntimeUiIconManifest,
      setDomainIconRenderTick,
      setMapUiThemeRenderTick,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let dispose = () => {};
    let idleHandle = null;
    let timeoutHandle = null;
    if (loading) {
      return () => {
        cancelled = true;
      };
    }
    if (!startupWarmupReady || mapInteracting) {
      return () => {
        cancelled = true;
      };
    }
    const reducedWarmup = backgroundWarmupPolicy?.reducedWarmup === true;
    const idleTimeoutMs = hasCachedRuntimeUiIconManifest
      ? (reducedWarmup ? 1800 : 1000)
      : (reducedWarmup ? 5000 : 3200);
    const fallbackDelayMs = hasCachedRuntimeUiIconManifest
      ? (reducedWarmup ? 520 : 220)
      : (reducedWarmup ? 1600 : 900);

    const runLoad = async () => {
      if (cancelled) return;
      await loadPublishedMapUiBundle({ preferCacheOnError: true });
    };

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(() => {
        idleHandle = null;
        void runLoad();
      }, { timeout: idleTimeoutMs });
    } else if (typeof window !== "undefined") {
      timeoutHandle = window.setTimeout(() => {
        timeoutHandle = null;
        void runLoad();
      }, fallbackDelayMs);
    } else {
      void runLoad();
    }

    return () => {
      cancelled = true;
      if (idleHandle != null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null && typeof window !== "undefined") {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [backgroundWarmupPolicy, hasCachedRuntimeUiIconManifest, loadPublishedMapUiBundle, loading, mapInteracting, startupWarmupReady]);

  useEffect(() => {
    if (typeof navigator === "undefined") return undefined;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const syncWarmupPolicy = () => {
      setBackgroundWarmupPolicy(resolveBackgroundWarmupPolicy());
    };
    syncWarmupPolicy();
    if (!connection || typeof connection.addEventListener !== "function") return undefined;
    connection.addEventListener("change", syncWarmupPolicy);
    return () => {
      connection.removeEventListener?.("change", syncWarmupPolicy);
    };
  }, []);

  const builtInReportDomainOptions = useMemo(
    () => REPORT_DOMAIN_OPTIONS.map((option) => ({
      ...option,
      iconSrc: resolveRuntimeDomainIconSrc(option.key, option.iconSrc, option.key),
    })),
    [domainIconRenderTick]
  );
  const runtimeUiTheme = useMemo(() => {
    UI_ICON_THEME = mergeMapUiTheme(UI_ICON_THEME_SOURCE);
    return UI_ICON_THEME;
  }, [domainIconRenderTick, mapUiThemeRenderTick]);
  UI_ICON_THEME = runtimeUiTheme;

  useLayoutEffect(() => {
    if (typeof document === "undefined") return undefined;
    const rootStyle = document.documentElement?.style;
    if (!rootStyle) return undefined;
    const nextVariables = buildRuntimeMapUiCssVariables(runtimeUiTheme, prefersDarkMode);
    for (const [key, value] of Object.entries(nextVariables)) {
      rootStyle.setProperty(key, String(value));
    }
    return undefined;
  }, [prefersDarkMode, runtimeUiTheme]);

  useEffect(() => {
    if (loading || !startupWarmupReady) return undefined;
    if (typeof window === "undefined") return undefined;
    let timerId = null;
    let pollId = null;
    const scheduleRefresh = () => {
      const now = Date.now();
      const nextBoundary = listMapUiThemeBoundaryTimestamps(UI_ICON_THEME_SOURCE)
        .find((value) => value > now);
      if (!Number.isFinite(nextBoundary)) return;
      const delay = Math.min(Math.max(nextBoundary - now + 250, 250), 2147483647);
      timerId = window.setTimeout(() => {
        UI_ICON_THEME = mergeMapUiTheme(UI_ICON_THEME_SOURCE);
        setMapUiThemeRenderTick((tick) => tick + 1);
        scheduleRefresh();
      }, delay);
    };
    const softRefresh = () => {
      UI_ICON_THEME = mergeMapUiTheme(UI_ICON_THEME_SOURCE);
      setMapUiThemeRenderTick((tick) => tick + 1);
    };
    const syncOnVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void loadPublishedMapUiBundle({ preferCacheOnError: true });
    };
    scheduleRefresh();
    pollId = window.setInterval(() => {
      softRefresh();
    }, 15000);
    window.addEventListener("focus", syncOnVisibility);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", syncOnVisibility);
    }
    return () => {
      if (timerId != null) window.clearTimeout(timerId);
      if (pollId != null) window.clearInterval(pollId);
      window.removeEventListener("focus", syncOnVisibility);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", syncOnVisibility);
      }
    };
  }, [domainIconRenderTick, loadPublishedMapUiBundle, loading, startupWarmupReady]);

  const [reports, setReports] = useState([]);
  const [sharedIncidentReportRowsStateByDomain, setSharedIncidentReportRowsStateByDomain] = useState({});
  const [sharedIncidentBaseMarkersStateByDomain, setSharedIncidentBaseMarkersStateByDomain] = useState({});
  const [sharedIncidentSpecializedMarkersByDomain, setSharedIncidentSpecializedMarkersByDomain] = useState({});
  const hasRenderableMapRuntimeDataRef = useRef(false);
  hasRenderableMapRuntimeDataRef.current = hasRenderableMapRuntimeDataShared({
    reports,
    officialLights,
    sharedIncidentMarkersByDomain: sharedIncidentBaseMarkersStateByDomain,
    configuredIncidentSeededRowsByDomain: configuredIncidentSeededRowsStateByDomain,
    configuredIncidentReportRowsByDomain: configuredIncidentReportRowsStateByDomain,
  });
  const [incidentDomainMarkerRuntimeHelpers, setIncidentDomainMarkerRuntimeHelpers] = useState(null);
  const [streetlightOutageTsByLightId, setStreetlightOutageTsByLightId] = useState({});
  const [picked, setPicked] = useState(null);

  const [reportType, setReportType] = useState("out");
  const [note, setNote] = useState("");
  const [streetlightAreaPowerOn, setStreetlightAreaPowerOn] = useState("");
  const [streetlightHazardYesNo, setStreetlightHazardYesNo] = useState("");

  // fixedLights: { [light_id]: fixed_at_ms }
  const [fixedLights, setFixedLights] = useState({});
  const [lastFixByLightId, setLastFixByLightId] = useState({});
  const [actionsByLightId, setActionsByLightId] = useState({});
  const [utilityReportedLightIdSet, setUtilityReportedLightIdSet] = useState(() => new Set());
  const [utilityReportedAtByLightId, setUtilityReportedAtByLightId] = useState({});
  const [utilityReportReferenceByLightId, setUtilityReportReferenceByLightId] = useState({});
  const [utilitySignalCountsByLightId, setUtilitySignalCountsByLightId] = useState({});

  // activeLight: object for modal context
  const [activeLight, setActiveLight] = useState(null);
  const [domainReportTarget, setDomainReportTarget] = useState(null); // { domain, lat, lng, lightId, locationLabel }
  const [domainDisclosureGateTarget, setDomainDisclosureGateTarget] = useState(null);
  const confirmReportTarget = null;
  const [domainReportNote, setDomainReportNote] = useState("");
  const [domainReportImageFile, setDomainReportImageFile] = useState(null);
  const [domainReportImagePreviewUrl, setDomainReportImagePreviewUrl] = useState("");
  const [markFixedImageFile, setMarkFixedImageFile] = useState(null);
  const [markFixedImagePreviewUrl, setMarkFixedImagePreviewUrl] = useState("");
  const [markFixedSubmitting, setMarkFixedSubmitting] = useState(false);
  const [domainReportIssue, setDomainReportIssue] = useState("");
  const [domainReportTypeSelections, setDomainReportTypeSelections] = useState({});
  const [domainDisclosureAcknowledgements, setDomainDisclosureAcknowledgements] = useState({});
  const [incidentLocationCacheByKey, setIncidentLocationCacheByKey] = useState({});
  const currentTenantLocationCacheKey = String(activeTenantKey() || "").trim().toLowerCase();
  const setConfiguredIncidentSeededRowsForDomain = useCallback((domainKeyRaw, nextRowsOrUpdater) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
    if (!domainKey) return;
    setConfiguredIncidentSeededRowsStateByDomain((prev) => {
      const prevRows = Array.isArray(prev?.[domainKey]) ? prev[domainKey] : [];
      const resolvedRows = typeof nextRowsOrUpdater === "function"
        ? nextRowsOrUpdater(prevRows)
        : nextRowsOrUpdater;
      return {
        ...(prev || {}),
        [domainKey]: Array.isArray(resolvedRows) ? resolvedRows : [],
      };
    });
  }, []);
  const setConfiguredIncidentReportRowsForDomain = useCallback((domainKeyRaw, nextRowsOrUpdater) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
    if (!domainKey) return;
    setConfiguredIncidentReportRowsStateByDomain((prev) => {
      const prevRows = Array.isArray(prev?.[domainKey]) ? prev[domainKey] : [];
      const resolvedRows = typeof nextRowsOrUpdater === "function"
        ? nextRowsOrUpdater(prevRows)
        : nextRowsOrUpdater;
      return {
        ...(prev || {}),
        [domainKey]: Array.isArray(resolvedRows) ? resolvedRows : [],
      };
    });
  }, []);
  const loadDeferredIncidentDomainSubmitHelpers = useCallback(async () => {
    return createDeferredIncidentDomainSubmitHelpersRuntime({
      firstConfiguredFieldValue,
      getIncidentDomainHelper,
      incidentDomainBuildCoordsDisplayId,
      incidentDomainResolveLookupValueByMode,
      isUuidLike: (value) => UUID_LIKE_RE.test(String(value || "").trim()),
      lookupIncidentIdForDomain,
      nearestDomainMarkerForPoint,
      normalizeDomainKeyOrSlug,
      readIncidentDomainHelperBoolean,
      readIncidentDomainHelperString,
      resolveIncidentDomainHelperEntry,
    });
  }, [
    getIncidentDomainHelper,
    incidentDomainBuildCoordsDisplayId,
    incidentDomainResolveLookupValueByMode,
    lookupIncidentIdForDomain,
    nearestDomainMarkerForPoint,
    readIncidentDomainHelperBoolean,
    readIncidentDomainHelperString,
    resolveIncidentDomainHelperEntry,
  ]);
  const loadDeferredConfiguredIncidentStateRuntimeHelpers = useCallback(async () => {
    return createDeferredConfiguredIncidentStateRuntimeHelpersRuntime({
      INCIDENT_DOMAIN_HELPERS,
      getIncidentDomainHelper,
      isValidLatLng,
      normalizeDomainKeyOrSlug,
      readIncidentDomainConfiguredCollectionHelperString,
      readIncidentDomainHelperString,
      resolveIncidentDomainHelperEntry,
    });
  }, [
    getIncidentDomainHelper,
    isValidLatLng,
    readIncidentDomainConfiguredCollectionHelperString,
    readIncidentDomainHelperString,
    resolveIncidentDomainHelperEntry,
  ]);
  const loadDeferredIncidentDomainMarkerRuntimeHelpers = useCallback(async () => {
    return createDeferredIncidentDomainMarkerHelpersRuntime({
      firstConfiguredFieldValue,
      getIncidentDomainHelper,
      groupIntoLights,
      incidentDomainBuildCoordsDisplayId,
      incidentDomainCanonicalIncidentId,
      isUuidLike: (value) => UUID_LIKE_RE.test(String(value || "").trim()),
      isValidLatLng,
      lightIdFor,
      lookupIncidentIdForDomain,
      normalizeDomainKeyOrSlug,
      normalizeIncidentDrivenLookupId,
      resolveIncidentDomainHelperEntry,
    });
  }, [
    getIncidentDomainHelper,
    incidentDomainBuildCoordsDisplayId,
    incidentDomainCanonicalIncidentId,
    isValidLatLng,
    lookupIncidentIdForDomain,
    normalizeIncidentDrivenLookupId,
    resolveIncidentDomainHelperEntry,
  ]);
  useEffect(() => {
    let cancelled = false;
    void loadIncidentLocationCacheSupportModule().then(({ readPersistedIncidentLocationCache }) => {
      if (cancelled) return;
      setIncidentLocationCacheByKey(readPersistedIncidentLocationCache(currentTenantLocationCacheKey));
    });
    return () => {
      cancelled = true;
    };
  }, [currentTenantLocationCacheKey]);

  useEffect(() => {
    void loadIncidentLocationCacheSupportModule().then(({ writePersistedIncidentLocationCache }) => {
      writePersistedIncidentLocationCache(currentTenantLocationCacheKey, incidentLocationCacheByKey);
    });
  }, [currentTenantLocationCacheKey, incidentLocationCacheByKey]);

  const remoteIncidentLocationCacheHydrationKeyRef = useRef("");

  const persistIncidentLocationCacheWithEnrichment = useCallback(
    async (domainKeyRaw, incidentIdRaw, options = {}) => {
      const [
        { persistIncidentLocationCacheWithEnrichmentRuntimeShared },
        {
          incidentDomainApplyPersistedLocationCacheState,
          incidentDomainNormalizePersistenceIncidentId,
        },
      ] = await Promise.all([
        loadDeferredIncidentLocationRuntimeModule(),
        loadDeferredIncidentDomainSubmitHelpers(),
      ]);
      return persistIncidentLocationCacheWithEnrichmentRuntimeShared(
        domainKeyRaw,
        incidentIdRaw,
        options,
        {
          normalizeDomainKeyOrSlug,
          normalizeDomainKey,
          incidentDomainNormalizePersistenceIncidentId,
          buildConfiguredIncidentDomainRuntimeEntry,
          incidentDomainHelperKeysForConfiguredField,
          setConfiguredIncidentSeededRowsForDomain,
          setConfiguredIncidentReportRowsForDomain,
          setIncidentLocationCacheByKey,
          setOfficialLights,
          incidentDomainApplyPersistedLocationCacheState,
          setPersistedIncidentRecordStateByDomain,
          supabase,
          activeTenantKey,
          reverseGeocodeRoadLabel,
        }
      );
    },
    [
      loadDeferredIncidentDomainSubmitHelpers,
      setConfiguredIncidentSeededRowsForDomain,
      setConfiguredIncidentReportRowsForDomain,
      reverseGeocodeRoadLabel,
    ]
  );

  const persistIncidentLocationCacheEntry = useCallback(
    async (domainKeyRaw, incidentIdRaw, nextValues = {}, extra = {}) => {
      const [
        { persistIncidentLocationCacheEntryRuntimeShared },
        {
          incidentDomainApplyPersistedLocationCacheState,
          incidentDomainNormalizePersistenceIncidentId,
        },
      ] = await Promise.all([
        loadDeferredIncidentLocationRuntimeModule(),
        loadDeferredIncidentDomainSubmitHelpers(),
      ]);
      return persistIncidentLocationCacheEntryRuntimeShared(
        domainKeyRaw,
        incidentIdRaw,
        nextValues,
        extra,
        {
          normalizeDomainKeyOrSlug,
          normalizeDomainKey,
          incidentDomainNormalizePersistenceIncidentId,
          buildConfiguredIncidentDomainRuntimeEntry,
          incidentDomainHelperKeysForConfiguredField,
          setConfiguredIncidentSeededRowsForDomain,
          setConfiguredIncidentReportRowsForDomain,
          setIncidentLocationCacheByKey,
          setOfficialLights,
          incidentDomainApplyPersistedLocationCacheState,
          setPersistedIncidentRecordStateByDomain,
          supabase,
          activeTenantKey,
        }
      );
    },
    [
      loadDeferredIncidentDomainSubmitHelpers,
      setConfiguredIncidentSeededRowsForDomain,
      setConfiguredIncidentReportRowsForDomain,
    ]
  );

  useEffect(() => {
    if (!domainReportImageFile) {
      setDomainReportImagePreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(domainReportImageFile);
    setDomainReportImagePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [domainReportImageFile]);

  useEffect(() => {
    if (!markFixedImageFile) {
      setMarkFixedImagePreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(markFixedImageFile);
    setMarkFixedImagePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [markFixedImageFile]);

  // Notice modal state
  const [notice, setNotice] = useState({ open: false, icon: "", iconKey: "", title: "", message: "", compact: false });
  const [reportSuccess, setReportSuccess] = useState({
    open: false,
    kind: "incident",
    domainKey: "",
    title: "",
    message: "",
    reportNumbers: [],
    submittedAt: 0,
  });
  const noticeTimerRef = useRef(null);
  const dbConnectionStartedAtRef = useRef(Date.now());
  const dbConnectionNoticeAtRef = useRef(0);
  const dbConnectionFailureStreakRef = useRef(0);
  const dbConnectionResumeAtRef = useRef(Date.now());
  const mobileIncidentMenuTouchActionAtRef = useRef(0);
  const appHiddenAtRef = useRef(0);
  const placesLookupBlockedUntilRef = useRef(0);
  const placesBlockedNoticeShownRef = useRef(false);
  const placesLibraryLoadPromiseRef = useRef(null);
  const geocoderLookupBlockedUntilRef = useRef(0);
  const geocoderBlockedNoticeShownRef = useRef(false);
  const reverseGeocodeInFlightRef = useRef(new Map());
  const [toolHintText, setToolHintText] = useState("");
  const [toolHintIndex, setToolHintIndex] = useState(null);
  const toolHintTimerRef = useRef(null);

  function openNotice(icon, title, message, opts = {}) {
    const { autoCloseMs = 0, compact = false, iconKey = "" } = opts;
    const rawTitle = String(title ?? "").trim();
    const rawMessage = String(message ?? "").trim();
    const rawIcon = String(icon ?? "");
    const safeIconKey = String(iconKey || "").trim();
    let safeTitle = rawTitle;
    let safeMessage = rawMessage;
    if (!safeTitle && !safeMessage) {
      if (rawIcon.includes("⚠️")) {
        safeTitle = "Notice";
        safeMessage = "Something needs attention.";
      } else if (rawIcon.includes("ℹ️")) {
        safeTitle = "Notice";
        safeMessage = "More information is available.";
      } else if (safeIconKey) {
        safeTitle = "Notice";
      }
    }
    const safeCompact = compact && !rawIcon.includes("⚠️");

    // clear any prior timer
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }

    setNotice({ open: true, icon: rawIcon, iconKey: safeIconKey, title: safeTitle, message: safeMessage, compact: safeCompact });

    if (autoCloseMs > 0) {
      noticeTimerRef.current = setTimeout(() => {
        setNotice((p) => ({ ...p, open: false }));
        noticeTimerRef.current = null;
      }, autoCloseMs);
    }
  }

  function closeNotice() {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    setNotice((p) => ({ ...p, open: false }));
  }

  function openConfiguredNotice(noticeKey, fallback = {}, opts = {}) {
    const key = String(noticeKey || "").trim();
    const configured = key ? (UI_NOTICE_META?.[key] || {}) : {};
    const fallbackIcon = String(fallback?.icon || "").trim();
    const fallbackTitle = String(fallback?.title || "").trim();
    const fallbackMessage = String(fallback?.message || "").trim();
    const resolvedIconKey = String(opts?.iconKey || configured?.icon_key || fallback?.iconKey || "").trim();
    const resolvedTitle = String(opts?.title ?? configured?.title ?? fallbackTitle).trim();
    const resolvedMessage = String(opts?.message ?? configured?.message ?? fallbackMessage).trim();
    openNotice(fallbackIcon, resolvedTitle, resolvedMessage, {
      ...opts,
      iconKey: resolvedIconKey,
    });
  }

  function openReportSuccess(opts = {}) {
    setReportSuccess({
      open: true,
      kind: String(opts?.kind || "incident").trim() === "streetlight" ? "streetlight" : "incident",
      domainKey: String(opts?.domainKey || "").trim(),
      title: String(opts?.title || "Report saved").trim() || "Report saved",
      message: String(opts?.message || "").trim(),
      reportNumbers: Array.isArray(opts?.reportNumbers)
        ? opts.reportNumbers.map((value) => String(value || "").trim()).filter(Boolean)
        : String(opts?.reportNumber || "").trim()
          ? [String(opts.reportNumber).trim()]
          : [],
      submittedAt: Number(opts?.submittedAt || 0),
    });
  }

  function closeReportSuccess() {
    setReportSuccess((prev) => ({ ...prev, open: false }));
  }

  const showToolHint = useCallback((text, ms = 1100, index = null) => {
    const msg = String(text || "").trim();
    if (!msg) return;
    if (toolHintTimerRef.current) {
      clearTimeout(toolHintTimerRef.current);
      toolHintTimerRef.current = null;
    }
    setToolHintText(msg);
    setToolHintIndex(Number.isFinite(index) ? index : null);
    toolHintTimerRef.current = setTimeout(() => {
      setToolHintText("");
      setToolHintIndex(null);
      toolHintTimerRef.current = null;
    }, ms);
  }, []);

  const runMobileIncidentMenuAction = useCallback((event, action) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const ref = clickDelayRef.current;
    if (ref?.timer) {
      clearTimeout(ref.timer);
      ref.timer = null;
    }
    if (ref) ref.lastLatLng = null;
    suppressMapClickRef.current.until = Date.now() + 1100;
    mobileIncidentMenuTouchActionAtRef.current = Date.now();
    action?.();
  }, []);

  const shouldIgnoreMobileIncidentMenuClick = useCallback(
    () => Date.now() - Number(mobileIncidentMenuTouchActionAtRef.current || 0) < 450,
    []
  );

  function isConnectionLikeDbError(errOrStatus) {
    if (!errOrStatus) return false;

    // Realtime channel status strings
    if (typeof errOrStatus === "string") {
      const s = errOrStatus.toUpperCase();
      return s === "CHANNEL_ERROR" || s === "TIMED_OUT";
    }

    const statusNum = Number(errOrStatus?.status);
    const rawCode = String(errOrStatus?.code || "").toUpperCase();
    const msg = String(errOrStatus?.message || "").toLowerCase();
    const details = String(errOrStatus?.details || "").toLowerCase();
    const hint = String(errOrStatus?.hint || "").toLowerCase();
    const combined = `${msg} ${details} ${hint}`;

    // auth/permission/policy errors are not connectivity outages
    if (statusNum === 401 || statusNum === 403) return false;
    if (rawCode === "42501" || rawCode === "PGRST301" || rawCode === "PGRST116") return false;
    if (
      combined.includes("permission denied") ||
      combined.includes("row-level security") ||
      combined.includes("jwt") ||
      combined.includes("unauthorized") ||
      combined.includes("forbidden")
    ) return false;

    // likely connectivity/server failures
    if (Number.isFinite(statusNum) && statusNum >= 500) return true;
    if (
      combined.includes("failed to fetch") ||
      combined.includes("network") ||
      combined.includes("timeout") ||
      combined.includes("timed out") ||
      combined.includes("connection") ||
      combined.includes("unavailable")
    ) return true;

    return false;
  }

  function notifyDbConnectionIssue(errOrStatus) {
    if (!isConnectionLikeDbError(errOrStatus)) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    const now = Date.now();
    if (now - dbConnectionStartedAtRef.current < 6000) return; // startup grace period
    if (now - dbConnectionResumeAtRef.current < 5000) return; // tab/app return grace period
    dbConnectionFailureStreakRef.current += 1;
    if (dbConnectionFailureStreakRef.current < 2) return; // require 2 consecutive failures
    if (now - dbConnectionNoticeAtRef.current < 15000) return; // avoid notice spam
    dbConnectionNoticeAtRef.current = now;
    dbConnectionFailureStreakRef.current = 0;
    openConfiguredNotice("connection_issue", {
      icon: "⚠️",
      title: "Connection issue",
      message: "Some map/report data may be unavailable temporarily.",
    });
  }

  function resetDbConnectionIssueStreak() {
    dbConnectionFailureStreakRef.current = 0;
  }

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;
    const markResume = () => {
      const hiddenForMs = appHiddenAtRef.current ? Date.now() - appHiddenAtRef.current : 0;
      dbConnectionResumeAtRef.current = Date.now();
      resetDbConnectionIssueStreak();
      if (hiddenForMs >= 15000) {
        setResumeRefreshActive(true);
        setMapDataReloadToken((value) => value + 1);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        appHiddenAtRef.current = Date.now();
        return;
      }
      if (document.visibilityState === "visible") markResume();
    };
    window.addEventListener("online", markResume);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("online", markResume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!loading && resumeRefreshActive) {
      setResumeRefreshActive(false);
    }
  }, [loading, resumeRefreshActive]);
  useEffect(() => {
    if (loading) {
      setNonCriticalStartupReady(false);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setNonCriticalStartupReady(true);
    }, 4500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, tenant?.tenantKey]);
  const officialLightHistoryCacheRef = useRef(new Map());

  const [myReportsOpen, setMyReportsOpen] = useState(false);
  const [myReportsDomain, setMyReportsDomain] = useState("streetlights");
  const [myReportsDomainFilters, setMyReportsDomainFilters] = useState([]);
  const [myReportsLaunchOptions, setMyReportsLaunchOptions] = useState(() => ({
    token: "",
    focusIncidentId: "",
    focusQuery: "",
    inViewOnly: false,
  }));
  const [myReportsReportedByMode, setMyReportsReportedByMode] = useState("me");

  const [openReportsOpen, setOpenReportsOpen] = useState(false);
  const [openReportsLaunchOptions, setOpenReportsLaunchOptions] = useState(() => ({
    token: "",
    focusIncidentId: "",
    focusQuery: "",
    inViewOnly: false,
  }));
  const [openReportsDomainFilters, setOpenReportsDomainFilters] = useState([]);
  const [openReportMapFilterOn, setOpenReportMapFilterOn] = useState(false);
  const [streetlightInViewFilterMode, setStreetlightInViewFilterMode] = useState("");
  const [adminReportDomain, setAdminReportDomain] = useState("streetlights");
  const [activeMapLayerKey, setActiveMapLayerKey] = useState(INCIDENT_REPORTING_LAYER_KEY);
  const [incidentMapFilterKeys, setIncidentMapFilterKeys] = useState([]);
  const [lastIncidentMapDomain, setLastIncidentMapDomain] = useState("streetlights");
  const [adminDomainMenuOpen, setAdminDomainMenuOpen] = useState(false);
  const [mobileIncidentDomainMenuOpen, setMobileIncidentDomainMenuOpen] = useState(false);
  const [adminToolboxOpen, setAdminToolboxOpen] = useState(false);
  const [selectedDomainMarker, setSelectedDomainMarker] = useState(null);
  const [infoMenuOpen, setInfoMenuOpen] = useState(false);
  const [citySwitcherOpen, setCitySwitcherOpen] = useState(false);
  const [followedLocationsOpen, setFollowedLocationsOpen] = useState(false);
  const [notificationsWindowOpen, setNotificationsWindowOpen] = useState(false);
  const [alertsWindowOpen, setAlertsWindowOpen] = useState(false);
  const [eventsWindowOpen, setEventsWindowOpen] = useState(false);
  const [mapCommunityAlerts, setMapCommunityAlerts] = useState([]);
  const [mapCommunityEvents, setMapCommunityEvents] = useState([]);
  const [mapCommunityTopics, setMapCommunityTopics] = useState([]);
  const notificationTopics = useMemo(() => mapCommunityTopics, [mapCommunityTopics]);
  const [communityFeedEditor, setCommunityFeedEditor] = useState({ open: false, kind: "alert", mode: "create", item: null });
  const [mapCommunityFeedLoading, setMapCommunityFeedLoading] = useState(false);
  const [mapCommunityFeedError, setMapCommunityFeedError] = useState("");
  const [residentFeedRuntimeSupport, setResidentFeedRuntimeSupport] = useState(null);
  const [mapCommunityFeedReadState, setMapCommunityFeedReadState] = useState(() => ({
    ...EMPTY_MAP_COMMUNITY_FEED_READ_STATE,
    alertsReadKeys: [],
    eventsReadKeys: [],
    alertsReadIds: [],
    eventsReadIds: [],
  }));
  const [alertsSessionNewKeys, setAlertsSessionNewKeys] = useState([]);
  const [eventsSessionNewKeys, setEventsSessionNewKeys] = useState([]);
  const alertsFeedMarkedForOpenRef = useRef(false);
  const eventsFeedMarkedForOpenRef = useRef(false);
  const mapCommunityFeedRequestSeqRef = useRef(0);
  const [residentNotificationLocations, setResidentNotificationLocations] = useState([]);
  const [residentFeedBadgeCounts, setResidentFeedBadgeCounts] = useState(() => ({
    notifications: 0,
    alerts: 0,
    events: 0,
  }));
  const [residentFeedControllerApi, setResidentFeedControllerApi] = useState(() => ({
    loadMapCommunityFeed: async () => {},
    openResidentNotificationTarget: async () => {},
    handleResidentAlertVisible: () => {},
    handleResidentEventVisible: () => {},
    refreshResidentNotifications: () => {},
  }));
  const [residentNotificationsRefreshToken, setResidentNotificationsRefreshToken] = useState(0);
  const [focusedResidentAlertId, setFocusedResidentAlertId] = useState("");
  const [focusedResidentEventId, setFocusedResidentEventId] = useState("");
  const [pendingResidentNotificationTarget, setPendingResidentNotificationTarget] = useState(null);
  const [computeStreetlightConfidenceSnapshot, setComputeStreetlightConfidenceSnapshot] = useState(() => null);

  const resolveTenantDomainType = useCallback((domainKeyRaw) => {
    const domainKey = String(domainKeyRaw || "").trim().toLowerCase();
    if (!domainKey) return "";
    const cfg = tenantDomainPublicConfigByDomain?.[domainKey] || null;
    return resolveDomainType(domainKey, cfg?.domain_type);
  }, [tenantDomainPublicConfigByDomain]);

  const isTenantIncidentDrivenDomain = useCallback((domainKeyRaw) => {
    const domainType = resolveTenantDomainType(domainKeyRaw);
    if (!domainType) return false;
    return domainType !== "asset_backed";
  }, [resolveTenantDomainType]);

  const isTenantAssetBackedDomain = useCallback((domainKeyRaw) => {
    const domainType = resolveTenantDomainType(domainKeyRaw);
    if (!domainType) return false;
    return domainType === "asset_backed";
  }, [resolveTenantDomainType]);

  const isTenantOrganizationManagedIncidentDomain = useCallback((domainKeyRaw) => {
    const domainKey = String(domainKeyRaw || "").trim().toLowerCase();
    if (!domainKey) return false;
    if (resolveTenantDomainType(domainKey) !== "incident_driven") return false;
    const cfg = tenantDomainPublicConfigByDomain?.[domainKey] || null;
    return cfg?.organization_monitored_repairs === true;
  }, [resolveTenantDomainType, tenantDomainPublicConfigByDomain]);

  const isSharedIncidentDomain = useCallback((domainKeyRaw) => {
    const domainKey = String(domainKeyRaw || "").trim().toLowerCase();
    if (!domainKey) return false;
    if (domainKey === "streetlights") return false;
    return isTenantIncidentDrivenDomain(domainKey);
  }, [isTenantIncidentDrivenDomain]);

  function preferredInitialDomainKey(options = []) {
    const list = Array.isArray(options) ? options.filter(Boolean) : [];
    const firstIncidentKey = String(
      list.find((d) => isTenantIncidentDrivenDomain(d?.key))?.key || ""
    ).trim();
    if (firstIncidentKey) return firstIncidentKey;
    const firstStreetlightKey = String(
      list.find((d) => String(d?.key || "").trim() === "streetlights")?.key || ""
    ).trim();
    if (firstStreetlightKey) return firstStreetlightKey;
    return String(list?.[0]?.key || "streetlights").trim() || "streetlights";
  }

  function closeMyReports() {
    setMyReportsOpen(false);
  }

  function nextReportLaunchToken() {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function primeReportsModalWorkspace() {
    void loadOpenReportsModalModule();
  }

  function primePrimaryReportFlowOpenWorkspace() {
    void loadDeferredReportFlowOpenSupportModule();
    void loadDeferredMapTapRuntimeModule();
  }

  function primePrimaryReportFlowWorkspace() {
    void loadMapReportFlowModule();
    void loadDeferredReportFlowOpenSupportModule();
    void loadDeferredMapTapRuntimeModule();
    void loadDeferredGeoSupportModule();
  }

  function primeMapSelectionPopupsWorkspace(options = {}) {
    if (options?.officialStreetlight) {
      void loadStreetlightPopupWorkspaceModule();
    }
    if (options?.incidentDriven) {
      void loadIncidentDomainPopupWorkspaceModule();
    }
    if (options?.incidentStack || options?.queued || (!options?.officialStreetlight && !options?.incidentDriven)) {
      void loadMapSelectionPopupsModule();
    }
    if (options?.incidentDriven || options?.incidentStack) {
      void loadDeferredSelectionPopupIncidentSupportModule();
    }
  }

  function openMyReports(opts = {}) {
    const requestedDomainKey = String(opts?.domainKey || "").trim();
    const defaultDomainKey = String(
      adminReportDomain
      || preferredInitialDomainKey(visibleDomainOptions)
      || "streetlights"
    ).trim() || "streetlights";
    const domainKey = requestedDomainKey || defaultDomainKey;
    const focusIncidentId = String(opts?.focusIncidentId || "").trim();
    const focusQuery = String(opts?.focusQuery || "").trim();
    const inViewOnly = Boolean(opts?.inViewOnly);
    const hasExplicitReportedByMode = Object.prototype.hasOwnProperty.call(opts || {}, "reportedByMode");
    const reportedByModeSource = hasExplicitReportedByMode ? opts?.reportedByMode : myReportsReportedByMode;
    const reportedByMode = String(reportedByModeSource || "me").trim().toLowerCase() === "all" ? "all" : "me";
    primeReportsModalWorkspace();
    closeAnyPopup();
    setSelectedOfficialId(null);
    setSelectedDomainMarker(null);
    setSelectedQueuedTempId(null);
    setAccountMenuOpen(false);
    setMobileHeaderMenuOpen(false);
    setAdminDomainMenuOpen(false);
    setNotificationsWindowOpen(false);
    setAlertsWindowOpen(false);
    setEventsWindowOpen(false);
    setAdminReportDomain(domainKey);
    setMyReportsDomain(domainKey);
    setMyReportsDomainFilters(requestedDomainKey ? [domainKey] : []);
    setMyReportsLaunchOptions({
      token: nextReportLaunchToken(),
      focusIncidentId,
      focusQuery,
      inViewOnly,
    });
    setMyReportsReportedByMode(reportedByMode);
    setMyReportsOpen(true);
  }

  function openNotificationsInbox() {
    closeAnyPopup();
    setSelectedOfficialId(null);
    setSelectedDomainMarker(null);
    setSelectedQueuedTempId(null);
    setAccountMenuOpen(false);
    setMobileHeaderMenuOpen(false);
    setAdminDomainMenuOpen(false);
    setMyReportsOpen(false);
    setAlertsWindowOpen(false);
    setEventsWindowOpen(false);
    setNotificationsWindowOpen(true);
  }

  function closeOpenReports() {
    setOpenReportsOpen(false);
  }

  function closeIncidentRepairConfirmDialog() {
    setIncidentRepairConfirmOpen(false);
    setPendingIncidentRepairId("");
    setPendingIncidentRepairDomainKey("");
  }

  function requestIncidentRepairConfirmation(incidentIdRaw, domainKeyRaw) {
    const incidentId = String(incidentIdRaw || "").trim();
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || domainForIncidentId(incidentId);
    if (!incidentId || !domainKey || saving) return;
    const currentSnapshot = getIncidentRepairSnapshot(domainKey, incidentId);
    if (currentSnapshot?.viewerHasRepairSignal) {
      markIncidentRepairSignalOptimistically(domainKey, incidentId);
      openNotice("ℹ️", "Already confirmed", "You already marked this incident fixed.");
      return;
    }
    setIncidentRepairConfirmOpen(true);
    setPendingIncidentRepairId(incidentId);
    setPendingIncidentRepairDomainKey(domainKey);
  }

  function openOpenReports({ inViewOnly = false, focusIncidentId = "", focusQuery = "" } = {}) {
    if (!canOpenDomainReports) return;
    primeReportsModalWorkspace();
    setOpenReportsLaunchOptions({
      token: nextReportLaunchToken(),
      focusIncidentId: String(focusIncidentId || "").trim(),
      focusQuery: String(focusQuery || "").trim(),
      inViewOnly: Boolean(inViewOnly),
    });
    setOpenReportsOpen(true);
  }

  const handleUtilityReportedChange = useCallback(async (incidentId, reported, opts = {}) => {
    const { normalizeUtilityReportReference } = await loadIncidentDeferredSupportModule();
    const id = String(incidentId || "").trim();
    if (!id) return;
    const reference = normalizeUtilityReportReference(opts?.reportReference);
    setUtilityReportedLightIdSet((prev) => {
      const next = new Set(prev || []);
      if (reported) next.add(id);
      else next.delete(id);
      return next;
    });
    setUtilityReportReferenceByLightId((prev) => {
      const next = { ...(prev || {}) };
      if (reported) next[id] = reference;
      else delete next[id];
      return next;
    });
  }, []);

  const toggleStreetlightInViewFilter = useCallback((mode) => {
    const normalized = String(mode || "").trim().toLowerCase();
    if (normalized !== "saved" && normalized !== "utility") {
      setStreetlightInViewFilterMode("");
      return;
    }
    setStreetlightInViewFilterMode((prev) => (prev === normalized ? "" : normalized));
  }, []);
  const getIncidentSnapshot = useCallback((domain, incidentId) => {
    const id = String(incidentId || "").trim();
    if (!id) return null;
    const candidates = incidentSnapshotCandidateDomainsShared(domain, id, {
      getIncidentDomainHelper,
      normalizeDomainKey,
      normalizeDomainKeyOrSlug,
    });

    for (const d of candidates) {
      const key = incidentSnapshotKey(d, id);
      if (!key) continue;
      const hit = incidentStateByKey?.[key] || null;
      if (hit) return hit;
    }

    // Final fallback for mixed historical keys.
    for (const [key, value] of Object.entries(incidentStateByKey || {})) {
      if (String(key || "").endsWith(`:${id}`)) return value || null;
    }

    return null;
  }, [incidentStateByKey]);

  const incidentMarkerLifecycleTsById = useMemo(() => {
    const next = {};
    for (const [incidentIdRaw, actions] of Object.entries(actionsByLightId || {})) {
      const incidentId = String(incidentIdRaw || "").trim();
      if (!incidentId || !Array.isArray(actions) || !actions.length) continue;
      let lastFixTs = 0;
      let lastReopenTs = 0;
      for (const action of actions) {
        const ts = Number(action?.ts || 0);
        if (!Number.isFinite(ts) || ts <= 0) continue;
        const kind = String(action?.action || "").trim().toLowerCase();
        if (kind === "fix") lastFixTs = Math.max(lastFixTs, ts);
        if (kind === "reopen") lastReopenTs = Math.max(lastReopenTs, ts);
      }
      if (lastFixTs > 0 || lastReopenTs > 0) {
        next[incidentId] = { lastFixTs, lastReopenTs };
      }
    }
    return next;
  }, [actionsByLightId]);

  const shouldRenderIncidentMarkerForState = useCallback((domainKeyRaw, incidentIdRaw, markerOrRows = null) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      || String(domainKeyRaw || "").trim().toLowerCase();
    const incidentId = String(incidentIdRaw || "").trim();
    if (!domainKey || !incidentId) return true;
    const snapshot = getIncidentSnapshot(domainKey, incidentId);
    const snapshotState = String(snapshot?.state || "").trim().toLowerCase();
    const lifecycleTs = incidentMarkerLifecycleTsById?.[incidentId] || null;
    const lastFixTs = Math.max(
      Number(lastFixByLightId?.[incidentId] || 0),
      Number(lifecycleTs?.lastFixTs || 0),
      Date.parse(String(snapshot?.last_changed_at || "")) || 0
    );
    const lastReopenTs = Number(lifecycleTs?.lastReopenTs || 0);
    const lastReportTs = Array.isArray(markerOrRows)
      ? markerOrRows.reduce((max, row) => {
          const ts = Number(row?.ts || 0);
          return Number.isFinite(ts) && ts > max ? ts : max;
        }, 0)
      : Number(markerOrRows?.lastTs || 0);
    if (lastReportTs > lastFixTs || lastReopenTs > lastFixTs) return true;
    if (!snapshotState) return true;
    return isLifecycleStateOpen(snapshotState);
  }, [getIncidentSnapshot, incidentMarkerLifecycleTsById, lastFixByLightId]);

  const domainForIncidentId = useCallback((incidentIdRaw) => {
    const incidentId = String(incidentIdRaw || "").trim();
    if (!incidentId) return "streetlights";
    const prefixedDomain = prefixedIncidentDomainKeyShared(incidentId);
    if (prefixedDomain) return prefixedDomain;
    const reportDomain = reportDomainFromLightId(incidentId);
    if (reportDomain !== "streetlights") return reportDomain;
    return "streetlights";
  }, []);

  async function getOfficialLightHistoryDetailed(lightId, { preferCache = true } = {}) {
    const { parseWorkingContactFromNote } = await loadIncidentDeferredSupportModule();
    const lid = (lightId || "").trim();
    if (!lid) return { reportRows: [], fixActionRows: [] };

    const cache = officialLightHistoryCacheRef.current;
    if (preferCache && cache.has(lid)) return cache.get(lid);

    const [repRes, actRes] = await Promise.all([
      supabase
        .from("reports")
        .select("id, created_at, lat, lng, report_type, report_quality, note, light_id, report_number, reporter_user_id, reporter_name, reporter_phone, reporter_email")
        .eq("light_id", lid)
        .order("created_at", { ascending: false }),
      supabase
        .from("light_actions")
        .select("id, light_id, action, note, created_at, actor_user_id")
        .eq("light_id", lid)
        .order("created_at", { ascending: false }),
    ]);

    if (repRes.error) throw repRes.error;
    if (actRes.error) throw actRes.error;

    const reportRows = (repRes.data || []).map((r) => ({
      id: r.id,
      lat: r.lat,
      lng: r.lng,
      type: r.report_type,
      report_quality: normalizeReportQuality(r.report_quality),
      note: r.note || "",
      ts: new Date(r.created_at).getTime(),
      light_id: r.light_id || lightIdFor(r.lat, r.lng),
      report_number: r.report_number || null,
      reporter_user_id: r.reporter_user_id || null,
      reporter_name: r.reporter_name || null,
      reporter_phone: r.reporter_phone || null,
      reporter_email: r.reporter_email || null,
    }));

    const fixActionRows = (actRes.data || []).map((a) => {
      const ts = new Date(a.created_at).getTime();
      const noteContact = parseWorkingContactFromNote(a.note);
      const actorEmail = a.actor_email || a.reporter_email || noteContact.email || null;
      const actorPhone = a.actor_phone || a.reporter_phone || noteContact.phone || null;
      const actorUserId = a.actor_user_id || a.reporter_user_id || null;
      const actorNameRaw = (a.actor_name || a.reporter_name || noteContact.name || "").trim();
      const actorNameFallback = actorEmail ? String(actorEmail).split("@")[0] : "";
      return {
        action: a.action,
        ts,
        note: a.note || null,
        actor_user_id: actorUserId,
        actor_email: actorEmail,
        actor_phone: actorPhone,
        actor_name: actorNameRaw || actorNameFallback || null,
        reporter_user_id: a.reporter_user_id || actorUserId,
        reporter_name: (a.reporter_name || "").trim() || actorNameRaw || actorNameFallback || null,
        reporter_email: a.reporter_email || actorEmail,
        reporter_phone: a.reporter_phone || actorPhone,
      };
    });

    const out = { reportRows, fixActionRows };
    cache.set(lid, out);
    return out;
  }

  async function markIncidentFixedByCanonicalId(incidentIdRaw, noteText = "", options = {}) {
    const incidentId = String(incidentIdRaw || "").trim();
    if (!incidentId) return false;
    return await markFixed({ lightId: incidentId, isOfficial: true }, noteText, options);
  }

  function stopLeafletPropagation(e) {
    e.stopPropagation?.();

    // stop the native event Leaflet listens to
    const ne = e?.nativeEvent;
    ne?.stopPropagation?.();
    ne?.stopImmediatePropagation?.();
  }

  function guardPopupAction(e, ms = 900, { prevent = false } = {}) {
    // ✅ IMPORTANT: preventDefault only on "click", NOT on pointer/touch down
    if (prevent) e.preventDefault?.();

    stopLeafletPropagation(e);

    // cancel pending delayed report
    const ref = clickDelayRef.current;
    if (ref?.timer) {
      clearTimeout(ref.timer);
      ref.timer = null;
    }

    // suppress any late/synthetic map click
    suppressMapClickRef.current.until = Date.now() + ms;
  }



  // Location (user-initiated)
  const [userLoc, setUserLoc] = useState(null); // [lat, lng]
  const [mapTarget, setMapTarget] = useState(null); // { pos:[lat,lng], zoom:number, nonce:number }
  const [locating, setLocating] = useState(false);
  const [autoFollow, setAutoFollow] = useState(false);
  const [followCamera, setFollowCamera] = useState(false);
  const [travelFollowMode, setTravelFollowMode] = useState(false);
  const [userHeading, setUserHeading] = useState(null);
  const [locationDiagnosticsOpen, setLocationDiagnosticsOpen] = useState(false);
  const [locationDiagnostics, setLocationDiagnostics] = useState(null);
  const lightActionsActorColumnsSupportedRef = useRef(false); // hard-disable actor_* writes unless explicitly enabled later
  const followHeadingEnabledRef = useRef(true);

  const lastTrackedPosRef = useRef(null);
  // Map style
  const [mapStyle, setMapStyle] = useState("streets"); // "streets" | "sat"


  // Remember if the browser reported "denied"
  const [geoDenied, setGeoDenied] = useState(() => {
    try {
      return localStorage.getItem("streetlight_geo_denied_v1") === "1";
    } catch {
      return false;
    }
  });

  function setGeoDeniedPersist(v) {
    setGeoDenied(v);
    try {
      localStorage.setItem("streetlight_geo_denied_v1", v ? "1" : "0");
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // Ask for location immediately on first load (once per app install/browser profile)
    try {
      const alreadyPrompted = localStorage.getItem(LOC_PROMPTED_APP_KEY) === "1";
      if (!alreadyPrompted) {
        localStorage.setItem(LOC_PROMPTED_APP_KEY, "1");
        setShowLocationPrompt(true);
      }
    } catch {
      // If storage fails, still show once
      setShowLocationPrompt(true);
    }
  }, []);



  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authGateStep, setAuthGateStep] = useState("welcome"); // welcome | login | signup | guest

  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const isTouchDevice = useMemo(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    return ("ontouchstart" in window) || Number(navigator.maxTouchPoints || 0) > 0;
  }, []);
  const isAppleTouchWeb = useMemo(() => !isNativeAppRuntime() && isAppleTouchBrowser(), []);
  const [forceRasterMapCompat, setForceRasterMapCompat] = useState(false);


  // Auth
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const initialCrossTenantAuthBridgeStateRef = useRef(
    typeof window === "undefined"
      ? { hasBridgeSessionHint: false, hasLogoutMarker: false }
      : readCrossTenantAuthBridgeStateHint()
  );
  const initialPersistedSupabaseSessionHintRef = useRef(
    typeof window === "undefined" ? false : hasPersistedSupabaseSessionHint()
  );
  const initialAuthBootstrapUrlHintRef = useRef(
    typeof window === "undefined"
      ? false
      : (
          hasAuthBootstrapUrlHint(window.location.search || "", window.location.hash || "")
          || readDeleteAccountDeepLinkRequest(window.location.search || "")
        )
  );
  const initialAuthBootstrapPendingStorageHintRef = useRef(
    typeof window === "undefined"
      ? false
      : (() => {
          try {
            return Boolean(
              String(window.sessionStorage.getItem(PUBLIC_APP_ONBOARDING_PENDING_AUTH_KEY) || "").trim()
              || String(window.sessionStorage.getItem(PUBLIC_ACCOUNT_DELETE_PENDING_AUTH_KEY) || "").trim()
            );
          } catch {
            return false;
          }
        })()
  );
  const shouldHydrateMapAuthEagerly = Boolean(
    initialCrossTenantAuthBridgeStateRef.current?.hasBridgeSessionHint
    || initialPersistedSupabaseSessionHintRef.current
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminStateResolved, setAdminStateResolved] = useState(false);
  const [canAccessAdminReports, setCanAccessAdminReports] = useState(false);
  const [canAccessDomainReports, setCanAccessDomainReports] = useState(false);
  const [canEditDomainReports, setCanEditDomainReports] = useState(false);
  const [reportAccessResolved, setReportAccessResolved] = useState(false);
  // Access vocabulary:
  // - isPlatformAdmin: developer/platform-only tools and diagnostics
  // - hasOrgAdminReportsAccess: richer org-admin reports workspace
  // - hasOrgDomainReportsAccess: org-admin can open domain reports
  // - hasOrgDomainReportsEditAccess: org-admin can mark fixed / reopen on managed incident domains
  const isPlatformAdmin = isAdmin;
  const hasOrgAdminReportsAccess = canAccessAdminReports;
  const hasOrgDomainReportsAccess = canAccessDomainReports;
  const hasOrgDomainReportsEditAccess = canEditDomainReports;
  const canOpenAdminReports = isPlatformAdmin || hasOrgAdminReportsAccess;
  const canOpenDomainReports = isPlatformAdmin || hasOrgDomainReportsAccess;
  // Domain-report access should also unlock full incident visibility on the map.
  const isReportsAdminView = isPlatformAdmin || hasOrgAdminReportsAccess || hasOrgDomainReportsAccess;
  const reportsAdminView = isReportsAdminView;
  const waitingForAuthenticatedMapAccess = shouldWaitForAuthenticatedMapAccessShared({
    authReady,
    sessionUserId: session?.user?.id,
    adminStateResolved,
    reportAccessResolved,
  });
  const tenantScopedReadClient = useMemo(
    () => createTenantScopedReadClient(tenant?.tenantKey || activeTenantKey()),
    [tenant?.tenantKey]
  );
  const resolvedTenantDomainConfigTenantKey = useMemo(
    () => String(tenant?.tenantKey || activeTenantKey() || "").trim().toLowerCase(),
    [tenant?.tenantKey]
  );
  const [tenantVisibilityByDomain, setTenantVisibilityByDomain] = useState({});
  const [tenantVisibilityLoaded, setTenantVisibilityLoaded] = useState(false);
  const [tenantMapFeatures, setTenantMapFeatures] = useState(DEFAULT_TENANT_MAP_FEATURES);
  const [tenantMapFeaturesLoaded, setTenantMapFeaturesLoaded] = useState(false);
  const [tenantDomainConfigLoaded, setTenantDomainConfigLoaded] = useState(false);
  const [publicMapCoreCacheHydrated, setPublicMapCoreCacheHydrated] = useState(false);
  const [publicMapCoreCacheHasIncidentData, setPublicMapCoreCacheHasIncidentData] = useState(false);
  const deferredIncidentStateRefreshContextKeyRef = useRef("");
  const deferredBoundaryRefreshContextKeyRef = useRef("");
  const tenantMapFeaturesSourceRef = useRef("initial");
  const tenantBoundaryRenderSignatureRef = useRef("");
  const tenantRegistryIncidentDomainsRef = useRef([]);
  const visibleDomainOptionsRef = useRef([]);
  const tenantDomainConfigLoadedRef = useRef(false);
  const [openAbuseFlagSummary, setOpenAbuseFlagSummary] = useState({ total: 0, maxSeverity: 0 });
  const [moderationFlagsOpen, setModerationFlagsOpen] = useState(false);
  const abuseFlagBannerShownRef = useRef(false);
  const resolvedTenantBoundaryTenantKey = String(
    tenant?.tenantKey || tenant?.tenantConfig?.tenant_key || activeTenantKey() || ""
  ).trim().toLowerCase();

  useLayoutEffect(() => {
    const clearMapCoreRuntime = () => {
      setPublicMapCoreCacheHydrated(false);
      setPublicMapCoreCacheHasIncidentData(false);
      setOfficialLights([]);
      setReports([]);
      setSharedIncidentReportRowsStateByDomain({});
      setSharedIncidentBaseMarkersStateByDomain({});
      setStreetlightOutageTsByLightId({});
      setIncidentStateByKey({});
      setFixedLights({});
      setActionsByLightId({});
      setConfiguredIncidentSeededRowsStateByDomain({});
      setConfiguredIncidentReportRowsStateByDomain({});
      setConfiguredIncidentLoadedDomainKeys([]);
      setConfiguredIncidentPersistedStateLoadedDomainKeys([]);
      configuredIncidentLoadingDomainKeysRef.current = new Set();
      configuredIncidentPersistedStateLoadingDomainKeysRef.current = new Set();
      cachedConfiguredIncidentSeededRowsByDomainRef.current = {};
      cachedConfiguredIncidentReportRowsByDomainRef.current = {};
      cachedPersistedIncidentRecordStateByDomainRef.current = {};
      setPersistedIncidentRecordStateByDomain({});
    };

    const shouldHydratePublicCache = shouldHydratePublicMapCoreCacheShared({
      tenantKey: resolvedTenantBoundaryTenantKey,
      reportsAdminView,
      authReady,
      sessionUserId: session?.user?.id || "",
      waitingForReportAccess: waitingForAuthenticatedMapAccess,
    });
    if (!shouldHydratePublicCache) {
      clearMapCoreRuntime();
      return;
    }
    const cachedMapCoreSnapshot = readCachedTenantPublicMapCoreSnapshot(resolvedTenantBoundaryTenantKey);
    if (!cachedMapCoreSnapshot) {
      clearMapCoreRuntime();
      return;
    }
    const cachedReports = Array.isArray(cachedMapCoreSnapshot.reports)
      ? cachedMapCoreSnapshot.reports
      : [];
    const cachedConfiguredSeededRowsByDomain =
      cachedMapCoreSnapshot.configuredIncidentSeededRowsStateByDomain
      && typeof cachedMapCoreSnapshot.configuredIncidentSeededRowsStateByDomain === "object"
        ? cachedMapCoreSnapshot.configuredIncidentSeededRowsStateByDomain
        : {};
    const cachedConfiguredReportRowsByDomain =
      cachedMapCoreSnapshot.configuredIncidentReportRowsStateByDomain
      && typeof cachedMapCoreSnapshot.configuredIncidentReportRowsStateByDomain === "object"
        ? cachedMapCoreSnapshot.configuredIncidentReportRowsStateByDomain
        : {};
    const hasCachedConfiguredIncidentData = (
      Object.values(cachedConfiguredSeededRowsByDomain).some((rows) => Array.isArray(rows) && rows.length > 0)
      || Object.values(cachedConfiguredReportRowsByDomain).some((rows) => Array.isArray(rows) && rows.length > 0)
    );
    setPublicMapCoreCacheHydrated(true);
    setPublicMapCoreCacheHasIncidentData(cachedReports.length > 0 || hasCachedConfiguredIncidentData);
    setOfficialLights(cachedMapCoreSnapshot.officialLights);
    setReports(cachedReports);
    setSharedIncidentReportRowsStateByDomain(
      cachedMapCoreSnapshot.sharedIncidentReportRowsStateByDomain || {}
    );
    setSharedIncidentBaseMarkersStateByDomain(
      cachedMapCoreSnapshot.sharedIncidentBaseMarkersStateByDomain || {}
    );
    setStreetlightOutageTsByLightId(
      cachedMapCoreSnapshot.streetlightOutageTsByLightId
      || {}
    );
    setIncidentStateByKey(cachedMapCoreSnapshot.incidentStateByKey);
    setFixedLights(cachedMapCoreSnapshot.fixedLights);
    setActionsByLightId(cachedMapCoreSnapshot.actionsByLightId);
    cachedConfiguredIncidentSeededRowsByDomainRef.current = cachedConfiguredSeededRowsByDomain;
    cachedConfiguredIncidentReportRowsByDomainRef.current = cachedConfiguredReportRowsByDomain;
    cachedPersistedIncidentRecordStateByDomainRef.current = cachedMapCoreSnapshot.persistedIncidentRecordStateByDomain || {};
    setConfiguredIncidentSeededRowsStateByDomain(cachedConfiguredSeededRowsByDomain);
    setConfiguredIncidentReportRowsStateByDomain(cachedConfiguredReportRowsByDomain);
    setConfiguredIncidentLoadedDomainKeys([]);
    setConfiguredIncidentPersistedStateLoadedDomainKeys([]);
    configuredIncidentLoadingDomainKeysRef.current = new Set();
    configuredIncidentPersistedStateLoadingDomainKeysRef.current = new Set();
    setPersistedIncidentRecordStateByDomain(cachedMapCoreSnapshot.persistedIncidentRecordStateByDomain || {});
  }, [
    authReady,
    reportsAdminView,
    resolvedTenantBoundaryTenantKey,
    session?.user?.id,
    shouldHydrateMapAuthEagerly,
    waitingForAuthenticatedMapAccess,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedTenantDomainConfigTenantKey) {
      setTenantVisibilityByDomain({});
      setTenantVisibilityLoaded(false);
      return () => {
        cancelled = true;
      };
    }
    void loadDeferredTenantUiConfigSupportModule()
      .then(({ readCachedTenantVisibilityConfigShared }) => {
        if (cancelled) return;
        const cachedVisibility = readCachedTenantVisibilityConfigShared(resolvedTenantDomainConfigTenantKey);
        if (cachedVisibility) {
          setTenantVisibilityByDomain(cachedVisibility);
          setTenantVisibilityLoaded(true);
          return;
        }
        setTenantVisibilityByDomain({});
        setTenantVisibilityLoaded(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTenantVisibilityByDomain({});
        setTenantVisibilityLoaded(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedTenantDomainConfigTenantKey]);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedTenantBoundaryTenantKey) {
      setCityBoundaryGeojson(null);
      return () => {
        cancelled = true;
      };
    }
    void loadDeferredPublicMapLoadSupportModule()
      .then(({ readCachedTenantBoundaryGeojsonShared }) => {
        if (cancelled) return;
        const cachedBoundaryGeojson = readCachedTenantBoundaryGeojsonShared(
          resolvedTenantBoundaryTenantKey,
          { parseGeoJsonValue },
        );
        setCityBoundaryGeojson(cachedBoundaryGeojson || null);
      })
      .catch(() => {
        if (cancelled) return;
        setCityBoundaryGeojson(null);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedTenantBoundaryTenantKey]);

  useEffect(() => {
    if (reportsAdminView || session?.user?.id || !resolvedTenantBoundaryTenantKey) return;
    cachedConfiguredIncidentSeededRowsByDomainRef.current = configuredIncidentSeededRowsStateByDomain || {};
    cachedConfiguredIncidentReportRowsByDomainRef.current = configuredIncidentReportRowsStateByDomain || {};
    cachedPersistedIncidentRecordStateByDomainRef.current = persistedIncidentRecordStateByDomain || {};
    const snapshot = {
      officialLights,
      reports,
      streetlightOutageTsByLightId,
      incidentStateByKey,
      fixedLights,
      actionsByLightId,
      configuredIncidentSeededRowsStateByDomain,
      configuredIncidentReportRowsStateByDomain,
      persistedIncidentRecordStateByDomain,
    };
    if (typeof window === "undefined") {
      void writeCachedTenantPublicMapCoreSnapshotDeferred(resolvedTenantBoundaryTenantKey, snapshot);
      return undefined;
    }
    if (!startupWarmupReady) return undefined;
    let idleHandle = null;
    let timeoutHandle = null;
    const flushCacheWrite = () => {
      idleHandle = null;
      timeoutHandle = null;
      void writeCachedTenantPublicMapCoreSnapshotDeferred(resolvedTenantBoundaryTenantKey, snapshot);
    };

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(
        flushCacheWrite,
        { timeout: 1800 }
      );
    } else {
      timeoutHandle = window.setTimeout(
        flushCacheWrite,
        180
      );
    }

    return () => {
      if (idleHandle != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [
    actionsByLightId,
    configuredIncidentReportRowsStateByDomain,
    configuredIncidentSeededRowsStateByDomain,
    fixedLights,
    incidentStateByKey,
    officialLights,
    persistedIncidentRecordStateByDomain,
    reports,
    streetlightOutageTsByLightId,
    reportsAdminView,
    resolvedTenantBoundaryTenantKey,
    session?.user?.id,
    startupWarmupReady,
  ]);

  const applyIncidentStateSnapshot = useCallback((nextIncidentStateSnapshot) => {
    setIncidentStateByKey(nextIncidentStateSnapshot);
    setLastFixByLightId((prev) => {
      const out = { ...(prev || {}) };
      for (const [key, snap] of Object.entries(nextIncidentStateSnapshot || {})) {
        const keyStr = String(key || "");
        const sep = keyStr.indexOf(":");
        if (sep < 0) continue;
        const incidentId = keyStr.slice(sep + 1).trim();
        if (!incidentId) continue;
        const state = String(snap?.state || "").trim().toLowerCase();
        if (state !== "fixed") continue;
        const ts = Date.parse(String(snap?.last_changed_at || "")) || 0;
        if (!ts) continue;
        if (!out[incidentId] || ts > Number(out[incidentId] || 0)) {
          out[incidentId] = ts;
        }
      }
      return out;
    });
  }, []);

  const clearRuntimeDomainMeta = useCallback(() => {
    RUNTIME_DOMAIN_META.domainTypeByDomain.clear();
    RUNTIME_DOMAIN_META.reportPrefixByDomain.clear();
    RUNTIME_DOMAIN_META.iconSrcByDomain.clear();
    RUNTIME_DOMAIN_META.iconRenderModeByDomain.clear();
    RUNTIME_DOMAIN_META.iconTintModeByDomain.clear();
    RUNTIME_DOMAIN_META.iconTintColorByDomain.clear();
    RUNTIME_DOMAIN_META.highConfidenceIconTintModeByDomain.clear();
    RUNTIME_DOMAIN_META.highConfidenceIconTintColorByDomain.clear();
    RUNTIME_DOMAIN_META.labelByDomain.clear();
    RUNTIME_DOMAIN_META.markerColorByDomain.clear();
    RUNTIME_DOMAIN_META.publicVisibilityMinReportsByDomain.clear();
    RUNTIME_DOMAIN_META.highConfidenceMinReportsByDomain.clear();
    RUNTIME_DOMAIN_META.highConfidenceMarkerColorByDomain.clear();
    RUNTIME_DOMAIN_META.rawIssueTypesByDomain.clear();
    RUNTIME_DOMAIN_META.rawTypeOptionsByDomain.clear();
    RUNTIME_DOMAIN_META.issueTypesByDomain.clear();
    RUNTIME_DOMAIN_META.typeOptionsByDomain.clear();
    RUNTIME_DOMAIN_META.disclosuresByDomain.clear();
    RUNTIME_DOMAIN_META.allowReportImagesByDomain.clear();
    RUNTIME_DOMAIN_META.roadRequiredByDomain.clear();
    RUNTIME_DOMAIN_META.parkRequiredByDomain.clear();
  }, []);
  const normalizeRegistryIncidentDomainRows = useCallback((rows = []) => {
    clearRuntimeDomainMeta();
    const normalizedRows = [];
    for (const row of rows || []) {
      const domainKey = normalizeDomainKeyOrSlug(row?.domain_key || row?.key, { allowUnknown: true });
      if (!domainKey) continue;
      const reportPrefix = String(row?.report_prefix || "").trim().toUpperCase();
      const label = String(row?.label || domainKey).trim() || domainKey;
      const iconSrc = resolveRuntimeDomainIconSrc(domainKey, row?.icon_src, row?.icon_key);
      const iconRenderMode = normalizeDomainIconRenderMode(row?.icon_render_mode, iconSrc);
      const iconTintMode = normalizeDomainIconTintMode(row?.icon_tint_mode);
      const iconTintColor = normalizeDomainIconTintColor(row?.icon_tint_color, "");
      const highConfidenceIconTintMode = normalizeDomainIconTintMode(
        row?.high_confidence_icon_tint_mode ?? row?.icon_tint_mode
      );
      const highConfidenceIconTintColor = normalizeDomainIconTintColor(
        row?.high_confidence_icon_tint_color,
        row?.icon_tint_color || ""
      );
      const markerColor = String(row?.marker_color || "").trim();
      const highConfidenceMarkerColor = String(row?.high_confidence_marker_color || "").trim();
      const domainType = String(row?.domain_type || "").trim().toLowerCase() || defaultDomainType(domainKey);

      RUNTIME_DOMAIN_META.domainTypeByDomain.set(domainKey, domainType);
      if (reportPrefix) RUNTIME_DOMAIN_META.reportPrefixByDomain.set(domainKey, reportPrefix);
      if (iconSrc) RUNTIME_DOMAIN_META.iconSrcByDomain.set(domainKey, iconSrc);
      if (iconRenderMode) RUNTIME_DOMAIN_META.iconRenderModeByDomain.set(domainKey, iconRenderMode);
      if (iconTintMode) RUNTIME_DOMAIN_META.iconTintModeByDomain.set(domainKey, iconTintMode);
      if (iconTintColor) RUNTIME_DOMAIN_META.iconTintColorByDomain.set(domainKey, iconTintColor);
      if (highConfidenceIconTintMode) {
        RUNTIME_DOMAIN_META.highConfidenceIconTintModeByDomain.set(domainKey, highConfidenceIconTintMode);
      }
      if (highConfidenceIconTintColor) {
        RUNTIME_DOMAIN_META.highConfidenceIconTintColorByDomain.set(domainKey, highConfidenceIconTintColor);
      }
      RUNTIME_DOMAIN_META.labelByDomain.set(domainKey, label);
      if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(markerColor)) {
        RUNTIME_DOMAIN_META.markerColorByDomain.set(domainKey, markerColor);
      }
      if (Number.isFinite(Number(row?.public_visibility_min_reports))) {
        RUNTIME_DOMAIN_META.publicVisibilityMinReportsByDomain.set(
          domainKey,
          Number(row.public_visibility_min_reports)
        );
      }
      if (Number.isFinite(Number(row?.high_confidence_min_reports))) {
        RUNTIME_DOMAIN_META.highConfidenceMinReportsByDomain.set(
          domainKey,
          Number(row.high_confidence_min_reports)
        );
      }
      if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(highConfidenceMarkerColor)) {
        RUNTIME_DOMAIN_META.highConfidenceMarkerColorByDomain.set(domainKey, highConfidenceMarkerColor);
      }
      RUNTIME_DOMAIN_META.rawIssueTypesByDomain.set(domainKey, Array.isArray(row?.issue_types) ? row.issue_types : []);
      RUNTIME_DOMAIN_META.rawTypeOptionsByDomain.set(domainKey, Array.isArray(row?.type_options) ? row.type_options : []);
      RUNTIME_DOMAIN_META.disclosuresByDomain.set(domainKey, row?.report_disclosures ?? null);
      if (typeof row?.allow_report_images === "boolean") {
        RUNTIME_DOMAIN_META.allowReportImagesByDomain.set(domainKey, row.allow_report_images === true);
      }
      if (typeof row?.road_required === "boolean") {
        RUNTIME_DOMAIN_META.roadRequiredByDomain.set(domainKey, row.road_required === true);
      }
      if (typeof row?.park_required === "boolean") {
        RUNTIME_DOMAIN_META.parkRequiredByDomain.set(domainKey, row.park_required === true);
      }

      normalizedRows.push({
        domain_key: domainKey,
        label,
        icon_key: String(row?.icon_key || "").trim(),
        icon_src: iconSrc,
        icon_render_mode: iconRenderMode,
        icon_tint_mode: iconTintMode,
        icon_tint_color: iconTintColor,
        high_confidence_icon_tint_mode: highConfidenceIconTintMode,
        high_confidence_icon_tint_color: highConfidenceIconTintColor,
        report_prefix: reportPrefix,
        marker_color: markerColor,
        allow_report_images: row?.allow_report_images === true,
        road_required: row?.road_required === true,
        park_required: row?.park_required === true,
      });
    }
    return normalizedRows;
  }, [clearRuntimeDomainMeta]);
  const applyTenantDomainConfigSnapshot = useCallback((snapshot, { loaded = true } = {}) => {
    const domainConfigByDomain =
      snapshot?.domainConfigByDomain && typeof snapshot.domainConfigByDomain === "object"
        ? snapshot.domainConfigByDomain
        : {};
    const registryIncidentDomains = normalizeRegistryIncidentDomainRows(snapshot?.registryIncidentDomains || []);
    setTenantDomainPublicConfigByDomain(domainConfigByDomain);
    setTenantRegistryIncidentDomains(registryIncidentDomains);
    setTenantDomainConfigLoaded(loaded);
  }, [normalizeRegistryIncidentDomainRows]);
  const isDomainPublic = useCallback((domainKey) => {
    const key = String(domainKey || "").trim();
    if (!key) return false;
    if (!ENABLE_TENANT_VISIBILITY_CONFIG || !tenantVisibilityLoaded) {
      return DEFAULT_PUBLIC_DOMAINS.has(key);
    }
    const configured = String(tenantVisibilityByDomain?.[key] || "").trim().toLowerCase();
    if (configured === "public") return true;
    if (configured === "internal_only") return false;
    return false;
  }, [tenantVisibilityByDomain, tenantVisibilityLoaded]);
  const registryVisibleDomainOptions = useMemo(() => {
    return (tenantRegistryIncidentDomains || [])
      .map((row) => {
        const key = normalizeDomainKeyOrSlug(row?.domain_key || row?.key, { allowUnknown: true });
        if (!key) return null;
        const iconSrc = String(
          RUNTIME_DOMAIN_META.iconSrcByDomain.get(key)
          || row?.icon_src
          || resolveRuntimeDomainIconSrc(key, "", row?.icon_key)
          || ""
        ).trim();
        return {
          key,
          label: String(
            RUNTIME_DOMAIN_META.labelByDomain.get(key)
            || row?.label
            || key
          ).trim() || key,
          icon: "📍",
          iconSrc,
          markerColor: String(
            RUNTIME_DOMAIN_META.markerColorByDomain.get(key)
            || row?.marker_color
            || defaultMarkerColorForDomain(key)
          ).trim() || defaultMarkerColorForDomain(key),
          enabled: true,
          source: "registry",
        };
      })
      .filter(Boolean);
  }, [tenantRegistryIncidentDomains]);
  const waitingForTenantDomainConfig = tenant?.ready !== false
    && Boolean(resolvedTenantDomainConfigTenantKey)
    && !tenantDomainConfigLoaded;
  const visibleDomainOptions = useMemo(() => {
    const legacyOptions = builtInReportDomainOptions.filter((d) => isDomainPublic(d.key)).map((d) => ({
      ...d,
      enabled: true,
    }));
    if (!registryVisibleDomainOptions.length) {
      if (waitingForTenantDomainConfig) return [];
      return legacyOptions;
    }
    const merged = new Map();
    for (const option of registryVisibleDomainOptions) {
      merged.set(String(option?.key || "").trim().toLowerCase(), option);
    }
    return Array.from(merged.values());
  }, [builtInReportDomainOptions, isDomainPublic, registryVisibleDomainOptions, waitingForTenantDomainConfig]);
  const visibleReportDomainKeys = useMemo(
    () => (visibleDomainOptions || [])
      .map((option) => String(option?.key || "").trim())
      .filter(Boolean),
    [visibleDomainOptions]
  );
  const visibleDomainOptionsByKey = useMemo(() => {
    const next = new Map();
    for (const option of visibleDomainOptions || []) {
      const key = String(option?.key || "").trim();
      if (!key) continue;
      next.set(key, option);
    }
    return next;
  }, [visibleDomainOptions]);
  const builtInReportDomainOptionsByKey = useMemo(() => {
    const next = new Map();
    for (const option of builtInReportDomainOptions || []) {
      const key = String(option?.key || "").trim();
      if (!key) continue;
      next.set(key, option);
    }
    return next;
  }, [builtInReportDomainOptions]);
  tenantRegistryIncidentDomainsRef.current = tenantRegistryIncidentDomains || [];
  visibleDomainOptionsRef.current = visibleDomainOptions || [];
  tenantDomainConfigLoadedRef.current = tenantDomainConfigLoaded;
  const shouldComputeMyReportsDomainSelection = Boolean(myReportsOpen);
  const activeMyReportsDomainKeys = useMemo(() => {
    if (!shouldComputeMyReportsDomainSelection) return [];
    const explicitKeys = normalizeExplicitDomainSelection(myReportsDomainFilters, visibleReportDomainKeys);
    return explicitKeys.length ? explicitKeys : visibleReportDomainKeys;
  }, [myReportsDomainFilters, shouldComputeMyReportsDomainSelection, visibleReportDomainKeys]);
  const hasExplicitMyReportsDomainFilter = useMemo(
    () => shouldComputeMyReportsDomainSelection
      && normalizeExplicitDomainSelection(myReportsDomainFilters, visibleReportDomainKeys).length > 0,
    [myReportsDomainFilters, shouldComputeMyReportsDomainSelection, visibleReportDomainKeys]
  );
  const resetMyReportsDomainFilters = useCallback(() => {
    setMyReportsDomainFilters((prev) => {
      const current = normalizeExplicitDomainSelection(prev, visibleReportDomainKeys);
      const hasNoneSelection = current.includes(NO_REPORT_DOMAINS_KEY);
      if (hasNoneSelection) return [];
      if (!current.length) return [NO_REPORT_DOMAINS_KEY];
      return [];
    });
  }, [visibleReportDomainKeys]);
  const toggleMyReportsDomainFilter = useCallback((domainKeyRaw) => {
    const domainKey = String(domainKeyRaw || "").trim();
    if (!domainKey) return;
    setMyReportsDomainFilters((prev) => {
      const currentRaw = normalizeExplicitDomainSelection(prev, visibleReportDomainKeys);
      const hasNoneSelection = currentRaw.includes(NO_REPORT_DOMAINS_KEY);
      const current = hasNoneSelection ? [] : currentRaw;
      let next = [];
      if (hasNoneSelection) {
        next = [domainKey];
      } else if (!current.length) {
        next = visibleReportDomainKeys.filter((key) => key !== domainKey);
      } else if (current.includes(domainKey)) {
        next = current.length === 1 ? [NO_REPORT_DOMAINS_KEY] : current.filter((key) => key !== domainKey);
      } else {
        next = [...current, domainKey];
      }
      return normalizeExplicitDomainSelection(next, visibleReportDomainKeys);
    });
    setMyReportsDomain(domainKey);
    setAdminReportDomain(domainKey);
  }, [visibleReportDomainKeys]);
  const isRoadRequiredForDomain = useCallback((domainKeyRaw) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
    if (!domainKey) return false;
    const cfg = tenantDomainPublicConfigByDomain?.[domainKey] || null;
    if (typeof cfg?.road_required === "boolean") return cfg.road_required === true;
    return resolveRuntimeDomainRoadRequiredShared(domainKey);
  }, [tenantDomainPublicConfigByDomain]);
  const isParkRequiredForDomain = useCallback((domainKeyRaw) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
    if (!domainKey) return false;
    const cfg = tenantDomainPublicConfigByDomain?.[domainKey] || null;
    if (typeof cfg?.park_required === "boolean") return cfg.park_required === true;
    return resolveRuntimeDomainParkRequiredShared(domainKey);
  }, [tenantDomainPublicConfigByDomain]);
  const shouldPrioritizeTenantParksLoad = useMemo(
    () => (visibleDomainOptions || []).some((option) => {
      const domainKey = normalizeDomainKeyOrSlug(option?.key, { allowUnknown: true });
      if (!domainKey) return false;
      const cfg = tenantDomainPublicConfigByDomain?.[domainKey] || null;
      if (typeof cfg?.park_required === "boolean") return cfg.park_required === true;
      return resolveRuntimeDomainParkRequiredShared(domainKey);
    }),
    [tenantDomainPublicConfigByDomain, visibleDomainOptions]
  );
  const resolveVisibleDomainIconSrc = useCallback((domainKeyRaw, fallback = "") => {
    const key = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
    if (!key) return String(fallback || "").trim();
    return String(
      RUNTIME_DOMAIN_META.iconSrcByDomain.get(key)
      || visibleDomainOptionsByKey.get(key)?.iconSrc
      || builtInReportDomainOptionsByKey.get(key)?.iconSrc
      || fallback
      || ""
    ).trim();
  }, [builtInReportDomainOptionsByKey, visibleDomainOptionsByKey]);
  const visibleDomainIconUrlSignature = useMemo(
    () => (visibleDomainOptions || [])
      .map((option) => String(option?.iconSrc || "").trim())
      .filter((url) => /^(https?:|\/)/i.test(url))
      .join("|"),
    [visibleDomainOptions]
  );
  useEffect(() => {
    if (!startupWarmupReady) return;
    const urls = visibleDomainIconUrlSignature
      ? visibleDomainIconUrlSignature.split("|").filter(Boolean)
      : [];
    if (!urls.length || typeof window === "undefined") return;
    let cancelled = false;
    urls.forEach((url) => {
      if (preloadedDomainIconUrlsRef.current.has(url)) return;
      preloadedDomainIconUrlsRef.current.add(url);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = img.onerror = () => {
        if (cancelled) return;
        setDomainIconRenderTick((tick) => tick + 1);
      };
      img.src = url;
    });
    return () => {
      cancelled = true;
    };
  }, [startupWarmupReady, visibleDomainIconUrlSignature]);
  const assetLayerOptions = useMemo(() => {
    const includeInternalAssetLayers = Boolean(isAdmin);
    const visibleAssetOptions = (visibleDomainOptions || []).filter((d) => isTenantAssetBackedDomain(d.key));
    const next = [...visibleAssetOptions];
    const hasStreetlightLayer = next.some((d) => d.key === "streetlights");
    if (!hasStreetlightLayer) {
      const streetlightsOption = builtInReportDomainOptionsByKey.get("streetlights");
      if (streetlightsOption) {
        next.unshift({ ...streetlightsOption, enabled: true });
      }
    }
    if (includeInternalAssetLayers) {
      for (const option of builtInReportDomainOptions.filter((d) => isAssetBackedDomainKey(d.key))) {
        if (next.some((d) => d.key === option.key)) continue;
        next.push({ ...option, enabled: true });
      }
    }
    return next;
  }, [builtInReportDomainOptions, builtInReportDomainOptionsByKey, visibleDomainOptions, isAdmin, isTenantAssetBackedDomain]);
  const incidentLayerDomainOptions = useMemo(
    () => (visibleDomainOptions || []).filter((d) => isTenantIncidentDrivenDomain(d.key)),
    [visibleDomainOptions, isTenantIncidentDrivenDomain]
  );
  const incidentLayerDomainKeySet = useMemo(
    () => new Set((incidentLayerDomainOptions || []).map((option) => String(option?.key || "").trim()).filter(Boolean)),
    [incidentLayerDomainOptions]
  );
  const activeIncidentMapFilterKeys = useMemo(() => {
    const explicitKeys = normalizeExplicitDomainSelection(
      incidentMapFilterKeys,
      incidentLayerDomainOptions.map((option) => option.key)
    );
    if (explicitKeys.includes(NO_REPORT_DOMAINS_KEY)) return [];
    return explicitKeys;
  }, [incidentMapFilterKeys, incidentLayerDomainOptions]);
  const hasExplicitIncidentMapFilter = useMemo(
    () => normalizeExplicitDomainSelection(
      incidentMapFilterKeys,
      incidentLayerDomainOptions.map((option) => option.key)
    ).length > 0,
    [incidentMapFilterKeys, incidentLayerDomainOptions]
  );
  const incidentMapVisibleDomainKeys = useMemo(() => {
    if (activeIncidentMapFilterKeys.length) return activeIncidentMapFilterKeys;
    if (hasExplicitIncidentMapFilter) return [];
    return (incidentLayerDomainOptions || [])
      .map((option) => String(option?.key || "").trim())
      .filter(Boolean);
  }, [activeIncidentMapFilterKeys, hasExplicitIncidentMapFilter, incidentLayerDomainOptions]);
  const incidentLayerButtonEnabled = isRuntimeUiIconEnabled("incidentReportingLayer", UI_ICON_SRC.incidentReportingLayer);
  const allIncidentReportsOptionEnabled = isRuntimeUiIconEnabled("allIncidentReports", UI_ICON_SRC.allIncidentReports);
  const layerOptions = useMemo(() => {
    const opts = [...assetLayerOptions];
    if (incidentLayerDomainOptions.length) {
      opts.push({
        key: INCIDENT_REPORTING_LAYER_KEY,
        label: "Incident Reporting",
        icon: "📍",
        iconSrc: UI_ICON_SRC.incidentReportingLayer,
        iconKey: "incidentReportingLayer",
        enabled: incidentLayerButtonEnabled,
      });
    }
    return opts;
  }, [assetLayerOptions, domainIconRenderTick, incidentLayerDomainOptions, incidentLayerButtonEnabled]);
  const layerOptionsByKey = useMemo(() => {
    const next = new Map();
    for (const option of layerOptions || []) {
      const key = String(option?.key || "").trim();
      if (!key) continue;
      next.set(key, option);
    }
    return next;
  }, [layerOptions]);
  const resolvedIncidentMapDomain = useMemo(() => {
    if (incidentLayerDomainOptions.some((d) => d.key === lastIncidentMapDomain)) return lastIncidentMapDomain;
    if (incidentLayerDomainOptions.some((d) => d.key === adminReportDomain)) return adminReportDomain;
    return String(preferredInitialDomainKey(incidentLayerDomainOptions) || "").trim();
  }, [incidentLayerDomainOptions, lastIncidentMapDomain, adminReportDomain]);
  const resolvedIncidentLayerOption = useMemo(() => {
    const resolvedKey = String(resolvedIncidentMapDomain || "").trim();
    if (!resolvedKey) return incidentLayerDomainOptions[0] || null;
    return incidentLayerDomainOptions.find((d) => d.key === resolvedKey) || incidentLayerDomainOptions[0] || null;
  }, [incidentLayerDomainOptions, resolvedIncidentMapDomain]);
  useEffect(() => {
    setIncidentMapFilterKeys((prev) => {
      const next = Array.isArray(prev)
        ? prev
            .map((key) => String(key || "").trim())
            .filter((key) => incidentLayerDomainKeySet.has(key))
        : [];
      if (next.length === (Array.isArray(prev) ? prev.length : 0)) return prev;
      return next;
    });
  }, [incidentLayerDomainKeySet]);
  const shouldComputeOpenReportsDomainSelection = Boolean(
    openReportsOpen || (myReportsOpen && myReportsReportedByMode === "all")
  );
  const openReportsDomainOptions = useMemo(
    () => {
      if (!shouldComputeOpenReportsDomainSelection) return [];
      return (visibleDomainOptions || []).filter((option) => {
      const domainKey = String(option?.key || "").trim().toLowerCase();
      if (!domainKey) return false;
      return isTenantOrganizationManagedIncidentDomain(domainKey);
      });
    },
    [isTenantOrganizationManagedIncidentDomain, shouldComputeOpenReportsDomainSelection, visibleDomainOptions]
  );
  const openReportsVisibleDomainKeys = useMemo(
    () => (openReportsDomainOptions || [])
      .map((option) => String(option?.key || "").trim())
      .filter(Boolean),
    [openReportsDomainOptions]
  );
  const openReportsVisibleDomainKeySet = useMemo(
    () => new Set(openReportsVisibleDomainKeys.map((key) => String(key || "").trim().toLowerCase()).filter(Boolean)),
    [openReportsVisibleDomainKeys]
  );
  const activeOpenReportsDomainKeys = useMemo(() => {
    if (!openReportsOpen) return [];
    const explicitKeys = normalizeExplicitDomainSelection(openReportsDomainFilters, openReportsVisibleDomainKeys);
    if (explicitKeys.includes(NO_REPORT_DOMAINS_KEY)) return [];
    return explicitKeys.length ? explicitKeys : openReportsVisibleDomainKeys;
  }, [openReportsDomainFilters, openReportsOpen, openReportsVisibleDomainKeys]);
  const resolvedOpenReportsActiveDomain = useMemo(() => {
    if (!openReportsOpen) return "streetlights";
    const selectedKeys = Array.isArray(activeOpenReportsDomainKeys) ? activeOpenReportsDomainKeys : [];
    if (selectedKeys.includes(adminReportDomain)) return adminReportDomain;
    return String(
      selectedKeys[0]
      || adminReportDomain
      || preferredInitialDomainKey(openReportsDomainOptions)
      || "streetlights"
    ).trim() || "streetlights";
  }, [activeOpenReportsDomainKeys, adminReportDomain, openReportsDomainOptions, openReportsOpen]);
  const hasExplicitOpenReportsDomainFilter = useMemo(
    () => openReportsOpen
      && normalizeExplicitDomainSelection(openReportsDomainFilters, openReportsVisibleDomainKeys).length > 0,
    [openReportsDomainFilters, openReportsOpen, openReportsVisibleDomainKeys]
  );
  const resetOpenReportsDomainFilters = useCallback(() => {
    setOpenReportsDomainFilters((prev) => {
      const current = normalizeExplicitDomainSelection(prev, openReportsVisibleDomainKeys);
      const hasNoneSelection = current.includes(NO_REPORT_DOMAINS_KEY);
      if (hasNoneSelection) return [];
      if (!current.length) return [NO_REPORT_DOMAINS_KEY];
      return [];
    });
  }, [openReportsVisibleDomainKeys]);
  const toggleOpenReportsDomainFilter = useCallback((domainKeyRaw) => {
    const domainKey = String(domainKeyRaw || "").trim();
    if (!domainKey) return;
    setOpenReportsDomainFilters((prev) => {
      const currentRaw = normalizeExplicitDomainSelection(prev, openReportsVisibleDomainKeys);
      const hasNoneSelection = currentRaw.includes(NO_REPORT_DOMAINS_KEY);
      const current = hasNoneSelection ? [] : currentRaw;
      let next = [];
      if (hasNoneSelection) {
        next = [domainKey];
      } else if (!current.length) {
        next = openReportsVisibleDomainKeys.filter((key) => key !== domainKey);
      } else if (current.includes(domainKey)) {
        next = current.length === 1 ? [NO_REPORT_DOMAINS_KEY] : current.filter((key) => key !== domainKey);
      } else {
        next = [...current, domainKey];
      }
      return normalizeExplicitDomainSelection(next, openReportsVisibleDomainKeys);
    });
  }, [openReportsVisibleDomainKeys]);
  const shouldWaitForAuthBeforePublicMapLoad = true;
  const publicReadAccessReady = isMapReadAccessReadyShared({
    authReady,
    shouldWaitForAuth: shouldWaitForAuthBeforePublicMapLoad,
    waitingForReportAccess: waitingForAuthenticatedMapAccess,
  });
  const canToggleReportedByInMyReports = canOpenDomainReports || canOpenAdminReports;

  useEffect(() => {
    if (!openReportsOpen) return;
    if (!openReportsDomainOptions.length) return;
    if (openReportsDomainOptions.some((d) => d.key === adminReportDomain)) return;
    setAdminReportDomain(preferredInitialDomainKey(openReportsDomainOptions));
  }, [openReportsOpen, openReportsDomainOptions, adminReportDomain]);

  useEffect(() => {
    if (!isTenantIncidentDrivenDomain(adminReportDomain)) return;
    const nextIncidentDomain = String(adminReportDomain || "").trim();
    if (!nextIncidentDomain || nextIncidentDomain === lastIncidentMapDomain) return;
    setLastIncidentMapDomain(nextIncidentDomain);
  }, [adminReportDomain, lastIncidentMapDomain, isTenantIncidentDrivenDomain]);

  useEffect(() => {
    if (waitingForTenantDomainConfig) return;
    if (!layerOptions.length) return;
    if (layerOptions.some((d) => d.key === activeMapLayerKey)) return;
    const fallbackLayerKey = layerOptions.some((d) => d.key === INCIDENT_REPORTING_LAYER_KEY)
      ? INCIDENT_REPORTING_LAYER_KEY
      : layerOptions.some((d) => d.key === "streetlights")
        ? "streetlights"
        : String(layerOptions?.[0]?.key || "streetlights").trim() || "streetlights";
    setActiveMapLayerKey(fallbackLayerKey);
  }, [layerOptions, activeMapLayerKey, waitingForTenantDomainConfig]);

  useEffect(() => {
    if (canOpenDomainReports) return;
    if (!openReportsOpen) return;
    setOpenReportsOpen(false);
  }, [canOpenDomainReports, openReportsOpen]);

  useEffect(() => {
    const requestedView = String(initialReportView || "").trim().toLowerCase();
    if (initialReportViewHandledRef.current) return;
    if (!requestedView) {
      initialReportViewHandledRef.current = true;
      return;
    }
    if (!visibleDomainOptions.length) return;
    if (requestedView === "all" && !reportAccessResolved) return;
    if (requestedView === "all") {
      if (!canToggleReportedByInMyReports) {
        initialReportViewHandledRef.current = true;
        return;
      }
      initialReportViewHandledRef.current = true;
      if (isTenantIncidentDrivenDomain(activeMapLayerKey)) {
        setActiveMapLayerKey(INCIDENT_REPORTING_LAYER_KEY);
      }
      openMyReports({ reportedByMode: "all", inViewOnly: false });
      return;
    }
    if (requestedView === "me") {
      initialReportViewHandledRef.current = true;
      openMyReports({ reportedByMode: "me", inViewOnly: false });
      return;
    }
    initialReportViewHandledRef.current = true;
  }, [
    initialReportView,
    visibleDomainOptions,
    reportAccessResolved,
    canToggleReportedByInMyReports,
    isTenantIncidentDrivenDomain,
    activeMapLayerKey,
  ]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!myReportsOpen) return;
    if (hasExplicitMyReportsDomainFilter) return;
    if (activeMyReportsDomainKeys.length !== 1) return;
    if (myReportsDomain === adminReportDomain) return;
    setMyReportsDomain(adminReportDomain);
  }, [isAdmin, myReportsOpen, myReportsDomain, adminReportDomain, hasExplicitMyReportsDomainFilter, activeMyReportsDomainKeys]);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [authResetLoading, setAuthResetLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordError, setForgotPasswordError] = useState("");

  // Signup fields
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPassword2, setSignupPassword2] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupLegalAccepted, setSignupLegalAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  // Gate flow
  const [guestInfo, setGuestInfo] = useState({ name: "", phone: "", email: "" });
  const [guestInfoDraft, setGuestInfoDraft] = useState({ name: "", phone: "", email: "" });
  const [guestInfoOpen, setGuestInfoOpen] = useState(false);
  const [contactChoiceOpen, setContactChoiceOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [pendingGuestAction, setPendingGuestAction] = useState(null); // { kind: "report" | "working" | "bulk" | "repair", lightId?: string, incidentId?: string, domainKey?: string }
  const guestSubmitBypassRef = useRef(false);
  const domainSubmitInFlightRef = useRef(false);
  const domainSubmitDedupRef = useRef(new Map());
  const [profile, setProfile] = useState(null); // { full_name, phone, email }


  const [showAdminLogin] = useState(() => {
    try {
      return window.location.hash.includes("admin");
    } catch {
      return false;
    }
  });

  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileHeaderMenuOpen, setMobileHeaderMenuOpen] = useState(false);
  const [mobileTabTransitionDirection, setMobileTabTransitionDirection] = useState("forward");
  const [accountView, setAccountView] = useState("menu"); 
  // "menu" | "manage" | "myReports"
  const [manageOpen, setManageOpen] = useState(false);
  const [manageEditing, setManageEditing] = useState(false);
  const [manageSaving, setManageSaving] = useState(false);
  const [manageForm, setManageForm] = useState({ full_name: "", phone: "" });
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountSaving, setDeleteAccountSaving] = useState(false);
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState("");
  const [deleteAccountDisclosureAccepted, setDeleteAccountDisclosureAccepted] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthSaving, setReauthSaving] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthIntent, setReauthIntent] = useState(null); // "edit_profile" | "save_profile" | "delete_account"
  const reauthAtRef = useRef(0);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordSaving, setChangePasswordSaving] = useState(false);
  const [changePasswordValue, setChangePasswordValue] = useState("");
  const [changePasswordValue2, setChangePasswordValue2] = useState("");
  const [changePasswordCurrentValue, setChangePasswordCurrentValue] = useState("");
  const [recoveryPasswordOpen, setRecoveryPasswordOpen] = useState(false);
  const [recoveryPasswordSaving, setRecoveryPasswordSaving] = useState(false);
  const [recoveryPasswordValue, setRecoveryPasswordValue] = useState("");
  const [recoveryPasswordValue2, setRecoveryPasswordValue2] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]); // array of official light UUIDs
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isWorkingConfirmOpen, setIsWorkingConfirmOpen] = useState(false);
  const [pendingWorkingLightId, setPendingWorkingLightId] = useState(null);
  const [incidentRepairConfirmOpen, setIncidentRepairConfirmOpen] = useState(false);
  const [pendingIncidentRepairId, setPendingIncidentRepairId] = useState("");
  const [pendingIncidentRepairDomainKey, setPendingIncidentRepairDomainKey] = useState("");
  const [utilityReportDialogOpen, setUtilityReportDialogOpen] = useState(false);
  const [pendingUtilityReportLightId, setPendingUtilityReportLightId] = useState(null);
  const [pendingUtilityReportReference, setPendingUtilityReportReference] = useState("");
  const [markFixedConfirmOpen, setMarkFixedConfirmOpen] = useState(false);
  const [pendingMarkFixedLightId, setPendingMarkFixedLightId] = useState(null);
  const [pendingMarkFixedClusterReports, setPendingMarkFixedClusterReports] = useState([]);
  const [pendingIncidentCompatMarker, setPendingIncidentCompatMarker] = useState(null);
  const [, setPendingIncidentActionType] = useState("fix"); // fix | reopen
  const [pendingIncidentDomainKey, setPendingIncidentDomainKey] = useState("");
  const [pendingIncidentCurrentState, setPendingIncidentCurrentState] = useState("");
  const [pendingIncidentNextState, setPendingIncidentNextState] = useState("");
  const [pendingIncidentLabel, setPendingIncidentLabel] = useState("");
  const [pendingIncidentIsOfficialTarget, setPendingIncidentIsOfficialTarget] = useState(false);
  const [pendingIncidentPin, setPendingIncidentPin] = useState("");
  const [pendingIncidentStatusError, setPendingIncidentStatusError] = useState("");
  const [markFixedNote, setMarkFixedNote] = useState("");
  const [deleteOfficialConfirmOpen, setDeleteOfficialConfirmOpen] = useState(false);
  const [pendingDeleteOfficialLightId, setPendingDeleteOfficialLightId] = useState(null);
  const [deleteCircleMode, setDeleteCircleMode] = useState(false);
  const [deleteCircleDraft, setDeleteCircleDraft] = useState(null); // { center: {lat,lng}, radiusMeters }
  const [deleteCircleConfirmOpen, setDeleteCircleConfirmOpen] = useState(false);
  const [deleteCircleNote, setDeleteCircleNote] = useState("");
  const [deleteOfficialSignConfirmOpen, setDeleteOfficialSignConfirmOpen] = useState(false);
  const [pendingDeleteOfficialSignId, setPendingDeleteOfficialSignId] = useState(null);
  const [clearQueuedConfirmOpen, setClearQueuedConfirmOpen] = useState(false);
  const [domainSwitchConfirmOpen, setDomainSwitchConfirmOpen] = useState(false);
  const [pendingDomainSwitchTarget, setPendingDomainSwitchTarget] = useState(null);
  const [queueSignTypeOpen, setQueueSignTypeOpen] = useState(false);
  const [pendingQueuedSign, setPendingQueuedSign] = useState(null); // {lat, lng, sign_type}
  const [incidentTypePickerOpen, setIncidentTypePickerOpen] = useState(false);
  const [pendingIncidentTypeTarget, setPendingIncidentTypeTarget] = useState(null);
  const [incidentTypePickerOpenedAt, setIncidentTypePickerOpenedAt] = useState(0);
  const [mappingQueue, setMappingQueue] = useState([]);
  const [notificationPreferencesOpen, setNotificationPreferencesOpen] = useState(false);
  const [savedNotificationPreferencesByTopic, setSavedNotificationPreferencesByTopic] = useState({});
  const nativePushRegisteringRef = useRef(false);
  const showNotificationPreferencesEntry =
    Boolean(session?.user?.id) &&
    (tenantMapFeatures?.show_alert_icon !== false || tenantMapFeatures?.show_event_icon !== false);
  const shouldLoadReportAccessEagerly =
    Boolean(session?.user?.id) ||
    accountMenuOpen ||
    mobileHeaderMenuOpen ||
    openReportsOpen ||
    myReportsOpen ||
    String(initialReportView || "").trim().toLowerCase() === "all" ||
    Boolean(String(initialReportDeepLinkRef.current?.focusIncidentId || "").trim());
  const shouldLoadProfileEagerly =
    manageOpen ||
    myReportsOpen ||
    openReportsOpen ||
    Boolean(domainReportTarget) ||
    Boolean(domainDisclosureGateTarget) ||
    Boolean(confirmReportTarget);
  const shouldLoadAdminStateEagerly =
    Boolean(session?.user?.id) ||
    adminMenuOpen ||
    accountMenuOpen ||
    mobileHeaderMenuOpen ||
    myReportsOpen ||
    openReportsOpen ||
    manageOpen ||
    mappingMode ||
    Boolean(domainReportTarget) ||
    Boolean(domainDisclosureGateTarget) ||
    Boolean(confirmReportTarget);
  const shouldPrepareCommunityFeedReadState =
    alertsWindowOpen ||
    eventsWindowOpen ||
    (Boolean(session?.user?.id) && (notificationsWindowOpen || notificationPreferencesOpen));
  const shouldComputeStreetlightRuntimeState = Boolean(
    activeMapLayerKey === "streetlights"
    || myReportsOpen
    || openReportsOpen
    || mappingMode
    || bulkMode
    || selectedOfficialId
    || activeLight
    || domainReportTarget
    || domainDisclosureGateTarget
    || confirmReportTarget
  );
  const normalizedStreetlightInViewFilterMode = String(streetlightInViewFilterMode || "all").trim().toLowerCase() || "all";
  const shouldPrioritizeStreetlightRuntimeStartup = Boolean(
    myReportsOpen
    || openReportsOpen
    || mappingMode
    || bulkMode
    || selectedOfficialId
    || activeLight
    || domainReportTarget
    || domainDisclosureGateTarget
    || confirmReportTarget
  );
  const hasStreetlightViewerIdentityHints = Boolean(
    String(
      session?.user?.id
      || guestInfo?.email
      || guestInfo?.phone
      || guestInfo?.name
      || ""
    ).trim()
  );
  const viewerIdentityKey = useMemo(
    () => reporterIdentityKey({ session, profile, guestInfo }),
    [session?.user?.id, guestInfo?.email, guestInfo?.phone, guestInfo?.name]
  );
  const shouldNeedStreetlightConfidenceState = Boolean(
    shouldComputeStreetlightRuntimeState && (
      shouldPrioritizeStreetlightRuntimeStartup
      || reportsAdminView
      || normalizedStreetlightInViewFilterMode !== "all"
      || hasStreetlightViewerIdentityHints
    )
  );
  const shouldWarmStreetlightConfidenceModule = Boolean(
    shouldNeedStreetlightConfidenceState && (
      shouldPrioritizeStreetlightRuntimeStartup
      || nonCriticalStartupReady
    )
  );
  const shouldComputeStreetlightRuntimeStateRef = useRef(shouldComputeStreetlightRuntimeState);
  const shouldPrioritizeStreetlightRuntimeStartupRef = useRef(shouldPrioritizeStreetlightRuntimeStartup);

  useEffect(() => {
    shouldComputeStreetlightRuntimeStateRef.current = shouldComputeStreetlightRuntimeState;
  }, [shouldComputeStreetlightRuntimeState]);

  useEffect(() => {
    shouldPrioritizeStreetlightRuntimeStartupRef.current = shouldPrioritizeStreetlightRuntimeStartup;
  }, [shouldPrioritizeStreetlightRuntimeStartup]);

  useEffect(() => {
    if (!shouldWarmStreetlightConfidenceModule) return undefined;
    if (!shouldPrioritizeStreetlightRuntimeStartup && !startupWarmupReady) return undefined;
    if (typeof computeStreetlightConfidenceSnapshot === "function") return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const module = await loadStreetlightConfidenceModule();
        if (cancelled) return;
        setComputeStreetlightConfidenceSnapshot(() => module.computeStreetlightConfidenceSnapshot);
      } catch (error) {
        if (!cancelled) {
          console.warn("[streetlight confidence]", error?.message || error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    computeStreetlightConfidenceSnapshot,
    startupWarmupReady,
    shouldWarmStreetlightConfidenceModule,
    shouldPrioritizeStreetlightRuntimeStartup,
  ]);

  const handleAccountMenuToggle = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setMobileHeaderMenuOpen(false);
    setAccountMenuOpen((prev) => !prev);
    setAccountView("menu");
  }, []);

  const nativePushShouldRegister = useMemo(() => {
    if (!NATIVE_PUSH_ENABLED) return false;
    if (!isNativeAppRuntime()) return false;
    if (getPlatformName() === "android") return false;
    return Boolean(showNotificationPreferencesEntry);
  }, [showNotificationPreferencesEntry]);

  const closeAccountSubpages = useCallback(() => {
    setAccountMenuOpen(false);
    setManageOpen(false);
    setManageEditing(false);
    setDeleteAccountOpen(false);
    setDeleteAccountConfirmText("");
    setDeleteAccountDisclosureAccepted(false);
    setNotificationPreferencesOpen(false);
    setFollowedLocationsOpen(false);
    setAccountView("menu");
  }, []);

  const clearDeleteAccountQuery = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("deleteAccount")) return;
      url.searchParams.delete("deleteAccount");
      const next = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}${url.hash || ""}`;
      window.history.replaceState({}, document.title, next);
    } catch {
      // ignore URL cleanup failures
    }
  }, []);

  const openDeleteAccountFlow = useCallback(() => {
    setManageOpen(true);
    setManageEditing(false);
    setDeleteAccountConfirmText("");
    setDeleteAccountDisclosureAccepted(false);
    setDeleteAccountOpen(true);
    setAccountView("manage");
    setAccountMenuOpen(false);
  }, []);

  const showAdminTools = isAdmin || showAdminLogin;

  function recordLocationDiagnostics(snapshot = {}, force = false) {
    if (!showAdminTools) return;
    const now = Date.now();
    if (!force && now - Number(locationDiagnosticsLastStateAtRef.current || 0) < 500) return;
    locationDiagnosticsLastStateAtRef.current = now;
    setLocationDiagnostics({
      updatedAt: now,
      tenantKey: tenant?.tenantKey || activeTenantKey(),
      ...snapshot,
    });
  }

  async function copyLocationDiagnostics() {
    const payload = {
      capturedAt: new Date().toISOString(),
      tenantKey: tenant?.tenantKey || activeTenantKey(),
      activeMapLayerKey,
      autoFollow,
      followCamera,
      travelFollowMode,
      userLoc,
      userHeading,
      liveMotion: liveMotionRef.current,
      diagnostics: locationDiagnostics,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      openNotice("✅", "Copied", "Location diagnostics copied.", { autoCloseMs: 1200, compact: true });
    } catch {
      openNotice("⚠️", "Copy failed", "Could not copy location diagnostics.");
    }
  }



  // =========================
  // BULK REPORTING (official lights)
  // =========================
  const bulkSelectedSet = useMemo(() => new Set(bulkSelectedIds), [bulkSelectedIds]);
  const bulkSelectedCount = bulkSelectedIds.length;

  function clearBulkSelection() {
    setBulkSelectedIds([]);
  }
  

  function toggleBulkSelection(id) {
    const alreadySelected = bulkSelectedSet.has(id);
    if (!alreadySelected && Number(mapZoomRef.current || mapZoom) < 17) {
      openConfiguredNotice("zoom_to_select", {
        icon: "🔎",
        title: "Zoom in to select",
        message: "To improve accuracy of bulk selection, zoom in further before selecting lights.",
      });
      return;
    }
    setBulkSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= BULK_MAX_LIGHTS_PER_SUBMIT) {
        openNotice("⚠️", "Selection limit", `You can select up to ${BULK_MAX_LIGHTS_PER_SUBMIT} lights per bulk report.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  function exitBulkMode() {
    setBulkMode(false);
    setBulkConfirmOpen(false);
    clearBulkSelection();
  }

  function resetDeleteCircleTool() {
    setDeleteCircleMode(false);
    setDeleteCircleDraft(null);
    setDeleteCircleConfirmOpen(false);
    setDeleteCircleNote("");
  }

  const [exitMappingConfirmOpen, setExitMappingConfirmOpen] = useState(false);

  function exitMappingMode() {
    setMappingMode(false);
    setMappingQueue([]);
    setSelectedQueuedTempId(null);
  }

  function requestClearQueuedLights() {
    if (!mappingQueue.length) return;
    setClearQueuedConfirmOpen(true);
  }

  function confirmClearQueuedLights() {
    setMappingQueue([]);
    setSelectedQueuedTempId(null);
    setClearQueuedConfirmOpen(false);
  }

  const requestExitMappingMode = useCallback(() => {
    if (mappingQueue.length > 0) {
      setExitMappingConfirmOpen(true);
      return;
    }
    exitMappingMode();
  }, [mappingQueue.length, exitMappingMode]);
  function handleMobileBottomRailMapClick() {
    setMobileTabTransitionFor("map");
    setCommunityFeedEditor((prev) => ({ ...prev, open: false }));
    closeMyReports();
    closeAccountSubpages();
    setMobileHeaderMenuOpen(false);
    setAdminDomainMenuOpen(false);
    setAdminToolboxOpen(false);
    setNotificationsWindowOpen(false);
    setAlertsWindowOpen(false);
    setEventsWindowOpen(false);
  }
  function handleMobileBottomRailReportsClick() {
    setMobileTabTransitionFor((!viewerIdentityKey && !hasMapSession) ? "account" : "reports");
    setCommunityFeedEditor((prev) => ({ ...prev, open: false }));
    if (mappingMode) requestExitMappingMode();
    if (bulkMode) setBulkMode(false);
    closeAccountSubpages();
    setMobileHeaderMenuOpen(false);
    setAdminDomainMenuOpen(false);
    setAdminToolboxOpen(false);
    setNotificationsWindowOpen(false);
    setAlertsWindowOpen(false);
    setEventsWindowOpen(false);
    if (!viewerIdentityKey && !hasMapSession) {
      setAccountMenuOpen(true);
      return;
    }
    openMyReports({ inViewOnly: false });
  }
  function handleMobileBottomRailNotificationsClick() {
    setMobileTabTransitionFor((!viewerIdentityKey && !hasMapSession) ? "account" : "notifications");
    setCommunityFeedEditor((prev) => ({ ...prev, open: false }));
    closeMyReports();
    closeAccountSubpages();
    setMobileHeaderMenuOpen(false);
    setAdminDomainMenuOpen(false);
    setAdminToolboxOpen(false);
    setEventsWindowOpen(false);
    setAlertsWindowOpen(false);
    if (!viewerIdentityKey && !hasMapSession) {
      setNotificationsWindowOpen(false);
      setAccountMenuOpen(true);
      return;
    }
    openNotificationsInbox();
  }
  function handleMobileBottomRailAlertsClick() {
    setMobileTabTransitionFor("alerts");
    setCommunityFeedEditor((prev) => ({ ...prev, open: false }));
    closeMyReports();
    closeAccountSubpages();
    setMobileHeaderMenuOpen(false);
    setAdminDomainMenuOpen(false);
    setAdminToolboxOpen(false);
    setNotificationsWindowOpen(false);
    setEventsWindowOpen(false);
    setAlertsWindowOpen(true);
  }
  function handleMobileBottomRailEventsClick() {
    setMobileTabTransitionFor("events");
    setCommunityFeedEditor((prev) => ({ ...prev, open: false }));
    closeMyReports();
    closeAccountSubpages();
    setMobileHeaderMenuOpen(false);
    setAdminDomainMenuOpen(false);
    setAdminToolboxOpen(false);
    setNotificationsWindowOpen(false);
    setAlertsWindowOpen(false);
    setEventsWindowOpen(true);
  }
  function handleMobileBottomRailAccountClick() {
    setMobileTabTransitionFor("account");
    setCommunityFeedEditor((prev) => ({ ...prev, open: false }));
    closeMyReports();
    setManageOpen(false);
    setManageEditing(false);
    setNotificationPreferencesOpen(false);
    setFollowedLocationsOpen(false);
    setMobileHeaderMenuOpen(false);
    setAdminDomainMenuOpen(false);
    setAdminToolboxOpen(false);
    setNotificationsWindowOpen(false);
    setAlertsWindowOpen(false);
    setEventsWindowOpen(false);
    setAccountView("menu");
    setAccountMenuOpen(true);
  }
  const handleMobileTitleLogoError = useCallback(() => {
    setTitleLogoError(true);
  }, []);
  const handleToggleMobileHeaderMenu = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setAdminDomainMenuOpen(false);
    setAdminToolboxOpen(false);
    setMobileHeaderMenuOpen((prev) => !prev);
  }, []);
  const handleMobileToggleSatellite = useCallback(() => {
    setMapType((type) => (type === "roadmap" ? "satellite" : "roadmap"));
  }, []);
  const handleMobileResetHeading = useCallback(() => {
    setTravelFollowMode(false);
    followHeadingEnabledRef.current = false;
    try {
      if (mapRef.current?.moveCamera) {
        mapRef.current.moveCamera({
          heading: 0,
          tilt: 0,
        });
      } else if (mapRef.current?.setHeading) {
        mapRef.current.setHeading(0);
        mapRef.current?.setTilt?.(0);
      }
    } catch {
      // ignore
    }
  }, []);
  const handleMobileLocate = useCallback(() => {
    if (geoDenied) {
      setShowLocationPrompt(true);
      return;
    }
    followHeadingEnabledRef.current = true;
    void findMyLocation(false);
  }, [findMyLocation, geoDenied]);
  const handleMobileToggleTravelFollow = useCallback(() => {
    toggleTravelFollowMode();
  }, [toggleTravelFollowMode]);
  function handleMobileRecenterHome() {
    setAutoFollow(false);
    setFollowCamera(false);
    setTravelFollowMode(false);
    recenterToTenantHome("home-button");
  }
  function handleMobileSelectMapLayer(layerKey, layerLabel) {
    requestMapLayerSwitch(layerKey, layerLabel);
  }
  function handleMobileResetIncidentFilter() {
    resetIncidentMapFilter();
  }
  function handleMobileToggleIncidentDomainFilter(domainKey, domainLabel) {
    toggleIncidentMapDomainFilter(domainKey, domainLabel);
  }
  const handleMobileToggleBulkMode = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setBulkConfirmOpen(false);
    setBulkMode((on) => {
      const next = !on;
      showToolHint(next ? "Save multiple light reports" : "Save one light report", 1100, 4);
      if (next) {
        setDeleteCircleMode(false);
        setDeleteCircleDraft(null);
        setDeleteCircleConfirmOpen(false);
        setSelectedOfficialId(null);
        setMappingMode(false);
        setMappingQueue([]);
        closeAnyPopup();
        suppressPopupsSafe(1600);
      } else {
        clearBulkSelection();
      }
      return next;
    });
  }, [clearBulkSelection, closeAnyPopup, showToolHint, suppressPopupsSafe]);
  const handleMobileToggleMappingMode = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setMappingMode((on) => {
      const next = !on;
      showToolHint(next ? "Mapping mode on" : "Mapping mode off", 1100, 2);
      if (next) {
        setBulkMode(false);
        setBulkConfirmOpen(false);
        clearBulkSelection();
        setDeleteCircleMode(false);
        setDeleteCircleDraft(null);
        setDeleteCircleConfirmOpen(false);
        setDeleteCircleNote("");
        suppressPopupsSafe(1600);
        closeAnyPopup();
      } else if (mappingQueue.length > 0) {
        setExitMappingConfirmOpen(true);
        return true;
      } else {
        setMappingQueue([]);
      }
      return next;
    });
  }, [clearBulkSelection, closeAnyPopup, mappingQueue.length, showToolHint, suppressPopupsSafe]);

  function closeIncidentTypePicker() {
    setIncidentTypePickerOpen(false);
    setPendingIncidentTypeTarget(null);
    setIncidentTypePickerOpenedAt(0);
  }

  const residentIncidentPickerOptions = useMemo(
    () => incidentLayerDomainOptions || [],
    [incidentLayerDomainOptions]
  );

  async function validateAndPrepareRoadTarget(target) {
    const { validateAndPrepareRoadTargetShared } = await loadDeferredReportSubmitSupportModule();
    return validateAndPrepareRoadTargetShared(target, {
      reverseGeocodeRoadLabel,
      openConfiguredNotice,
    });
  }

  function validateParkPlacementForTarget(target, options = {}) {
    const showNotice = options?.showNotice !== false;
    const actualLat = Number.isFinite(Number(target?.lat))
      ? Number(target.lat)
      : Number(target?.sourceLat);
    const actualLng = Number.isFinite(Number(target?.lng))
      ? Number(target.lng)
      : Number(target?.sourceLng);
    if (!Number.isFinite(actualLat) || !Number.isFinite(actualLng)) return false;
    if (isWithinAnyPark(actualLat, actualLng)) return true;
    if (showNotice) {
      openConfiguredNotice("park_required", {
        icon: "⚠️",
        title: "Park required",
        message: "This report must be placed inside a park boundary.",
      });
    }
    return false;
  }

  async function ensureParkPlacementForTarget(target, options = {}) {
    if (!isParkRequiredForDomain(target?.domain)) return true;
    await ensureTenantParksReadyForValidation();
    return validateParkPlacementForTarget(target, options);
  }

  async function openDomainReportFlow(target, options = {}) {
    if (!target) return;
    primePrimaryReportFlowWorkspace();
    const { prepareDomainReportFlowOpenShared } = await loadDeferredReportFlowOpenSupportModule();
    const nextFlow = await prepareDomainReportFlowOpenShared(target, options, {
      residentIncidentPickerOptions,
      municipalBoundaryGate,
      isRoadRequiredForDomain,
      validateAndPrepareRoadTarget,
      ensureParkPlacementForTarget,
    });
    if (!nextFlow) return;
    if (nextFlow.action === "open_picker") {
      setIncidentTypePickerOpenedAt(Date.now());
      setPendingIncidentTypeTarget(nextFlow.pickerTarget || null);
      setIncidentTypePickerOpen(true);
      return;
    }
    setDomainDisclosureAcknowledgements({});
    setDomainReportNote("");
    setDomainReportImageFile(null);
    setDomainReportImagePreviewUrl("");
    setDomainReportIssue(nextFlow.initialIssue || "");
    setDomainReportTypeSelections(nextFlow.initialTypeSelections || {});
    if (nextFlow.action === "open_disclosure") {
      setDomainReportTarget(null);
      setDomainDisclosureGateTarget(nextFlow.nextTarget || null);
      return;
    }
    setDomainDisclosureGateTarget(null);
    setDomainReportTarget(nextFlow.nextTarget || null);
  }

  async function continueDomainReportAfterDisclosureGate() {
    const { continueDomainReportAfterDisclosureGateShared } = await loadDeferredReportFlowOpenSupportModule();
    const pendingTarget = await continueDomainReportAfterDisclosureGateShared(domainDisclosureGateTarget, {
      isRoadRequiredForDomain,
      validateAndPrepareRoadTarget,
      municipalBoundaryGate,
      ensureParkPlacementForTarget,
    });
    if (!pendingTarget) return;
    setDomainDisclosureGateTarget(null);
    setDomainReportTarget(pendingTarget);
  }

  async function startIncidentReportAtPoint(domainKey, lat, lng, options = {}) {
    const { incidentDomainNormalizeSubmitTarget } = await loadDeferredIncidentDomainSubmitHelpers();
    const { startIncidentReportAtPointRuntimeShared } = await loadDeferredMapTapRuntimeModule();
    await startIncidentReportAtPointRuntimeShared(domainKey, lat, lng, options, {
      normalizeDomainKeyOrSlug,
      isTenantAssetBackedDomain,
      municipalBoundaryGate,
      primePrimaryReportFlowWorkspace,
      visibleDomainOptionsByKey,
      loadIncidentReportTargetSupportModule,
      incidentDomainNormalizeSubmitTarget,
      incidentDrivenMarkersForDomain,
      openDomainReportFlow,
    });
  }

  const requestAdminDomainSwitch = useCallback((domainKey, domainLabel, opts = {}) => {
    const nextKey = String(domainKey || "").trim();
    if (!nextKey) return;
    const nextLayerKey = String(
      opts?.layerKey || (isTenantIncidentDrivenDomain(nextKey) ? INCIDENT_REPORTING_LAYER_KEY : nextKey)
    ).trim() || nextKey;
    if (nextKey === adminReportDomain && nextLayerKey === activeMapLayerKey) {
      setAdminDomainMenuOpen(false);
      return;
    }
    if (mappingMode && mappingQueue.length > 0) {
      setPendingDomainSwitchTarget({
        key: nextKey,
        layerKey: nextLayerKey,
        label: String(domainLabel || nextKey),
      });
      setDomainSwitchConfirmOpen(true);
      return;
    }
    if (isTenantIncidentDrivenDomain(nextKey)) setLastIncidentMapDomain(nextKey);
    setActiveMapLayerKey(nextLayerKey);
    setAdminReportDomain(nextKey);
    setAdminDomainMenuOpen(false);
    setMobileIncidentDomainMenuOpen(false);
    showToolHint(`Domain: ${String(domainLabel || nextKey)}`, 1000, 3);
  }, [
    activeMapLayerKey,
    adminReportDomain,
    isTenantIncidentDrivenDomain,
    mappingMode,
    mappingQueue.length,
    showToolHint,
  ]);

  const resetIncidentMapFilter = useCallback(() => {
    if (mappingMode && mappingQueue.length > 0) {
      return;
    }
    setIncidentMapFilterKeys((prev) => {
      const current = normalizeExplicitDomainSelection(prev, incidentLayerDomainOptions.map((option) => option.key));
      const hasNoneSelection = current.includes(NO_REPORT_DOMAINS_KEY);
      if (hasNoneSelection) return [];
      if (!current.length) return [NO_REPORT_DOMAINS_KEY];
      return [];
    });
    setActiveMapLayerKey(INCIDENT_REPORTING_LAYER_KEY);
    showToolHint(
      hasExplicitIncidentMapFilter ? "Filter: All incident reports" : "Filter: No incident reports",
      1000,
      3
    );
  }, [
    hasExplicitIncidentMapFilter,
    incidentLayerDomainOptions,
    mappingMode,
    mappingQueue.length,
    showToolHint,
  ]);

  const toggleIncidentMapDomainFilter = useCallback((domainKey, domainLabel) => {
    const nextKey = String(domainKey || "").trim();
    if (!nextKey) return;
    if (mappingMode && mappingQueue.length > 0) {
      return;
    }
    const allowedKeys = incidentLayerDomainOptions.map((option) => option.key);
    const currentRaw = normalizeExplicitDomainSelection(incidentMapFilterKeys, allowedKeys);
    const hasNoneSelection = currentRaw.includes(NO_REPORT_DOMAINS_KEY);
    const current = hasNoneSelection ? [] : currentRaw;
    let next = [];
    if (hasNoneSelection) {
      next = [nextKey];
    } else if (!current.length) {
      next = allowedKeys.filter((key) => key !== nextKey);
    } else if (current.includes(nextKey)) {
      next = current.length === 1 ? [NO_REPORT_DOMAINS_KEY] : current.filter((key) => key !== nextKey);
    } else {
      next = [...current, nextKey];
    }
    const normalizedNext = normalizeExplicitDomainSelection(next, allowedKeys);
    const nextVisibleKeys = normalizedNext.includes(NO_REPORT_DOMAINS_KEY)
      ? []
      : normalizedNext.length
        ? normalizedNext
        : allowedKeys;
    const nextActiveDomainKey = String(
      nextVisibleKeys.includes(nextKey)
        ? nextKey
        : (nextVisibleKeys[0] || nextKey)
    ).trim();
    setIncidentMapFilterKeys(normalizedNext);
    if (isTenantIncidentDrivenDomain(nextActiveDomainKey)) setLastIncidentMapDomain(nextActiveDomainKey);
    setAdminReportDomain(nextActiveDomainKey);
    setActiveMapLayerKey(INCIDENT_REPORTING_LAYER_KEY);
    showToolHint(`Filter: ${String(domainLabel || nextKey)}`, 1000, 3);
  }, [
    incidentLayerDomainOptions,
    incidentMapFilterKeys,
    isTenantIncidentDrivenDomain,
    mappingMode,
    mappingQueue.length,
    showToolHint,
  ]);

  const requestMapLayerSwitch = useCallback((layerKey, layerLabel) => {
    const nextLayerKey = String(layerKey || "").trim();
    if (!nextLayerKey) return;
    if (
      useAppShellLayout
      && nextLayerKey === INCIDENT_REPORTING_LAYER_KEY
      && incidentLayerDomainOptions.length > 1
      && activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY
    ) {
      setMobileIncidentDomainMenuOpen((prev) => !prev);
      return;
    }
    if (nextLayerKey === INCIDENT_REPORTING_LAYER_KEY) {
      const fallbackIncidentDomain = resolvedIncidentMapDomain;
      if (!fallbackIncidentDomain) return;
      if (useAppShellLayout && incidentLayerDomainOptions.length > 1) {
        setMobileIncidentDomainMenuOpen(true);
      }
      requestAdminDomainSwitch(fallbackIncidentDomain, layerLabel || "Incident Reporting", {
        layerKey: INCIDENT_REPORTING_LAYER_KEY,
      });
      return;
    }
    setMobileIncidentDomainMenuOpen(false);
    requestAdminDomainSwitch(nextLayerKey, layerLabel, { layerKey: nextLayerKey });
  }, [
    activeMapLayerKey,
    incidentLayerDomainOptions.length,
    requestAdminDomainSwitch,
    resolvedIncidentMapDomain,
    useAppShellLayout,
  ]);

  function cancelAdminDomainSwitch() {
    setDomainSwitchConfirmOpen(false);
    setPendingDomainSwitchTarget(null);
  }

  async function placeQueuedAndSwitchDomain() {
    if (!pendingDomainSwitchTarget?.key) {
      cancelAdminDomainSwitch();
      return;
    }
    const ok = await confirmMappingQueue();
    if (!ok) return;
    if (isTenantIncidentDrivenDomain(pendingDomainSwitchTarget.key)) {
      setLastIncidentMapDomain(pendingDomainSwitchTarget.key);
    }
    setActiveMapLayerKey(
      String(pendingDomainSwitchTarget?.layerKey || pendingDomainSwitchTarget.key).trim()
      || pendingDomainSwitchTarget.key
    );
    setAdminReportDomain(pendingDomainSwitchTarget.key);
    setAdminDomainMenuOpen(false);
    showToolHint(`Domain: ${String(pendingDomainSwitchTarget.label || pendingDomainSwitchTarget.key)}`, 1000, 3);
    cancelAdminDomainSwitch();
  }

  function clearQueuedAndSwitchDomain() {
    if (!pendingDomainSwitchTarget?.key) {
      cancelAdminDomainSwitch();
      return;
    }
    setMappingQueue([]);
    setSelectedQueuedTempId(null);
    if (isTenantIncidentDrivenDomain(pendingDomainSwitchTarget.key)) {
      setLastIncidentMapDomain(pendingDomainSwitchTarget.key);
    }
    setActiveMapLayerKey(
      String(pendingDomainSwitchTarget?.layerKey || pendingDomainSwitchTarget.key).trim()
      || pendingDomainSwitchTarget.key
    );
    setAdminReportDomain(pendingDomainSwitchTarget.key);
    setAdminDomainMenuOpen(false);
    showToolHint(`Domain: ${String(pendingDomainSwitchTarget.label || pendingDomainSwitchTarget.key)}`, 1000, 3);
    cancelAdminDomainSwitch();
  }

  async function saveAndExitMappingMode() {
    const ok = await confirmMappingQueue();
    if (!ok) return; // keep mapping on if saving failed
    setExitMappingConfirmOpen(false);
    exitMappingMode();
  }

  function exitAdminModes() {
    // one-stop cleanup if needed later
    exitBulkMode();
    exitMappingMode();
  }

  useEffect(() => {
    // Hard guarantee: never allow both modes at once
    if (bulkMode && mappingMode) {
      setMappingMode(false);
      setMappingQueue([]);
    }
  }, [bulkMode, mappingMode]);


  // =========================
  // ADMIN LIGHT MAPPING QUEUE
  // =========================
  // rows: { lat, lng, tempId, domain, sl_id?, sign_type? }

  function queueOfficialLight(lat, lng) {
    if (!isValidLatLng(lat, lng)) return;
    if (Number(mapZoom) < MAPPING_MIN_ZOOM) {
      openNotice(
        "⚠️",
        "Zoom in to place lights",
        `Zoom to at least level ${MAPPING_MIN_ZOOM} to place official lights.`
      );
      return;
    }

    const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const sl_id = makeLightIdFromCoords(lat, lng);

    setMappingQueue((prev) => [
      ...prev,
      { lat: Number(lat), lng: Number(lng), tempId, sl_id, domain: "streetlights" },
    ]);
  }

  function queueOfficialSign(lat, lng, signType) {
    if (!isValidLatLng(lat, lng)) return;
    if (Number(mapZoom) < MAPPING_MIN_ZOOM) {
      openNotice(
        "⚠️",
        "Zoom in to place signs",
        `Zoom to at least level ${MAPPING_MIN_ZOOM} to place mapped signs.`
      );
      return;
    }
    const nextType = String(signType || "").trim().toLowerCase();
    if (!STREET_SIGN_TYPE_VALUES.has(nextType)) {
      openNotice("⚠️", "Sign type required", "Select a sign type before adding this sign to the queue.");
      return;
    }

    const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setMappingQueue((prev) => [
      ...prev,
      {
        lat: Number(lat),
        lng: Number(lng),
        tempId,
        domain: "street_signs",
        sign_type: nextType,
      },
    ]);
    // Keep mapping flow fast: do not auto-open queued popup after sign type confirmation.
    setSelectedQueuedTempId(null);
  }

  function requestQueueOfficialSign(lat, lng) {
    if (!isValidLatLng(lat, lng)) return;
    if (Number(mapZoom) < MAPPING_MIN_ZOOM) {
      openNotice(
        "⚠️",
        "Zoom in to place signs",
        `Zoom to at least level ${MAPPING_MIN_ZOOM} to place mapped signs.`
      );
      return;
    }
    setPendingQueuedSign({
      lat: Number(lat),
      lng: Number(lng),
      sign_type: "",
    });
    setQueueSignTypeOpen(true);
  }

  function cancelQueueOfficialSign() {
    setQueueSignTypeOpen(false);
    setPendingQueuedSign(null);
  }

  function confirmQueueOfficialSign() {
    const next = pendingQueuedSign;
    if (!next) return;
    queueOfficialSign(next.lat, next.lng, next.sign_type);
    setQueueSignTypeOpen(false);
    setPendingQueuedSign(null);
  }

  function updateQueuedSignType(tempId, signType) {
    const nextType = String(signType || "other").trim().toLowerCase() || "other";
    setMappingQueue((prev) =>
      prev.map((q) =>
        q.tempId === tempId && incidentDomainQueueItemMatchesVariant(q, "official_sign")
          ? { ...q, sign_type: nextType }
          : q
      )
    );
  }

  useEffect(() => {
    const userId = String(session?.user?.id || "").trim();
    setAdminStateResolved(!userId);
    if (!userId) setIsAdmin(false);
  }, [session?.user?.id]);

  useEffect(() => {
    const userId = String(session?.user?.id || "").trim();
    if (userId) return;
    setProfile(null);
  }, [session?.user?.id]);

  useEffect(() => {
    const userId = String(session?.user?.id || "").trim();
    const tenantKey = String(activeTenantKey() || "").trim().toLowerCase();
    if (userId && tenantKey) return;
    setCanAccessAdminReports(false);
    setCanAccessDomainReports(false);
    setCanEditDomainReports(false);
    setReportAccessResolved(Boolean(!userId));
  }, [session?.user?.id, tenant?.tenantKey]);

  useEffect(() => {
    const userId = String(session?.user?.id || "").trim();
    if (userId) return;
    setTenantVisibilityByDomain({});
    setTenantVisibilityLoaded(false);
  }, [session?.user?.id]);

  const resolvedTenantMapFeaturesTenantKey = resolvedTenantBoundaryTenantKey;

  useEffect(() => {
    if (resolvedTenantMapFeaturesTenantKey) return;
    tenantMapFeaturesSourceRef.current = "empty-tenant";
    setTenantMapFeatures({ ...DEFAULT_TENANT_MAP_FEATURES });
    setTenantMapFeaturesLoaded(true);
    setTenantParks([]);
    setTenantParksLoaded(true);
  }, [resolvedTenantMapFeaturesTenantKey]);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedTenantMapFeaturesTenantKey) {
      tenantMapFeaturesSourceRef.current = "empty-tenant";
      setTenantMapFeatures({ ...DEFAULT_TENANT_MAP_FEATURES });
      setTenantMapFeaturesLoaded(true);
      return () => {
        cancelled = true;
      };
    }
    void loadDeferredTenantUiConfigSupportModule()
      .then(({ readCachedTenantMapFeaturesShared }) => {
        if (cancelled) return;
        const cachedFeatures = readCachedTenantMapFeaturesShared(
          resolvedTenantMapFeaturesTenantKey,
          DEFAULT_TENANT_MAP_FEATURES,
        );
        if (cachedFeatures) {
          tenantMapFeaturesSourceRef.current = "cache";
          setTenantMapFeatures(cachedFeatures);
          setTenantMapFeaturesLoaded(true);
          return;
        }
        tenantMapFeaturesSourceRef.current = "default-pending";
        setTenantMapFeatures({ ...DEFAULT_TENANT_MAP_FEATURES });
        setTenantMapFeaturesLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        tenantMapFeaturesSourceRef.current = "default-pending";
        setTenantMapFeatures({ ...DEFAULT_TENANT_MAP_FEATURES });
        setTenantMapFeaturesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedTenantMapFeaturesTenantKey]);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedTenantMapFeaturesTenantKey || !shouldPrioritizeTenantParksLoad) {
      setTenantParks([]);
      setTenantParksLoaded(true);
      return () => {
        cancelled = true;
      };
    }
    void loadDeferredTenantParkSupportModule()
      .then(({ readCachedTenantParksShared }) => {
        if (cancelled) return;
        const cachedParks = readCachedTenantParksShared(resolvedTenantMapFeaturesTenantKey);
        if (cachedParks) {
          setTenantParks(cachedParks);
          setTenantParksLoaded(true);
          return;
        }
        setTenantParks([]);
        setTenantParksLoaded(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTenantParks([]);
        setTenantParksLoaded(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedTenantMapFeaturesTenantKey, shouldPrioritizeTenantParksLoad]);

  const loadTenantParksNow = useCallback(async () => {
    const tenantKey = resolvedTenantMapFeaturesTenantKey;
    const {
      loadTenantParksRuntimeShared,
      readCachedTenantParksShared,
      normalizeCachedTenantParksShared,
      writeCachedTenantParksShared,
    } = await loadDeferredTenantParkSupportModule();
    return loadTenantParksRuntimeShared({
      promiseRef: tenantParksLoadPromiseRef,
      authReady: publicReadAccessReady,
      tenantKey,
      readCachedTenantParks: readCachedTenantParksShared,
      normalizeCachedTenantParks: normalizeCachedTenantParksShared,
      tenantScopedReadClient,
      createTenantScopedReadClient,
      supabase,
      setTenantParks,
      setTenantParksLoaded,
      writeCachedTenantParks: writeCachedTenantParksShared,
    });
  }, [publicReadAccessReady, resolvedTenantMapFeaturesTenantKey, tenantScopedReadClient]);

  const ensureTenantParksReadyForValidation = useCallback(async () => {
    if (tenantParksLoaded) return tenantParks;
    return loadTenantParksNow();
  }, [loadTenantParksNow, tenantParks, tenantParksLoaded]);
  const loadOpenAbuseFlagSummary = useCallback(async ({ silent = true } = {}) => {
    const {
      refreshOpenAbuseFlagSummaryRuntimeShared,
      writeCachedOpenAbuseFlagSummaryShared,
    } = await loadDeferredAbuseSupportModule();
    await refreshOpenAbuseFlagSummaryRuntimeShared({
      isAdmin,
      supabase,
      setOpenAbuseFlagSummary,
      writeCachedOpenAbuseFlagSummary: writeCachedOpenAbuseFlagSummaryShared,
      abuseFlagBannerShownRef,
      silent,
      isExpectedPermissionError,
    });
  }, [isAdmin, isExpectedPermissionError]);

  const resolvedCommunityFeedTenantKey = String(
    tenant?.tenantKey || tenant?.tenantConfig?.tenant_key || activeTenantKey() || ""
  ).trim().toLowerCase();
  const communityFeedViewerUserId = String(session?.user?.id || "").trim();
  const communityFeedViewerKey = String(communityFeedViewerUserId || "anon").trim().toLowerCase() || "anon";
  const residentFeedRuntimeReady = Boolean(residentFeedRuntimeSupport);
  const residentNotificationsUnreadCount = Number(residentFeedBadgeCounts.notifications || 0);
  const mapAlertsUnreadCount = Number(residentFeedBadgeCounts.alerts || 0);
  const mapEventsUnreadCount = Number(residentFeedBadgeCounts.events || 0);
  const loadMapCommunityFeed = residentFeedControllerApi.loadMapCommunityFeed;
  const openCommunityFeedEditor = useCallback((kind, item = null) => {
    const safeKind = kind === "event" ? "event" : "alert";
    setCommunityFeedEditor({
      open: true,
      kind: safeKind,
      mode: item ? "edit" : "create",
      item: item || null,
    });
  }, []);

  const closeCommunityFeedEditor = useCallback(() => {
    setCommunityFeedEditor((prev) => ({ ...prev, open: false }));
  }, []);
  const openResidentNotificationTarget = residentFeedControllerApi.openResidentNotificationTarget;
  const handleResidentAlertVisible = residentFeedControllerApi.handleResidentAlertVisible;
  const handleResidentEventVisible = residentFeedControllerApi.handleResidentEventVisible;

  useEffect(() => {
    if (!visibleDomainOptions.length) return;
    const preferredDomainKey = preferredInitialDomainKey(visibleDomainOptions);
    const hasAdminDomain = visibleDomainOptions.some((d) => d.key === adminReportDomain);
    if (!hasAdminDomain) setAdminReportDomain(preferredDomainKey);
    if (!hasAdminDomain) {
      setActiveMapLayerKey(isTenantIncidentDrivenDomain(preferredDomainKey) ? INCIDENT_REPORTING_LAYER_KEY : preferredDomainKey);
    }
    const hasMyDomain = visibleDomainOptions.some((d) => d.key === myReportsDomain);
    if (!hasMyDomain) setMyReportsDomain(preferredDomainKey);
    setMyReportsDomainFilters((prev) => normalizeExplicitDomainSelection(prev, visibleReportDomainKeys));
    setOpenReportsDomainFilters((prev) => normalizeExplicitDomainSelection(prev, openReportsVisibleDomainKeys));
  }, [
    visibleDomainOptions,
    visibleReportDomainKeys,
    openReportsVisibleDomainKeys,
    adminReportDomain,
    myReportsDomain,
    isTenantIncidentDrivenDomain,
  ]);

  const previousTenantKeyRef = useRef("");
  useEffect(() => {
    const nextTenantKey = String(tenant?.tenantKey || "").trim().toLowerCase();
    if (!nextTenantKey || !visibleDomainOptions.length) return;
    if (!previousTenantKeyRef.current) {
      previousTenantKeyRef.current = nextTenantKey;
      return;
    }
    if (previousTenantKeyRef.current === nextTenantKey) return;
    previousTenantKeyRef.current = nextTenantKey;

    const preferredDomainKey = preferredInitialDomainKey(visibleDomainOptions);

    setActiveMapLayerKey(isTenantIncidentDrivenDomain(preferredDomainKey) ? INCIDENT_REPORTING_LAYER_KEY : preferredDomainKey);
    setAdminReportDomain(preferredDomainKey);
    setMyReportsDomain(preferredDomainKey);
    setMyReportsDomainFilters([]);
    setOpenReportsDomainFilters([]);
    setMyReportsReportedByMode("me");
    closeMyReports();
    closeOpenReports();
    setSelectedOfficialId(null);
    setSelectedDomainMarker(null);
    setSelectedQueuedTempId(null);
    setAdminDomainMenuOpen(false);
    setAdminToolboxOpen(false);
    setNotificationsWindowOpen(false);
    setAlertsWindowOpen(false);
    setEventsWindowOpen(false);
    setAccountMenuOpen(false);
    setMobileHeaderMenuOpen(false);
    setStreetlightInViewFilterMode("");
    setBulkMode(false);
    setBulkConfirmOpen(false);
    clearBulkSelection();
    setMappingMode(false);
    setMappingQueue([]);
    setReports([]);
    setSharedIncidentReportRowsStateByDomain({});
    setSharedIncidentBaseMarkersStateByDomain({});
    setStreetlightOutageTsByLightId({});
    setOfficialLights([]);
    setConfiguredIncidentSeededRowsStateByDomain({});
    setConfiguredIncidentReportRowsStateByDomain({});
    setConfiguredIncidentLoadedDomainKeys([]);
    setConfiguredIncidentPersistedStateLoadedDomainKeys([]);
    configuredIncidentLoadingDomainKeysRef.current = new Set();
    configuredIncidentPersistedStateLoadingDomainKeysRef.current = new Set();
    setIncidentStateByKey({});
    setPersistedIncidentRecordStateByDomain({});
    setFixedLights({});
    setLastFixByLightId({});
    setActionsByLightId({});
    setUtilityReportedLightIdSet(new Set());
    setUtilityReportedAtByLightId({});
    setUtilityReportReferenceByLightId({});
    setUtilitySignalCountsByLightId({});
    setCityBoundaryGeojson(null);
    setMapBounds(null);
    setGmapsRef(null);
    mapRef.current = null;
    boundaryCameraSignatureRef.current = "";
    preserveReportFlyTargetCameraRef.current = false;
    pendingTenantHomeRecenterRef.current = nextTenantKey;
  }, [tenant?.tenantKey, visibleDomainOptions, isTenantIncidentDrivenDomain]);

  useEffect(() => {
    if (reportDeepLinkHandledRef.current) return;
    if (typeof window === "undefined" || !visibleDomainOptions.length) return;

    const { requestedDomain, focusIncidentId, flyLat, flyLng, flyZoom, hasFlyTarget } =
      initialReportDeepLinkRef.current || readReportDeepLinkRequest(window.location.search || "");
    if (focusIncidentId && !reportAccessResolved) return;
    const nextDomain = visibleDomainOptions.some((d) => d.key === requestedDomain) ? requestedDomain : "";

    if (!nextDomain && !focusIncidentId && !hasFlyTarget) {
      reportDeepLinkHandledRef.current = true;
      return;
    }

    reportDeepLinkHandledRef.current = true;

    if (nextDomain) {
      setActiveMapLayerKey(isTenantIncidentDrivenDomain(nextDomain) ? INCIDENT_REPORTING_LAYER_KEY : nextDomain);
      setAdminReportDomain(nextDomain);
      setMyReportsDomain(nextDomain);
    }

    if (focusIncidentId && canOpenDomainReports) {
      openOpenReports({ focusIncidentId });
    }

    if (hasFlyTarget) {
      preserveReportFlyTargetCameraRef.current = true;
      flyToTarget([flyLat, flyLng], flyZoom);
    }
  }, [visibleDomainOptions, canOpenDomainReports, isTenantIncidentDrivenDomain, openOpenReports, reportAccessResolved]);

  useEffect(() => {
    if (!isAdmin && mappingMode) setMappingMode(false);
  }, [isAdmin, mappingMode]);

  async function signIn() {
    setAuthLoading(true);
    setLoginError("");

    const email = (authEmail || "").trim().toLowerCase();
    const password = authPassword || "";

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setAuthLoading(false);

    if (error) {
      setLoginError("invalid_credentials");
      return false;
    }

    setAccountMenuOpen(false);
    setLoginError("");
    return true;
  }

  function openForgotPasswordModal() {
    setForgotPasswordEmail((authEmail || "").trim());
    setForgotPasswordError("");
    setForgotPasswordOpen(true);
  }

  async function sendPasswordReset() {
    const { sendPasswordResetRuntimeShared } = await loadDeferredAccountRuntimeModule();
    return sendPasswordResetRuntimeShared({
      forgotPasswordEmail,
    }, {
      supabase,
      setForgotPasswordError,
      setAuthResetLoading,
      setForgotPasswordOpen,
      openNotice,
    });
  }

    async function userLogin(email, password) {
      const e = (email || "").trim().toLowerCase();
      const p = password || "";

      const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
      // CMD+F: async function userLogin(email, password)
      if (error) {
        openNotice("⚠️", "Sign-in failed", error.message);
        return false;
      }
      return true;
    }

  async function handleCreateAccount() {
    const email = signupEmail.trim();
    const password = signupPassword;
    const full_name = signupName.trim();
    const phone = signupPhone.trim();

    if (!full_name) {
      openNotice("⚠️", "Name required", "Please enter your full name.");
      return;
    }
    if (!email) {
      openNotice("⚠️", "Email required", "Please enter your email.");
      return;
    }
    if (!(await validateStrongPasswordDeferred(password))) {
      openNotice("⚠️", "Weak password", "Use 8+ chars with uppercase, lowercase, number, and special character.");
      return;
    }
    if (signupPassword !== signupPassword2) {
      openNotice("⚠️", "Passwords don’t match", "Please re-enter your password so both fields match.");
      return;
    }
    if (!signupLegalAccepted) {
      openNotice(
        "⚠️",
        "Agreement required",
        "Please accept the Terms of Use and Privacy Policy to create an account."
      );
      return;
    }

    setSignupLoading(true);
    const { userCreateAccountRuntimeShared } = await loadDeferredAccountRuntimeModule();
    const result = await userCreateAccountRuntimeShared({
      email,
      password,
      fullName: full_name,
      phone,
    }, {
      supabase,
    });
    setSignupLoading(false);

    if (!result?.ok) {
      openNotice("⚠️", "Sign up failed", result?.error?.message || "Please try again.");
      return;
    }

    setAuthGateOpen(false);
    setAuthGateStep("welcome");
    openNotice(
      "✅",
      "Confirmation sent",
      "Check your email for the confirmation link. After you confirm, come back here to sign in."
    );

    setSignupName("");
    setSignupPhone("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupPassword2("");
    setSignupLegalAccepted(false);
  }

  async function signOut() {
    const { signOutRuntimeShared } = await loadDeferredAccountRuntimeModule();
    return signOutRuntimeShared({}, {
      supabase,
      clearReauthAt: () => {
        reauthAtRef.current = 0;
      },
      setIsAdmin,
      setAuthEmail,
      setAuthPassword,
      setAccountMenuOpen,
      setFollowedLocationsOpen,
    });
  }

  async function saveManagedProfile() {
    const { saveManagedProfileRuntimeShared } = await loadDeferredAccountRuntimeModule();
    return saveManagedProfileRuntimeShared({
      sessionUserId: session?.user?.id || "",
      sessionUserEmail: session?.user?.email || "",
      profileEmail: profile?.email || "",
      manageForm,
      reauthAt: reauthAtRef.current,
    }, {
      supabase,
      setReauthIntent,
      setReauthPassword,
      setReauthOpen,
      setManageSaving,
      setProfile,
      setManageEditing,
      openNotice,
    });
  }

  async function performDeleteAccount() {
    const { performDeleteAccountRuntimeShared } = await loadDeferredAccountRuntimeModule();
    return performDeleteAccountRuntimeShared({
      sessionUserId: session?.user?.id || "",
    }, {
      supabase,
      publicAccountDeletePendingAuthKey: PUBLIC_ACCOUNT_DELETE_PENDING_AUTH_KEY,
      clearDeleteAccountQuery,
      setDeleteAccountSaving,
      setDeleteAccountOpen,
      setDeleteAccountConfirmText,
      setDeleteAccountDisclosureAccepted,
      setManageOpen,
      setManageEditing,
      setAccountMenuOpen,
      setNotificationPreferencesOpen,
      setFollowedLocationsOpen,
      setAccountView,
      setSession,
      setProfile,
      clearReauthAt: () => {
        reauthAtRef.current = 0;
      },
      openNotice,
    });
  }

  function requestDeleteAccount() {
    if (String(deleteAccountConfirmText || "").trim().toUpperCase() !== "DELETE") {
      openNotice("⚠️", "Confirmation required", "Type DELETE to confirm account removal.");
      return;
    }
    if (!deleteAccountDisclosureAccepted) {
      openNotice("⚠️", "Agreement required", "Please confirm the account deletion disclosure before continuing.");
      return;
    }
    setReauthIntent("delete_account");
    setReauthPassword("");
    setReauthOpen(true);
  }

  async function handleChangePassword() {
    const { changePasswordRuntimeShared } = await loadDeferredAccountRuntimeModule();
    return changePasswordRuntimeShared({
      sessionUserEmail: session?.user?.email || "",
      profileEmail: profile?.email || "",
      changePasswordCurrentValue,
      changePasswordValue,
      changePasswordValue2,
    }, {
      supabase,
      validateStrongPassword: validateStrongPasswordDeferred,
      openNotice,
      setChangePasswordSaving,
      setChangePasswordValue,
      setChangePasswordValue2,
      setChangePasswordCurrentValue,
      setChangePasswordOpen,
      setSession,
      setReauthAt: (value) => {
        reauthAtRef.current = value;
      },
    });
  }

  async function handleRecoveryPasswordUpdate() {
    const { recoveryPasswordUpdateRuntimeShared } = await loadDeferredAccountRuntimeModule();
    return recoveryPasswordUpdateRuntimeShared({
      recoveryPasswordValue,
      recoveryPasswordValue2,
    }, {
      supabase,
      validateStrongPassword: validateStrongPasswordDeferred,
      openNotice,
      setRecoveryPasswordSaving,
      setRecoveryPasswordValue,
      setRecoveryPasswordValue2,
      setRecoveryPasswordOpen,
      setSession,
    });
  }

  function requestEditManagedProfile() {
    if (Date.now() - reauthAtRef.current <= 5 * 60 * 1000) {
      setManageEditing(true);
      return;
    }
    setReauthIntent("edit_profile");
    setReauthPassword("");
    setReauthOpen(true);
  }

  async function confirmReauth() {
    const { confirmReauthRuntimeShared } = await loadDeferredAccountRuntimeModule();
    return confirmReauthRuntimeShared({
      sessionUserEmail: session?.user?.email || "",
      profileEmail: profile?.email || "",
      reauthPassword,
      reauthIntent,
    }, {
      supabase,
      openNotice,
      setReauthSaving,
      setReauthOpen,
      setReauthPassword,
      setReauthIntent,
      setManageEditing,
      setReauthAt: (value) => {
        reauthAtRef.current = value;
      },
      onSaveProfile: saveManagedProfile,
      onDeleteAccount: performDeleteAccount,
    });
  }

  // -------------------------
  // Load reports + fixed + official
  // -------------------------
  // CMD+F: async function fetchAllOfficialLights
  async function fetchAllOfficialLights(client = supabase, tenantKey = "") {
    const { fetchAllOfficialLightsShared } = await loadDeferredPublicMapLoadSupportModule();
    return fetchAllOfficialLightsShared(client, tenantKey, { isMissingTenantKeyColumnError });
  }
  async function fetchAllIncidentStateCurrent(client = supabase, tenantKey = "") {
    const { fetchAllIncidentStateCurrentShared } = await loadDeferredPublicMapLoadSupportModule();
    return fetchAllIncidentStateCurrentShared(client, tenantKey, { isMissingTenantKeyColumnError });
  }

  async function fetchAllConfiguredIncidentPersistedRecordState(client = supabase, domainKeyRaw, tenantKey = "") {
    const { fetchAllConfiguredIncidentPersistedRecordStateShared } = await loadDeferredPublicMapLoadSupportModule();
    const {
      incidentDomainConfiguredPersistedRecordStateOrderField,
      incidentDomainConfiguredPersistedRecordStateSelectFields,
      incidentDomainConfiguredPersistedRecordStateTable,
    } = await loadDeferredConfiguredIncidentStateRuntimeHelpers();
    return fetchAllConfiguredIncidentPersistedRecordStateShared(
      client,
      domainKeyRaw,
      tenantKey,
      {
        normalizeDomainKeyOrSlug,
        incidentDomainConfiguredPersistedRecordStateTable,
        incidentDomainConfiguredPersistedRecordStateSelectFields,
        incidentDomainConfiguredPersistedRecordStateOrderField,
        isMissingTenantKeyColumnError,
      }
    );
  }

  async function fetchAllIncidentLocationCache(client = supabase, tenantKey = "") {
    const { fetchAllIncidentLocationCacheShared } = await loadDeferredPublicMapLoadSupportModule();
    return fetchAllIncidentLocationCacheShared(client, tenantKey);
  }

async function fetchTenantDomainPublicConfig(client = supabase) {
  const { fetchTenantDomainPublicConfigShared } = await loadDeferredPublicMapLoadSupportModule();
  return fetchTenantDomainPublicConfigShared(client);
}

async function fetchTenantAssignedDomains(client = supabase) {
  const { fetchTenantAssignedDomainsShared } = await loadDeferredPublicMapLoadSupportModule();
  return fetchTenantAssignedDomainsShared(client);
}

async function fetchTenantRegistryIncidentDomains(client = supabase) {
  const { fetchTenantRegistryIncidentDomainsShared } = await loadDeferredPublicMapLoadSupportModule();
  return fetchTenantRegistryIncidentDomainsShared(client);
}

async function fetchTenantBoundaryGeojson(client = supabase, tenantKeyRaw = "") {
  const { fetchTenantBoundaryGeojsonShared } = await loadDeferredPublicMapLoadSupportModule();
  return fetchTenantBoundaryGeojsonShared(client, tenantKeyRaw, {
    tenantBoundaryConfigKey,
    parseGeoJsonValue,
  });
}

async function fetchTenantAssignedDomainsRobust(tenantKey, client = supabase) {
  const { fetchTenantAssignedDomainsRobustShared } = await loadDeferredPublicMapLoadSupportModule();
  return fetchTenantAssignedDomainsRobustShared(tenantKey, client, {
    fetchTenantAssignedDomains,
    createTenantScopedReadClient,
  });
}

async function selectTenantScopedPublicRows(
  client,
  tableName,
  selectClause,
  tenantKey,
  orderColumn = "created_at",
  options = {}
) {
  const { selectTenantScopedPublicRowsShared } = await loadDeferredPublicMapLoadSupportModule();
  return selectTenantScopedPublicRowsShared(
    client,
    tableName,
    selectClause,
    tenantKey,
    orderColumn,
    options,
    { isMissingTenantKeyColumnError }
  );
}

  const shouldForceAdminConfiguredIncidentDomain = Boolean(
    mappingMode
    || bulkMode
    || openReportMapFilterOn
    || adminDomainMenuOpen
  );
  const configuredIncidentRuntimeCandidateDomainKeys = useMemo(() => {
    const configuredRuntimeEligibleDomainKeys = new Set(
      incidentDomainHelperKeysForConfiguredField("requiresConfiguredRuntime")
    );
    const next = new Set();
    const pushDomain = (domainKeyRaw) => {
      const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
      if (!domainKey || !configuredRuntimeEligibleDomainKeys.has(domainKey)) return;
      next.add(domainKey);
    };

    if (activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY) {
      for (const domainKey of incidentMapVisibleDomainKeys || []) pushDomain(domainKey);
    } else {
      pushDomain(activeMapLayerKey);
    }
    if (myReportsOpen) {
      for (const domainKey of activeMyReportsDomainKeys || []) pushDomain(domainKey);
    }
    if (openReportsOpen) {
      for (const domainKey of activeOpenReportsDomainKeys || []) pushDomain(domainKey);
    }
    pushDomain(selectedDomainMarker?.domain);
    pushDomain(domainReportTarget?.domain);
    pushDomain(domainDisclosureGateTarget?.domain);
    pushDomain(confirmReportTarget?.domain);
    if (selectedIncidentStackMarker?.markers?.length) {
      for (const marker of selectedIncidentStackMarker.markers) {
        pushDomain(marker?.domain);
      }
    }
    if (shouldForceAdminConfiguredIncidentDomain) {
      pushDomain(adminReportDomain);
    }

    return Array.from(next);
  }, [
    activeMapLayerKey,
    activeMyReportsDomainKeys,
    activeOpenReportsDomainKeys,
    adminDomainMenuOpen,
    adminReportDomain,
    bulkMode,
    confirmReportTarget?.domain,
    domainDisclosureGateTarget?.domain,
    domainReportTarget?.domain,
    incidentMapVisibleDomainKeys,
    mappingMode,
    myReportsOpen,
    openReportMapFilterOn,
    openReportsOpen,
    selectedDomainMarker?.domain,
    selectedIncidentStackMarker?.markers,
    shouldForceAdminConfiguredIncidentDomain,
  ]);
  const hasConfiguredIncidentRuntimeCandidates = configuredIncidentRuntimeCandidateDomainKeys.length > 0;

  const configuredIncidentLastFixRuntimeContext = useMemo(() => {
    if (!hasConfiguredIncidentRuntimeCandidates) {
      return { lastFixByIncidentMapByDomain: new Map() };
    }
    return buildConfiguredIncidentDomainLastFixRuntimeContext({
      actionsByLightId,
      incidentStateByKey,
    }, configuredIncidentRuntimeCandidateDomainKeys);
  }, [
    actionsByLightId,
    configuredIncidentRuntimeCandidateDomainKeys,
    hasConfiguredIncidentRuntimeCandidates,
    incidentStateByKey,
  ]);

  const configuredIncidentRuntimeSeededRowsByDomain = useMemo(() => {
    const next = new Map();
    if (!hasConfiguredIncidentRuntimeCandidates) return next;
    for (const domainKey of configuredIncidentRuntimeCandidateDomainKeys) {
      next.set(
        domainKey,
        Array.isArray(configuredIncidentSeededRowsStateByDomain?.[domainKey])
          ? configuredIncidentSeededRowsStateByDomain[domainKey]
          : []
      );
    }
    return next;
  }, [
    configuredIncidentRuntimeCandidateDomainKeys,
    configuredIncidentSeededRowsStateByDomain,
    hasConfiguredIncidentRuntimeCandidates,
  ]);

  const configuredIncidentRuntimeReportRowsByDomain = useMemo(() => {
    const next = new Map();
    if (!hasConfiguredIncidentRuntimeCandidates) return next;
    for (const domainKey of configuredIncidentRuntimeCandidateDomainKeys) {
      next.set(
        domainKey,
        Array.isArray(configuredIncidentReportRowsStateByDomain?.[domainKey])
          ? configuredIncidentReportRowsStateByDomain[domainKey]
          : []
      );
    }
    return next;
  }, [
    configuredIncidentRuntimeCandidateDomainKeys,
    configuredIncidentReportRowsStateByDomain,
    hasConfiguredIncidentRuntimeCandidates,
  ]);

  const configuredIncidentRuntimeSetSeededRowsByDomain = useMemo(() => new Map([
    ...configuredIncidentRuntimeCandidateDomainKeys
      .filter((domainKey) => configuredIncidentHasSourceTableSync(domainKey, "seeded"))
      .map((domainKey) => [
      domainKey,
      (nextRowsOrUpdater) => setConfiguredIncidentSeededRowsForDomain(domainKey, nextRowsOrUpdater),
    ]),
  ]), [configuredIncidentRuntimeCandidateDomainKeys, setConfiguredIncidentSeededRowsForDomain]);

  const configuredIncidentRuntimeSetReportRowsByDomain = useMemo(() => new Map([
    ...configuredIncidentRuntimeCandidateDomainKeys
      .filter((domainKey) => configuredIncidentHasSourceTableSync(domainKey, "reports"))
      .map((domainKey) => [
      domainKey,
      (nextRowsOrUpdater) => setConfiguredIncidentReportRowsForDomain(domainKey, nextRowsOrUpdater),
    ]),
  ]), [configuredIncidentRuntimeCandidateDomainKeys, setConfiguredIncidentReportRowsForDomain]);

  const configuredIncidentRuntimeEntries = useMemo(() => {
    if (!hasConfiguredIncidentRuntimeCandidates) return [];
    return buildConfiguredIncidentDomainRuntimeEntries({
      ...configuredIncidentLastFixRuntimeContext,
      seededRowsByDomain: configuredIncidentRuntimeSeededRowsByDomain,
      reportRowsByDomain: configuredIncidentRuntimeReportRowsByDomain,
      setSeededRowsByDomain: configuredIncidentRuntimeSetSeededRowsByDomain,
      setReportRowsByDomain: configuredIncidentRuntimeSetReportRowsByDomain,
    }, configuredIncidentRuntimeCandidateDomainKeys);
  }, [
    configuredIncidentLastFixRuntimeContext,
    configuredIncidentRuntimeCandidateDomainKeys,
    configuredIncidentRuntimeReportRowsByDomain,
    configuredIncidentRuntimeSeededRowsByDomain,
    configuredIncidentRuntimeSetReportRowsByDomain,
    configuredIncidentRuntimeSetSeededRowsByDomain,
    hasConfiguredIncidentRuntimeCandidates,
  ]);

  const configuredIncidentRealtimeConfigEntries = useMemo(() => (
    configuredIncidentRuntimeEntries
      .filter((entry) => (
        typeof entry?.setSeededRows === "function"
        || typeof entry?.setReportRows === "function"
      ))
      .map((entry) => ({
        domainKey: entry.domainKey,
        setSeededRows: entry.setSeededRows,
        setReportRows: entry.setReportRows,
      }))
  ), [configuredIncidentRuntimeEntries]);
  const allConfiguredIncidentRuntimeDomainKeys = useMemo(
    () => configuredIncidentRealtimeConfigEntries.map((entry) => String(entry?.domainKey || "").trim()).filter(Boolean),
    [configuredIncidentRealtimeConfigEntries]
  );
  const configuredIncidentRuntimeEntryByDomain = useMemo(() => new Map(
    configuredIncidentRealtimeConfigEntries.map((entry) => [String(entry?.domainKey || "").trim(), entry]).filter(([domainKey]) => domainKey)
  ), [configuredIncidentRealtimeConfigEntries]);
  const configuredIncidentPersistedStateSupportedDomainKeys = useMemo(
    () => configuredIncidentPersistedStateSupportedDomainKeysSync().map((domainKey) => (
      normalizeDomainKeyOrSlug(domainKey, { allowUnknown: true }) || normalizeDomainKey(domainKey)
    )).filter(Boolean),
    []
  );
  const configuredIncidentDemandDomainKeys = useMemo(() => {
    if (!allConfiguredIncidentRuntimeDomainKeys.length) return [];
    const next = new Set();
    const pushDomain = (domainKeyRaw) => {
      const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
      if (!domainKey || !allConfiguredIncidentRuntimeDomainKeys.includes(domainKey)) return;
      next.add(domainKey);
    };

    if (activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY) {
      for (const domainKey of incidentMapVisibleDomainKeys || []) pushDomain(domainKey);
    } else {
      pushDomain(activeMapLayerKey);
    }

    if (myReportsOpen) {
      for (const domainKey of activeMyReportsDomainKeys || []) pushDomain(domainKey);
    }
    if (openReportsOpen) {
      for (const domainKey of activeOpenReportsDomainKeys || []) pushDomain(domainKey);
    }
    pushDomain(domainReportTarget?.domain);
    pushDomain(domainDisclosureGateTarget?.domain);
    pushDomain(confirmReportTarget?.domain);
    pushDomain(selectedDomainMarker?.domain);

    if (selectedIncidentStackMarker?.markers?.length) {
      for (const marker of selectedIncidentStackMarker.markers) {
        pushDomain(marker?.domain);
      }
    }

    if (shouldForceAdminConfiguredIncidentDomain) {
      pushDomain(adminReportDomain);
    }

    return Array.from(next);
  }, [
    activeMapLayerKey,
    activeMyReportsDomainKeys,
    activeOpenReportsDomainKeys,
    adminDomainMenuOpen,
    adminReportDomain,
    allConfiguredIncidentRuntimeDomainKeys,
    bulkMode,
    confirmReportTarget?.domain,
    domainDisclosureGateTarget?.domain,
    domainReportTarget?.domain,
    incidentMapVisibleDomainKeys,
    mappingMode,
    openReportMapFilterOn,
    reportsAdminView,
    selectedDomainMarker?.domain,
    selectedIncidentStackMarker?.markers,
    shouldForceAdminConfiguredIncidentDomain,
  ]);
  const configuredIncidentLoadedDomainKeySet = useMemo(
    () => new Set(configuredIncidentLoadedDomainKeys),
    [configuredIncidentLoadedDomainKeys]
  );
  const configuredIncidentPersistedStateLoadedDomainKeySet = useMemo(
    () => new Set(configuredIncidentPersistedStateLoadedDomainKeys),
    [configuredIncidentPersistedStateLoadedDomainKeys]
  );
  const configuredIncidentDemandDomainKeysRef = useRef(configuredIncidentDemandDomainKeys);
  configuredIncidentDemandDomainKeysRef.current = configuredIncidentDemandDomainKeys;

  useEffect(() => {
    if (reportsAdminView) return;
    const cachedSeededByDomain = cachedConfiguredIncidentSeededRowsByDomainRef.current || {};
    const cachedReportByDomain = cachedConfiguredIncidentReportRowsByDomainRef.current || {};
    const cachedPersistedByDomain = cachedPersistedIncidentRecordStateByDomainRef.current || {};

    const cachedConfiguredDomainKeys = configuredIncidentDemandDomainKeys.filter((domainKey) => (
      !configuredIncidentLoadedDomainKeySet.has(domainKey)
      && (
        Object.prototype.hasOwnProperty.call(cachedSeededByDomain, domainKey)
        || Object.prototype.hasOwnProperty.call(cachedReportByDomain, domainKey)
      )
    ));
    const cachedPersistedDomainKeys = configuredIncidentPersistedStateSupportedDomainKeys.filter((domainKey) => (
      configuredIncidentDemandDomainKeys.includes(domainKey)
      && !configuredIncidentPersistedStateLoadedDomainKeySet.has(domainKey)
      && Object.prototype.hasOwnProperty.call(cachedPersistedByDomain, domainKey)
    ));

    if (!cachedConfiguredDomainKeys.length && !cachedPersistedDomainKeys.length) return;

    if (cachedConfiguredDomainKeys.length) {
      setConfiguredIncidentSeededRowsStateByDomain((prev) => {
        const next = { ...(prev || {}) };
        for (const domainKey of cachedConfiguredDomainKeys) {
          if (Object.prototype.hasOwnProperty.call(cachedSeededByDomain, domainKey)) {
            next[domainKey] = Array.isArray(cachedSeededByDomain[domainKey]) ? cachedSeededByDomain[domainKey] : [];
          }
        }
        return next;
      });
      setConfiguredIncidentReportRowsStateByDomain((prev) => {
        const next = { ...(prev || {}) };
        for (const domainKey of cachedConfiguredDomainKeys) {
          if (Object.prototype.hasOwnProperty.call(cachedReportByDomain, domainKey)) {
            next[domainKey] = Array.isArray(cachedReportByDomain[domainKey]) ? cachedReportByDomain[domainKey] : [];
          }
        }
        return next;
      });
      setConfiguredIncidentLoadedDomainKeys((prev) => {
        const next = new Set(prev || []);
        for (const domainKey of cachedConfiguredDomainKeys) next.add(domainKey);
        return Array.from(next);
      });
    }

    if (cachedPersistedDomainKeys.length) {
      setPersistedIncidentRecordStateByDomain((prev) => {
        const next = { ...(prev || {}) };
        for (const domainKey of cachedPersistedDomainKeys) {
          if (Object.prototype.hasOwnProperty.call(cachedPersistedByDomain, domainKey)) {
            next[domainKey] = cachedPersistedByDomain[domainKey] && typeof cachedPersistedByDomain[domainKey] === "object"
              ? cachedPersistedByDomain[domainKey]
              : {};
          }
        }
        return next;
      });
      setConfiguredIncidentPersistedStateLoadedDomainKeys((prev) => {
        const next = new Set(prev || []);
        for (const domainKey of cachedPersistedDomainKeys) next.add(domainKey);
        return Array.from(next);
      });
    }
  }, [
    configuredIncidentDemandDomainKeys,
    configuredIncidentLoadedDomainKeySet,
    configuredIncidentPersistedStateLoadedDomainKeySet,
    configuredIncidentPersistedStateSupportedDomainKeys,
    reportsAdminView,
  ]);
  useEffect(() => {
    if (isAdmin) return;
    setOpenAbuseFlagSummary({ total: 0, maxSeverity: 0 });
    abuseFlagBannerShownRef.current = false;
  }, [isAdmin]);

  const publicMapLoadAuthGateKey = [
    shouldWaitForAuthBeforePublicMapLoad ? String(authReady) : "skip-auth-gate",
    waitingForAuthenticatedMapAccess
      ? `waiting-map-access:${String(adminStateResolved)}:${String(reportAccessResolved)}`
      : `map-access-ready:${String(adminStateResolved)}:${String(reportAccessResolved)}`,
  ].join("::");

  useEffect(() => {
    if (!publicReadAccessReady) return;
    if (tenant?.ready === false) return;
    if (waitingForTenantDomainConfig) return;
    let cancelled = false;
    let deferredStartupCleanup = null;
    async function loadAll(loadAttempt = 0) {
      const loadTenantKey = String(tenant?.tenantKey || activeTenantKey() || "").trim().toLowerCase();
      const publicMapLoadSupportModulePromise = loadDeferredPublicMapLoadSupportModule();
      const publicReadClient = loadAttempt > 0
        ? (createTenantScopedReadClient(loadTenantKey) || tenantScopedReadClient || supabase)
        : (tenantScopedReadClient || createTenantScopedReadClient(loadTenantKey) || supabase);
      const authedReadClient = session?.access_token
        ? (
            createTenantScopedAuthedClient(loadTenantKey, session.access_token)
            || createTenantScopedReadClient(loadTenantKey)
            || supabase
          )
        : supabase;
      const preferScopedPublicReads = publicReadClient !== supabase;
      // Keep an already-rendered map stable while resume/sparse retries refresh in the background.
      // Access-scope changes clear runtime data first, so they still use the guarded loading state.
      if (!hasRenderableMapRuntimeDataRef.current) {
        setLoading(true);
      }
      setError("");

      const isAuthed = Boolean(session?.user?.id);
      const reportSelectMapRuntime = "id, created_at, lat, lng, report_type, report_quality, note, light_id, report_number, reporter_user_id, report_domain";
      const reportSelectFull = "id, created_at, lat, lng, report_type, report_quality, note, light_id, report_number, reporter_user_id, reporter_name, reporter_phone, reporter_email, report_domain";
      const actionsSelectPublic = "id, light_id, action, created_at";
      const actionsSelectFull = "id, light_id, action, note, created_at, actor_user_id";
      const shouldLoadStreetlightRuntimeNow = shouldPrioritizeStreetlightRuntimeStartupRef.current;
      const initialFocusedIncidentId = String(initialReportDeepLinkRef.current?.focusIncidentId || "").trim();
      const cachedPublicMapCoreSnapshot = !reportsAdminView
        ? readCachedTenantPublicMapCoreSnapshot(loadTenantKey)
        : null;
      const cachedReportRowsForStartup = Array.isArray(reports)
        ? reports.filter(Boolean)
        : [];
      const cachedOfficialLightRowsForStartup = Array.isArray(officialLights)
        ? officialLights.filter(Boolean)
        : [];
      const cachedIncidentStateForStartup = cachedPublicMapCoreSnapshot?.incidentStateByKey || {};
      const shouldPreferFreshPublicIncidentReportsAtStartup = Boolean(
        !reportsAdminView
        && activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY
      );
      const canUseCachedReportsForStartup = Boolean(
        !shouldPreferFreshPublicIncidentReportsAtStartup
        && !reportsAdminView
        && !initialFocusedIncidentId
        && cachedReportRowsForStartup.length > 0
      );
      const canUseCachedOfficialLightsForStartup = Boolean(
        !reportsAdminView
        && !shouldLoadStreetlightRuntimeNow
        && cachedOfficialLightRowsForStartup.length > 0
      );
      const shouldDeferIncidentStateForStartup = Boolean(
        !reportsAdminView
        && !shouldLoadStreetlightRuntimeNow
        && activeMapLayerKey === "streetlights"
        && !initialFocusedIncidentId
      );
      const canUseCachedIncidentStateForStartup = Boolean(
        !reportsAdminView
        && activeMapLayerKey !== INCIDENT_REPORTING_LAYER_KEY
        && !initialFocusedIncidentId
        && Object.keys(cachedIncidentStateForStartup).length > 0
      );
      deferredIncidentStateRefreshContextKeyRef.current = (canUseCachedIncidentStateForStartup || shouldDeferIncidentStateForStartup)
        ? `${loadTenantKey}::${String(session?.user?.id || "").trim() || "anon"}::${mapDataReloadToken}`
        : "";
      deferredBoundaryRefreshContextKeyRef.current = `${loadTenantKey}::${mapDataReloadToken}`;
      const shouldLoadRichStartupReports = Boolean(
        reportsAdminView && (myReportsOpen || openReportsOpen)
      );
      const configuredIncidentStartupDomainKeySet = new Set(
        configuredIncidentDemandDomainKeysRef.current
          .filter((domainKey) => configuredIncidentRuntimeEntryByDomain.has(domainKey))
      );
      if (activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY) {
        for (const option of visibleDomainOptionsRef.current || []) {
          const domainKey = normalizeDomainKeyOrSlug(option?.key, { allowUnknown: true }) || normalizeDomainKey(option?.key);
          if (!domainKey || domainKey === "streetlights") continue;
          if (!configuredIncidentRuntimeEntryByDomain.has(domainKey)) continue;
          configuredIncidentStartupDomainKeySet.add(domainKey);
        }
      }
      const configuredIncidentStartupDomainKeys = Array.from(configuredIncidentStartupDomainKeySet);
      const shouldLoadConfiguredIncidentRuntimeNow = configuredIncidentStartupDomainKeys.length > 0;
      const configuredIncidentDataSupportModulePromise = shouldLoadConfiguredIncidentRuntimeNow
        ? loadDeferredConfiguredIncidentDataSupportModule()
        : null;

      const loadReportsNow = async () => {
        let nextReportData = [];
        let nextRepErr = null;

        if (reportsAdminView) {
          const result = await authedReadClient
            .from("reports")
            .select(shouldLoadRichStartupReports ? reportSelectFull : reportSelectMapRuntime)
            .eq("tenant_key", loadTenantKey)
            .order("created_at", { ascending: false });
          nextReportData = result?.data || [];
          nextRepErr = result?.error || null;
          return { data: nextReportData, publicData: [], error: nextRepErr };
        }

        const {
          fetchTenantPublicMapReportsShared,
          mergeTenantPublicAndViewerReportsShared,
        } = await publicMapLoadSupportModulePromise;
        const [publicResult, viewerResult] = await Promise.all([
          fetchTenantPublicMapReportsShared(publicReadClient, loadTenantKey),
          isAuthed
            ? authedReadClient
                .from("reports")
                .select(reportSelectMapRuntime)
                .eq("tenant_key", loadTenantKey)
                .eq("reporter_user_id", session.user.id)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
        ]);
        const publicReportData = publicResult?.data || [];
        const viewerReportData = viewerResult?.data || [];
        if (viewerResult?.error && !isExpectedPermissionError(viewerResult.error)) {
          console.warn("[viewer map reports] load warning:", viewerResult.error?.message || viewerResult.error);
        }
        nextReportData = mergeTenantPublicAndViewerReportsShared(
          publicReportData,
          viewerReportData
        );
        nextRepErr = publicResult?.error || null;

        return { data: nextReportData, publicData: publicReportData, error: nextRepErr };
      };

      const fixedLightsPromise = shouldLoadStreetlightRuntimeNow
        ? publicReadClient
            .from("fixed_lights")
            .select("*")
            .eq("tenant_key", loadTenantKey)
        : Promise.resolve({ data: [], error: null });

      const actionsPromise = shouldLoadStreetlightRuntimeNow
        ? (
            reportsAdminView
              ? authedReadClient.from("light_actions").select(actionsSelectFull).eq("tenant_key", loadTenantKey).order("created_at", { ascending: false })
              : selectTenantScopedPublicRows(
                  publicReadClient,
                  "light_actions_public",
                  actionsSelectPublic,
                  loadTenantKey,
                  "created_at",
                  { preferScopedClient: preferScopedPublicReads }
                )
          )
        : Promise.resolve({ data: [], error: null });
      const loadOfficialLightsNow = () => fetchAllOfficialLights(publicReadClient, loadTenantKey)
        .then((data) => ({ data, error: null }))
        .catch((error) => ({ data: [], error }));
      const loadIncidentStateNow = () => fetchAllIncidentStateCurrent(publicReadClient, loadTenantKey)
        .then((data) => ({ data, error: null }))
        .catch((error) => ({ data: [], error }));

      const reportsResultPromise = canUseCachedReportsForStartup
        ? Promise.resolve({
            data: cachedReportRowsForStartup,
            publicData: cachedReportRowsForStartup,
            error: null,
          })
        : loadReportsNow();
      const officialLightsResultPromise = canUseCachedOfficialLightsForStartup
        ? Promise.resolve({ data: cachedOfficialLightRowsForStartup, error: null })
        : loadOfficialLightsNow();
      const shouldLoadIncidentStateAtStartup = Boolean(
        activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY
        && !canUseCachedIncidentStateForStartup
        && !shouldDeferIncidentStateForStartup
      );
      const incidentStateResultPromise = shouldLoadIncidentStateAtStartup
        ? loadIncidentStateNow()
        : Promise.resolve({ data: [], error: null });

      let reportData = cachedReportRowsForStartup;
      let repErr = null;
      let startupIncidentStateErr = null;
      let startupIncidentStateByKey = null;

      const configuredIncidentStateRuntimeHelpers = shouldLoadConfiguredIncidentRuntimeNow
        ? await loadDeferredConfiguredIncidentStateRuntimeHelpers()
        : null;
      const configuredIncidentDataSupportDeps = {
        normalizeDomainKeyOrSlug,
        incidentDomainConfiguredSourceTable: configuredIncidentStateRuntimeHelpers?.incidentDomainConfiguredSourceTable,
        incidentDomainConfiguredSelectFields: configuredIncidentStateRuntimeHelpers?.incidentDomainConfiguredSelectFields,
        incidentDomainConfiguredStaticFilters: configuredIncidentStateRuntimeHelpers?.incidentDomainConfiguredStaticFilters,
        isMissingTenantKeyColumnError,
        fetchAllConfiguredIncidentPersistedRecordState,
        incidentDomainConfiguredPersistedRecordStateTable:
          configuredIncidentStateRuntimeHelpers?.incidentDomainConfiguredPersistedRecordStateTable,
        incidentDomainNormalizePersistedRecordStateRow:
          configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizePersistedRecordStateRow,
        incidentDomainNormalizeConfiguredSeededRecord:
          configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizeConfiguredSeededRecord,
        incidentDomainNormalizeConfiguredReportRecord:
          configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizeConfiguredReportRecord,
      };
      let configuredIncidentLoadResults = [];
      let configuredIncidentSeededCountByDomain = {};
      let configuredIncidentReportCountByDomain = {};
      let configuredIncidentLoadErrors = [];
      let configuredIncidentNormalizedSeededRowsByDomain = new Map();
      let configuredPersistedRecordStateResults = [];
      let configuredPersistedRecordStateCountByDomain = {};
      let configuredPersistedRecordStateLoadErrors = [];

      if (shouldLoadConfiguredIncidentRuntimeNow && configuredIncidentDataSupportModulePromise) {
        const {
          loadConfiguredIncidentDomainDataShared,
          loadConfiguredIncidentPersistedRecordStateShared,
          applyLoadedConfiguredIncidentPersistedRecordStateShared,
          applyLoadedConfiguredIncidentDomainStateShared,
          buildConfiguredIncidentInitialLoadSummaryShared,
          buildConfiguredIncidentPersistedStateInitialLoadSummaryShared,
          mergeLoadedConfiguredIncidentDomainKeysShared,
          mergeLoadedConfiguredIncidentPersistedStateDomainKeysShared,
        } = await configuredIncidentDataSupportModulePromise;
        const configuredIncidentInitialLoadDomainKeys = configuredIncidentStartupDomainKeys;

        const configuredIncidentLoadResultsPromise = Promise.all(
          configuredIncidentInitialLoadDomainKeys.map(async (domainKey) => {
            const entry = configuredIncidentRuntimeEntryByDomain.get(domainKey);
            if (!entry) {
              return {
                domainKey,
                setSeededRows: null,
                setReportRows: null,
                seededRows: [],
                reportRows: [],
                seededError: null,
                reportError: null,
              };
            }
            const result = await loadConfiguredIncidentDomainDataShared(
              entry.domainKey,
              publicReadClient,
              loadTenantKey,
              configuredIncidentDataSupportDeps
            );
            return {
              domainKey: entry.domainKey,
              setSeededRows: entry.setSeededRows,
              setReportRows: entry.setReportRows,
              ...result,
            };
          })
        );
        const configuredPersistedRecordStateResultsPromise = Promise.all(
          configuredIncidentPersistedStateSupportedDomainKeys
            .filter((domainKey) => configuredIncidentInitialLoadDomainKeys.includes(domainKey))
            .map(async (domainKey) => {
            const result = await loadConfiguredIncidentPersistedRecordStateShared(
              domainKey,
              publicReadClient,
              loadTenantKey,
              configuredIncidentDataSupportDeps
            );
            return {
              domainKey,
              ...result,
            };
          })
        );
        [configuredIncidentLoadResults, configuredPersistedRecordStateResults] = await Promise.all([
          configuredIncidentLoadResultsPromise,
          configuredPersistedRecordStateResultsPromise,
        ]);
        ({
          configuredIncidentSeededCountByDomain,
          configuredIncidentReportCountByDomain,
          configuredIncidentLoadErrors,
          configuredIncidentNormalizedSeededRowsByDomain,
        } = buildConfiguredIncidentInitialLoadSummaryShared(
          configuredIncidentLoadResults,
          {
            incidentDomainNormalizeConfiguredSeededRecord:
              configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizeConfiguredSeededRecord,
          }
        ));
        ({
          configuredPersistedRecordStateCountByDomain,
          configuredPersistedRecordStateLoadErrors,
        } = buildConfiguredIncidentPersistedStateInitialLoadSummaryShared(
          configuredPersistedRecordStateResults
        ));

        for (const entry of configuredPersistedRecordStateResults) {
          applyLoadedConfiguredIncidentPersistedRecordStateShared(entry.domainKey, {
            stateRows: entry.stateRows,
            stateError: entry.stateError,
            setPersistedIncidentRecordStateByDomain,
          }, configuredIncidentDataSupportDeps);
        }
        for (const entry of configuredIncidentLoadResults) {
          applyLoadedConfiguredIncidentDomainStateShared(entry.domainKey, {
            seededRows: entry.seededRows,
            reportRows: entry.reportRows,
            seededError: entry.seededError,
            reportError: entry.reportError,
            setSeededRows: entry.setSeededRows,
            setReportRows: entry.setReportRows,
          }, configuredIncidentDataSupportDeps);
        }
      }

      const liveReportsResult = await reportsResultPromise;
      reportData = liveReportsResult?.data || [];
      const publicReportData = liveReportsResult?.publicData || [];
      repErr = liveReportsResult?.error || null;

      let officialData = cachedOfficialLightRowsForStartup;
      let offErr = null;
      const officialLightsResult = await officialLightsResultPromise;
      officialData = officialLightsResult?.data || [];
      offErr = officialLightsResult?.error || null;
      const genericIncidentDataLoaded =
        (Array.isArray(reportData) && reportData.length > 0)
        || (Array.isArray(officialData) && officialData.length > 0)
        || configuredIncidentLoadResults.some((entry) => (
          Array.isArray(entry?.seededRows) && entry.seededRows.length > 0
        ));
      const { shouldRetrySparseFirstLoadShared } = await publicMapLoadSupportModulePromise;
      const registryDomainCount = Number(tenantRegistryIncidentDomainsRef.current?.length || 0);
      const visibleDomainCount = Number(visibleDomainOptionsRef.current?.length || 0);
      const waitingForDomainConfigForRetry = !tenantDomainConfigLoadedRef.current;
      const shouldRetrySparseFirstLoad = shouldRetrySparseFirstLoadShared({
        cancelled,
        reportsAdminView,
        loadAttempt,
        loadTenantKey,
        expectedConfiguredRuntimeDomainCount: configuredIncidentStartupDomainKeys.length,
        genericIncidentDataLoaded,
        repErr,
        offErr,
        registryDomainCount,
        visibleDomainCount,
        waitingForDomainConfigForRetry,
        configuredIncidentSeededCountByDomain,
        configuredIncidentReportCountByDomain,
        configuredPersistedRecordStateCountByDomain,
      });
      if (shouldRetrySparseFirstLoad) {
        pushTenantBoundaryDiagnostic("map_data:sparse-first-load-retry", {
          loadAttempt,
          loadTenantKey,
          runtimeTenantKey: String(activeTenantKey() || "").trim().toLowerCase(),
          globalSupabaseTenantKey: getSupabaseTenantKey(),
          registryDomainCount,
          visibleDomainCount,
          waitingForDomainConfigForRetry,
          reportCount: Number(reportData?.length || 0),
          officialLightCount: Number(officialData?.length || 0),
          incidentStateCount: -1,
          configuredIncidentSeededCountByDomain,
          configuredIncidentReportCountByDomain,
          configuredPersistedRecordStateCountByDomain,
          usingSharedSupabaseClient: publicReadClient === supabase,
        });
        await new Promise((resolve) => window.setTimeout(resolve, 250 * (loadAttempt + 1)));
        if (cancelled) return;
        return loadAll(loadAttempt + 1);
      }
      if (cancelled) return;

      if (offErr) {
        openNotice("⚠️", "Official lights failed to load", offErr.message || "Check Supabase RLS policies.");
      } else {
        if (!canUseCachedOfficialLightsForStartup) {
          setOfficialLights(
            (officialData || [])
              .map(normalizeOfficialLightRow)
              .filter(Boolean)
          );
        }
      }
      let normalizedPersistedIncidentRecordStateByDomain = {};
      let normalizedConfiguredIncidentSeededRowsStateByDomain = {};
      let normalizedConfiguredIncidentReportRowsStateByDomain = {};
      if (configuredIncidentDataSupportModulePromise) {
        const {
          buildNormalizedConfiguredIncidentPersistedStateByDomainShared,
          buildNormalizedConfiguredIncidentRuntimeStateByDomainShared,
          mergeLoadedConfiguredIncidentDomainKeysShared,
          mergeLoadedConfiguredIncidentPersistedStateDomainKeysShared,
        } = await configuredIncidentDataSupportModulePromise;
        normalizedPersistedIncidentRecordStateByDomain =
          buildNormalizedConfiguredIncidentPersistedStateByDomainShared(
            configuredPersistedRecordStateResults,
            {
              normalizeDomainKeyOrSlug,
              incidentDomainNormalizePersistedRecordStateRow:
                configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizePersistedRecordStateRow,
            }
          );
        ({
          normalizedConfiguredIncidentSeededRowsStateByDomain,
          normalizedConfiguredIncidentReportRowsStateByDomain,
        } = buildNormalizedConfiguredIncidentRuntimeStateByDomainShared(
          configuredIncidentLoadResults,
          {
            normalizeDomainKeyOrSlug,
            incidentDomainNormalizeConfiguredSeededRecord:
              configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizeConfiguredSeededRecord,
            incidentDomainNormalizeConfiguredReportRecord:
              configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizeConfiguredReportRecord,
          }
        ));
        setConfiguredIncidentLoadedDomainKeys((prev) =>
          mergeLoadedConfiguredIncidentDomainKeysShared(prev, configuredIncidentLoadResults, {
            isConnectionLikeDbError,
          })
        );
        setConfiguredIncidentPersistedStateLoadedDomainKeys((prev) =>
          mergeLoadedConfiguredIncidentPersistedStateDomainKeysShared(prev, configuredPersistedRecordStateResults, {
            isConnectionLikeDbError,
          })
        );
      }
      const publicMapLoadSupportModule = await publicMapLoadSupportModulePromise;
      const {
        buildIncidentStateSnapshotShared,
        buildKnownAssetIdSetsByDomainShared,
        buildOfficialLightRuntimeMapsShared,
        hasConnectionLikeFailureShared,
        normalizeResidentReportRowShared,
        scheduleDeferredStartupFollowupRuntimeShared,
        writeCachedTenantPublicMapCoreSnapshotShared,
      } = publicMapLoadSupportModule;
      if (shouldLoadIncidentStateAtStartup) {
        const startupIncidentStateResult = await incidentStateResultPromise;
        if (cancelled) return;
        startupIncidentStateErr = startupIncidentStateResult?.error || null;
        if (startupIncidentStateErr) {
          if (!isExpectedPermissionError(startupIncidentStateErr)) {
            console.warn("[incident_state_current] load warning:", startupIncidentStateErr?.message || startupIncidentStateErr);
          }
        } else {
          startupIncidentStateByKey = buildIncidentStateSnapshotShared(
            startupIncidentStateResult?.data || [],
            { incidentSnapshotKey }
          );
          applyIncidentStateSnapshot(startupIncidentStateByKey);
        }
      }
      const normalizedOfficialLightRows = (officialData || [])
        .map(normalizeOfficialLightRow)
        .filter(Boolean);
      const {
        normalizedOfficialLightIdSet,
        officialIdByAlias,
        officialIdByCoordKey,
      } = buildOfficialLightRuntimeMapsShared(normalizedOfficialLightRows);
      const normalizedKnownAssetIdSetsByDomain = buildKnownAssetIdSetsByDomainShared(
        normalizedOfficialLightIdSet,
        configuredIncidentNormalizedSeededRowsByDomain,
        { isAssetBackedDomainType }
      );

      if (repErr) {
        if (!isExpectedPermissionError(repErr)) {
          console.error(repErr);
        }
      }

      const normalizeResidentReportRow = (row) => normalizeResidentReportRowShared(row, {
        officialIdByAlias,
        officialIdByCoordKey,
        officialLightRows: normalizedOfficialLightRows,
        knownAssetIdSetsByDomain: normalizedKnownAssetIdSetsByDomain,
        officialLightIdSet: normalizedOfficialLightIdSet,
      }, {
        canonicalOfficialLightId,
        normalizeDomainKeyOrSlug,
        normalizeReportQuality,
        reportDomainForRow,
      });

      const normalizedPublicReports = canUseCachedReportsForStartup
        ? cachedReportRowsForStartup
        : (reportData || [])
            .map(normalizeResidentReportRow)
            .filter(Boolean);
      const normalizedPublicCacheReports = canUseCachedReportsForStartup
        ? cachedReportRowsForStartup
        : (publicReportData || [])
            .map(normalizeResidentReportRow)
            .filter(Boolean);
      const startupReportRuntimeState = derivePublicMapReportRuntimeState(
        normalizedPublicReports,
        normalizedOfficialLightIdSet,
        { assumeNormalized: true }
      );
      setReports(startupReportRuntimeState.reports);
      setSharedIncidentReportRowsStateByDomain(startupReportRuntimeState.sharedIncidentReportRowsStateByDomain);
      setSharedIncidentBaseMarkersStateByDomain(startupReportRuntimeState.sharedIncidentBaseMarkersStateByDomain);
      setStreetlightOutageTsByLightId(startupReportRuntimeState.streetlightOutageTsByLightId);
      if (!cancelled) {
        setLoading(false);
      }

      const loadDeferredMapStartupData = async () => {
        let deferredNormalizedPublicReports = normalizedPublicReports;
        let deferredNormalizedPublicCacheReports = normalizedPublicCacheReports;
        let deferredOfficialLightRows = normalizedOfficialLightRows;
        let deferredOfficialLightIdSet = normalizedOfficialLightIdSet;
        let deferredOfficialIdByAlias = officialIdByAlias;
        let deferredOfficialIdByCoordKey = officialIdByCoordKey;
        let deferredStreetlightOutageTsByLightId = startupReportRuntimeState.streetlightOutageTsByLightId;
        let deferredRepErr = repErr;
        let deferredOffErr = offErr;
        let deferredIncidentStateErr = null;

        if (canUseCachedOfficialLightsForStartup) {
          const officialLightsResult = await loadOfficialLightsNow();
          if (cancelled) return;
          deferredOffErr = officialLightsResult?.error || null;
          if (!deferredOffErr) {
            deferredOfficialLightRows = (officialLightsResult?.data || [])
              .map(normalizeOfficialLightRow)
              .filter(Boolean);
            ({
              normalizedOfficialLightIdSet: deferredOfficialLightIdSet,
              officialIdByAlias: deferredOfficialIdByAlias,
              officialIdByCoordKey: deferredOfficialIdByCoordKey,
            } = buildOfficialLightRuntimeMapsShared(deferredOfficialLightRows));
            startTransition(() => {
              setOfficialLights(deferredOfficialLightRows);
            });
          }
        }

        if (canUseCachedReportsForStartup) {
          const deferredKnownAssetIdSetsByDomain = buildKnownAssetIdSetsByDomainShared(
            deferredOfficialLightIdSet,
            configuredIncidentNormalizedSeededRowsByDomain,
            { isAssetBackedDomainType }
          );
          const deferredReportsResult = await loadReportsNow();
          if (cancelled) return;
          deferredRepErr = deferredReportsResult?.error || null;
          if (!deferredRepErr) {
            deferredNormalizedPublicReports = (deferredReportsResult?.data || [])
              .map((row) => normalizeResidentReportRowShared(row, {
                officialIdByAlias: deferredOfficialIdByAlias,
                officialIdByCoordKey: deferredOfficialIdByCoordKey,
                officialLightRows: deferredOfficialLightRows,
                knownAssetIdSetsByDomain: deferredKnownAssetIdSetsByDomain,
                officialLightIdSet: deferredOfficialLightIdSet,
              }, {
                canonicalOfficialLightId,
                normalizeDomainKeyOrSlug,
                normalizeReportQuality,
                reportDomainForRow,
              }))
              .filter(Boolean)
              .sort((a, b) => (b.ts || 0) - (a.ts || 0));
            deferredNormalizedPublicCacheReports = (deferredReportsResult?.publicData || [])
              .map((row) => normalizeResidentReportRowShared(row, {
                officialIdByAlias: deferredOfficialIdByAlias,
                officialIdByCoordKey: deferredOfficialIdByCoordKey,
                officialLightRows: deferredOfficialLightRows,
                knownAssetIdSetsByDomain: deferredKnownAssetIdSetsByDomain,
                officialLightIdSet: deferredOfficialLightIdSet,
              }, {
                canonicalOfficialLightId,
                normalizeDomainKeyOrSlug,
                normalizeReportQuality,
                reportDomainForRow,
              }))
              .filter(Boolean)
              .sort((a, b) => (b.ts || 0) - (a.ts || 0));
            const deferredReportRuntimeState = derivePublicMapReportRuntimeState(
              deferredNormalizedPublicReports,
              deferredOfficialLightIdSet,
              {
                assumeNormalized: true,
                assumeSorted: true,
              }
            );
            startTransition(() => {
              setReports(deferredReportRuntimeState.reports);
              setSharedIncidentReportRowsStateByDomain(
                deferredReportRuntimeState.sharedIncidentReportRowsStateByDomain
              );
              setSharedIncidentBaseMarkersStateByDomain(
                deferredReportRuntimeState.sharedIncidentBaseMarkersStateByDomain
              );
              setStreetlightOutageTsByLightId(deferredReportRuntimeState.streetlightOutageTsByLightId);
            });
            deferredNormalizedPublicReports = deferredReportRuntimeState.reports;
            deferredStreetlightOutageTsByLightId = deferredReportRuntimeState.streetlightOutageTsByLightId;
          }
        }

        const incidentStateResult = (canUseCachedIncidentStateForStartup || shouldDeferIncidentStateForStartup || shouldLoadIncidentStateAtStartup)
          ? { data: [], error: null }
          : await loadIncidentStateNow();
        if (cancelled) return;
        const incidentStateErr = (canUseCachedIncidentStateForStartup || shouldDeferIncidentStateForStartup || shouldLoadIncidentStateAtStartup)
          ? startupIncidentStateErr
          : (incidentStateResult?.error || null);
        deferredIncidentStateErr = incidentStateErr;
        let nextIncidentStateByKey = shouldLoadIncidentStateAtStartup
          ? { ...(startupIncidentStateByKey || {}) }
          : canUseCachedIncidentStateForStartup
            ? { ...cachedIncidentStateForStartup }
            : {};
        if (shouldLoadIncidentStateAtStartup) {
          // The incident layer published this lifecycle snapshot atomically with its markers.
        } else if (incidentStateErr) {
          if (!isExpectedPermissionError(incidentStateErr)) {
            console.warn("[incident_state_current] load warning:", incidentStateErr?.message || incidentStateErr);
          }
        } else {
          nextIncidentStateByKey = buildIncidentStateSnapshotShared(
            incidentStateResult?.data || [],
            { incidentSnapshotKey }
          );
          if (!canUseCachedIncidentStateForStartup && !shouldDeferIncidentStateForStartup && !shouldLoadIncidentStateAtStartup) {
            applyIncidentStateSnapshot(nextIncidentStateByKey);
          }
        }

        const streetlightRuntimeStartupState = shouldPrioritizeStreetlightRuntimeStartupRef.current
          ? await loadDeferredPublicMapStreetlightStartupSupportModule().then(({
            loadDeferredStreetlightRuntimeStartupShared,
          }) => loadDeferredStreetlightRuntimeStartupShared({
            shouldPrioritizeStreetlightRuntimeStartup: true,
            isAuthed,
            authedReadClient,
            publicReadClient,
            loadTenantKey,
            sessionUserId: session?.user?.id || "",
            deferredOfficialIdByAlias,
            deferredOfficialIdByCoordKey,
            fixedLightsPromise,
            actionsPromise,
            isCancelled: () => cancelled,
          }, {
            loadIncidentDeferredSupportModule,
            canonicalOfficialLightId,
            setUtilityReportedLightIdSet,
            setUtilityReportedAtByLightId,
            setUtilityReportReferenceByLightId,
            setUtilitySignalCountsByLightId,
            setFixedLights,
            setActionsByLightId,
            setLastFixByLightId,
            isExpectedPermissionError,
          }))
          : {
            utilityStatusErr: null,
            utilitySignalCountErr: null,
            fixErr: null,
            actErr: null,
            fixedMap: {},
            nextActionsByLightId: {},
          };
        if (cancelled) return;
        const utilityStatusErr = streetlightRuntimeStartupState.utilityStatusErr;
        const utilitySignalCountErr = streetlightRuntimeStartupState.utilitySignalCountErr;
        const fixErr = streetlightRuntimeStartupState.fixErr;
        const actErr = streetlightRuntimeStartupState.actErr;
        const fixedMap = streetlightRuntimeStartupState.fixedMap;
        const nextActionsByLightId = streetlightRuntimeStartupState.nextActionsByLightId;

        const cachedFixedLightsForDeferredWrite = shouldPrioritizeStreetlightRuntimeStartupRef.current
          ? fixedMap
          : normalizeCachedFixedLights(fixedLights);
        const cachedActionsByLightIdForDeferredWrite = shouldPrioritizeStreetlightRuntimeStartupRef.current
          ? nextActionsByLightId
          : normalizeCachedActionsByLightId(actionsByLightId);
        const cachedIncidentStateByKeyForDeferredWrite = canUseCachedIncidentStateForStartup
          ? (cachedPublicMapCoreSnapshot?.incidentStateByKey || nextIncidentStateByKey)
          : nextIncidentStateByKey;

        if (!isAuthed && !reportsAdminView) {
          writeCachedTenantPublicMapCoreSnapshotShared(loadTenantKey, {
            officialLights: deferredOfficialLightRows,
            reports: deferredNormalizedPublicCacheReports,
            streetlightOutageTsByLightId: deferredStreetlightOutageTsByLightId,
            incidentStateByKey: cachedIncidentStateByKeyForDeferredWrite,
            fixedLights: cachedFixedLightsForDeferredWrite,
            actionsByLightId: cachedActionsByLightIdForDeferredWrite,
            configuredIncidentSeededRowsStateByDomain: normalizedConfiguredIncidentSeededRowsStateByDomain,
            configuredIncidentReportRowsStateByDomain: normalizedConfiguredIncidentReportRowsStateByDomain,
            persistedIncidentRecordStateByDomain: normalizedPersistedIncidentRecordStateByDomain,
          }, {
            tenantPublicMapCoreCacheStorageKey,
            normalizeOfficialLightRow,
            normalizeCachedPublicMapReports,
            normalizeCachedStreetlightOutageTsByLightId,
            derivePublicMapReportRuntimeState,
            normalizeCachedIncidentStateByKey,
            normalizeCachedFixedLights,
            normalizeCachedConfiguredIncidentRowsByDomain:
              configuredIncidentStateRuntimeHelpers?.normalizeCachedConfiguredIncidentRowsByDomainShared,
            normalizeCachedPersistedIncidentRecordStateByDomain:
              configuredIncidentStateRuntimeHelpers?.normalizeCachedPersistedIncidentRecordStateByDomainShared,
            normalizeDomainKeyOrSlug,
            incidentDomainNormalizeConfiguredReportRecord:
              configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizeConfiguredReportRecord,
          });
        }

        const loadHadConnectionFailure = hasConnectionLikeFailureShared([
          deferredRepErr,
          fixErr,
          actErr,
          deferredOffErr,
          deferredIncidentStateErr,
          utilityStatusErr,
          utilitySignalCountErr,
          ...configuredPersistedRecordStateLoadErrors,
          ...configuredIncidentLoadErrors,
        ], {
          isConnectionLikeDbError,
        });
        if (loadHadConnectionFailure) {
          notifyDbConnectionIssue({ message: "deferred connection check failed" });
        } else {
          resetDbConnectionIssueStreak();
        }
      };

      if (cancelled) return;
      deferredStartupCleanup?.();
      deferredStartupCleanup = scheduleDeferredStartupFollowupRuntimeShared(async (isFollowupCancelled) => {
        if (cancelled || isFollowupCancelled()) return;
        await loadDeferredMapStartupData();
      }, {
        startupDelayMs: 4600,
        idleTimeoutMs: 1200,
        fallbackDelayMs: 0,
      });
    }

    void loadAll();
    return () => {
      cancelled = true;
      deferredStartupCleanup?.();
    };
  }, [applyIncidentStateSnapshot, publicMapLoadAuthGateKey, publicReadAccessReady, reportsAdminView, session?.access_token, session?.user?.id, tenant?.tenantKey, tenant?.ready, tenantScopedReadClient, mapDataReloadToken, waitingForTenantDomainConfig]);

  useEffect(() => {
    if (!publicReadAccessReady || tenant?.ready === false) return;
    const loadTenantKey = String(tenant?.tenantKey || activeTenantKey() || "").trim().toLowerCase();
    if (!loadTenantKey) return;
    const missingConfiguredDomainKeys = (configuredIncidentDemandDomainKeys || []).filter((domainKey) => (
      configuredIncidentRuntimeEntryByDomain?.has(domainKey)
      && !configuredIncidentLoadedDomainKeySet?.has(domainKey)
      && !configuredIncidentLoadingDomainKeysRef?.current?.has(domainKey)
    ));
    const configuredDemandDomainKeySet = new Set(configuredIncidentDemandDomainKeys || []);
    const missingPersistedStateDomainKeys = (configuredIncidentPersistedStateSupportedDomainKeys || []).filter((domainKey) => (
      configuredDemandDomainKeySet.has(domainKey)
      && !configuredIncidentPersistedStateLoadedDomainKeySet?.has(domainKey)
      && !configuredIncidentPersistedStateLoadingDomainKeysRef?.current?.has(domainKey)
    ));
    if (!missingConfiguredDomainKeys.length && !missingPersistedStateDomainKeys.length) return;

    const cachedSeededByDomain = cachedConfiguredIncidentSeededRowsByDomainRef.current || {};
    const cachedReportByDomain = cachedConfiguredIncidentReportRowsByDomainRef.current || {};
    const cachedPersistedByDomain = cachedPersistedIncidentRecordStateByDomainRef.current || {};
    const canRefreshConfiguredDomainsFromCachedSnapshot = missingConfiguredDomainKeys.every((domainKey) => (
      Object.prototype.hasOwnProperty.call(cachedSeededByDomain, domainKey)
      || Object.prototype.hasOwnProperty.call(cachedReportByDomain, domainKey)
    ));
    const canRefreshPersistedStateFromCachedSnapshot = missingPersistedStateDomainKeys.every((domainKey) => (
      Object.prototype.hasOwnProperty.call(cachedPersistedByDomain, domainKey)
    ));
    const shouldDeferCachedConfiguredIncidentHydrationBootstrap =
      !reportsAdminView
      && activeMapLayerKey !== INCIDENT_REPORTING_LAYER_KEY
      && publicMapCoreCacheHydrated
      && canRefreshConfiguredDomainsFromCachedSnapshot
      && canRefreshPersistedStateFromCachedSnapshot
      && (loading || !startupWarmupReady);
    if (shouldDeferCachedConfiguredIncidentHydrationBootstrap) return;

    const publicReadClient = tenantScopedReadClient || createTenantScopedReadClient(loadTenantKey) || supabase;
    let cleanup = null;
    let disposed = false;

    void Promise.all([
      loadDeferredConfiguredIncidentDataSupportModule(),
      loadDeferredConfiguredIncidentStateRuntimeHelpers(),
    ]).then(([
      {
        scheduleConfiguredIncidentDomainsHydrationShared,
      },
      configuredIncidentStateRuntimeHelpers,
    ]) => {
      const nextCleanup = scheduleConfiguredIncidentDomainsHydrationShared({
        configuredIncidentDemandDomainKeys,
        configuredIncidentRuntimeEntryByDomain,
        configuredIncidentLoadedDomainKeySet,
        configuredIncidentLoadingDomainKeysRef,
        configuredIncidentPersistedStateSupportedDomainKeys,
        configuredIncidentPersistedStateLoadedDomainKeySet,
        configuredIncidentPersistedStateLoadingDomainKeysRef,
        cachedSeededByDomain: cachedConfiguredIncidentSeededRowsByDomainRef.current || {},
        cachedReportByDomain: cachedConfiguredIncidentReportRowsByDomainRef.current || {},
        cachedPersistedByDomain: cachedPersistedIncidentRecordStateByDomainRef.current || {},
        reportsAdminView,
        publicMapCoreCacheHydrated,
        loading,
        nonCriticalStartupReady,
        publicReadClient,
        loadTenantKey,
        setPersistedIncidentRecordStateByDomain,
        setConfiguredIncidentLoadedDomainKeys,
        setConfiguredIncidentPersistedStateLoadedDomainKeys,
      }, {
        normalizeDomainKeyOrSlug,
        incidentDomainConfiguredSourceTable: configuredIncidentStateRuntimeHelpers?.incidentDomainConfiguredSourceTable,
        incidentDomainConfiguredSelectFields: configuredIncidentStateRuntimeHelpers?.incidentDomainConfiguredSelectFields,
        incidentDomainConfiguredStaticFilters: configuredIncidentStateRuntimeHelpers?.incidentDomainConfiguredStaticFilters,
        isMissingTenantKeyColumnError,
        fetchAllConfiguredIncidentPersistedRecordState,
        incidentDomainConfiguredPersistedRecordStateTable:
          configuredIncidentStateRuntimeHelpers?.incidentDomainConfiguredPersistedRecordStateTable,
        incidentDomainNormalizePersistedRecordStateRow:
          configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizePersistedRecordStateRow,
        incidentDomainNormalizeConfiguredSeededRecord:
          configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizeConfiguredSeededRecord,
        incidentDomainNormalizeConfiguredReportRecord:
          configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizeConfiguredReportRecord,
        isConnectionLikeDbError,
      });
      if (disposed) {
        nextCleanup?.();
        return;
      }
      cleanup = nextCleanup;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [
    configuredIncidentDemandDomainKeys,
    configuredIncidentLoadedDomainKeySet,
    configuredIncidentPersistedStateLoadedDomainKeySet,
    configuredIncidentPersistedStateSupportedDomainKeys,
    configuredIncidentRuntimeEntryByDomain,
    loading,
    startupWarmupReady,
    publicReadAccessReady,
    activeMapLayerKey,
    publicMapCoreCacheHydrated,
    reportsAdminView,
    tenant?.ready,
    tenant?.tenantKey,
    tenantScopedReadClient,
  ]);

  const adminFullReportsHydrationKeyRef = useRef("");
  useEffect(() => {
    if (!reportsAdminView || !(myReportsOpen || openReportsOpen) || !authReady || tenant?.ready === false) return;
    const loadTenantKey = String(tenant?.tenantKey || activeTenantKey() || "").trim().toLowerCase();
    const accessToken = String(session?.access_token || "").trim();
    if (!loadTenantKey || !accessToken) return;
    const hydrationKey = `${loadTenantKey}::${mapDataReloadToken}`;
    if (adminFullReportsHydrationKeyRef.current === hydrationKey) return;

    const authedReadClient =
      createTenantScopedAuthedClient(loadTenantKey, accessToken)
      || createTenantScopedReadClient(loadTenantKey)
      || supabase;
    const reportSelectFull = "id, created_at, lat, lng, report_type, report_quality, note, light_id, report_number, reporter_user_id, reporter_name, reporter_phone, reporter_email, report_domain";
    const hasStartupReportRows = Array.isArray(reports) && reports.length > 0;
    let cleanup = null;
    let disposed = false;

    void loadDeferredPublicMapFollowupSupportModule().then(({
      scheduleScopedReportsHydrationRuntimeShared,
    }) => {
      const nextCleanup = scheduleScopedReportsHydrationRuntimeShared({
        readClient: authedReadClient,
        reportSelectFull,
        loadTenantKey,
        hydrationKey,
        logLabel: "admin reports hydrate",
        setHydrationKey: (value) => {
          adminFullReportsHydrationKeyRef.current = value;
        },
        deferUntilIdle: hasStartupReportRows,
        idleTimeoutMs: 2200,
        fallbackDelayMs: 180,
      }, {
        isExpectedPermissionError,
        mergeResidentReportsIntoState,
      });
      if (disposed) {
        nextCleanup?.();
        return;
      }
      cleanup = nextCleanup;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [
    authReady,
    mapDataReloadToken,
    myReportsOpen,
    openReportsOpen,
    reportsAdminView,
    reports,
    session?.access_token,
    tenant?.ready,
    tenant?.tenantKey,
  ]);
  useEffect(() => {
    if (!myReportsOpen || reportsAdminView || !authReady || tenant?.ready === false) return;
    const viewerUserId = String(session?.user?.id || "").trim();
    const loadTenantKey = String(tenant?.tenantKey || activeTenantKey() || "").trim().toLowerCase();
    if (!viewerUserId || !loadTenantKey) return;
    const hydrationKey = `${loadTenantKey}::${viewerUserId}`;
    if (residentReportsHydrationKeyRef.current === hydrationKey) return;

    const scopedReadClient = tenantScopedReadClient || createTenantScopedReadClient(loadTenantKey) || supabase;
    const authedReadClient = session?.access_token ? supabase : scopedReadClient;
    const reportSelectFull = "id, created_at, lat, lng, report_type, report_quality, note, light_id, report_number, reporter_user_id, reporter_name, reporter_phone, reporter_email, report_domain";
    const hasStartupResidentRows = Array.isArray(reports)
      && reports.some((row) => String(row?.reporter_user_id || "").trim() === viewerUserId);
    let cleanup = null;
    let disposed = false;

    void loadDeferredPublicMapFollowupSupportModule().then(({
      scheduleScopedReportsHydrationRuntimeShared,
    }) => {
      const nextCleanup = scheduleScopedReportsHydrationRuntimeShared({
        readClient: authedReadClient,
        reportSelectFull,
        loadTenantKey,
        viewerUserId,
        hydrationKey,
        logLabel: "my reports hydrate",
        setHydrationKey: (value) => {
          residentReportsHydrationKeyRef.current = value;
        },
        deferUntilIdle: hasStartupResidentRows,
        idleTimeoutMs: 2200,
        fallbackDelayMs: 180,
      }, {
        isExpectedPermissionError,
        mergeResidentReportsIntoState,
      });
      if (disposed) {
        nextCleanup?.();
        return;
      }
      cleanup = nextCleanup;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [
    authReady,
    myReportsOpen,
    reportsAdminView,
    reports,
    session?.access_token,
    session?.user?.id,
    tenant?.ready,
    tenant?.tenantKey,
    tenantScopedReadClient,
  ]);
  useEffect(() => {
    if (!(myReportsOpen || openReportsOpen) || !publicReadAccessReady || tenant?.ready === false) return;
    const loadTenantKey = String(tenant?.tenantKey || activeTenantKey() || "").trim().toLowerCase();
    if (!loadTenantKey) return;
    if (remoteIncidentLocationCacheHydrationKeyRef.current === loadTenantKey) return;

    const scopedReadClient = tenantScopedReadClient || createTenantScopedReadClient(loadTenantKey) || supabase;
    const hasLocalIncidentLocationCache = Object.keys(incidentLocationCacheByKey || {}).length > 0;
    const idleTimeoutMs = hasLocalIncidentLocationCache ? 4200 : 2200;
    const fallbackDelayMs = hasLocalIncidentLocationCache ? 1200 : 300;
    let cleanup = null;
    let disposed = false;

    void loadDeferredPublicMapFollowupSupportModule().then(({
      scheduleRemoteIncidentLocationCacheHydrationRuntimeShared,
    }) => {
      const nextCleanup = scheduleRemoteIncidentLocationCacheHydrationRuntimeShared({
        readClient: scopedReadClient,
        loadTenantKey,
        fetchAllIncidentLocationCache,
        setHydrationKey: (value) => {
          remoteIncidentLocationCacheHydrationKeyRef.current = value;
        },
        setIncidentLocationCacheByKey,
        idleTimeoutMs,
        fallbackDelayMs,
      }, {
        startTransition,
      });
      if (disposed) {
        nextCleanup?.();
        return;
      }
      cleanup = nextCleanup;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [
    incidentLocationCacheByKey,
    myReportsOpen,
    openReportsOpen,
    publicReadAccessReady,
    tenant?.ready,
    tenant?.tenantKey,
    tenantScopedReadClient,
  ]);

  useEffect(() => {
    if (!isAdmin) return;
    const lid = (selectedOfficialId || "").trim();
    if (!lid) return;
    getOfficialLightHistoryDetailed(lid).catch((e) => {
      console.warn("[official light history prefetch] failed:", e);
    });
  }, [isAdmin, selectedOfficialId]);

  const passiveStreetlightRuntimeHydrationKeyRef = useRef("");
  const passiveIncidentStateHydrationKeyRef = useRef("");
  useEffect(() => {
    if (!shouldComputeStreetlightRuntimeState) return undefined;
    if (shouldPrioritizeStreetlightRuntimeStartup) return undefined;
    if (loading || !startupWarmupReady || tenant?.ready === false) return undefined;

    const loadTenantKey = String(tenant?.tenantKey || activeTenantKey() || "").trim().toLowerCase();
    if (!loadTenantKey) return undefined;

    const viewerUserId = String(session?.user?.id || "").trim();
    const accessToken = String(session?.access_token || "").trim();
    const hydrationKey = `${loadTenantKey}::${reportsAdminView ? "admin" : "public"}::${viewerUserId || "anon"}`;
    if (passiveStreetlightRuntimeHydrationKeyRef.current === hydrationKey) return undefined;

    let cancelled = false;
    let idleHandle = null;
    let timeoutHandle = null;
    let dispose = () => {};
    const publicReadClient = tenantScopedReadClient || createTenantScopedReadClient(loadTenantKey) || supabase;
    const authedReadClient = accessToken
      ? (
          createTenantScopedAuthedClient(loadTenantKey, accessToken)
          || createTenantScopedReadClient(loadTenantKey)
          || supabase
        )
      : supabase;
    const preferScopedPublicReads = publicReadClient !== supabase;
    const hasCachedStreetlightRuntimeSnapshot = Boolean(
      Object.keys(fixedLights || {}).length > 0
      || Object.keys(actionsByLightId || {}).length > 0
      || Object.keys(lastFixByLightId || {}).length > 0
    );
    const reducedWarmup = backgroundWarmupPolicy?.reducedWarmup === true;
    const passiveStreetlightRuntimeIdleTimeoutMs = hasCachedStreetlightRuntimeSnapshot
      ? (reducedWarmup ? 6800 : 5200)
      : 1800;
    const passiveStreetlightRuntimeFallbackDelayMs = hasCachedStreetlightRuntimeSnapshot
      ? (reducedWarmup ? 4200 : 3200)
      : 240;

    void loadDeferredIncidentSupportModule().then(({ schedulePassiveStreetlightRuntimeShared }) => {
      if (cancelled) return;
      dispose = schedulePassiveStreetlightRuntimeShared({
        publicReadClient,
        authedReadClient,
        tenantKey: loadTenantKey,
        reportsAdminView,
        preferScopedPublicReads,
        setFixedLights,
        setActionsByLightId,
        setLastFixByLightId,
        onHydrated: () => {
          passiveStreetlightRuntimeHydrationKeyRef.current = hydrationKey;
        },
        idleTimeoutMs: passiveStreetlightRuntimeIdleTimeoutMs,
        fallbackDelayMs: passiveStreetlightRuntimeFallbackDelayMs,
      }, {
        selectTenantScopedPublicRows,
        isExpectedPermissionError,
      });
    });

    return () => {
      cancelled = true;
      dispose();
    };
  }, [
    loading,
    startupWarmupReady,
    reportsAdminView,
    session?.access_token,
    session?.user?.id,
    actionsByLightId,
    backgroundWarmupPolicy,
    fixedLights,
    lastFixByLightId,
    shouldComputeStreetlightRuntimeState,
    shouldPrioritizeStreetlightRuntimeStartup,
    tenant?.ready,
    tenant?.tenantKey,
    tenantScopedReadClient,
  ]);

  useEffect(() => {
    if (reportsAdminView) return undefined;
    if (loading || !startupWarmupReady || tenant?.ready === false) return undefined;

    const loadTenantKey = String(tenant?.tenantKey || activeTenantKey() || "").trim().toLowerCase();
    if (!loadTenantKey) return undefined;

    const viewerUserId = String(session?.user?.id || "").trim();
    const hydrationKey = `${loadTenantKey}::${viewerUserId || "anon"}::${mapDataReloadToken}`;
    if (deferredIncidentStateRefreshContextKeyRef.current !== hydrationKey) return undefined;
    if (passiveIncidentStateHydrationKeyRef.current === hydrationKey) return undefined;

    const publicReadClient = tenantScopedReadClient || createTenantScopedReadClient(loadTenantKey) || supabase;
    let dispose = () => {};
    let cancelled = false;
    void loadDeferredPublicMapFollowupSupportModule().then(({ schedulePassiveIncidentStateRuntimeShared }) => {
      if (cancelled) return;
      dispose = schedulePassiveIncidentStateRuntimeShared({
        readClient: publicReadClient,
        loadTenantKey,
        hydrationKey,
        fetchAllIncidentStateCurrent,
        setHydrationKey: (value) => {
          passiveIncidentStateHydrationKeyRef.current = value;
        },
      }, {
        incidentSnapshotKey,
        applyIncidentStateSnapshot,
        isExpectedPermissionError,
      });
    });

    return () => {
      cancelled = true;
      dispose();
    };
  }, [
    applyIncidentStateSnapshot,
    loading,
    mapDataReloadToken,
    startupWarmupReady,
    reportsAdminView,
    session?.user?.id,
    tenant?.ready,
    tenant?.tenantKey,
    tenantScopedReadClient,
  ]);

  const passiveBoundaryHydrationKeyRef = useRef("");
  useEffect(() => {
    if (loading || !startupWarmupReady || tenant?.ready === false || mapInteracting) return undefined;

    const loadTenantKey = String(tenant?.tenantKey || activeTenantKey() || "").trim().toLowerCase();
    if (!loadTenantKey) return undefined;

    const hydrationKey = `${loadTenantKey}::${mapDataReloadToken}`;
    if (deferredBoundaryRefreshContextKeyRef.current !== hydrationKey) return undefined;
    if (passiveBoundaryHydrationKeyRef.current === hydrationKey) return undefined;

    const publicReadClient = tenantScopedReadClient || createTenantScopedReadClient(loadTenantKey) || supabase;
    let dispose = () => {};
    let cancelled = false;
    void loadDeferredPublicMapFollowupSupportModule().then(({
      scheduleDeferredBoundaryGeojsonRuntimeShared,
    }) => {
      void loadDeferredPublicMapLoadSupportModule().then(({
      writeCachedTenantBoundaryGeojsonShared,
      clearCachedTenantBoundaryGeojsonShared,
      }) => {
        if (cancelled) return;
        dispose = scheduleDeferredBoundaryGeojsonRuntimeShared({
          readClient: publicReadClient,
          loadTenantKey,
          hydrationKey,
          fetchTenantBoundaryGeojson,
          setCityBoundaryGeojson,
          setHydrationKey: (value) => {
            passiveBoundaryHydrationKeyRef.current = value;
          },
        }, {
          writeCachedTenantBoundaryGeojson: (tenantKey, geojson) => (
            writeCachedTenantBoundaryGeojsonShared(tenantKey, geojson, { parseGeoJsonValue })
          ),
          clearCachedTenantBoundaryGeojson: clearCachedTenantBoundaryGeojsonShared,
        });
      });
    });

    return () => {
      cancelled = true;
      dispose();
    };
  }, [
    loading,
    mapDataReloadToken,
    mapInteracting,
    startupWarmupReady,
    tenant?.ready,
    tenant?.tenantKey,
    tenantScopedReadClient,
  ]);

  // Build a fast lookup of official IDs
  const officialIdSet = useMemo(() => new Set(officialLights.map((o) => o.id)), [officialLights]);
  const shouldComputeResidentReportRuntimeLookups = Boolean(
    myReportsOpen || openReportsOpen
  );
  const shouldComputeReportDomainRuntimeLookups = Boolean(
    shouldComputeResidentReportRuntimeLookups
    || activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY
    || (
      String(activeMapLayerKey || "").trim()
      && String(activeMapLayerKey || "").trim().toLowerCase() !== "streetlights"
    )
    || selectedDomainMarker
    || domainReportTarget
    || domainDisclosureGateTarget
    || confirmReportTarget
    || selectedIncidentStackMarker?.markers?.length
  );
  const reportKnownAssetIdSetsByDomain = useMemo(() => {
    const next = new Map([["streetlights", officialIdSet]]);
    if (!shouldComputeReportDomainRuntimeLookups) return next;
    for (const [domainKey, rows] of Object.entries(configuredIncidentSeededRowsStateByDomain || {})) {
      if (String(domainKey || "").trim() === "streetlights" || !isAssetBackedDomainType(domainKey)) continue;
      next.set(
        domainKey,
        new Set((Array.isArray(rows) ? rows : []).map((row) => String(row?.id || "").trim()).filter(Boolean))
      );
    }
    return next;
  }, [configuredIncidentSeededRowsStateByDomain, isAssetBackedDomainType, officialIdSet, shouldComputeReportDomainRuntimeLookups]);
  const sharedIncidentReportRowsByDomain = useMemo(() => {
    const byDomain = new Map();
    if (!shouldComputeReportDomainRuntimeLookups) return byDomain;
    for (const [domainKeyRaw, rows] of Object.entries(sharedIncidentReportRowsStateByDomain || {})) {
      const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
      if (!(domainKey && isSharedIncidentDomain(domainKey))) continue;
      byDomain.set(domainKey, Array.isArray(rows) ? rows : []);
    }
    return byDomain;
  }, [
    isSharedIncidentDomain,
    sharedIncidentReportRowsStateByDomain,
    shouldComputeReportDomainRuntimeLookups,
  ]);
  const shouldPrepareIncidentDomainMarkerSupport = Boolean(
    shouldComputeReportDomainRuntimeLookups
  );
  useEffect(() => {
    if (!shouldPrepareIncidentDomainMarkerSupport || incidentDomainMarkerRuntimeHelpers) return undefined;

    let cancelled = false;
    void loadDeferredIncidentDomainMarkerRuntimeHelpers().then((helpers) => {
      if (cancelled || !helpers) return;
      startTransition(() => {
        setIncidentDomainMarkerRuntimeHelpers((prev) => prev || helpers);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    incidentDomainMarkerRuntimeHelpers,
    loadDeferredIncidentDomainMarkerRuntimeHelpers,
    shouldPrepareIncidentDomainMarkerSupport,
  ]);
  useEffect(() => {
    if (
      !shouldPrepareIncidentDomainMarkerSupport
      || typeof incidentDomainMarkerRuntimeHelpers?.incidentDrivenSpecializedMarkerCollection !== "function"
    ) {
      setSharedIncidentSpecializedMarkersByDomain((prev) => (
        Object.keys(prev || {}).length ? {} : prev
      ));
      return;
    }

    const buildSpecializedMarkers = incidentDomainMarkerRuntimeHelpers.incidentDrivenSpecializedMarkerCollection;
    const next = {};
    for (const [domainKey, rows] of sharedIncidentReportRowsByDomain.entries()) {
      if (!domainKey || domainKey === "streetlights") continue;
      if (isAssetBackedDomainType(domainKey, resolveRuntimeDomainTypeForMap(domainKey))) continue;
      const markers = buildSpecializedMarkers(domainKey, {
        incidentDrivenRowsByDomain: new Map([[domainKey, Array.isArray(rows) ? rows : []]]),
        hydrateIncidentLocationFields: (marker) => marker,
        lastFixByLightId,
        fixedLights,
        isValidLatLng,
      }) || [];
      if (markers.length) next[domainKey] = markers;
    }
    startTransition(() => {
      setSharedIncidentSpecializedMarkersByDomain(next);
    });
  }, [
    fixedLights,
    incidentDomainMarkerRuntimeHelpers,
    isAssetBackedDomainType,
    isValidLatLng,
    lastFixByLightId,
    sharedIncidentReportRowsByDomain,
    shouldPrepareIncidentDomainMarkerSupport,
  ]);
  const officialIdAliasLookup = useMemo(() => {
    const next = new Map();
    if (!shouldComputeResidentReportRuntimeLookups) return next;
    for (const light of officialLights || []) {
      const id = String(light?.id || "").trim();
      if (!id) continue;
      next.set(id, id);
      const slId = String(light?.sl_id || "").trim();
      if (slId) next.set(slId, id);
    }
    return next;
  }, [shouldComputeResidentReportRuntimeLookups, officialLights]);
  const officialIdCoordLookup = useMemo(() => {
    const next = new Map();
    if (!shouldComputeResidentReportRuntimeLookups) return next;
    for (const light of officialLights || []) {
      const id = String(light?.id || "").trim();
      const lat = Number(light?.lat);
      const lng = Number(light?.lng);
      if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      next.set(`${lat.toFixed(5)}:${lng.toFixed(5)}`, id);
      next.set(`${lat.toFixed(4)}:${lng.toFixed(4)}`, id);
    }
    return next;
  }, [shouldComputeResidentReportRuntimeLookups, officialLights]);


  const slIdByUuid = useMemo(() => {
    const m = new Map();
    if (!shouldComputeResidentReportRuntimeLookups) return m;
    for (const l of officialLights || []) {
      const uuid = (l.id || "").trim();
      const sl = (l.sl_id || "").trim();
      if (uuid && sl) m.set(uuid, sl);
    }
    return m;
  }, [shouldComputeResidentReportRuntimeLookups, officialLights]);

  const shouldComputeOpenReportOfficialIdSet = Boolean(
    isAdmin && (
      openReportMapFilterOn
      || deleteCircleDraft?.center
    )
  );
  const openReportOfficialIdSet = useMemo(() => {
    const out = new Set();
    if (!shouldComputeOpenReportOfficialIdSet) return out;
    for (const r of reports || []) {
      if (!isOutageReportType(r)) continue;
      const lightId = (r.light_id || "").trim();
      if (!lightId || !officialIdSet.has(lightId)) continue;
      const lastFixTs = Math.max(lastFixByLightId?.[lightId] || 0, fixedLights?.[lightId] || 0);
      if (lastFixTs && (r.ts || 0) <= lastFixTs) continue;
      out.add(lightId);
    }
    return out;
  }, [shouldComputeOpenReportOfficialIdSet, reports, officialIdSet, fixedLights, lastFixByLightId]);
  const normalizeResidentReportRowForRuntime = useCallback((row) => {
    const normalizedLightId = canonicalOfficialLightId(
      row?.light_id,
      row?.lat,
      row?.lng,
      officialIdAliasLookup,
      officialIdCoordLookup,
      officialLights
    );
    const normalizedRow = {
      id: row?.id,
      lat: row?.lat,
      lng: row?.lng,
      type: row?.report_type,
      report_domain: normalizeDomainKeyOrSlug(row?.report_domain, { allowUnknown: true }) || null,
      domain: normalizeDomainKeyOrSlug(row?.report_domain, { allowUnknown: true }) || null,
      report_quality: normalizeReportQuality(row?.report_quality),
      note: row?.note || "",
      ts: new Date(row?.created_at).getTime(),
      light_id: normalizedLightId,
      report_number: row?.report_number || null,
      reporter_user_id: row?.reporter_user_id || null,
      reporter_name: row?.reporter_name || null,
      reporter_phone: row?.reporter_phone || null,
      reporter_email: row?.reporter_email || null,
    };
    const inferredDomain = reportDomainForRow(normalizedRow, reportKnownAssetIdSetsByDomain);
    if (inferredDomain === "streetlights" && !officialIdSet.has(String(normalizedLightId || "").trim())) {
      return null;
    }
    return normalizedRow;
  }, [officialIdAliasLookup, officialIdCoordLookup, officialIdSet, officialLights, reportKnownAssetIdSetsByDomain]);
  const residentReportsHydrationKeyRef = useRef("");
  const mergeResidentReportsIntoState = useCallback((rows) => {
    const normalizedRows = (Array.isArray(rows) ? rows : [])
      .map(normalizeResidentReportRowForRuntime)
      .filter(Boolean);
    if (!normalizedRows.length) return;
    startTransition(() => {
      let nextReports = null;
      setReports((prev) => {
        const reportMap = new Map((Array.isArray(prev) ? prev : []).map((entry) => [entry.id, entry]));
        for (const entry of normalizedRows) reportMap.set(entry.id, entry);
        nextReports = Array.from(reportMap.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
        return nextReports;
      });
      if (nextReports) {
        const nextReportRuntimeState = derivePublicMapReportRuntimeState(nextReports, officialIdSet, {
          assumeNormalized: true,
          assumeSorted: true,
        });
        setSharedIncidentReportRowsStateByDomain(nextReportRuntimeState.sharedIncidentReportRowsStateByDomain);
        setSharedIncidentBaseMarkersStateByDomain(nextReportRuntimeState.sharedIncidentBaseMarkersStateByDomain);
        setStreetlightOutageTsByLightId(nextReportRuntimeState.streetlightOutageTsByLightId);
      }
    });
  }, [normalizeResidentReportRowForRuntime, officialIdSet]);

  const isStreetlightsLayerActive = activeMapLayerKey === "streetlights";
  const activeAssetReportingDomainKey = isAssetBackedDomainType(activeMapLayerKey) ? activeMapLayerKey : "";
  const isAssetReportingDomain = Boolean(activeAssetReportingDomainKey);
  const isAggregatedReportingDomain = !isAssetReportingDomain;
  const incidentLayerMeta = useMemo(() => ({
    key: INCIDENT_REPORTING_LAYER_KEY,
    label: "Incident Reporting",
    icon: "📍",
    iconSrc: UI_ICON_SRC.incidentReportingLayer,
    iconKey: "incidentReportingLayer",
    enabled: incidentLayerButtonEnabled,
  }), [domainIconRenderTick, incidentLayerButtonEnabled]);
  const activeLayerMeta =
    (activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY
      ? {
          ...incidentLayerMeta,
          label: hasExplicitIncidentMapFilter
            ? activeIncidentMapFilterKeys.length === 1
              ? `Incident Reporting · ${resolvedIncidentLayerOption?.label || activeIncidentMapFilterKeys[0]}`
              : `Incident Reporting · ${activeIncidentMapFilterKeys.length} filters`
            : incidentLayerMeta.label,
          iconSrc:
            hasExplicitIncidentMapFilter && activeIncidentMapFilterKeys.length === 1
              ? (resolvedIncidentLayerOption?.iconSrc || incidentLayerMeta.iconSrc)
              : incidentLayerMeta.iconSrc,
        }
      : null)
    || layerOptionsByKey.get(activeMapLayerKey)
    || layerOptions[0]
    || (activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY ? incidentLayerMeta : null)
    || visibleDomainOptionsByKey.get(adminReportDomain)
    || builtInReportDomainOptions[0];
  const mobilePrimaryLayerOptions = useMemo(() => {
    const opts = [];
    if (incidentLayerDomainOptions.length && incidentLayerButtonEnabled) {
      opts.push(incidentLayerMeta);
    }
    const streetlightLayerMeta =
      layerOptionsByKey.get("streetlights")
      || visibleDomainOptionsByKey.get("streetlights")
      || builtInReportDomainOptionsByKey.get("streetlights")
      || { key: "streetlights", label: "Streetlights", iconSrc: UI_ICON_SRC.streetlight, enabled: true };
    if (streetlightLayerMeta?.key === "streetlights") {
      opts.push({
        ...streetlightLayerMeta,
        iconSrc: streetlightLayerMeta?.iconSrc || UI_ICON_SRC.streetlight,
        enabled: streetlightLayerMeta?.enabled !== false,
      });
    }
    return opts;
  }, [builtInReportDomainOptionsByKey, incidentLayerDomainOptions.length, incidentLayerMeta, incidentLayerButtonEnabled, layerOptionsByKey, visibleDomainOptionsByKey, hasExplicitIncidentMapFilter, activeIncidentMapFilterKeys.length, resolvedIncidentLayerOption]);
  const webStreetlightsPrimaryOption = useMemo(
    () => mobilePrimaryLayerOptions.find((layer) => layer?.key === "streetlights") || null,
    [mobilePrimaryLayerOptions]
  );
  const canUseStreetlightBulk = isStreetlightsLayerActive;
  const showMobileMapTabContent =
    !myReportsOpen &&
    !notificationsWindowOpen &&
    !alertsWindowOpen &&
    !eventsWindowOpen &&
    !accountMenuOpen &&
    !notificationPreferencesOpen &&
    !followedLocationsOpen &&
    !manageOpen &&
    !contactUsOpen &&
    !infoMenuOpen &&
    !citySwitcherOpen &&
    !mobileHeaderMenuOpen;
  const mobileBottomRailSurfaceBg = showMobileMapTabContent
    ? "var(--sl-ui-surface-bg)"
    : "var(--sl-ui-modal-bg)";
  const accountTabActive = accountMenuOpen || manageOpen || deleteAccountOpen || notificationPreferencesOpen || followedLocationsOpen;
  const activeMobileTabKey = myReportsOpen
    ? "reports"
    : notificationsWindowOpen
      ? "notifications"
      : alertsWindowOpen
      ? "alerts"
      : eventsWindowOpen
        ? "events"
        : accountTabActive
          ? "account"
          : "map";
  const setMobileTabTransitionFor = useCallback((nextKey) => {
    const order = ["map", "reports", "notifications", "alerts", "events", "account"];
    const currentIndex = order.indexOf(activeMobileTabKey);
    const nextIndex = order.indexOf(String(nextKey || "map").trim());
    if (currentIndex < 0 || nextIndex < 0 || currentIndex === nextIndex) return;
    setMobileTabTransitionDirection(nextIndex < currentIndex ? "back" : "forward");
  }, [activeMobileTabKey]);
  const mobileStreetlightModeButtonCount =
    (canUseStreetlightBulk ? 1 : 0) +
    (showAdminTools && isStreetlightsLayerActive ? 1 : 0);
  const mappingUnitLabel = String(
    readIncidentDomainHelperString(activeAssetReportingDomainKey, "mappedAssetUnitLabel", "")
    || (isStreetlightsLayerActive ? "Light" : "Asset")
  ).trim() || "Asset";
  const cityLimitPolygons = useMemo(
    () => extractPolygonsFromGeoJson(cityBoundaryGeojson),
    [cityBoundaryGeojson]
  );
  const cityBoundaryViewport = useMemo(
    () => boundaryViewportFromPolygons(cityLimitPolygons),
    [cityLimitPolygons]
  );
  const tenantParkGeometry = useMemo(() => {
    return (tenantParks || [])
      .map((row) => {
        const polygons = extractPolygonsFromGeoJson(row?.boundary_geojson);
        if (!polygons.length) return null;
        const viewport = boundaryViewportFromPolygons(polygons);
        const labelLat = parseOptionalCoordinate(row?.label_lat);
        const labelLng = parseOptionalCoordinate(row?.label_lng);
        const explicitLabelPosition =
          Number.isFinite(labelLat) &&
          Number.isFinite(labelLng) &&
          isPointInPolygons(labelLat, labelLng, polygons)
            ? { lat: labelLat, lng: labelLng }
            : null;
        return {
          id: String(row?.id || "").trim(),
          parkKey: String(row?.park_key || "").trim(),
          parkName: String(row?.park_name || "").trim() || "Park",
          polygons,
          borderSegments: buildParkExteriorBorderSegments(polygons),
          borderColor: sanitizeHexColor(row?.border_color, "#2e7d32"),
          borderWidth: Number.isFinite(Number(row?.border_width))
            ? Math.max(0, Math.min(12, Number(row.border_width)))
            : 2,
          fillColor: sanitizeHexColor(row?.fill_color, "#66bb6a"),
          fillOpacity: Number.isFinite(Number(row?.fill_opacity))
            ? Math.max(0, Math.min(1, Number(row.fill_opacity)))
            : 0.18,
          labelColor: sanitizeHexColor(row?.label_color, "#17314f"),
          labelPosition: explicitLabelPosition || viewport?.center || null,
          showLabelConfigured: row?.show_label !== false,
        };
      })
      .filter(Boolean);
  }, [tenantParks]);
  const tenantParkVisuals = useMemo(() => {
    return (tenantParkGeometry || []).map((park) => {
      const labelVisual = parkLabelVisualConfig(park?.parkName, mapZoom);
      return {
        ...park,
        labelFontSizePx: labelVisual.fontSizePx,
        showLabel: park?.showLabelConfigured !== false && labelVisual.visible,
      };
    });
  }, [tenantParkGeometry, mapZoom]);
  const isWithinAnyPark = useCallback((lat, lng) => {
    const targetLat = Number(lat);
    const targetLng = Number(lng);
    if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return false;
    return tenantParkGeometry.some((park) => isPointInPolygons(targetLat, targetLng, park?.polygons || []));
  }, [tenantParkGeometry]);
  const {
    seededRowsByDomain: configuredIncidentSeededRowsByDomain,
    reportRowsByDomain: configuredIncidentReportRowsByDomain,
    seededByIdByDomain: configuredIncidentSeededByIdByDomain,
    seededDomainKeysWithRows: configuredIncidentSeededDomainKeysWithRows,
    reportDomainKeysWithRows: configuredIncidentReportDomainKeysWithRows,
  } = useMemo(
    () => buildConfiguredIncidentDomainCollections(configuredIncidentRuntimeEntries),
    [configuredIncidentRuntimeEntries]
  );
  const hasConfiguredIncidentSeededRows = configuredIncidentSeededDomainKeysWithRows.length > 0;
  const hasConfiguredIncidentReportRows = configuredIncidentReportDomainKeysWithRows.length > 0;
  const hasSharedConfiguredIncidentSeededRows = useMemo(
    () => configuredIncidentSeededDomainKeysWithRows.some((domainKey) => isSharedIncidentDomain(domainKey)),
    [configuredIncidentSeededDomainKeysWithRows, isSharedIncidentDomain]
  );
  const hasSharedConfiguredIncidentReportRows = useMemo(
    () => configuredIncidentReportDomainKeysWithRows.some((domainKey) => isSharedIncidentDomain(domainKey)),
    [configuredIncidentReportDomainKeysWithRows, isSharedIncidentDomain]
  );
  const hasSharedIncidentReports = useMemo(
    () => sharedIncidentReportRowsByDomain.size > 0,
    [sharedIncidentReportRowsByDomain]
  );
  const computeTenantDataViewport = useCallback(() => {
    if (cityBoundaryViewport) return null;
    const points = [];
    for (const row of officialLights || []) {
      points.push({ lat: Number(row?.lat), lng: Number(row?.lng) });
    }
    for (const rows of configuredIncidentSeededRowsByDomain.values()) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        points.push({ lat: Number(row?.lat), lng: Number(row?.lng) });
      }
    }
    for (const row of reports || []) {
      points.push({ lat: Number(row?.lat), lng: Number(row?.lng) });
    }
    return viewportFromPoints(points);
  }, [cityBoundaryViewport, officialLights, configuredIncidentSeededRowsByDomain, reports]);
  const cityBoundaryOuterRings = useMemo(
    () => (cityLimitPolygons || []).map((poly) => poly?.[0]).filter((ring) => Array.isArray(ring) && ring.length >= 3),
    [cityLimitPolygons]
  );
  const cityOutsideMaskPaths = useMemo(() => {
    if (!cityBoundaryOuterRings.length) return [];
    const outerRing = buildWorldMaskRing();
    const holeRings = cityBoundaryOuterRings
      .map((ring) => orientRing(ring, "counterclockwise"))
      .filter((ring) => ring.length >= 3);
    return [outerRing, ...holeRings];
  }, [cityBoundaryOuterRings]);
  const showCityBoundaryBorder = tenantMapFeaturesLoaded && tenantMapFeatures?.show_boundary_border !== false;
  const showCityOutsideShade = tenantMapFeaturesLoaded && tenantMapFeatures?.shade_outside_boundary !== false;
  const hasMapSession = Boolean(session?.user?.id);
  const showMapAlertIcon = tenantMapFeaturesLoaded ? tenantMapFeatures?.show_alert_icon !== false : true;
  const showMapEventIcon = tenantMapFeaturesLoaded ? tenantMapFeatures?.show_event_icon !== false : true;
  const showMapNotificationsIcon = true;
  const shouldMountTenantRuntimeController = Boolean(
    shouldPrioritizeTenantParksLoad
    || (
      !loading
      && startupWarmupReady
      && (
        resolvedTenantDomainConfigTenantKey
        || resolvedTenantMapFeaturesTenantKey
      )
    )
  );
  const shouldMountAuthBootstrapController = Boolean(
    shouldWaitForAuthBeforePublicMapLoad
    || shouldHydrateMapAuthEagerly
    || initialAuthBootstrapUrlHintRef.current
    || initialAuthBootstrapPendingStorageHintRef.current
    || authGateOpen
    || accountMenuOpen
    || mobileHeaderMenuOpen
    || manageOpen
    || deleteAccountOpen
    || reauthOpen
    || changePasswordOpen
    || recoveryPasswordOpen
    || notificationPreferencesOpen
    || followedLocationsOpen
  );
  const shouldMountAccountAccessController = Boolean(
    authGateOpen
    || accountMenuOpen
    || mobileHeaderMenuOpen
    || manageOpen
    || deleteAccountOpen
    || reauthOpen
    || changePasswordOpen
    || recoveryPasswordOpen
    || notificationPreferencesOpen
    || followedLocationsOpen
    || shouldLoadAdminStateEagerly
    || shouldLoadReportAccessEagerly
    || shouldLoadProfileEagerly
    || accountAccessWarmupReady
  );
  const shouldMountAbuseSummaryController = Boolean(
    (isAdmin && startupWarmupReady)
    || adminToolboxOpen
    || moderationFlagsOpen
  );
  const shouldWarmResidentFeedBadgeController = Boolean(
    communityFeedViewerUserId
    && resolvedCommunityFeedTenantKey
    && (showMapNotificationsIcon || showMapAlertIcon || showMapEventIcon)
  );
  const desktopAdminDeferredDialogsVisible = Boolean(
    exitMappingConfirmOpen
    || clearQueuedConfirmOpen
    || domainSwitchConfirmOpen
    || queueSignTypeOpen
    || deleteCircleConfirmOpen
    || deleteOfficialConfirmOpen
    || deleteOfficialSignConfirmOpen
  );
  const shouldMountDesktopAdminControls = Boolean(
    !useAppShellLayout && (
      desktopAdminDeferredDialogsVisible
      || isAdmin
      || showAdminTools
      || (showMobileMapTabContent && canUseStreetlightBulk && bulkMode)
      || (showMobileMapTabContent && mappingMode && mappingQueue.length > 0)
    )
  );
  const shouldMountResidentFeedBadgeController = Boolean(
    shouldPrepareCommunityFeedReadState
    || communityFeedEditor.open
    || residentFeedBadgeWarmupReady
  );
  const secondaryWorkspaceVisible = Boolean(
    isWorkingConfirmOpen
    || incidentRepairConfirmOpen
    || utilityReportDialogOpen
    || markFixedConfirmOpen
    || moderationFlagsOpen
    || notificationsWindowOpen
    || alertsWindowOpen
    || eventsWindowOpen
    || communityFeedEditor.open
    || myReportsOpen
    || openReportsOpen
  );
  const showMobileAdminRailButton = false;
  const mobileBottomRailColumnCount =
    3 +
    (showMapNotificationsIcon ? 1 : 0) +
    (showMapAlertIcon ? 1 : 0) +
    (showMapEventIcon ? 1 : 0) +
    (showMobileAdminRailButton ? 1 : 0);
  const cityOutsideShadeOpacity = Number.isFinite(Number(tenantMapFeatures?.outside_shade_opacity))
    ? Math.max(0, Math.min(1, Number(tenantMapFeatures.outside_shade_opacity)))
    : DEFAULT_TENANT_MAP_FEATURES.outside_shade_opacity;
  const cityBoundaryBorderColor = /^#[0-9a-fA-F]{6}$/.test(String(tenantMapFeatures?.boundary_border_color || "").trim())
    ? String(tenantMapFeatures?.boundary_border_color || "").trim().toLowerCase()
    : DEFAULT_TENANT_MAP_FEATURES.boundary_border_color;
  const cityBoundaryBorderWidth = Number.isFinite(Number(tenantMapFeatures?.boundary_border_width))
    ? Math.max(0.5, Math.min(8, Number(tenantMapFeatures?.boundary_border_width)))
    : DEFAULT_TENANT_MAP_FEATURES.boundary_border_width;
  const restrictPublicMarkersToCity = !isAdmin && cityLimitPolygons.length > 0;
  const isWithinAshtabulaCityLimits = useCallback(
    (lat, lng) => isPointInPolygons(Number(lat), Number(lng), cityLimitPolygons),
    [cityLimitPolygons]
  );

  useEffect(() => {
    if (!tenantMapFeaturesLoaded) return;
    const payload = {
      tenantKey: resolvedTenantMapFeaturesTenantKey,
      runtimeTenantKey: String(activeTenantKey() || "").trim().toLowerCase(),
      globalSupabaseTenantKey: getSupabaseTenantKey(),
      source: tenantMapFeaturesSourceRef.current,
      showCityBoundaryBorder,
      cityBoundaryBorderColor,
      cityBoundaryBorderWidth,
      showCityOutsideShade,
      cityOutsideShadeOpacity,
      hasBoundaryPolygons: cityBoundaryOuterRings.length > 0,
    };
    const signature = JSON.stringify(payload);
    if (tenantBoundaryRenderSignatureRef.current === signature) return;
    tenantBoundaryRenderSignatureRef.current = signature;
    const isFallbackRed =
      cityBoundaryBorderColor === DEFAULT_TENANT_MAP_FEATURES.boundary_border_color &&
      tenantMapFeaturesSourceRef.current !== "db-row";
    pushTenantBoundaryDiagnostic("tenant_map_features:render", payload, { forceWarn: isFallbackRed });
  }, [
    cityBoundaryBorderColor,
    cityBoundaryBorderWidth,
    cityBoundaryOuterRings.length,
    cityOutsideShadeOpacity,
    resolvedTenantMapFeaturesTenantKey,
    showCityBoundaryBorder,
    showCityOutsideShade,
    tenantMapFeaturesLoaded,
  ]);

  useEffect(() => {
    if (!showMapAlertIcon) setAlertsWindowOpen(false);
  }, [showMapAlertIcon]);

  useEffect(() => {
    if (!showMapEventIcon) setEventsWindowOpen(false);
  }, [showMapEventIcon]);

  useEffect(() => {
    if (showMapNotificationsIcon) return;
    setNotificationsWindowOpen(false);
  }, [showMapNotificationsIcon]);

  useEffect(() => {
    if (communityFeedViewerUserId) return;
    setResidentFeedBadgeCounts({
      notifications: 0,
      alerts: 0,
      events: 0,
    });
  }, [communityFeedViewerUserId]);

  const recenterToTenantHome = useCallback((reason = "manual") => {
    const viewport = cityBoundaryViewport || computeTenantDataViewport();
    if (!viewport) return false;

    const map = mapRef.current;
    const nextCenter = viewport.center;
    setMapCenter((prev) => {
      if (!prev) return nextCenter;
      if (
        Math.abs(Number(prev.lat) - Number(nextCenter.lat)) < 0.000001 &&
        Math.abs(Number(prev.lng) - Number(nextCenter.lng)) < 0.000001
      ) {
        return prev;
      }
      return nextCenter;
    });

    if (!map || !window?.google?.maps?.LatLngBounds) return true;

    try {
      const bounds = new window.google.maps.LatLngBounds(
        { lat: viewport.south, lng: viewport.west },
        { lat: viewport.north, lng: viewport.east }
      );
      map.fitBounds(bounds, 42);
      window.requestAnimationFrame(() => {
        const c = map.getCenter?.();
        const z = Number(map.getZoom?.());
        const lat = Number(c?.lat?.());
        const lng = Number(c?.lng?.());
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setMapCenter({ lat, lng });
        }
        if (Number.isFinite(z)) {
          mapZoomRef.current = z;
          setMapZoom(Math.round(z));
        }
      });
    } catch (err) {
      console.warn("[home camera] fitBounds failed:", err?.message || err);
    }

    return true;
  }, [cityBoundaryViewport, computeTenantDataViewport]);

  useEffect(() => {
    const tenantKey = String(tenant?.tenantKey || "").trim().toLowerCase();
    if (!tenantKey) return;
    if (pendingTenantHomeRecenterRef.current !== tenantKey) return;
    if (!recenterToTenantHome("tenant-switch")) return;
    pendingTenantHomeRecenterRef.current = "";
  }, [tenant?.tenantKey, recenterToTenantHome]);

  useEffect(() => {
    if (!cityBoundaryViewport) {
      boundaryCameraSignatureRef.current = "";
      return;
    }

    const map = mapRef.current;
    const tenantKey = activeTenantKey();
    const signature = [
      tenantKey,
      cityBoundaryViewport.north.toFixed(6),
      cityBoundaryViewport.south.toFixed(6),
      cityBoundaryViewport.east.toFixed(6),
      cityBoundaryViewport.west.toFixed(6),
    ].join("|");

    // Preserve hub fly-to deep links instead of snapping back to the tenant
    // boundary once the boundary data finishes loading.
    if (preserveReportFlyTargetCameraRef.current) {
      boundaryCameraSignatureRef.current = signature;
      return;
    }

    if (boundaryCameraSignatureRef.current === signature) return;

    const nextCenter = cityBoundaryViewport.center;
    if (!map) {
      setMapCenter((prev) => {
        if (!prev) return nextCenter;
        if (
          Math.abs(Number(prev.lat) - Number(nextCenter.lat)) < 0.000001
          && Math.abs(Number(prev.lng) - Number(nextCenter.lng)) < 0.000001
        ) {
          return prev;
        }
        return nextCenter;
      });
      return;
    }
    if (!window?.google?.maps?.LatLngBounds) return;

    try {
      setMapCenter((prev) => {
        if (!prev) return nextCenter;
        if (
          Math.abs(Number(prev.lat) - Number(nextCenter.lat)) < 0.000001
          && Math.abs(Number(prev.lng) - Number(nextCenter.lng)) < 0.000001
        ) {
          return prev;
        }
        return nextCenter;
      });
      const bounds = new window.google.maps.LatLngBounds(
        { lat: cityBoundaryViewport.south, lng: cityBoundaryViewport.west },
        { lat: cityBoundaryViewport.north, lng: cityBoundaryViewport.east }
      );
      map.fitBounds(bounds, 42);
      boundaryCameraSignatureRef.current = signature;
      window.requestAnimationFrame(() => {
        const c = map.getCenter?.();
        const z = Number(map.getZoom?.());
        const lat = Number(c?.lat?.());
        const lng = Number(c?.lng?.());
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setMapCenter({ lat, lng });
        }
        if (Number.isFinite(z)) {
          mapZoomRef.current = z;
          setMapZoom(Math.round(z));
        }
      });
    } catch (err) {
      console.warn("[boundary camera] fitBounds failed:", err?.message || err);
    }
  }, [cityBoundaryViewport, gmapsRef]);

  const configuredIncidentLastFixByDomain = useMemo(
    () => buildConfiguredIncidentLastFixCollections(configuredIncidentRuntimeEntries),
    [configuredIncidentRuntimeEntries]
  );

  function incidentDrivenFixTsValue(domainKeyRaw, incidentIdRaw, marker = null) {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
    const incidentId = normalizeIncidentDrivenLookupId(domainKey, incidentIdRaw);
    if (!domainKey || !incidentId) return 0;
    const helper = getIncidentDomainHelper(domainKey);
    const configuredLastFixByIncidentMap = configuredIncidentLastFixByDomain.get(domainKey) || {};
    const fixTsMode = String(helper?.fixTsMode || "").trim();
    if (fixTsMode === "incident_map") {
      return Number(configuredLastFixByIncidentMap?.[incidentId] || 0);
    }
    return Number(marker?.lastFixTs || lastFixByLightId?.[incidentId] || 0);
  }

  const resolveIncidentDrivenFixTsForId = useCallback((domainKeyRaw, incidentIdRaw, marker = null) => {
    return incidentDrivenFixTsValue(domainKeyRaw, incidentIdRaw, marker);
  }, [incidentDrivenFixTsValue]);

  const configuredIncidentDrivenRowsByDomain = useMemo(() => {
    const byDomain = new Map();
    if (!shouldComputeReportDomainRuntimeLookups) return byDomain;
    for (const [domainKeyRaw, reportRows] of configuredIncidentReportRowsByDomain.entries()) {
      const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
      if (!domainKey || !isSharedIncidentDomain(domainKey)) continue;
      byDomain.set(
        domainKey,
        incidentDomainBuildIncidentRows(domainKey, {
          reportRows: reportRows || [],
        }) || []
      );
    }
    return byDomain;
  }, [
    configuredIncidentReportRowsByDomain,
    isSharedIncidentDomain,
    shouldComputeReportDomainRuntimeLookups,
  ]);

  const incidentDrivenBaseRowsByDomain = useMemo(() => {
    const byDomain = new Map();
    if (!shouldComputeReportDomainRuntimeLookups) return byDomain;
    const domainKeys = new Set([
      ...Array.from(configuredIncidentDrivenRowsByDomain.keys()),
      ...Array.from(sharedIncidentReportRowsByDomain.keys()),
    ]);
    for (const domainKeyRaw of domainKeys) {
      const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
      if (!domainKey || !isSharedIncidentDomain(domainKey)) continue;
      const rows = [...(configuredIncidentDrivenRowsByDomain.get(domainKey) || [])];

      for (const row of sharedIncidentReportRowsByDomain.get(domainKey) || []) {
        const incidentId = String(row?.light_id || lightIdFor(row?.lat, row?.lng) || "").trim();
        if (!incidentId) continue;
        rows.push({
          ...row,
          domainKey,
          domain: domainKey,
          incident_id: incidentId,
          light_id: incidentId,
        });
      }

      byDomain.set(domainKey, rows);
    }
    return byDomain;
  }, [
    configuredIncidentDrivenRowsByDomain,
    isSharedIncidentDomain,
    lightIdFor,
    sharedIncidentReportRowsByDomain,
    shouldComputeReportDomainRuntimeLookups,
  ]);

  const incidentDrivenRuntimeDomainKeys = useMemo(() => {
    const keys = new Set();
    const pushDomain = (domainKeyRaw) => {
      const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
      if (!domainKey || !isSharedIncidentDomain(domainKey)) return;
      keys.add(domainKey);
    };

    if (activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY) {
      for (const domainKey of incidentMapVisibleDomainKeys || []) pushDomain(domainKey);
    } else if (String(activeMapLayerKey || "").trim().toLowerCase() !== "streetlights") {
      pushDomain(resolveActiveIncidentDomainKey({
        activeMapLayerKey,
        resolvedIncidentMapDomain,
        adminReportDomain,
      }));
    }

    if (myReportsOpen) {
      for (const domainKey of activeMyReportsDomainKeys || []) pushDomain(domainKey);
    }
    if (openReportsOpen) {
      for (const domainKey of activeOpenReportsDomainKeys || []) pushDomain(domainKey);
    }
    pushDomain(selectedDomainMarker?.domain);
    pushDomain(domainReportTarget?.domain);
    pushDomain(domainDisclosureGateTarget?.domain);
    pushDomain(confirmReportTarget?.domain);

    if (selectedIncidentStackMarker?.markers?.length) {
      for (const marker of selectedIncidentStackMarker.markers) {
        pushDomain(marker?.domain);
      }
    }

    return Array.from(keys);
  }, [
    activeMapLayerKey,
    activeMyReportsDomainKeys,
    activeOpenReportsDomainKeys,
    adminReportDomain,
    confirmReportTarget?.domain,
    domainDisclosureGateTarget?.domain,
    domainReportTarget?.domain,
    incidentMapVisibleDomainKeys,
    isSharedIncidentDomain,
    myReportsOpen,
    openReportsOpen,
    resolvedIncidentMapDomain,
    selectedDomainMarker?.domain,
    selectedIncidentStackMarker?.markers,
  ]);

  const shouldComputeViewerReportedIncidentIds = Boolean(
    activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY
    || (
      String(activeMapLayerKey || "").trim()
      && String(activeMapLayerKey || "").trim().toLowerCase() !== "streetlights"
    )
    || myReportsOpen
    || openReportsOpen
    || selectedDomainMarker
    || selectedIncidentStackMarker
  );
  const incidentDrivenRowsRuntime = useMemo(() => {
    const byDomain = new Map();
    const viewerReportedIdsByDomain = new Map();
    let hasRows = false;
    for (const domainKey of incidentDrivenRuntimeDomainKeys) {
      const rows = incidentDrivenBaseRowsByDomain.get(domainKey) || [];
      byDomain.set(domainKey, rows);
      if (rows.length > 0) hasRows = true;
      if (!shouldComputeViewerReportedIncidentIds || !viewerIdentityKey) continue;
      const incidentIds = new Set();
      for (const row of rows) {
        const incidentId = String(row?.incident_id || row?.light_id || "").trim();
        if (!incidentId) continue;
        const ts = Number(row?.ts || 0);
        const lastFixTs = Number(resolveIncidentDrivenFixTsForId(domainKey, incidentId) || 0);
        if (lastFixTs && ts > 0 && ts <= lastFixTs) continue;
        if (reportIdentityKey(row) !== viewerIdentityKey) continue;
        incidentIds.add(incidentDrivenViewerLookupId(domainKey, incidentId));
      }
      viewerReportedIdsByDomain.set(domainKey, incidentIds);
    }
    return {
      byDomain,
      hasRows,
      viewerReportedIdsByDomain,
    };
  }, [
    incidentDrivenBaseRowsByDomain,
    incidentDrivenRuntimeDomainKeys,
    resolveIncidentDrivenFixTsForId,
    shouldComputeViewerReportedIncidentIds,
    viewerIdentityKey,
  ]);
  const incidentDrivenRowsByDomain = incidentDrivenRowsRuntime.byDomain;
  const viewerReportedIncidentIdsByDomain = incidentDrivenRowsRuntime.viewerReportedIdsByDomain || new Map();

  const normalizeIncidentDrivenReportsForDomainKeys = useCallback((domainKeysRaw = []) => {
    const domainKeys = Array.isArray(domainKeysRaw)
      ? domainKeysRaw
      : domainKeysRaw instanceof Set
        ? Array.from(domainKeysRaw)
        : domainKeysRaw
          ? [domainKeysRaw]
          : [];
    const selectedDomainKeys = Array.from(new Set(
      domainKeys
        .map((key) => normalizeDomainKeyOrSlug(key, { allowUnknown: true }) || normalizeDomainKey(key))
        .filter(Boolean)
    ));
    if (!selectedDomainKeys.length) return [];
    return selectedDomainKeys.flatMap((domainKey) => incidentDrivenRowsByDomain.get(domainKey) || []);
  }, [incidentDrivenRowsByDomain]);

  function incidentDrivenSuppressesGlyph(domainKeyRaw) {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
    return Boolean(domainKey && getIncidentDomainHelper(domainKey).suppressesGlyph);
  }

  function incidentDrivenUsesMappedCenter(domainKeyRaw) {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
    return Boolean(domainKey && getIncidentDomainHelper(domainKey).usesMappedCenter);
  }

  function resolveActiveIncidentDomainKey({
    activeMapLayerKey = "",
    resolvedIncidentMapDomain = "",
    adminReportDomain = "",
  } = {}) {
    const activeLayerDomainKey =
      normalizeDomainKeyOrSlug(activeMapLayerKey, { allowUnknown: true }) || normalizeDomainKey(activeMapLayerKey);
    if (activeLayerDomainKey && activeLayerDomainKey !== "streetlights") return activeLayerDomainKey;
    const adminDomainKey =
      normalizeDomainKeyOrSlug(adminReportDomain, { allowUnknown: true }) || normalizeDomainKey(adminReportDomain);
    if (adminDomainKey && adminDomainKey !== "streetlights") return adminDomainKey;
    return String(resolvedIncidentMapDomain || activeMapLayerKey || "").trim().toLowerCase();
  }

  const visibleIncidentMarkerDomainKeys = useMemo(() => {
    if (String(activeMapLayerKey || "").trim().toLowerCase() === "streetlights") {
      return [];
    }
    if (activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY) {
      return Array.from(new Set(
        (incidentMapVisibleDomainKeys || [])
          .map((key) => normalizeDomainKeyOrSlug(key, { allowUnknown: true }) || normalizeDomainKey(key))
          .filter((key) => key && isSharedIncidentDomain(key))
      ));
    }
    const activeDomainKey = resolveActiveIncidentDomainKey({
      activeMapLayerKey,
      resolvedIncidentMapDomain,
      adminReportDomain,
    });
    return activeDomainKey && isSharedIncidentDomain(activeDomainKey)
      ? [activeDomainKey]
      : [];
  }, [
    activeMapLayerKey,
    adminReportDomain,
    incidentMapVisibleDomainKeys,
    isSharedIncidentDomain,
    resolvedIncidentMapDomain,
  ]);

  const renderedOfficialLights = useMemo(() => {
    if (!isStreetlightsLayerActive) return [];
    const base = Array.isArray(officialLights) ? officialLights : [];
    const cityFiltered = restrictPublicMarkersToCity
      ? base.filter((l) => isWithinAshtabulaCityLimits(l.lat, l.lng))
      : base;
    // In mapping mode, always show full official asset layer so existing lights are never hidden.
    if (mappingMode) return cityFiltered;
    if (!(isAdmin && openReportMapFilterOn)) return cityFiltered;
    return cityFiltered.filter((l) => openReportOfficialIdSet.has((l.id || "").trim()));
  }, [
    officialLights,
    isStreetlightsLayerActive,
    isAdmin,
    mappingMode,
    openReportMapFilterOn,
    openReportOfficialIdSet,
    restrictPublicMarkersToCity,
    isWithinAshtabulaCityLimits,
  ]);

  const incidentDrivenDomainMetaByKey = useMemo(() => new Map(
    [...(visibleDomainOptions || []), ...(registryVisibleDomainOptions || [])]
      .map((option) => [String(option?.key || "").trim(), option])
      .filter(([key]) => key)
  ), [visibleDomainOptions, registryVisibleDomainOptions]);

  const configuredGenericBaseMarkersByVisibleDomain = useMemo(() => {
    const byDomain = new Map();
    for (const domainKey of visibleIncidentMarkerDomainKeys) {
      byDomain.set(
        domainKey,
        buildGenericIncidentBaseMarkersForDomain(
          domainKey,
          configuredIncidentDrivenRowsByDomain.get(domainKey) || []
        )
      );
    }
    return byDomain;
  }, [configuredIncidentDrivenRowsByDomain, visibleIncidentMarkerDomainKeys]);

  const buildIncidentDrivenMarkersForDomain = useCallback((domainKeyRaw) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
    if (!domainKey || !isSharedIncidentDomain(domainKey)) {
      return [];
    }
    const helper = getIncidentDomainHelper(domainKey);
    const buildSpecializedMarkers = incidentDomainMarkerRuntimeHelpers?.incidentDrivenSpecializedMarkerCollection;
    const mergeMarkerCollections = incidentDomainMarkerRuntimeHelpers?.mergeIncidentDrivenMarkerCollections;
    const configuredIncidentRows = configuredIncidentDrivenRowsByDomain.get(domainKey) || [];
    const domainRows =
      incidentDrivenRowsByDomain.get(domainKey)
      || incidentDrivenBaseRowsByDomain.get(domainKey)
      || [];
    const domainOption = incidentDrivenDomainMetaByKey.get(domainKey) || null;
    const specializedMarkers = Array.isArray(sharedIncidentSpecializedMarkersByDomain?.[domainKey])
      ? sharedIncidentSpecializedMarkersByDomain[domainKey]
      : typeof buildSpecializedMarkers === "function"
        ? buildSpecializedMarkers(domainKey, {
          seededRows: configuredIncidentSeededRowsByDomain.get(domainKey) || [],
          seededRecordsById: configuredIncidentSeededByIdByDomain.get(domainKey) || null,
          seededRecordsRaw: configuredIncidentSeededRowsByDomain.get(domainKey) || [],
          incidentDrivenRowsByDomain: incidentDrivenRowsByDomain.has(domainKey)
            ? incidentDrivenRowsByDomain
            : new Map([[domainKey, domainRows]]),
          hydrateIncidentLocationFields: (marker) => marker,
          lastFixByIncidentMap: configuredIncidentLastFixByDomain.get(domainKey) || {},
          lastFixByLightId,
          fixedLights,
          isValidLatLng,
        })
        : null;
    const specializedMarkersHaveVisibleCounts = Array.isArray(specializedMarkers)
      && specializedMarkers.some((marker) => Number(marker?.count || 0) > 0);
    if (helper?.specializedMarkerCollectionCoversGenericRows && specializedMarkersHaveVisibleCounts) {
      return specializedMarkers;
    }
    const sharedGenericBaseMarkers = Array.isArray(sharedIncidentBaseMarkersStateByDomain?.[domainKey])
      ? sharedIncidentBaseMarkersStateByDomain[domainKey]
      : [];
    const configuredGenericBaseMarkers =
      configuredGenericBaseMarkersByVisibleDomain.get(domainKey)
      || buildGenericIncidentBaseMarkersForDomain(domainKey, configuredIncidentRows);
    const genericBaseMarkers = mergeGenericIncidentBaseMarkers(
      sharedGenericBaseMarkers,
      configuredGenericBaseMarkers
    );
    const genericMarkers = genericBaseMarkers
      .map((marker) => ({
        ...marker,
        domainLabel: String(domainOption?.label || domainKey).trim() || domainKey,
        glyph: String(domainOption?.icon || "📍"),
        glyphSrc: String(domainOption?.iconSrc || "").trim(),
        rows: Array.isArray(marker?.rows) ? [...marker.rows] : [],
      }))
      .sort((a, b) => (b.count - a.count) || (b.lastTs - a.lastTs));
    if (typeof mergeMarkerCollections === "function") {
      return mergeMarkerCollections(domainKey, specializedMarkers, genericMarkers);
    }
    return genericMarkers;
  }, [
    configuredIncidentLastFixByDomain,
    configuredGenericBaseMarkersByVisibleDomain,
    configuredIncidentDrivenRowsByDomain,
    configuredIncidentSeededByIdByDomain,
    configuredIncidentSeededRowsByDomain,
    fixedLights,
    getIncidentDomainHelper,
    incidentDomainMarkerRuntimeHelpers,
    incidentDrivenDomainMetaByKey,
    incidentDrivenBaseRowsByDomain,
    incidentDrivenRowsByDomain,
    isSharedIncidentDomain,
    isValidLatLng,
    lastFixByLightId,
    sharedIncidentBaseMarkersStateByDomain,
    sharedIncidentSpecializedMarkersByDomain,
  ]);

  const incidentDrivenMarkersByDomain = useMemo(() => {
    const byDomain = new Map();
    for (const domainKey of visibleIncidentMarkerDomainKeys) {
      byDomain.set(domainKey, buildIncidentDrivenMarkersForDomain(domainKey));
    }
    return byDomain;
  }, [buildIncidentDrivenMarkersForDomain, visibleIncidentMarkerDomainKeys]);

  const incidentDrivenMarkersForDomain = useCallback((domainKeyRaw) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
    if (!domainKey) return [];
    return incidentDrivenMarkersByDomain.get(domainKey) || buildIncidentDrivenMarkersForDomain(domainKey);
  }, [buildIncidentDrivenMarkersForDomain, incidentDrivenMarkersByDomain]);

  const hasIncidentDrivenDomainMarkers = useMemo(
    () => (
      hasSharedConfiguredIncidentReportRows
      || hasSharedIncidentReports
      || incidentDrivenRowsRuntime.hasRows
      || hasSharedConfiguredIncidentSeededRows
    ),
    [
      hasSharedConfiguredIncidentReportRows,
      hasSharedConfiguredIncidentSeededRows,
      hasSharedIncidentReports,
      incidentDrivenRowsRuntime,
    ]
  );

  const nonStreetlightDomainMarkers = useMemo(() => {
    if (isStreetlightsLayerActive) return [];
    const activeDomainKey = resolveActiveIncidentDomainKey({
      activeMapLayerKey,
      resolvedIncidentMapDomain,
      adminReportDomain,
    });
    return incidentDrivenMarkersByDomain.get(activeDomainKey) || [];
  }, [
    isStreetlightsLayerActive,
    activeMapLayerKey,
    adminReportDomain,
    resolvedIncidentMapDomain,
    incidentDrivenMarkersByDomain,
  ]);

  const deleteCircleCandidateIds = useMemo(() => {
    if (!deleteCircleDraft?.center) return [];
    const centerLat = Number(deleteCircleDraft.center.lat);
    const centerLng = Number(deleteCircleDraft.center.lng);
    const radius = Number(deleteCircleDraft.radiusMeters || 0);
    if (!isValidLatLng(centerLat, centerLng) || !Number.isFinite(radius) || radius <= 0) return [];
    const ids = [];
    if (isStreetlightsLayerActive) {
      for (const row of officialLights || []) {
        const lid = String(row?.id || "").trim();
        if (!lid || !openReportOfficialIdSet.has(lid)) continue;
        const dist = metersBetween(
          { lat: centerLat, lng: centerLng },
          { lat: Number(row?.lat), lng: Number(row?.lng) }
        );
        if (dist <= radius) ids.push(lid);
      }
      return ids.filter(Boolean);
    }
    for (const marker of nonStreetlightDomainMarkers || []) {
      const incidentId = String(marker?.incident_id || marker?.id || "").trim();
      const lat = Number(marker?.lat);
      const lng = Number(marker?.lng);
      const count = Number(marker?.count || 0);
      if (!incidentId || !isValidLatLng(lat, lng) || count <= 0) continue;
      const dist = metersBetween({ lat: centerLat, lng: centerLng }, { lat, lng });
      if (dist <= radius) ids.push(incidentId);
    }
    return Array.from(new Set(ids.filter(Boolean)));
  }, [
    deleteCircleDraft,
    isStreetlightsLayerActive,
    officialLights,
    openReportOfficialIdSet,
    nonStreetlightDomainMarkers,
  ]);

  const shouldComputeStreetlightConfidenceState = Boolean(
    shouldNeedStreetlightConfidenceState
    && typeof computeStreetlightConfidenceSnapshot === "function"
  );
  const streetlightOpenReportRuntime = useMemo(() => {
    const runtime = {
      reportsByOfficialId: {},
    };
    if (!shouldComputeStreetlightRuntimeState) return runtime;

    for (const [lightIdRaw, timestamps] of Object.entries(streetlightOutageTsByLightId || {})) {
      const lightId = String(lightIdRaw || "").trim();
      if (!lightId || !Array.isArray(timestamps) || !timestamps.length) continue;
      const lastFixTs = Math.max(Number(lastFixByLightId?.[lightId] || 0), Number(fixedLights?.[lightId] || 0));
      let sinceFixCount = 0;
      for (const tsRaw of timestamps) {
        const ts = Number(tsRaw || 0);
        if (!Number.isFinite(ts) || ts <= 0) continue;
        if (lastFixTs && ts <= lastFixTs) break;
        sinceFixCount += 1;
      }
      if (sinceFixCount <= 0) continue;
      runtime.reportsByOfficialId[lightId] = { sinceFixCount };
    }

    return runtime;
  }, [
    shouldComputeStreetlightRuntimeState,
    streetlightOutageTsByLightId,
    lastFixByLightId,
    fixedLights,
  ]);
  const streetlightViewerSignalRuntime = useMemo(() => {
    const runtime = {
      viewerSavedStreetlightLightIdSet: new Set(),
      confidenceSignalsByLightId: new Map(),
      confidenceCandidateLightIds: new Set(),
    };
    if (!shouldComputeStreetlightConfidenceState) return runtime;

    const normalizedViewerIdentityKey = String(viewerIdentityKey || "").trim();
    const shouldTrackViewerSavedIds = Boolean(normalizedViewerIdentityKey);

    for (const row of reports || []) {
      const lid = String(row?.light_id || "").trim();
      if (!lid || !officialIdSet.has(lid)) continue;

      const lastFixTs = Math.max(Number(lastFixByLightId?.[lid] || 0), Number(fixedLights?.[lid] || 0));
      const ts = Number(row?.ts || 0);
      if (lastFixTs && ts > 0 && ts <= lastFixTs) continue;

      runtime.confidenceCandidateLightIds.add(lid);
      const reporterKey = String(reportIdentityKey(row) || `report:${row?.id || ts}`).trim();
      const current = runtime.confidenceSignalsByLightId.get(lid) || {
        outageSignals: [],
        workingSignals: [],
      };
      if (isWorkingReportType(row)) {
        current.workingSignals.push({ reporterKey, ts });
      } else if (isOutageReportType(row)) {
        current.outageSignals.push({ reporterKey, ts });
        if (shouldTrackViewerSavedIds && reportIdentityKey(row) === normalizedViewerIdentityKey) {
          runtime.viewerSavedStreetlightLightIdSet.add(lid);
        }
      }
      runtime.confidenceSignalsByLightId.set(lid, current);
    }

    return runtime;
  }, [
    shouldComputeStreetlightConfidenceState,
    viewerIdentityKey,
    reports,
    officialIdSet,
    lastFixByLightId,
    fixedLights,
  ]);
  const viewerSavedStreetlightLightIdSet = streetlightViewerSignalRuntime.viewerSavedStreetlightLightIdSet;
  const reportsByOfficialId = streetlightOpenReportRuntime.reportsByOfficialId;

  const viewerUtilityReportedLightIdSet = useMemo(() => {
    const out = new Set();
    if (!shouldComputeStreetlightConfidenceState) return out;
    if (!viewerIdentityKey) return out;
    for (const lid of utilityReportedLightIdSet || []) {
      const id = String(lid || "").trim();
      if (!id || !officialIdSet.has(id)) continue;
      const lastFixTs = Math.max(Number(lastFixByLightId?.[id] || 0), Number(fixedLights?.[id] || 0));
      const reportedAtTs = Number(utilityReportedAtByLightId?.[id] || 0);
      if (lastFixTs && reportedAtTs > 0 && reportedAtTs <= lastFixTs) continue;
      out.add(id);
    }
    return out;
  }, [shouldComputeStreetlightConfidenceState, viewerIdentityKey, utilityReportedLightIdSet, officialIdSet, utilityReportedAtByLightId, lastFixByLightId, fixedLights]);

  const activeUtilitySignalCountsByLightId = useMemo(() => {
    const next = {};
    if (!shouldComputeStreetlightConfidenceState) return next;
    for (const [lidRaw, utility] of Object.entries(utilitySignalCountsByLightId || {})) {
      const lid = String(lidRaw || "").trim();
      if (!lid) continue;
      const lastFixTs = Math.max(Number(lastFixByLightId?.[lid] || 0), Number(fixedLights?.[lid] || 0));
      const latestReportedTs = Number(utility?.latestReportedTs || 0);
      if (lastFixTs && latestReportedTs > 0 && latestReportedTs <= lastFixTs) continue;
      next[lid] = {
        reportedCount: Math.max(0, Number(utility?.reportedCount || 0)),
        referenceCount: Math.max(0, Number(utility?.referenceCount || 0)),
        latestReportedTs,
      };
    }
    return next;
  }, [shouldComputeStreetlightConfidenceState, utilitySignalCountsByLightId, lastFixByLightId, fixedLights]);

  const refreshIncidentRepairProgress = useCallback(async (identityKey = viewerIdentityKey) => {
    const { refreshIncidentRepairProgressRuntimeShared } = await loadDeferredIncidentRepairActionSupportModule();
    return refreshIncidentRepairProgressRuntimeShared({
      tenantScopedReadClient,
      supabase,
      activeTenantKey,
      viewerIdentityKey,
      identityKey,
      setIncidentRepairProgressByKey,
      setPersistedIncidentRepairConfirmedKeySet,
      savePersistedIncidentRepairConfirmedKeys: (tenantKey, keys) => {
        void savePersistedIncidentRepairConfirmedKeysDeferred(tenantKey, keys);
      },
      setIncidentRepairProgressReadyContextKey,
    });
  }, [activeTenantKey, supabase, tenantScopedReadClient, viewerIdentityKey]);

  useLayoutEffect(() => {
    let cancelled = false;
    if (!resolvedTenantDomainConfigTenantKey) {
      clearRuntimeDomainMeta();
      setTenantDomainPublicConfigByDomain({});
      setTenantRegistryIncidentDomains([]);
      setTenantDomainConfigLoaded(false);
      return () => {
        cancelled = true;
      };
    }
    void loadDeferredTenantDomainConfigSupportModule()
      .then(({ readCachedTenantDomainConfigSnapshotShared }) => {
        if (cancelled) return;
        const cachedSnapshot = readCachedTenantDomainConfigSnapshotShared(
          resolvedTenantDomainConfigTenantKey,
        );
        if (cachedSnapshot) {
          applyTenantDomainConfigSnapshot(cachedSnapshot, { loaded: true });
          return;
        }
        clearRuntimeDomainMeta();
        setTenantDomainPublicConfigByDomain({});
        setTenantRegistryIncidentDomains([]);
        setTenantDomainConfigLoaded(false);
      })
      .catch(() => {
        if (cancelled) return;
        clearRuntimeDomainMeta();
        setTenantDomainPublicConfigByDomain({});
        setTenantRegistryIncidentDomains([]);
        setTenantDomainConfigLoaded(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    applyTenantDomainConfigSnapshot,
    clearRuntimeDomainMeta,
    resolvedTenantDomainConfigTenantKey,
  ]);

  useEffect(() => {
    let cancelled = false;
    let idleHandle = null;
    let timeoutHandle = null;
    async function loadDomainPublicConfig() {
      const tenantKey = resolvedTenantDomainConfigTenantKey;
      const readClient = tenantScopedReadClient || supabase;
      const {
        refreshTenantDomainPublicConfigShared,
        writeCachedTenantDomainConfigSnapshotShared,
      } = await loadDeferredTenantDomainConfigSupportModule();
      await refreshTenantDomainPublicConfigShared({
        tenantReady: tenant?.ready,
        tenantKey,
        readClient,
        fetchTenantDomainPublicConfig,
        fetchTenantAssignedDomainsRobust,
        fetchTenantRegistryIncidentDomains,
        defaultRoadRequiredForDomain,
        applyTenantDomainConfigSnapshot,
        writeCachedTenantDomainConfigSnapshot: writeCachedTenantDomainConfigSnapshotShared,
        shouldCancel: () => cancelled,
      });
    }
    void loadDeferredTenantDomainConfigSupportModule()
      .then(({ readCachedTenantDomainConfigSnapshotShared }) => {
        if (cancelled) return;
        const cachedSnapshot = readCachedTenantDomainConfigSnapshotShared(
          resolvedTenantDomainConfigTenantKey,
        );
        if (!cachedSnapshot) {
          setTenantDomainConfigLoaded(false);
          void loadDomainPublicConfig();
          return;
        }
        if (mapInteracting || loading || !startupWarmupReady) return;
        const cachedRefreshIdleTimeoutMs = 4500;
        const cachedRefreshDelayMs = 1400;

        if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
          idleHandle = window.requestIdleCallback(() => {
            idleHandle = null;
            void loadDomainPublicConfig();
          }, { timeout: cachedRefreshIdleTimeoutMs });
        } else if (typeof window !== "undefined") {
          timeoutHandle = window.setTimeout(() => {
            timeoutHandle = null;
            void loadDomainPublicConfig();
          }, cachedRefreshDelayMs);
        } else {
          void loadDomainPublicConfig();
        }
      })
      .catch(() => {
        if (cancelled) return;
        setTenantDomainConfigLoaded(false);
        void loadDomainPublicConfig();
      });

    return () => {
      cancelled = true;
      if (idleHandle != null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null && typeof window !== "undefined") {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [applyTenantDomainConfigSnapshot, loading, mapInteracting, resolvedTenantDomainConfigTenantKey, session?.access_token, session?.user?.id, startupWarmupReady, tenant?.ready, tenantScopedReadClient]);

  const incidentRepairProgressContextKey = `${String(activeTenantKey() || "").trim().toLowerCase()}::${String(viewerIdentityKey || "").trim() || "anon"}`;
  const selectedIncidentRepairHydrationDomainKey = normalizeDomainKeyOrSlug(
    selectedDomainMarker?.domain || adminReportDomain,
    { allowUnknown: true }
  );
  const shouldHydrateIncidentRepairProgress = Boolean(
    authReady && (
      myReportsOpen
      || (
        selectedDomainMarker
        && selectedIncidentRepairHydrationDomainKey
        && selectedIncidentRepairHydrationDomainKey !== "streetlights"
        && isPublicRepairEnabledForDomain(selectedIncidentRepairHydrationDomainKey)
      )
    )
  );
  const incidentRepairProgressReadyForContext = incidentRepairProgressReadyContextKey === incidentRepairProgressContextKey;
  const shouldMountIncidentRepairProgressController = Boolean(
    shouldHydrateIncidentRepairProgress
    || incidentRepairProgressReadyForContext
    || incidentRepairProgressAttemptedContextKey
    || incidentRepairProgressReadyContextKey
  );

  const getIncidentRepairSnapshot = useCallback((domain, incidentId) => {
    return resolveIncidentRepairSnapshotShared(domain, incidentId, {
      incidentRepairProgressByKey,
      persistedIncidentRepairConfirmedKeySet,
    });
  }, [incidentRepairProgressByKey, persistedIncidentRepairConfirmedKeySet]);

  const markIncidentRepairSignalOptimistically = useCallback((domainKeyRaw, incidentIdRaw) => {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      || String(domainKeyRaw || "").trim().toLowerCase();
    const incidentId = String(incidentIdRaw || "").trim();
    const key = incidentSnapshotKey(domainKey, incidentId);
    if (!key) return;
    const nextIso = new Date().toISOString();
    setPersistedIncidentRepairConfirmedKeySet((prev) => {
      const next = new Set(prev || []);
      next.add(key);
      void savePersistedIncidentRepairConfirmedKeysDeferred(activeTenantKey(), Array.from(next));
      return next;
    });
    setIncidentRepairProgressByKey((prev) => {
      const current = prev?.[key] || {};
      return {
        ...(prev || {}),
        [key]: {
          ...current,
          lastRepairAt: current?.lastRepairAt || nextIso,
          lastMovementAt: nextIso,
          viewerHasRepairSignal: true,
        },
      };
    });
  }, []);

  function incidentLifecycleDomainTypeForDomain(domainKeyRaw) {
    const domainKey = String(domainKeyRaw || "").trim().toLowerCase();
    if (!domainKey) return resolveDomainType(domainKeyRaw, "");
    const cfg = tenantDomainPublicConfigByDomain?.[domainKey] || null;
    return resolveDomainType(domainKey, cfg?.domain_type);
  }

  function isPublicRepairEnabledForDomain(domainKeyRaw) {
    const domainKey = String(domainKeyRaw || "").trim().toLowerCase();
    if (!domainKey) return false;
    const cfg = tenantDomainPublicConfigByDomain?.[domainKey] || null;
    const domainType = incidentLifecycleDomainTypeForDomain(domainKey);
    if (domainType !== "incident_driven") return false;
    return cfg?.organization_monitored_repairs === false;
  }

  const isOrganizationManagedIncidentDomain = useCallback((domainKeyRaw) => {
    return isTenantOrganizationManagedIncidentDomain(domainKeyRaw);
  }, [isTenantOrganizationManagedIncidentDomain]);

  const canManageIncidentDomainRepairs = useCallback((domainKeyRaw) => {
    if (!isOrganizationManagedIncidentDomain(domainKeyRaw)) return false;
    return isPlatformAdmin || hasOrgAdminReportsAccess || hasOrgDomainReportsEditAccess;
  }, [isPlatformAdmin, hasOrgAdminReportsAccess, hasOrgDomainReportsEditAccess, isOrganizationManagedIncidentDomain]);
  const canMutateAnyMyReportsSelection = useMemo(() => {
    if (isPlatformAdmin) return true;
    if (!(hasOrgAdminReportsAccess || hasOrgDomainReportsEditAccess)) return false;
    return (activeMyReportsDomainKeys || []).some((domainKey) => isOrganizationManagedIncidentDomain(domainKey));
  }, [
    isPlatformAdmin,
    hasOrgAdminReportsAccess,
    hasOrgDomainReportsEditAccess,
    activeMyReportsDomainKeys,
    isOrganizationManagedIncidentDomain,
  ]);
  const canMutateAnyOpenReportsSelection = useMemo(() => {
    if (isPlatformAdmin) return true;
    if (!hasOrgDomainReportsEditAccess) return false;
    return (activeOpenReportsDomainKeys || []).some((domainKey) => isOrganizationManagedIncidentDomain(domainKey));
  }, [
    isPlatformAdmin,
    hasOrgDomainReportsEditAccess,
    activeOpenReportsDomainKeys,
    isOrganizationManagedIncidentDomain,
  ]);

  const incidentPublicVisibilityThresholdForDomain = useCallback((domainKeyRaw) => {
    const domainKey = String(domainKeyRaw || "").trim().toLowerCase();
    if (!domainKey) return defaultDomainPublicVisibilityMinReports(domainKeyRaw);
    const cfg = tenantDomainPublicConfigByDomain?.[domainKey] || null;
    return sanitizeIncidentReportThreshold(
      cfg?.public_visibility_min_reports,
      defaultDomainPublicVisibilityMinReports(domainKey)
    );
  }, [tenantDomainPublicConfigByDomain]);

  const canShowPublicRepairAction = useCallback((incidentIdRaw, domainKeyRaw) => {
    const incidentId = String(incidentIdRaw || "").trim();
    const domainKey = String(domainKeyRaw || "").trim().toLowerCase();
    if (!incidentId || !domainKey) return false;
    if (!isPublicRepairEnabledForDomain(domainKey)) return false;
    const snapshot = getIncidentRepairSnapshot(domainKey, incidentId);
    if (!incidentRepairProgressReadyForContext) return false;
    if (snapshot?.archived) return false;
    if (snapshot?.likelyFixed) return false;
    if (snapshot?.viewerHasRepairSignal) return false;
    return true;
  }, [isPublicRepairEnabledForDomain, getIncidentRepairSnapshot, incidentRepairProgressReadyForContext]);

  const streetlightConfidenceByLightId = useMemo(() => {
    const byLight = {};
    if (!shouldComputeStreetlightConfidenceState) return byLight;
    if (typeof computeStreetlightConfidenceSnapshot !== "function") return byLight;
    const lightIds = new Set(streetlightViewerSignalRuntime.confidenceCandidateLightIds || []);

    for (const lid of Object.keys(activeUtilitySignalCountsByLightId || {})) {
      if (String(lid || "").trim()) lightIds.add(String(lid || "").trim());
    }

    for (const lid of lightIds) {
      const signals = streetlightViewerSignalRuntime.confidenceSignalsByLightId.get(lid) || {
        outageSignals: [],
        workingSignals: [],
      };
      const utility = activeUtilitySignalCountsByLightId?.[lid] || {};
      byLight[lid] = computeStreetlightConfidenceSnapshot({
        outageSignals: signals.outageSignals,
        workingSignals: signals.workingSignals,
        utilityReportedCount: Number(utility?.reportedCount || 0),
        utilityReferenceCount: Number(utility?.referenceCount || 0),
        utilityLastTs: Number(utility?.latestReportedTs || 0),
        viewerIdentityKey,
        viewerHasSaved: viewerSavedStreetlightLightIdSet.has(lid),
        viewerUtilityReported: viewerUtilityReportedLightIdSet.has(lid),
        rolloutStartMs: STREETLIGHT_STALENESS_ROLLOUT_START,
      });
    }

    return byLight;
  }, [
    computeStreetlightConfidenceSnapshot,
    shouldComputeStreetlightConfidenceState,
    streetlightViewerSignalRuntime,
    activeUtilitySignalCountsByLightId,
    viewerIdentityKey,
    viewerSavedStreetlightLightIdSet,
    viewerUtilityReportedLightIdSet,
  ]);

  const viewerStreetlightRingOpenIdSet = useMemo(() => {
    const openSet = new Set();
    if (!shouldComputeStreetlightConfidenceState) return openSet;
    const candidateIds = new Set([
      ...(viewerSavedStreetlightLightIdSet || []),
      ...(viewerUtilityReportedLightIdSet || []),
    ]);
    if (!candidateIds.size) return openSet;

    for (const lidRaw of candidateIds) {
      const lid = String(lidRaw || "").trim();
      if (!lid) continue;
      const confidence = streetlightConfidenceByLightId?.[lid] || null;
      if (confidence && !confidence.closed) openSet.add(lid);
    }

    return openSet;
  }, [
    shouldComputeStreetlightConfidenceState,
    viewerSavedStreetlightLightIdSet,
    viewerUtilityReportedLightIdSet,
    streetlightConfidenceByLightId,
  ]);

  const officialMarkerRingColorForViewer = useCallback((lightId) => {
    if (!shouldComputeStreetlightConfidenceState) return "#fff";
    const lid = (lightId || "").trim();
    if (!lid) return "#fff";
    if (!viewerStreetlightRingOpenIdSet.has(lid)) return "#fff";
    if (viewerUtilityReportedLightIdSet.has(lid)) return "#1e88e5";
    if (viewerSavedStreetlightLightIdSet.has(lid)) return "#2ecc71";
    return "#fff";
  }, [shouldComputeStreetlightConfidenceState, viewerStreetlightRingOpenIdSet, viewerUtilityReportedLightIdSet, viewerSavedStreetlightLightIdSet]);

  const pendingConfiguredIncidentDomainKeys = configuredIncidentDemandDomainKeys.filter((domainKey) => (
    configuredIncidentRuntimeEntryByDomain.has(domainKey)
    && !configuredIncidentLoadedDomainKeySet.has(domainKey)
  ));
  const configuredIncidentDemandDomainKeySet = new Set(configuredIncidentDemandDomainKeys);
  const pendingConfiguredIncidentPersistedStateDomainKeys = configuredIncidentPersistedStateSupportedDomainKeys.filter((domainKey) => (
    configuredIncidentDemandDomainKeySet.has(domainKey)
    && !configuredIncidentPersistedStateLoadedDomainKeySet.has(domainKey)
  ));
  const incidentMapSnapshotReady = isIncidentMapSnapshotReadyShared({
    incidentLayerActive: activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY,
    publicReadAccessReady,
    waitingForTenantDomainConfig,
    tenantDomainConfigLoaded,
    loading,
    // Open/fixed state must be fresh before the all-incidents snapshot publishes.
    hasCompleteCachedSnapshot: false,
    pendingConfiguredDomainCount: pendingConfiguredIncidentDomainKeys.length,
    pendingPersistedStateDomainCount: pendingConfiguredIncidentPersistedStateDomainKeys.length,
  });
  const suppressIncompleteIncidentDomainRender = !incidentMapSnapshotReady;

  const renderedDomainMarkers = useMemo(() => {
    if (suppressIncompleteIncidentDomainRender) return [];
    const isLoggedIn = Boolean(session?.user?.id);
    const adminView = Boolean(reportsAdminView);
    const shouldRestrictToCity = Boolean(restrictPublicMarkersToCity);
    const shapeIncidentMarkersForDomain = (domainKeyRaw, markersRaw = []) => {
      const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
      if (!domainKey) return [];
      const publicVisibilityMin = incidentPublicVisibilityThresholdForDomain(domainKey);
      const publicRepairLifecycleEnabled = isPublicRepairEnabledForDomain(domainKey);
      const viewerReportedIds = viewerReportedIncidentIdsByDomain.get(domainKey) || new Set();
      const domainType = resolveRuntimeDomainTypeForMap(domainKey);
      const usesMappedCenter = incidentDrivenUsesMappedCenter(domainKey) || domainType === "asset_backed";
      const highConfidenceThreshold = usesMappedCenter
        ? resolveHighConfidenceThresholdForDomain(domainKey)
        : 0;
      const defaultMarkerColor = defaultMarkerColorForDomain(domainKey);
      const highConfidenceMarkerColor = usesMappedCenter
        ? resolveHighConfidenceMarkerColorForDomain(domainKey)
        : defaultMarkerColor;
      const suppressGlyph = incidentDrivenSuppressesGlyph(domainKey);
      const defaultGlyphSrc = defaultMarkerGlyphSrcForDomain(domainKey);
      const shaped = [];
      for (const marker of Array.isArray(markersRaw) ? markersRaw : []) {
        const count = Number(marker?.count || 0);
        if (count <= 0) continue;
        const incidentId = String(marker?.incident_id || marker?.id || "").trim();
        if (incidentId && !shouldRenderIncidentMarkerForState(domainKey, incidentId, marker)) continue;

        const viewerLookupId = incidentDrivenViewerLookupId(domainKey, incidentId);
        const userReported = viewerLookupId ? viewerReportedIds.has(viewerLookupId) : false;
        let repairSnapshot = null;

        if (publicRepairLifecycleEnabled) {
          repairSnapshot = getIncidentRepairSnapshot(domainKey, incidentId);
          if (repairSnapshot?.archived) continue;
        }

        if (!adminView) {
          const isPublic = count >= publicVisibilityMin;
          const isPrivateOwn = isLoggedIn && userReported && count < publicVisibilityMin;
          if (!isPublic && !isPrivateOwn) continue;
          if (!isPublic && isPrivateOwn) {
            repairSnapshot = repairSnapshot || getIncidentRepairSnapshot(domainKey, incidentId);
            if (repairSnapshot?.viewerHasRepairSignal) continue;
          }
        }

        const highConfidence = usesMappedCenter && count >= highConfidenceThreshold;
        const markerColor = highConfidence
          ? highConfidenceMarkerColor
          : defaultMarkerColor;
        const shapedMarker = {
          ...marker,
          color: markerColor,
          highConfidence,
          ringColor: userReported ? "#1e88e5" : "#fff",
          glyph: suppressGlyph ? "" : marker?.glyph,
          glyphSrc: resolveVisibleDomainIconSrc(
            domainKey,
            marker?.glyphSrc || defaultGlyphSrc
          ),
        };
        if (shouldRestrictToCity && !isWithinAshtabulaCityLimits(shapedMarker?.lat, shapedMarker?.lng)) continue;
        shaped.push(shapedMarker);
      }
      shaped.sort((a, b) => (Number(b.count || 0) - Number(a.count || 0)) || (Number(b.lastTs || 0) - Number(a.lastTs || 0)));
      return shaped;
    };

    if (activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY) {
      const shaped = [];
      for (const [domainKey, markers] of incidentDrivenMarkersByDomain.entries()) {
        const domainMarkers = shapeIncidentMarkersForDomain(domainKey, markers);
        if (domainMarkers.length) shaped.push(...domainMarkers);
      }
      return shaped;
    }

    const activeDomainKey = resolveActiveIncidentDomainKey({
      activeMapLayerKey,
      resolvedIncidentMapDomain,
      adminReportDomain,
    });
    if (!activeDomainKey) return [];
    return shapeIncidentMarkersForDomain(
      activeDomainKey,
      incidentDrivenMarkersByDomain.get(activeDomainKey) || []
    );
  }, [
    activeMapLayerKey,
    adminReportDomain,
    incidentDrivenMarkersByDomain,
    viewerReportedIncidentIdsByDomain,
    getIncidentRepairSnapshot,
    isPublicRepairEnabledForDomain,
    incidentPublicVisibilityThresholdForDomain,
    publicMapCoreCacheHasIncidentData,
    publicMapCoreCacheHydrated,
    session?.user?.id,
    reportsAdminView,
    suppressIncompleteIncidentDomainRender,
    restrictPublicMarkersToCity,
    isWithinAshtabulaCityLimits,
    resolvedIncidentMapDomain,
    resolveVisibleDomainIconSrc,
    resolveRuntimeDomainTypeForMap,
    resolveHighConfidenceThresholdForDomain,
    resolveHighConfidenceMarkerColorForDomain,
    shouldRenderIncidentMarkerForState,
  ]);

  const dedupedRenderedIncidentMarkers = useMemo(() => {
    if (activeMapLayerKey !== INCIDENT_REPORTING_LAYER_KEY) return [];
    return dedupeIncidentMarkerRenderSourceShared(renderedDomainMarkers, {
      getIncidentDomainHelper,
      normalizeDomainKeyOrSlug,
    });
  }, [
    activeMapLayerKey,
    renderedDomainMarkers,
    getIncidentDomainHelper,
    normalizeDomainKeyOrSlug,
  ]);

  const incidentClusterRenderItems = useMemo(() => {
    if (activeMapLayerKey !== INCIDENT_REPORTING_LAYER_KEY) return [];
    const source = dedupedRenderedIncidentMarkers;
    if (!source.length) return [];
    if (Number(mapZoom) > INCIDENT_CLUSTER_MAX_ZOOM) return source;

    const clusters = clusterMarkersByDistance(source, incidentClusterRadiusMetersForZoom(mapZoom));
    return clusters
      .map((cluster, index) => {
        const markers = Array.isArray(cluster?.markers) ? cluster.markers.filter(Boolean) : [];
        if (markers.length <= 1) return markers[0] || null;
        const totalReports = markers.reduce((sum, marker) => sum + Math.max(1, Number(marker?.count || 0)), 0);
        const incidentCount = markers.length;
        const domainCounts = new Map();
        for (const marker of markers) {
          const domainKey = String(marker?.domain || "").trim();
          if (!domainKey) continue;
          domainCounts.set(domainKey, (domainCounts.get(domainKey) || 0) + Math.max(1, Number(marker?.count || 0)));
        }
        return {
          id: `incident-cluster-${index}-${incidentLocationKey(cluster?.lat, cluster?.lng, 4)}`,
          kind: "incident_cluster",
          domain: "incident_cluster",
          lat: Number(cluster?.lat),
          lng: Number(cluster?.lng),
          count: incidentCount,
          incidentCount,
          reportCount: totalReports,
          markerCount: incidentCount,
          markers,
          domainCounts: Array.from(domainCounts.entries()),
          north: Number(cluster?.north),
          south: Number(cluster?.south),
          east: Number(cluster?.east),
          west: Number(cluster?.west),
        };
      })
      .filter(Boolean);
  }, [activeMapLayerKey, dedupedRenderedIncidentMarkers, mapZoom]);

  const incidentStackRenderItems = useMemo(() => {
    if (activeMapLayerKey !== INCIDENT_REPORTING_LAYER_KEY) return [];
    const source = dedupedRenderedIncidentMarkers;
    if (!source.length) return [];
    if (Number(mapZoom) <= INCIDENT_CLUSTER_MAX_ZOOM) return [];

    const byLocation = new Map();
    for (const marker of source) {
      const key = incidentLocationKey(marker?.lat, marker?.lng);
      if (!key) continue;
      const list = byLocation.get(key) || [];
      list.push(marker);
      byLocation.set(key, list);
    }

    const output = [];
    for (const markers of byLocation.values()) {
      if (!Array.isArray(markers) || !markers.length) continue;
      if (markers.length === 1) {
        output.push(markers[0]);
        continue;
      }
      const sortedMarkers = [...markers].sort((a, b) => (Number(b?.count || 0) - Number(a?.count || 0)) || (Number(b?.lastTs || 0) - Number(a?.lastTs || 0)));
      const totalReports = sortedMarkers.reduce((sum, marker) => sum + Math.max(1, Number(marker?.count || 0)), 0);
      const incidentCount = sortedMarkers.length;
      output.push({
        id: `incident-stack-${incidentLocationKey(sortedMarkers[0]?.lat, sortedMarkers[0]?.lng)}`,
        kind: "incident_stack",
        domain: "incident_stack",
        lat: Number(sortedMarkers[0]?.lat),
        lng: Number(sortedMarkers[0]?.lng),
        count: incidentCount,
        incidentCount,
        reportCount: totalReports,
        markerCount: incidentCount,
        markers: sortedMarkers,
      });
    }

    return output;
  }, [activeMapLayerKey, dedupedRenderedIncidentMarkers, mapZoom]);

  const displayedDomainMarkers = useMemo(() => {
    if (activeMapLayerKey !== INCIDENT_REPORTING_LAYER_KEY) return renderedDomainMarkers;
    if (Number(mapZoom) <= INCIDENT_CLUSTER_MAX_ZOOM) return incidentClusterRenderItems;
    return incidentStackRenderItems;
  }, [activeMapLayerKey, renderedDomainMarkers, mapZoom, incidentClusterRenderItems, incidentStackRenderItems]);
  const projectPopupPixel = useCallback((latRaw, lngRaw) => {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return officialCanvasOverlayRef.current?.projectLatLngToContainerPixel?.(lat, lng) || null;
  }, []);

  const zoomToIncidentCluster = useCallback((clusterMarker) => {
    if (!clusterMarker) return;
    setSelectedIncidentStackMarker(null);
    setSelectedDomainMarker(null);
    setSelectedOfficialId(null);
    const map = mapRef.current;
    const north = Number(clusterMarker?.north);
    const south = Number(clusterMarker?.south);
    const east = Number(clusterMarker?.east);
    const west = Number(clusterMarker?.west);
    if (
      map
      && window?.google?.maps?.LatLngBounds
      && [north, south, east, west].every(Number.isFinite)
      && (Math.abs(north - south) > 0.00001 || Math.abs(east - west) > 0.00001)
    ) {
      try {
        const bounds = new window.google.maps.LatLngBounds(
          { lat: south, lng: west },
          { lat: north, lng: east }
        );
        map.fitBounds(bounds, 56);
        return;
      } catch {
        // fall through to manual zoom if fitBounds fails
      }
    }

    const lat = Number(clusterMarker?.lat);
    const lng = Number(clusterMarker?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setMapCenter({ lat, lng });
    }
    const nextZoom = Math.min(18, Math.max(INCIDENT_CLUSTER_MAX_ZOOM + 1, Number(mapZoom || 0) + 2));
    setMapZoom(nextZoom);
    mapZoomRef.current = nextZoom;
    try {
      map?.panTo?.({ lat, lng });
      map?.setZoom?.(nextZoom);
    } catch {
      // state updates above are enough
    }
  }, [mapZoom]);

  useEffect(() => {
    if (!isStreetlightsLayerActive) {
      if (selectedOfficialId) setSelectedOfficialId(null);
      return;
    }
    if (!(isAdmin && openReportMapFilterOn)) return;
    const id = (selectedOfficialId || "").trim();
    if (!id) return;
    if (!openReportOfficialIdSet.has(id)) setSelectedOfficialId(null);
  }, [isStreetlightsLayerActive, isAdmin, openReportMapFilterOn, selectedOfficialId, openReportOfficialIdSet]);

  useEffect(() => {
    if (!selectedDomainMarker) return;
    const markerDomain = normalizeDomainKeyOrSlug(selectedDomainMarker?.domain || "", { allowUnknown: true });
    const keepForMarkerDomain = Boolean(markerDomain) && markerDomain !== "streetlights";
    if (!keepForMarkerDomain || activeMapLayerKey === "streetlights") {
      setSelectedDomainMarker(null);
    }
  }, [activeMapLayerKey, selectedDomainMarker]);

  useEffect(() => {
    if (!selectedDomainMarker) return;
    const markerDomain = normalizeDomainKeyOrSlug(selectedDomainMarker?.domain || "", { allowUnknown: true });
    if (!markerDomain || markerDomain === "streetlights") return;
    const incidentId = incidentDomainCanonicalIncidentId(markerDomain, selectedDomainMarker, selectedDomainMarker?.id);
    if (!incidentId) return;
    if (!shouldRenderIncidentMarkerForState(markerDomain, incidentId, selectedDomainMarker)) {
      setSelectedDomainMarker(null);
      setSelectedIncidentStackMarker(null);
    }
  }, [selectedDomainMarker, shouldRenderIncidentMarkerForState]);

  useEffect(() => {
    if (!selectedIncidentStackMarker) return;
    if (activeMapLayerKey !== INCIDENT_REPORTING_LAYER_KEY || Number(mapZoom) <= INCIDENT_CLUSTER_MAX_ZOOM) {
      setSelectedIncidentStackMarker(null);
    }
  }, [activeMapLayerKey, selectedIncidentStackMarker, mapZoom]);

  useEffect(() => {
    if (!queueSignTypeOpen) return;
    if (!(mappingMode && isAdmin && incidentDomainAdminMappingQueueVariant(adminReportDomain) === "official_sign")) {
      setQueueSignTypeOpen(false);
      setPendingQueuedSign(null);
    }
  }, [queueSignTypeOpen, mappingMode, isAdmin, adminReportDomain]);
  const shouldRenderStreetlightSelectionPopup = Boolean(
    !bulkMode
    && isStreetlightsLayerActive
    && String(selectedOfficialId || "").trim()
  );
  const shouldRenderIncidentDomainPopupWorkspace = Boolean(
    !bulkMode && selectedDomainMarker
  );
  const shouldRenderMapSelectionPopups = Boolean(
    !bulkMode && (
      selectedIncidentStackMarker ||
      (mappingMode && isAdmin && String(selectedQueuedTempId || "").trim())
    )
  );
  const shouldMountWorkspaceHost = Boolean(
    secondaryWorkspaceVisible
    || shouldRenderStreetlightSelectionPopup
    || shouldRenderIncidentDomainPopupWorkspace
    || shouldRenderMapSelectionPopups
  );
  const hasStreetlightPopupCandidates = Boolean(
    Array.isArray(renderedOfficialLights) && renderedOfficialLights.length > 0
  );
  const hasIncidentDomainPopupCandidates = Boolean(
    Array.isArray(displayedDomainMarkers)
    && displayedDomainMarkers.some(
      (marker) => marker && marker.kind !== "incident_stack" && marker.kind !== "incident_cluster"
    )
  );
  const hasIncidentStackPopupCandidates = Boolean(
    Array.isArray(displayedDomainMarkers)
    && displayedDomainMarkers.some((marker) => marker?.kind === "incident_stack")
  );
  const hasSecondaryMapSelectionPopupCandidates = Boolean(
    mappingMode && isAdmin && Array.isArray(mappingQueue) && mappingQueue.length > 0
  );
  const hasNonStreetlightPopupCandidates = Boolean(
    hasIncidentDomainPopupCandidates
    || hasIncidentStackPopupCandidates
    || hasSecondaryMapSelectionPopupCandidates
  );
  const hasMapSelectionPopupCandidates = Boolean(
    hasStreetlightPopupCandidates || hasNonStreetlightPopupCandidates
  );
  const shouldWarmStreetlightPopupWorkspace = Boolean(
    isStreetlightsLayerActive && hasStreetlightPopupCandidates
  );
  const shouldWarmIncidentDomainPopupWorkspace = Boolean(
    !isStreetlightsLayerActive && hasIncidentDomainPopupCandidates
  );
  const shouldWarmIncidentStackPopupWorkspace = Boolean(
    activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY && hasIncidentStackPopupCandidates
  );
  const shouldWarmQueuedSelectionPopupWorkspace = Boolean(
    hasSecondaryMapSelectionPopupCandidates
  );
  const hasWarmableMapSelectionPopupCandidates = Boolean(
    shouldWarmStreetlightPopupWorkspace
    || shouldWarmIncidentDomainPopupWorkspace
    || shouldWarmIncidentStackPopupWorkspace
    || shouldWarmQueuedSelectionPopupWorkspace
  );
  useEffect(() => {
    if (selectionPopupWarmupReady) return undefined;
    if (
      !startupWarmupReady
      || !hasWarmableMapSelectionPopupCandidates
      || shouldRenderIncidentDomainPopupWorkspace
      || shouldRenderMapSelectionPopups
    ) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setSelectionPopupWarmupReady(true);
    }, backgroundWarmupReduced ? 18000 : 12000);
    return () => clearTimeout(timer);
  }, [
    backgroundWarmupReduced,
    hasWarmableMapSelectionPopupCandidates,
    selectionPopupWarmupReady,
    shouldRenderIncidentDomainPopupWorkspace,
    shouldRenderMapSelectionPopups,
    startupWarmupReady,
  ]);
  useEffect(() => {
    if (deferredRealtimeReady) return undefined;
    if (loading || !startupWarmupReady) return undefined;
    const timer = setTimeout(() => {
      setDeferredRealtimeReady(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, [
    deferredRealtimeReady,
    loading,
    startupWarmupReady,
  ]);
  const shouldMountRealtimeController = Boolean(
    deferredRealtimeReady
    || shouldPrioritizeStreetlightRuntimeStartup
    || myReportsOpen
    || openReportsOpen
    || domainReportTarget
    || domainDisclosureGateTarget
    || confirmReportTarget
    || selectedDomainMarker
    || selectedIncidentStackMarker
    || shouldForceAdminConfiguredIncidentDomain
  );
  const hasPrimaryReportFlowCandidates = visibleReportDomainKeys.length > 0;
  useEffect(() => {
    if (primaryReportFlowWarmupReady) return undefined;
    if (!startupWarmupReady || !hasPrimaryReportFlowCandidates) return undefined;
    if (domainReportTarget || domainDisclosureGateTarget || confirmReportTarget) return undefined;
    const timer = setTimeout(() => {
      setPrimaryReportFlowWarmupReady(true);
    }, backgroundWarmupReduced ? 26000 : 18000);
    return () => clearTimeout(timer);
  }, [
    backgroundWarmupReduced,
    confirmReportTarget,
    domainDisclosureGateTarget,
    domainReportTarget,
    hasPrimaryReportFlowCandidates,
    primaryReportFlowWarmupReady,
    startupWarmupReady,
  ]);
  const shouldWarmAccountAccessController = Boolean(
    String(session?.user?.id || "").trim()
  );
  useEffect(() => {
    if (!shouldWarmAccountAccessController) {
      setAccountAccessWarmupReady(false);
      return undefined;
    }
    if (accountAccessWarmupReady) return undefined;
    if (
      authGateOpen
      || accountMenuOpen
      || mobileHeaderMenuOpen
      || manageOpen
      || deleteAccountOpen
      || reauthOpen
      || changePasswordOpen
      || recoveryPasswordOpen
      || notificationPreferencesOpen
      || followedLocationsOpen
      || shouldLoadAdminStateEagerly
      || shouldLoadReportAccessEagerly
      || shouldLoadProfileEagerly
    ) {
      setAccountAccessWarmupReady(true);
      return undefined;
    }
    if (!startupWarmupReady || loading) return undefined;
    return scheduleDeferredWarmup(() => {
      setAccountAccessWarmupReady(true);
    }, {
      startDelayMs: backgroundWarmupReduced ? 8000 : 4200,
      idleTimeoutMs: backgroundWarmupReduced ? 4200 : 2400,
      fallbackDelayMs: backgroundWarmupReduced ? 2200 : 1300,
    });
  }, [
    accountAccessWarmupReady,
    accountMenuOpen,
    authGateOpen,
    backgroundWarmupReduced,
    changePasswordOpen,
    deleteAccountOpen,
    followedLocationsOpen,
    loading,
    manageOpen,
    mobileHeaderMenuOpen,
    notificationPreferencesOpen,
    reauthOpen,
    recoveryPasswordOpen,
    shouldLoadAdminStateEagerly,
    shouldLoadProfileEagerly,
    shouldLoadReportAccessEagerly,
    shouldWarmAccountAccessController,
    startupWarmupReady,
  ]);
  const shouldWarmHeaderOrganizationProfile = Boolean(
    headerTenantKey
  );
  useEffect(() => {
    if (!shouldWarmHeaderOrganizationProfile) {
      setHeaderOrganizationProfileWarmupReady(false);
      return undefined;
    }
    if (headerOrganizationProfileWarmupReady) return undefined;
    if (contactUsOpen || accountMenuOpen || mobileHeaderMenuOpen) {
      setHeaderOrganizationProfileWarmupReady(true);
      return undefined;
    }
    if (!startupWarmupReady || loading) return undefined;
    return scheduleDeferredWarmup(() => {
      setHeaderOrganizationProfileWarmupReady(true);
    }, {
      startDelayMs: backgroundWarmupReduced ? 11000 : 7000,
      idleTimeoutMs: backgroundWarmupReduced ? 4200 : 2600,
      fallbackDelayMs: backgroundWarmupReduced ? 2200 : 1400,
    });
  }, [
    accountMenuOpen,
    backgroundWarmupReduced,
    contactUsOpen,
    headerOrganizationProfileWarmupReady,
    loading,
    mobileHeaderMenuOpen,
    shouldWarmHeaderOrganizationProfile,
    startupWarmupReady,
  ]);
  useEffect(() => {
    if (!shouldWarmResidentFeedBadgeController) {
      setResidentFeedBadgeWarmupReady(false);
      return undefined;
    }
    if (residentFeedBadgeWarmupReady) return undefined;
    if (shouldPrepareCommunityFeedReadState || communityFeedEditor.open) {
      setResidentFeedBadgeWarmupReady(true);
      return undefined;
    }
    if (!startupWarmupReady || loading) return undefined;
    return scheduleDeferredWarmup(() => {
      setResidentFeedBadgeWarmupReady(true);
    }, {
      startDelayMs: backgroundWarmupReduced ? 9000 : 5200,
      idleTimeoutMs: backgroundWarmupReduced ? 4200 : 2600,
      fallbackDelayMs: backgroundWarmupReduced ? 2200 : 1400,
    });
  }, [
    backgroundWarmupReduced,
    communityFeedEditor.open,
    loading,
    residentFeedBadgeWarmupReady,
    shouldPrepareCommunityFeedReadState,
    shouldWarmResidentFeedBadgeController,
    startupWarmupReady,
  ]);
  const shouldWarmMapSelectionPopups = Boolean(
    startupWarmupReady
    && selectionPopupWarmupReady
    && hasWarmableMapSelectionPopupCandidates
    && !shouldRenderIncidentDomainPopupWorkspace
    && !shouldRenderMapSelectionPopups
    && !loading
    && !mapInteracting
    && !myReportsOpen
    && !openReportsOpen
    && !notificationsWindowOpen
    && !alertsWindowOpen
    && !eventsWindowOpen
    && !accountMenuOpen
    && !notificationPreferencesOpen
    && !followedLocationsOpen
    && !manageOpen
    && !contactUsOpen
    && !infoMenuOpen
    && !citySwitcherOpen
    && !mobileHeaderMenuOpen
  );
  const shouldWarmPrimaryReportFlow = Boolean(
    startupWarmupReady
    && primaryReportFlowWarmupReady
    && hasPrimaryReportFlowCandidates
    && !loading
    && !mapInteracting
    && !bulkMode
    && !mappingMode
    && !openReportsOpen
    && !myReportsOpen
    && !notificationsWindowOpen
    && !alertsWindowOpen
    && !eventsWindowOpen
    && !accountMenuOpen
    && !notificationPreferencesOpen
    && !followedLocationsOpen
    && !manageOpen
    && !contactUsOpen
    && !infoMenuOpen
    && !citySwitcherOpen
    && !mobileHeaderMenuOpen
    && !domainReportTarget
    && !domainDisclosureGateTarget
    && !confirmReportTarget
  );
  useEffect(() => {
    if (!shouldWarmMapSelectionPopups) return undefined;
    return scheduleDeferredWarmup(() => {
      if (shouldWarmStreetlightPopupWorkspace) {
        void loadStreetlightPopupWorkspaceModule();
      }
      if (shouldWarmIncidentDomainPopupWorkspace) {
        void loadIncidentDomainPopupWorkspaceModule();
        void loadDeferredSelectionPopupIncidentSupportModule();
      }
      if (shouldWarmIncidentStackPopupWorkspace || shouldWarmQueuedSelectionPopupWorkspace) {
        void loadMapSelectionPopupsModule();
      }
      if (shouldWarmIncidentStackPopupWorkspace) {
        void loadDeferredSelectionPopupIncidentSupportModule();
      }
    }, {
      startDelayMs: backgroundWarmupReduced ? 3600 : 1800,
      idleTimeoutMs: backgroundWarmupReduced ? 4800 : 3200,
      fallbackDelayMs: backgroundWarmupReduced ? 2400 : 1400,
    });
  }, [
    backgroundWarmupReduced,
    shouldWarmIncidentDomainPopupWorkspace,
    shouldWarmIncidentStackPopupWorkspace,
    shouldWarmMapSelectionPopups,
    shouldWarmQueuedSelectionPopupWorkspace,
    shouldWarmStreetlightPopupWorkspace,
  ]);

  useEffect(() => {
    if (!shouldWarmPrimaryReportFlow) return undefined;
    return scheduleDeferredWarmup(() => {
      primePrimaryReportFlowOpenWorkspace();
    }, {
      startDelayMs: backgroundWarmupReduced ? 4400 : 2200,
      idleTimeoutMs: backgroundWarmupReduced ? 6800 : 5200,
      fallbackDelayMs: backgroundWarmupReduced ? 4200 : 3200,
    });
  }, [backgroundWarmupReduced, shouldWarmPrimaryReportFlow]);

  const officialMarkerColorForViewer = useCallback((lightId) => {
    if (!shouldComputeStreetlightConfidenceState) return defaultMarkerColorForDomain("streetlights");
    const lid = (lightId || "").trim();
    if (!lid) return defaultMarkerColorForDomain("streetlights");
    const confidence = streetlightConfidenceByLightId?.[lid] || null;
    if (String(confidence?.state || "").trim().toLowerCase() === "high_confidence_outage") {
      return resolveHighConfidenceMarkerColorForDomain("streetlights");
    }
    return defaultMarkerColorForDomain("streetlights");
  }, [shouldComputeStreetlightConfidenceState, streetlightConfidenceByLightId]);

  const officialMarkerPresentationForViewer = useCallback((lightId, markerColor, glyphSrc = "") => {
    if (!shouldComputeStreetlightConfidenceState) {
      return resolveDomainMarkerIconPresentation(
        "streetlights",
        markerColor || defaultMarkerColorForDomain("streetlights"),
        glyphSrc || UI_ICON_SRC.streetlight,
        { highConfidence: false }
      );
    }
    const lid = String(lightId || "").trim();
    const confidence = lid ? (streetlightConfidenceByLightId?.[lid] || null) : null;
    const highConfidence = String(confidence?.state || "").trim().toLowerCase() === "high_confidence_outage";
    return resolveDomainMarkerIconPresentation(
      "streetlights",
      markerColor || officialMarkerColorForViewer(lid),
      glyphSrc || UI_ICON_SRC.streetlight,
      { highConfidence }
    );
  }, [shouldComputeStreetlightConfidenceState, officialMarkerColorForViewer, streetlightConfidenceByLightId]);

  const renderedOfficialLightById = useMemo(() => {
    const byId = new Map();
    for (const light of renderedOfficialLights || []) {
      const id = String(light?.id || "").trim();
      if (id) byId.set(id, light);
    }
    return byId;
  }, [renderedOfficialLights]);

  const focusMapMarkerSelection = useCallback((marker) => {
    focusMapMarkerSelectionShared(marker, {
      mapRef,
      mapZoomRef,
      suppressMapClickRef,
    }, {
      setMapCenter,
      setMapZoom,
    });
  }, []);

  const handleOfficialMarkerClick = useCallback((lightId) => {
    primeMapSelectionPopupsWorkspace({ officialStreetlight: true });
    if (mappingMode) {
      focusMapMarkerSelection(renderedOfficialLightById.get(String(lightId || "").trim()));
      setSelectedQueuedTempId(null);
      setSelectedDomainMarker(null);
      setSelectedOfficialId(lightId);
      return;
    }

    if (bulkMode) {
      toggleBulkSelect(lightId);
      return;
    }

    focusMapMarkerSelection(renderedOfficialLightById.get(String(lightId || "").trim()));
    setSelectedQueuedTempId(null);
    setSelectedDomainMarker(null);
    setSelectedOfficialId(lightId);
  }, [mappingMode, bulkMode, focusMapMarkerSelection, renderedOfficialLightById, toggleBulkSelect]);

  const openIncidentDomainMarker = useCallback((marker) => {
    if (!marker) return;
    primeMapSelectionPopupsWorkspace({ incidentDriven: true });
    focusMapMarkerSelection(marker);
    setSelectedIncidentStackMarker(null);
    setSelectedQueuedTempId(null);
    setSelectedOfficialId(null);
    setSelectedDomainMarker(marker);
  }, [focusMapMarkerSelection, primeMapSelectionPopupsWorkspace]);
  const handleDisplayedDomainMarkerClick = useCallback((marker) => {
    if (!marker) return;
    setSelectedQueuedTempId(null);
    setSelectedOfficialId(null);
    if (marker?.kind === "incident_cluster") {
      zoomToIncidentCluster(marker);
      return;
    }
    if (marker?.kind === "incident_stack") {
      primeMapSelectionPopupsWorkspace({ incidentStack: true });
      focusMapMarkerSelection(marker);
      setSelectedDomainMarker(null);
      setSelectedIncidentStackMarker(marker);
      return;
    }
    openIncidentDomainMarker(marker);
  }, [focusMapMarkerSelection, openIncidentDomainMarker, zoomToIncidentCluster]);
  const handleQueuedPreviewMarkerClick = useCallback((queuedMarker) => {
    if (!queuedMarker) return;
    primeMapSelectionPopupsWorkspace({ queued: true });
    focusMapMarkerSelection(queuedMarker);
    setSelectedOfficialId(null);
    setSelectedDomainMarker(null);
    setSelectedQueuedTempId(queuedMarker.tempId);
  }, [focusMapMarkerSelection]);
  const isPointVisibleInCurrentMapBounds = useCallback((lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (!mapBounds) return true;
    return isPointInBounds(lat, lng, mapBounds);
  }, [mapBounds]);

  const streetlightViewRuntime = useMemo(() => {
    const emptyStats = { saved: 0, utility: 0 };
    const baseLights = Array.isArray(renderedOfficialLights) ? renderedOfficialLights : [];
    const visibleOfficialLightIdSet = new Set();
    if (!isStreetlightsLayerActive) {
      return {
        visibleOfficialLights: baseLights,
        visibleOfficialLightIdSet,
        streetlightPersonalInViewStats: emptyStats,
        openReportsInViewCount: 0,
      };
    }

    const mode = normalizedStreetlightInViewFilterMode;
    const filterSaved = mode === "saved";
    const filterUtility = mode === "utility";
    const hasSelectedOfficialLight = Boolean(String(selectedOfficialId || "").trim());
    let hasAnyUtilityReportedStreetlightSignal = false;
    if (shouldComputeStreetlightConfidenceState) {
      for (const [lidRaw, utility] of Object.entries(activeUtilitySignalCountsByLightId || {})) {
        const lid = String(lidRaw || "").trim();
        if (!lid) continue;
        if (Math.max(0, Number(utility?.reportedCount || 0)) > 0) {
          hasAnyUtilityReportedStreetlightSignal = true;
          break;
        }
      }
    }
    const hasViewerStreetlightSignals = Boolean(
      viewerStreetlightRingOpenIdSet.size
      || viewerSavedStreetlightLightIdSet.size
      || viewerUtilityReportedLightIdSet.size
      || hasAnyUtilityReportedStreetlightSignal
    );
    const canUseDefaultStreetlightViewportFastPath = Boolean(
      !filterSaved
      && !filterUtility
      && !reportsAdminView
      && !isAdmin
      && !hasSelectedOfficialLight
      && !hasViewerStreetlightSignals
    );
    if (canUseDefaultStreetlightViewportFastPath) {
      const hasMapBounds = Boolean(mapBounds);
      let renderedOfficialLightsById = null;
      let openReportsInViewCount = 0;
      if (!hasMapBounds) {
        for (const runtime of Object.values(reportsByOfficialId || {})) {
          openReportsInViewCount += Math.max(0, Number(runtime?.sinceFixCount || 0));
        }
      } else {
        renderedOfficialLightsById = new Map();
        for (const light of baseLights) {
          const lightId = String(light?.id || "").trim();
          if (!lightId) continue;
          renderedOfficialLightsById.set(lightId, light);
        }
        for (const [lidRaw, runtime] of Object.entries(reportsByOfficialId || {})) {
          const lid = String(lidRaw || "").trim();
          if (!lid) continue;
          if (Math.max(0, Number(runtime?.sinceFixCount || 0)) <= 0) continue;
          const light = renderedOfficialLightsById.get(lid);
          if (!light) continue;
          const lat = Number(light?.lat);
          const lng = Number(light?.lng);
          if (!isPointVisibleInCurrentMapBounds(lat, lng)) continue;
          openReportsInViewCount += Math.max(0, Number(runtime?.sinceFixCount || 0));
        }
      }
      return {
        visibleOfficialLights: baseLights,
        visibleOfficialLightIdSet,
        streetlightPersonalInViewStats: emptyStats,
        openReportsInViewCount,
      };
    }

    const visibleOfficialLights = [];
    const activeUtilityReportedAnyLightIdSet = new Set();
    if (shouldComputeStreetlightConfidenceState) {
      for (const [lidRaw, utility] of Object.entries(activeUtilitySignalCountsByLightId || {})) {
        const lid = String(lidRaw || "").trim();
        if (!lid) continue;
        if (Math.max(0, Number(utility?.reportedCount || 0)) > 0) activeUtilityReportedAnyLightIdSet.add(lid);
      }
    }
    let saved = 0;
    let utility = 0;
    let openReportsInViewCount = 0;

    for (const light of baseLights) {
      const lid = String(light?.id || "").trim();
      if (!lid) continue;

      const sinceFixCount = Number(reportsByOfficialId?.[lid]?.sinceFixCount ?? 0);
      const adminVisible = sinceFixCount >= 1;
      const viewerRingOpen = viewerStreetlightRingOpenIdSet.has(lid);
      const viewerSaved = viewerSavedStreetlightLightIdSet.has(lid);
      const viewerUtility = viewerUtilityReportedLightIdSet.has(lid);
      const utilityReportedAny = activeUtilityReportedAnyLightIdSet.has(lid);

      let filterMatches = true;
      if (filterSaved || filterUtility) {
        if (reportsAdminView) {
          filterMatches = adminVisible && (filterSaved || utilityReportedAny);
        } else {
          filterMatches = viewerRingOpen && (filterSaved ? viewerSaved : viewerUtility);
        }
      }
      if (filterMatches) visibleOfficialLights.push(light);
      if (filterMatches) visibleOfficialLightIdSet.add(lid);

      const lat = Number(light?.lat);
      const lng = Number(light?.lng);
      if (!isPointVisibleInCurrentMapBounds(lat, lng)) continue;

      if (filterMatches) {
        openReportsInViewCount += Math.max(0, sinceFixCount);
      }

      if (isAdmin) {
        if (adminVisible) {
          saved += 1;
          if (utilityReportedAny) utility += 1;
        }
        continue;
      }

      if (!viewerRingOpen) continue;
      if (viewerSaved) saved += 1;
      if (viewerUtility) utility += 1;
    }

    return {
      visibleOfficialLights,
      visibleOfficialLightIdSet,
      streetlightPersonalInViewStats: { saved, utility },
      openReportsInViewCount,
    };
  }, [
    isStreetlightsLayerActive,
    renderedOfficialLights,
    normalizedStreetlightInViewFilterMode,
    reportsByOfficialId,
    activeUtilitySignalCountsByLightId,
    shouldComputeStreetlightConfidenceState,
    reportsAdminView,
    selectedOfficialId,
    viewerStreetlightRingOpenIdSet,
    viewerSavedStreetlightLightIdSet,
    viewerUtilityReportedLightIdSet,
    isAdmin,
    mapBounds,
    isPointVisibleInCurrentMapBounds,
  ]);
  const visibleOfficialLights = streetlightViewRuntime.visibleOfficialLights;
  const visibleOfficialLightIdSet = streetlightViewRuntime.visibleOfficialLightIdSet;
  const streetlightPersonalInViewStats = streetlightViewRuntime.streetlightPersonalInViewStats;

  useEffect(() => {
    if (!isStreetlightsLayerActive) return;
    const selectedId = String(selectedOfficialId || "").trim();
    if (!selectedId) return;
    const stillVisible = visibleOfficialLightIdSet.has(selectedId);
    if (!stillVisible) setSelectedOfficialId(null);
  }, [isStreetlightsLayerActive, selectedOfficialId, visibleOfficialLightIdSet]);

  const displayedDomainMarkerViewportRuntime = useMemo(() => {
    if (activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY) {
      const summary = summarizeCanonicalIncidentMarkersInViewportShared(
        dedupedRenderedIncidentMarkers,
        { isPointVisible: isPointVisibleInCurrentMapBounds }
      );
      return {
        openReportsInViewCount: summary.count,
        byDomain: summary.byDomain,
        incidentIdsByDomain: summary.incidentIdsByDomain,
      };
    }
    const visibleMarkers = Array.isArray(displayedDomainMarkers) ? displayedDomainMarkers : [];
    if (!visibleMarkers.length) {
      return {
        openReportsInViewCount: 0,
      };
    }
    let openReportsInViewCount = 0;
    for (const marker of visibleMarkers) {
      const lat = Number(marker?.lat);
      const lng = Number(marker?.lng);
      if (!isPointVisibleInCurrentMapBounds(lat, lng)) continue;
      openReportsInViewCount += Math.max(0, Number(marker?.reportCount ?? marker?.count ?? marker?.incidentCount ?? marker?.markerCount ?? 0));
    }
    return {
      openReportsInViewCount,
    };
  }, [activeMapLayerKey, dedupedRenderedIncidentMarkers, displayedDomainMarkers, isPointVisibleInCurrentMapBounds]);

  useEffect(() => {
    if (typeof window === "undefined" || activeMapLayerKey !== INCIDENT_REPORTING_LAYER_KEY) return;
    window.__CITYREPORT_INCIDENT_MAP_SNAPSHOT__ = {
      tenantKey: String(tenant?.tenantKey || activeTenantKey() || "").trim().toLowerCase(),
      ready: incidentMapSnapshotReady,
      reportsAdminView: Boolean(reportsAdminView),
      sourceIncidentCount: dedupedRenderedIncidentMarkers.length,
      inViewIncidentCount: Number(displayedDomainMarkerViewportRuntime.openReportsInViewCount || 0),
      byDomain: displayedDomainMarkerViewportRuntime.byDomain || {},
      incidentIdsByDomain: displayedDomainMarkerViewportRuntime.incidentIdsByDomain || {},
      lifecycleStateCount: Object.keys(incidentStateByKey || {}).length,
      pendingConfiguredDomains: pendingConfiguredIncidentDomainKeys,
      pendingPersistedStateDomains: pendingConfiguredIncidentPersistedStateDomainKeys,
      bounds: mapBounds,
    };
  }, [
    activeMapLayerKey,
    dedupedRenderedIncidentMarkers,
    displayedDomainMarkerViewportRuntime,
    incidentMapSnapshotReady,
    incidentStateByKey,
    mapBounds,
    pendingConfiguredIncidentDomainKeys,
    pendingConfiguredIncidentPersistedStateDomainKeys,
    reportsAdminView,
    tenant?.tenantKey,
  ]);

  const openReportsInViewCount = useMemo(() => {
    if (isStreetlightsLayerActive) {
      return Number(streetlightViewRuntime.openReportsInViewCount || 0);
    }
    return Number(displayedDomainMarkerViewportRuntime.openReportsInViewCount || 0);
  }, [displayedDomainMarkerViewportRuntime, isStreetlightsLayerActive, streetlightViewRuntime]);

  const openReportsInViewLabel = activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY
    ? "Incidents in view"
    : "Reports in view";
  const handleOpenMobileInViewReports = useCallback(() => {
    if (!canOpenDomainReports) return;
    if (canOpenAdminReports) {
      openMyReports({ reportedByMode: "all", inViewOnly: true });
      return;
    }
    openOpenReports({ inViewOnly: true });
  }, [canOpenAdminReports, canOpenDomainReports, openMyReports, openOpenReports]);
  const handleToggleSavedStreetlightInViewFilter = useCallback(() => {
    toggleStreetlightInViewFilter("saved");
  }, [toggleStreetlightInViewFilter]);
  const handleToggleUtilityStreetlightInViewFilter = useCallback(() => {
    toggleStreetlightInViewFilter("utility");
  }, [toggleStreetlightInViewFilter]);
  const handleOpenModerationFlags = useCallback(() => {
    setModerationFlagsOpen(true);
  }, []);

  const showAllInMyReports = canToggleReportedByInMyReports && myReportsReportedByMode === "all";
  const myReportsAllReportsDomainOptions = showAllInMyReports ? openReportsDomainOptions : visibleDomainOptions;

  // -------------------------
  // Google Maps marker status helper
  // -------------------------

  // CMD+F: function formatTs
  function formatTs(input) {
    if (input == null) return "";

    // Accept: ms number, ISO string, Date, or seconds
    let t = input;

    if (t instanceof Date) t = t.getTime();

    if (typeof t === "string") {
      const parsed = Date.parse(t);
      if (!Number.isNaN(parsed)) t = parsed;
      else {
        const asNum = Number(t);
        t = Number.isFinite(asNum) ? asNum : 0;
      }
    }

    if (typeof t === "number") {
      // if it looks like seconds, convert → ms
      if (t > 0 && t < 2_000_000_000) t = t * 1000;
    }

    const ms = Number(t);
    if (!Number.isFinite(ms) || ms <= 0) return "";

    try {
      return new Date(ms).toLocaleString();
    } catch {
      return "";
    }
  }
  // CMD+F: function closeAnyPopup
  function closeAnyPopup() {
    // Google Maps InfoWindow (official)
    try { setSelectedOfficialId(null); } catch {}
    try { setSelectedDomainMarker(null); } catch {}
    try { setSelectedIncidentStackMarker(null); } catch {}

    // ✅ queued marker popup
    try { setSelectedQueuedTempId(null); } catch {}

    // Leaflet legacy (safe no-op if not present)
    try { mapRef.current?.closePopup?.(); } catch {}
  }

  const hasToolPopoutOpen =
    accountMenuOpen ||
    infoMenuOpen ||
    citySwitcherOpen ||
    notificationsWindowOpen ||
    alertsWindowOpen ||
    eventsWindowOpen ||
    openReportsOpen ||
    myReportsOpen ||
    adminDomainMenuOpen ||
    adminToolboxOpen ||
    locationDiagnosticsOpen ||
    manageOpen ||
    deleteAccountOpen ||
    reauthOpen ||
    changePasswordOpen ||
    recoveryPasswordOpen ||
    notificationPreferencesOpen ||
    followedLocationsOpen ||
    contactUsOpen;

  const shouldRenderAccountWorkspace =
    (accountMenuOpen && !useAppShellLayout) ||
    manageOpen ||
    deleteAccountOpen ||
    reauthOpen ||
    changePasswordOpen ||
    recoveryPasswordOpen ||
    followedLocationsOpen ||
    notificationPreferencesOpen ||
    contactUsOpen;

  useEffect(() => {
    if (!hasToolPopoutOpen) return;
    closeAnyPopup();
  }, [hasToolPopoutOpen]);

  // CMD+F: function suppressPopupsSafe
  function suppressPopupsSafe(_ms = 800) {
    // With Google Maps, we primarily suppress by closing InfoWindows
    // and ignoring quick subsequent clicks if you have logic for that.
    // Keep as a safe stub so calls won't crash.
  }

  function clearGuestContact() {
    setGuestInfo({ name: "", phone: "", email: "" });
    setGuestInfoDraft({ name: "", phone: "", email: "" });
  }

  function resetIncidentDomainReportDraft(domainKeyRaw = "") {
    setDomainReportNote("");
    setDomainReportImageFile(null);
    setDomainReportImagePreviewUrl("");
    setDomainReportIssue("");
    setDomainReportTypeSelections({});
    setDomainDisclosureAcknowledgements({});
  }

  function finalizeIncidentDomainSubmitSuccess({
    isAuthed = false,
    domainKey = "",
    title = "Report saved",
    message = "",
    reportNumbers = [],
    submittedAt = 0,
  } = {}) {
    if (!isAuthed) clearGuestContact();
    resetIncidentDomainReportDraft(domainKey);
    setDomainDisclosureGateTarget(null);
    setDomainReportTarget(null);
    openReportSuccess({
      kind: "incident",
      domainKey,
      title,
      message,
      reportNumbers,
      submittedAt: Number(submittedAt || 0) || Date.now(),
    });
  }

  function requestGuestChallenge(kind, lightId = "", domainKey = "") {
    void loadDeferredIncidentSupportModule().then(({ requestGuestChallengeRuntimeShared }) => {
      requestGuestChallengeRuntimeShared(kind, lightId, domainKey, {
        setPendingGuestAction,
        setContactChoiceOpen,
      });
    });
  }

  async function reverseGeocodeRoadLabel(lat, lng, options = {}) {
    const {
      reverseGeocodeRoadLabelRuntimeShared,
    } = await loadDeferredGeoSupportModule();
    return reverseGeocodeRoadLabelRuntimeShared(lat, lng, options, {
      reverseGeocodeInFlightMap: reverseGeocodeInFlightRef.current,
      placesLookupBlockedUntilRef,
      placesBlockedNoticeShownRef,
      placesLibraryLoadPromiseRef,
      geocoderLookupBlockedUntilRef,
      geocoderBlockedNoticeShownRef,
    }, {
      nextTraceId: () => ++GEO_TRACE_SEQUENCE,
      roadHitThresholdMeters: ROAD_VALIDATION_HIT_METERS,
      gmapsActiveKey: GMAPS_ACTIVE_KEY,
      enableLegacyPlacesService: ENABLE_LEGACY_PLACES_SERVICE,
      isAdmin,
      openConfiguredNotice,
      windowLike: window,
      fetchImpl: fetch,
    });
  }

  function resumePendingGuestAction() {
    void loadDeferredIncidentSupportModule().then(({ resumePendingGuestActionRuntimeShared }) => {
      resumePendingGuestActionRuntimeShared({
        pendingGuestAction,
      }, {
        setPendingGuestAction,
        submitIsWorking,
        submitIncidentRepairConfirmation,
        submitBulkReports,
        submitDomainReport,
        submitReport,
        setTimeoutImpl: window.setTimeout.bind(window),
      });
    });
  }

  const EMAIL_LOCATION_ENRICHMENT_WAIT_MS = 5000;

  function dispatchDomainSubmitEmailNotice(args = {}) {
    return (async () => {
      const {
        dispatchDomainSubmitEmailNoticeRuntimeShared,
      } = await loadDeferredIncidentSupportModule();
      return dispatchDomainSubmitEmailNoticeRuntimeShared(args, {
        normalizeDomainKeyOrSlug,
        resolveReportDomainLabel: (domainKeyRaw, fallback = "Incident") => (
          resolveReportDomainLabelShared(domainKeyRaw, fallback, {
            runtimeDomainMeta: RUNTIME_DOMAIN_META,
            reportDomainOptions: REPORT_DOMAIN_OPTIONS,
          })
        ),
        emailLocationEnrichmentWaitMs: EMAIL_LOCATION_ENRICHMENT_WAIT_MS,
        setTimeoutImpl: window.setTimeout.bind(window),
        tenantKey: String(activeTenantKey() || "").trim().toLowerCase(),
        functionUrlBase: String(import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
        publishableKey: String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim(),
        fetchImpl: fetch,
      });
    })();
  }

  function notifyAsyncEmailDelivery(domainLabel, noticeRes) {
    void loadDeferredIncidentSupportModule().then(({ notifyAsyncEmailDeliveryRuntimeShared }) => {
      notifyAsyncEmailDeliveryRuntimeShared(domainLabel, noticeRes);
    });
  }

  async function getAbuseSubmitRuntimeDeps() {
    const {
      registerAbuseEventWithServerRuntimeShared,
      openRateLimitNoticeRuntimeShared,
    } = await loadDeferredAbuseSupportModule();
    return {
      registerAbuseEventWithServer: (args = {}) => registerAbuseEventWithServerRuntimeShared(args, {
        normalizeEmail,
        normalizePhone,
        reporterIdentityKey,
        normalizeDomainKeyOrSlug,
        activeTenantKey,
        supabase,
        abuseGateFunction: ABUSE_GATE_FUNCTION,
        abuseWindowMs: ABUSE_WINDOW_MS,
        abuseMaxEventsPerWindow: ABUSE_MAX_EVENTS_PER_WINDOW,
        abuseMaxLightsPerWindow: ABUSE_MAX_LIGHTS_PER_WINDOW,
        abuseBackoffMaxMs: ABUSE_BACKOFF_MAX_MS,
        abuseRateKey: ABUSE_RATE_KEY,
        abuseBackoffKey: ABUSE_BACKOFF_KEY,
        localStorageLike: localStorage,
        logger: console,
      }),
      openRateLimitNotice: (openNoticeFn, abuseGate) => openRateLimitNoticeRuntimeShared(
        openNoticeFn,
        abuseGate,
        { abuseWindowMs: ABUSE_WINDOW_MS },
      ),
    };
  }

  function municipalBoundaryGate(domainKey, lat, lng, { showNotice = true } = {}) {
    const domain = normalizeDomainKeyOrSlug(domainKey, { allowUnknown: true });
    if (!domain || isTenantAssetBackedDomain(domain)) return true;
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
      if (showNotice) {
        openNotice("⚠️", "Location unavailable", "Could not validate the reporting boundary for this report.");
      }
      return false;
    }
    // Boundary unavailable should not block reporting (fail-open fallback).
    if (cityLimitPolygons.length <= 0) {
      console.warn("[municipalBoundaryGate] boundary unavailable; allowing submit without boundary check");
      return true;
    }
    if (!isWithinAshtabulaCityLimits(nLat, nLng)) {
      if (showNotice) {
        openNotice(
          "⚠️",
          "Outside reporting boundary",
          "This report must be placed inside the tenant boundary. It will not be submitted from outside the boundary."
        );
      }
      return false;
    }
    return true;
  }

  async function submitDomainReport() {
    const abuseSubmitDeps = await getAbuseSubmitRuntimeDeps();
    const [
      { submitIncidentDomainReportRuntimeShared },
      {
        incidentDomainConfiguredLookupField,
        incidentDomainConfiguredSelectFields,
        incidentDomainConfiguredSourceTable,
        incidentDomainPrependConfiguredReportState,
        incidentDomainUpsertConfiguredSeededState,
      },
      {
        incidentDomainAllowsRepeatAfterArchive,
        incidentDomainAlreadyReportedMessage,
        incidentDomainApplyPersistedLocationCacheState,
        incidentDomainBuildCustomSubmitFlowConfig,
        incidentDomainBuildReportLookupFallbackData,
        incidentDomainConfiguredLookupIdentityFields,
        incidentDomainDefaultIssueLabel,
        incidentDomainNormalizePayloadIncidentId,
        incidentDomainNormalizePersistenceIncidentId,
        incidentDomainNormalizeSubmitTarget,
        incidentDomainPersistsSubmitIssueType,
        incidentDomainResolveSubmitReportKeyHint,
        incidentDomainSeededInsertLookupFailureMessage,
        incidentDomainServiceSubmitFunctionName,
        incidentDomainShouldUseServiceSubmitFallback,
        incidentDomainSubmitDebugSource,
        incidentDomainSubmitFallbackIncidentPrefix,
        incidentDomainSubmitGeoModeWhenNotRoad,
        incidentDomainUsesCanonicalSubmitIncidentId,
        incidentDomainUsesCustomSubmitFlow,
        incidentDomainUsesSubmitIdentityGuard,
      },
      incidentIdentityRuntimeDeps,
    ] = await Promise.all([
      loadDeferredIncidentDomainSubmitRuntimeModule(),
      loadDeferredConfiguredIncidentStateRuntimeHelpers(),
      loadDeferredIncidentDomainSubmitHelpers(),
      getDeferredIncidentIdentityRuntimeDeps(),
    ]);
    return submitIncidentDomainReportRuntimeShared({
      domainReportTarget,
      saving,
      domainSubmitInFlightRef,
      domainReportIssue,
      domainReportNote,
      domainSubmitDedupRef,
      domainDisclosureAcknowledgements,
      session,
      guestSubmitBypassRef,
      guestInfoDraft,
      guestInfo,
      profile,
      selectedDomain: domainReportTarget?.domain || selectedDomainMarker?.domain || adminReportDomain,
      viewerIdentityKey,
      domainReportTypeSelections,
      reports,
      fixedLights,
      lastFixByLightId,
      visibleDomainOptions,
      configuredIncidentRuntimeEntries,
      domainReportImageFile,
    }, {
      normalizeDomainKey,
      incidentDomainNormalizeSubmitTarget,
      incidentDrivenMarkersForDomain,
      domainSubmitIdempotencyKey,
      domainSubmitDedupeWindowMs: DOMAIN_SUBMIT_DEDUPE_WINDOW_MS,
      openNotice,
      setSaving,
      municipalBoundaryGate,
      ensureParkPlacementForTarget,
      domainDisclosureAckKey,
      requestGuestChallenge,
      normalizeEmail,
      registerAbuseEventWithServer: abuseSubmitDeps.registerAbuseEventWithServer,
      openRateLimitNotice: abuseSubmitDeps.openRateLimitNotice,
      isRoadRequiredForDomain,
      validateAndPrepareRoadTarget,
      incidentDomainUsesCustomSubmitFlow,
      normalizeDomainKeyOrSlug,
      incidentDomainBuildCustomSubmitFlowConfig,
      resolveIncidentDomainHelperEntry,
      incidentDomainNormalizePayloadIncidentId,
      incidentDomainNormalizePersistenceIncidentId,
      incidentDomainBuildCoordsDisplayId,
      nearestSeededIncidentForPoint,
      potholeMergeRadiusMeters: POTHOLE_MERGE_RADIUS_METERS,
      runtimeDomainMeta: RUNTIME_DOMAIN_META,
      getIncidentDomainHelper,
      reportDomainFromLightId,
      incidentDomainUpsertConfiguredSeededState,
      incidentDomainPrependConfiguredReportState,
      incidentDomainApplyPersistedLocationCacheState,
      activeTenantKey,
      supabase,
      persistIncidentLocationCacheWithEnrichment,
      incidentDomainAllowsRepeatAfterArchive,
      getIncidentRepairSnapshot,
      canIdentityReportLight: incidentIdentityRuntimeDeps.canIdentityReportLight,
      incidentDomainAlreadyReportedMessage,
      incidentDomainServiceSubmitFunctionName,
      incidentDomainShouldUseServiceSubmitFallback,
      refreshIncidentRepairProgress,
      dispatchDomainSubmitEmailNotice,
      notifyAsyncEmailDelivery,
      incidentDomainConfiguredSourceTable,
      incidentDomainConfiguredSelectFields,
      incidentDomainConfiguredLookupField,
      createTenantScopedReadClient,
      incidentDomainConfiguredLookupIdentityFields,
      incidentDomainSeededInsertLookupFailureMessage,
      incidentDomainBuildReportLookupFallbackData,
      incidentDomainSubmitGeoModeWhenNotRoad,
      incidentDomainSubmitDebugSource,
      incidentDomainResolveSubmitReportKeyHint,
      reverseGeocodeRoadLabel,
      openConfiguredNotice,
      incidentDomainUsesSubmitIdentityGuard,
      incidentDomainUsesCanonicalSubmitIncidentId,
      incidentDomainCanonicalIncidentId,
      domainIssueNoteTag,
      incidentDomainPersistsSubmitIssueType,
      incidentDomainSubmitFallbackIncidentPrefix,
      insertReportWithFallback,
      normalizeReportQuality,
      setReports,
      incidentDomainDefaultIssueLabel,
      finalizeIncidentDomainSubmitSuccess,
    });
  }


function isMissingTenantKeyColumnError(err) {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("tenant_key") && (msg.includes("does not exist") || msg.includes("schema cache"));
}

async function insertReportWithFallback(payload) {
    const {
      insertReportWithFallbackShared,
      canRetryInsertWithoutSelectShared,
    } = await loadDeferredReportSubmitSupportModule();
    return insertReportWithFallbackShared(payload, {
      supabase,
      canRetryInsertWithoutSelect: canRetryInsertWithoutSelectShared,
    });
  }

  async function submitIsWorking(lightId) {
    const abuseSubmitDeps = await getAbuseSubmitRuntimeDeps();
    const { submitIsWorkingRuntimeShared } = await loadDeferredStreetlightSubmitRuntimeModule();
    return submitIsWorkingRuntimeShared({
      lightId,
      saving,
      session,
      guestSubmitBypassRef,
      guestInfoDraft,
      guestInfo,
      profile,
      officialLights,
    }, {
      requestGuestChallenge,
      openNotice,
      normalizeEmail,
      setSaving,
      registerAbuseEventWithServer: abuseSubmitDeps.registerAbuseEventWithServer,
      openRateLimitNotice: abuseSubmitDeps.openRateLimitNotice,
      normalizePhone,
      supabase,
      insertReportWithFallback,
      normalizeReportQuality,
      setReports,
      clearGuestContact,
      openReportSuccess,
    });
  }

  async function submitIncidentRepairConfirmation(incidentIdRaw, domainKeyRaw) {
    const abuseSubmitDeps = await getAbuseSubmitRuntimeDeps();
    const { submitIncidentRepairConfirmationRuntimeShared } = await loadDeferredStreetlightSubmitRuntimeModule();
    return submitIncidentRepairConfirmationRuntimeShared({
      incidentIdRaw,
      domainKeyRaw,
      saving,
      session,
      guestSubmitBypassRef,
      guestInfoDraft,
      guestInfo,
      profile,
      viewerIdentityKey,
    }, {
      normalizeDomainKeyOrSlug,
      domainForIncidentId,
      isPublicRepairEnabledForDomain,
      openNotice,
      getIncidentRepairSnapshot,
      markIncidentRepairSignalOptimistically,
      requestGuestChallenge,
      normalizeEmail,
      reporterIdentityKey,
      setSaving,
      registerAbuseEventWithServer: abuseSubmitDeps.registerAbuseEventWithServer,
      openRateLimitNotice: abuseSubmitDeps.openRateLimitNotice,
      supabase,
      activeTenantKey,
      refreshIncidentRepairProgress,
      clearGuestContact,
      openConfiguredNotice,
    });
  }

  function resumeSubmitIfPending() {
    if (!pendingSubmit) return;
    setPendingSubmit(false);

    // Ensure state updates (session/profile/guestInfo) are committed before submit reads them
    setTimeout(() => {
      submitReport();
    }, 0);
  }

  function openConfirmForLight({ lat, lng, lightId, isOfficial = false, reports = [] }) {
    if (isOfficial && Number(mapZoomRef.current || mapZoom) < REPORTING_MIN_ZOOM) {
      openConfiguredNotice("zoom_to_report", {
        icon: "🔎",
        title: "Zoom in to report",
        message: "To improve accuracy of marker placement, zoom in further to report.",
      });
      return;
    }
    setPicked([lat, lng]);
    setActiveLight({ lat, lng, lightId, isOfficial, reports });
    setNote("");           // optional: reset note each time
    setReportType("");
    setStreetlightAreaPowerOn("");
    setStreetlightHazardYesNo("");
  }

  async function submitReport() {
    const abuseSubmitDeps = await getAbuseSubmitRuntimeDeps();
    const [
      { submitStreetlightReportRuntimeShared },
      incidentIdentityRuntimeDeps,
    ] = await Promise.all([
      loadDeferredStreetlightSubmitRuntimeModule(),
      getDeferredIncidentIdentityRuntimeDeps(),
    ]);
    return submitStreetlightReportRuntimeShared({
      picked,
      saving,
      activeLight,
      session,
      guestSubmitBypassRef,
      guestInfoDraft,
      guestInfo,
      reportType,
      note,
      profile,
      officialIdSet,
      officialLights,
      streetlightConfidenceByLightId,
      reports,
      fixedLights,
      lastFixByLightId,
      streetlightAreaPowerOn,
      streetlightHazardYesNo,
    }, {
      requestGuestChallenge,
      openNotice,
      normalizeEmail,
      canIdentityReportLight: incidentIdentityRuntimeDeps.canIdentityReportLight,
      setActiveLight,
      setPicked,
      setSaving,
      registerAbuseEventWithServer: abuseSubmitDeps.registerAbuseEventWithServer,
      openRateLimitNotice: abuseSubmitDeps.openRateLimitNotice,
      reverseGeocodeRoadLabel,
      supabase,
      activeTenantKey,
      setOfficialLights,
      normalizeDomainKeyOrSlug,
      runtimeDomainMeta: RUNTIME_DOMAIN_META,
      insertReportWithFallback,
      normalizeReportQuality,
      setReports,
      clearGuestContact,
      closeAnyPopup,
      suppressMapClickRef,
      openReportSuccess,
      setNote,
      setStreetlightAreaPowerOn,
      setStreetlightHazardYesNo,
      lightIdFor,
    });
  }

  // ✅ Auto-resume pending report after successful login
  useEffect(() => {
    if (!pendingSubmit) return;
    if (!session?.user?.id) return;

    // close all auth-related modals
    setAuthGateOpen(false);
    setAuthGateStep("welcome");
    setContactChoiceOpen(false);
    setGuestInfoOpen(false);

    // allow React state to settle, then submit
    setPendingSubmit(false);
    setTimeout(() => {
      submitReport();
    }, 0);
  }, [pendingSubmit, session?.user?.id]);

  useEffect(() => {
    if (!pendingGuestAction) return;
    if (!session?.user?.id) return;

    setContactChoiceOpen(false);
    setGuestInfoOpen(false);
    resumePendingGuestAction();
  }, [pendingGuestAction, session?.user?.id]);
  
  function removeFromMappingQueue(tempId) {
    setMappingQueue((prev) => prev.filter((q) => q.tempId !== tempId));
  }

  // CMD+F: async function confirmMappingQueue
  async function confirmMappingQueue() {
    const { confirmMappingQueueRuntimeShared } = await loadDeferredAdminMappingRuntimeModule();
    return confirmMappingQueueRuntimeShared({
      sessionUserId: session?.user?.id || "",
      isAdmin,
      mappingQueue,
    }, {
      openNotice,
      setSaving,
      supabase,
      makeLightIdFromCoords,
      normalizeOfficialLightRow,
      normalizeOfficialSignRow,
      isValidLatLng,
      incidentDomainQueueItemMatchesVariant,
      setOfficialLights,
      setConfiguredIncidentSeededRowsForDomain,
      setMappingQueue,
      openConfiguredNotice,
    });
  }

  // Submit bulk reports
  async function submitBulkReports() {
  const abuseSubmitDeps = await getAbuseSubmitRuntimeDeps();
  const [
    { submitBulkStreetlightReportsRuntimeShared },
    incidentIdentityRuntimeDeps,
  ] = await Promise.all([
    loadDeferredStreetlightSubmitRuntimeModule(),
    getDeferredIncidentIdentityRuntimeDeps(),
  ]);
  return submitBulkStreetlightReportsRuntimeShared({
    saving,
    mapZoomRef,
    mapZoom,
    bulkSelectedIds,
    session,
    guestSubmitBypassRef,
    guestInfoDraft,
    guestInfo,
    profile,
    reportType,
    note,
    streetlightAreaPowerOn,
    streetlightHazardYesNo,
    streetlightConfidenceByLightId,
    reports,
    fixedLights,
    lastFixByLightId,
    officialLights,
  }, {
    reportMinZoom: REPORTING_MIN_ZOOM,
    openConfiguredNotice,
    openNotice,
    bulkMaxLightsPerSubmit: BULK_MAX_LIGHTS_PER_SUBMIT,
    requestGuestChallenge,
    normalizeEmail,
    normalizeDomainKeyOrSlug,
    runtimeDomainMeta: RUNTIME_DOMAIN_META,
    setSaving,
    registerAbuseEventWithServer: abuseSubmitDeps.registerAbuseEventWithServer,
    openRateLimitNotice: abuseSubmitDeps.openRateLimitNotice,
    closeAnyPopup,
    suppressPopupsSafe,
    canIdentityReportLight: incidentIdentityRuntimeDeps.canIdentityReportLight,
    insertReportWithFallback,
    normalizeReportQuality,
    setReports,
    setBulkConfirmOpen,
    clearBulkSelection,
    setNote,
    setStreetlightAreaPowerOn,
    setStreetlightHazardYesNo,
    clearGuestContact,
    openReportSuccess,
  });
}


  // Admin: optimistic add official light (no OK spam)
  async function addOfficialLight(lat, lng) {
    const { addOfficialLightRuntimeShared } = await loadDeferredAdminMappingRuntimeModule();
    return addOfficialLightRuntimeShared({
      isAdmin,
      lat,
      lng,
      createdBy: session?.user?.id || null,
    }, {
      supabase,
      makeLightIdFromCoords,
      normalizeOfficialLightRow,
      setOfficialLights,
      openNotice,
    });
  }

  async function deleteOfficialLight(id) {
    const { deleteOfficialLightRuntimeShared } = await loadDeferredAdminMappingRuntimeModule();
    return deleteOfficialLightRuntimeShared({
      isAdmin,
      id,
      officialLights,
    }, {
      supabase,
      closeAnyPopup,
      suppressPopupsSafe,
      setOfficialLights,
      openNotice,
    });
  }

  async function deleteOfficialLightsByIds(ids = []) {
    const { deleteOfficialLightsByIdsRuntimeShared } = await loadDeferredAdminMappingRuntimeModule();
    return deleteOfficialLightsByIdsRuntimeShared({
      isAdmin,
      ids,
      officialLights,
      selectedOfficialId,
    }, {
      supabase,
      closeAnyPopup,
      suppressPopupsSafe,
      setDeleteCircleConfirmOpen,
      setSaving,
      setOfficialLights,
      setSelectedOfficialId,
      setDeleteCircleDraft,
      openNotice,
    });
  }

  async function markIncidentsFixedByIds(ids = [], noteText = "") {
    const { markIncidentsFixedByIdsRuntimeShared } = await loadDeferredAdminMappingRuntimeModule();
    return markIncidentsFixedByIdsRuntimeShared({
      isAdmin,
      ids,
      noteText,
    }, {
      closeAnyPopup,
      suppressPopupsSafe,
      setDeleteCircleConfirmOpen,
      setSaving,
      markIncidentFixedByCanonicalId,
      setDeleteCircleDraft,
      setDeleteCircleNote,
      openNotice,
    });
  }

  async function deleteOfficialSign(id) {
    const { deleteOfficialSignRuntimeShared } = await loadDeferredAdminMappingRuntimeModule();
    return deleteOfficialSignRuntimeShared({
      isAdmin,
      id,
      configuredIncidentSeededRowsStateByDomain,
    }, {
      supabase,
      setConfiguredIncidentSeededRowsForDomain,
      closeAnyPopup,
      suppressPopupsSafe,
      openNotice,
    });
  }

  function resetMarkFixedDialogState() {
    setMarkFixedConfirmOpen(false);
    setPendingMarkFixedLightId(null);
    setPendingMarkFixedClusterReports([]);
    setPendingIncidentCompatMarker(null);
    setPendingIncidentActionType("fix");
    setPendingIncidentDomainKey("");
    setPendingIncidentCurrentState("");
    setPendingIncidentNextState("");
    setPendingIncidentLabel("");
    setPendingIncidentIsOfficialTarget(false);
    setPendingIncidentPin("");
    setPendingIncidentStatusError("");
    setMarkFixedNote("");
    setMarkFixedImageFile(null);
    setMarkFixedSubmitting(false);
  }

  function currentIncidentActionActor() {
    const actorName =
      String(profile?.full_name || "").trim()
      || String(session?.user?.user_metadata?.full_name || "").trim()
      || String(session?.user?.email || "").split("@")[0]
      || "";
    return {
      userId: session?.user?.id || null,
      name: actorName || "",
      email: normalizeEmail(session?.user?.email || profile?.email || "") || "",
      phone: normalizePhone(profile?.phone || "") || "",
    };
  }

  async function openIncidentStatusDialog({
    incidentId,
    domainKey,
    currentState = "",
    clusterReports = null,
    compatMarker = null,
    incidentLabel = "",
    isOfficial = false,
  }) {
    const { openIncidentStatusDialogRuntimeShared } = await loadDeferredIncidentAdminActionRuntimeModule();
    return openIncidentStatusDialogRuntimeShared({
      incidentId,
      domainKey,
      currentState,
      clusterReports,
      compatMarker,
      incidentLabel,
      isOfficial,
      domainForIncidentId,
      openNotice,
    }, {
      normalizeDomainKeyOrSlug,
      setters: {
        setPendingIncidentCompatMarker,
        setPendingMarkFixedLightId,
        setPendingMarkFixedClusterReports,
        setPendingIncidentDomainKey,
        setPendingIncidentCurrentState,
        setPendingIncidentNextState,
        setPendingIncidentActionType,
        setPendingIncidentLabel,
        setPendingIncidentIsOfficialTarget,
        setPendingIncidentPin,
        setPendingIncidentStatusError,
        setMarkFixedNote,
        setMarkFixedImageFile,
        setMarkFixedConfirmOpen,
      },
    });
  }

  const openIncidentStatusDialogForTarget = useCallback(async ({
    incidentId,
    domainKey,
    currentState = "",
    clusterReports = null,
    incidentLabel = "",
    isOfficial = false,
    marker = null,
  }) => {
    const { openIncidentStatusDialogForTargetRuntimeShared } =
      await loadDeferredIncidentAdminActionRuntimeModule();
    return openIncidentStatusDialogForTargetRuntimeShared({
      incidentId,
      domainKey,
      currentState,
      clusterReports,
      incidentLabel,
      isOfficial,
      marker,
    }, {
      normalizeDomainKeyOrSlug,
      domainForIncidentId,
      normalizeIncidentDrivenLookupId,
      configuredIncidentSeededByIdByDomain,
      persistedIncidentRecordStateByDomain,
      getIncidentDomainHelper,
      lookupIncidentIdForDomain,
      incidentDomainBuildCoordsDisplayId,
      openIncidentStatusDialog,
    });
  }, [
    domainForIncidentId,
    getIncidentDomainHelper,
    incidentDomainBuildCoordsDisplayId,
    configuredIncidentSeededByIdByDomain,
    openIncidentStatusDialog,
    lookupIncidentIdForDomain,
    normalizeIncidentDrivenLookupId,
    persistedIncidentRecordStateByDomain,
  ]);

  async function markFixed(light, noteText = "", options = {}) {
    const { markFixedRuntimeShared } = await loadDeferredIncidentAdminActionRuntimeModule();
    return markFixedRuntimeShared({
      light,
      noteText,
      options,
    }, {
      supabase,
      activeTenantKey,
      officialIdSet,
      lightActionsActorColumnsSupportedRef,
      domainForIncidentId,
      incidentSnapshotKey,
      prefixedIncidentDomainKey: prefixedIncidentDomainKeyShared,
      getIncidentDomainHelper,
      setFixedLights,
      setLastFixByLightId,
      setIncidentStateByKey,
      setActionsByLightId,
      setSelectedDomainMarker,
      openNotice,
      actor: currentIncidentActionActor(),
    });
  }


  async function reopenLight(light, noteText = "") {
    const { reopenLightRuntimeShared } = await loadDeferredIncidentAdminActionRuntimeModule();
    return reopenLightRuntimeShared({
      light,
      noteText,
    }, {
      supabase,
      activeTenantKey,
      lightActionsActorColumnsSupportedRef,
      domainForIncidentId,
      incidentSnapshotKey,
      setFixedLights,
      setLastFixByLightId,
      setActionsByLightId,
      setIncidentStateByKey,
      openNotice,
      actor: currentIncidentActionActor(),
    });
  }

  async function submitPendingIncidentAction() {
    const { submitPendingIncidentActionRuntimeShared } = await loadDeferredIncidentAdminActionRuntimeModule();
    return submitPendingIncidentActionRuntimeShared({
      markFixedSubmitting,
      pendingMarkFixedLightId,
      pendingIncidentDomainKey,
      pendingMarkFixedClusterReports,
      pendingIncidentCompatMarker,
      markFixedNote,
      pendingIncidentNextState,
      pendingIncidentCurrentState,
      markFixedImageFile,
      sessionUserId: String(session?.user?.id || "").trim(),
      pendingIncidentIsOfficialTarget,
      pendingIncidentPin,
      pendingIncidentLabel,
    }, {
      supabase,
      activeTenantKey,
      normalizeDomainKeyOrSlug,
      domainForIncidentId,
      resolveIncidentDomainHelperEntry,
      lookupIncidentIdForDomain,
      incidentDomainCanonicalIncidentId,
      isMissingRelationError,
      setPendingIncidentStatusError,
      setMarkFixedSubmitting,
      markFixed,
      reopenLight,
      setIncidentStateByKey,
      incidentSnapshotKey,
      openConfiguredNotice,
      resetMarkFixedDialogState,
    });
  }

  function openUtilityReportDialogForLight(lightId) {
    const lid = String(lightId || "").trim();
    if (!lid) return;
    if (!session?.user?.id) {
      openNotice("⚠️", "Login required", "Please sign in to track utility reporting on this light.");
      return;
    }
    setPendingUtilityReportLightId(lid);
    setPendingUtilityReportReference(String(utilityReportReferenceByLightId?.[lid] || "").trim());
    setUtilityReportDialogOpen(true);
  }

  function closeUtilityReportDialog() {
    setUtilityReportDialogOpen(false);
    setPendingUtilityReportLightId(null);
    setPendingUtilityReportReference("");
  }

  async function markUtilityReportedForViewer(lightId, reportReference = "") {
    const { markUtilityReportedForViewerRuntimeShared } = await loadDeferredIncidentAdminActionRuntimeModule();
    return markUtilityReportedForViewerRuntimeShared({
      sessionUserId: session?.user?.id || "",
      lightId,
      reportReference,
      utilityReportedLightIdSet,
      utilityReportReferenceByLightId,
      utilityReportedAtByLightId,
    }, {
      supabase,
      activeTenantKey,
      setUtilityReportedLightIdSet,
      setUtilityReportedAtByLightId,
      setUtilityReportReferenceByLightId,
    });
  }

  async function clearUtilityReportedForViewer(lightId) {
    const { clearUtilityReportedForViewerRuntimeShared } = await loadDeferredIncidentAdminActionRuntimeModule();
    return clearUtilityReportedForViewerRuntimeShared({
      sessionUserId: session?.user?.id || "",
      lightId,
    }, {
      supabase,
      activeTenantKey,
      setUtilityReportedLightIdSet,
      setUtilityReportedAtByLightId,
      setUtilityReportReferenceByLightId,
    });
  }

  // Helper: always forces map camera move
  function flyToTarget(pos, zoom) {
    return loadDeferredMapFlyRuntimeModule()
      .then(({ flyToTargetRuntimeShared }) => flyToTargetRuntimeShared(
        pos,
        zoom,
        {
          mapRef,
          mapInteractIdleTimerRef,
          mapCenter,
          mapZoom,
          flyAnimRef,
        },
        {
          setMapInteracting,
          setMapCenter,
          setMapZoom,
          setMapTarget,
        },
      ))
      .catch(() => {});
  }

  const flyToLightAndOpen = useCallback((pos, zoom, lightId) => {
    return loadDeferredMapFlyRuntimeModule()
      .then(({ flyToLightAndOpenRuntimeShared }) => flyToLightAndOpenRuntimeShared(
        pos,
        zoom,
        lightId,
        {
          mapRef,
          mapInteractIdleTimerRef,
          mapCenter,
          mapZoom,
          flyAnimRef,
          flyInfoTimerRef,
          officialIdSet,
        },
        {
          setMapInteracting,
          setMapCenter,
          setMapZoom,
          setMapTarget,
          primeMapSelectionPopupsWorkspace,
          setSelectedQueuedTempId,
          setSelectedDomainMarker,
          setSelectedOfficialId,
        },
      ))
      .catch(() => {});
  }, [mapCenter, mapZoom, officialIdSet]);

  const nudgeMapZoom = useCallback((delta) => {
    const map = mapRef.current;
    if (!map) return;
    const cur = Number(map.getZoom?.() ?? mapZoomRef.current ?? 0);
    if (!Number.isFinite(cur)) return;
    const next = clamp(cur + delta, 3, 22);
    try {
      if (map.moveCamera) map.moveCamera({ zoom: next });
      else map.setZoom?.(next);
    } catch {
      // ignore
    }
    mapZoomRef.current = next;
    const rounded = Math.round(next);
    setMapZoom((prev) => (prev === rounded ? prev : rounded));
  }, []);

  const moveFollowCamera = useCallback(({ lat, lng, heading, syncState = false }) => {
    return loadDeferredFollowCameraRuntimeModule()
      .then(({ moveFollowCameraRuntimeShared }) => moveFollowCameraRuntimeShared(
        { lat, lng, heading, syncState },
        {
          mapRef,
          mapZoomRef,
          travelFollowMode,
        },
        {
          resolveFollowCameraCenter,
          setMapCenter,
          setMapZoom,
          locateZoom: LOCATE_ZOOM,
        },
      ))
      .catch(() => {});
  }, [travelFollowMode]);

  const queueFollowCameraTarget = useCallback(({ lat, lng, heading }) => {
    return loadDeferredFollowCameraRuntimeModule()
      .then(({
        queueFollowCameraTargetRuntimeShared,
        moveFollowCameraRuntimeShared,
      }) => queueFollowCameraTargetRuntimeShared(
        { lat, lng, heading },
        {
          followTargetRef,
          followRafRef,
          mapRef,
          followCamera,
          followHeadingEnabledRef,
          followAnimatedCameraRef,
          lastFollowStateSyncRef,
          mapZoomRef,
          travelFollowMode,
        },
        {
          metersBetween,
          resolveFollowCameraCenter,
          moveFollowCamera: (payload) => moveFollowCameraRuntimeShared(
            payload,
            {
              mapRef,
              mapZoomRef,
              travelFollowMode,
            },
            {
              resolveFollowCameraCenter,
              setMapCenter,
              setMapZoom,
              locateZoom: LOCATE_ZOOM,
            },
          ),
          setMapCenter,
          setMapZoom,
        },
      ))
      .catch(() => {});
  }, [followCamera, travelFollowMode]);

  const resumeFollowCameraFromLiveMotion = useCallback(({ syncState = false } = {}) => {
    return loadDeferredFollowCameraRuntimeModule()
      .then(({
        resumeFollowCameraFromLiveMotionRuntimeShared,
        moveFollowCameraRuntimeShared,
        queueFollowCameraTargetRuntimeShared,
      }) => resumeFollowCameraFromLiveMotionRuntimeShared(
        { syncState },
        {
          liveMotionRef,
          followHeadingEnabledRef,
          lastFollowCameraRef,
          followAnimatedCameraRef,
        },
        {
          moveFollowCamera: (payload) => moveFollowCameraRuntimeShared(
            payload,
            {
              mapRef,
              mapZoomRef,
              travelFollowMode,
            },
            {
              resolveFollowCameraCenter,
              setMapCenter,
              setMapZoom,
              locateZoom: LOCATE_ZOOM,
            },
          ),
          queueFollowCameraTarget: (payload) => queueFollowCameraTargetRuntimeShared(
            payload,
            {
              followTargetRef,
              followRafRef,
              mapRef,
              followCamera,
              followHeadingEnabledRef,
              followAnimatedCameraRef,
              lastFollowStateSyncRef,
              mapZoomRef,
              travelFollowMode,
            },
            {
              metersBetween,
              resolveFollowCameraCenter,
              moveFollowCamera: (movePayload) => moveFollowCameraRuntimeShared(
                movePayload,
                {
                  mapRef,
                  mapZoomRef,
                  travelFollowMode,
                },
                {
                  resolveFollowCameraCenter,
                  setMapCenter,
                  setMapZoom,
                  locateZoom: LOCATE_ZOOM,
                },
              ),
              setMapCenter,
              setMapZoom,
            },
          ),
        },
      ))
      .catch(() => false);
  }, [followCamera, travelFollowMode]);



  async function applyLocatedPosition(pos) {
    const { applyLocatedPositionRuntimeShared } = await loadDeferredGeoSupportModule();
    return applyLocatedPositionRuntimeShared(
      pos,
      {
        lastTrackedPosRef,
        smoothedHeadingRef,
        navigationHeadingRef,
        lastFollowCameraRef,
        followAnimatedCameraRef,
        stationaryAnchorRef,
        stationaryReleaseStreakRef,
      },
      {
        updateUserLocUi,
        flyToTarget,
        setAutoFollow,
        setFollowCamera,
        locateZoom: LOCATE_ZOOM,
      }
    );
  }

  function toggleTravelFollowMode(force = null) {
    setTravelFollowMode((prev) => {
      const next = typeof force === "boolean" ? force : !prev;
      if (next) {
        setAutoFollow(true);
        setFollowCamera(true);
        followHeadingEnabledRef.current = true;
        void resumeFollowCameraFromLiveMotion({ syncState: true }).then((didResume) => {
          if (!didResume) {
            void findMyLocation(false);
          }
        });
      }
      return next;
    });
  }

  async function findMyLocation(force = false) {
    const { findMyLocationRuntimeShared } = await loadDeferredGeoSupportModule();
    return findMyLocationRuntimeShared(
      force,
      {
        geoDenied,
        followHeadingEnabledRef,
      },
      {
        isNativeAppRuntime,
        openNotice,
        loadCapacitorGeolocationModule,
        requestCurrentPositionReliable,
        applyLocatedPosition,
        setGeoDeniedPersist,
        setLocating,
        navigatorLike: navigator,
        windowLike: window,
      }
    );
  }


  // Watch position (smoother + heading updates)
  useEffect(() => {
    if (!autoFollow) return;
    if (!isNativeAppRuntime() && (!window.isSecureContext || !navigator.geolocation)) return;

    const handlePosition = (pos) => {
      void Promise.all([
        loadDeferredGeoSupportModule(),
        getDeferredIncidentIdentityRuntimeDeps(),
      ]).then(([
        { processTrackedPositionRuntimeShared },
        incidentIdentityRuntimeDeps,
      ]) => {
        processTrackedPositionRuntimeShared(pos, {
          lastTrackedPosRef,
          liveMotionRef,
          stationaryAnchorRef,
          stationaryReleaseStreakRef,
          smoothedHeadingRef,
          navigationHeadingRef,
          followHeadingEnabledRef,
          lastFollowCameraRef,
          followTargetRef,
          followCamera,
          travelFollowMode,
          userDragPanRef,
        }, {
          setUserHeading,
          metersBetween,
          bearingBetween: incidentIdentityRuntimeDeps.bearingBetween,
          predictedMovingDisplayPosition: incidentIdentityRuntimeDeps.predictedMovingDisplayPosition,
          recordLocationDiagnostics,
          updateUserLocUi,
          queueFollowCameraTarget,
        });
      });
    };

    const handleError = (err) => {
      void loadDeferredGeoSupportModule().then(({ handleTrackedPositionErrorRuntimeShared }) => {
        handleTrackedPositionErrorRuntimeShared(err, {
          setAutoFollow,
          setGeoDeniedPersist,
          openNotice,
        });
      });
    };

    if (isNativeAppRuntime()) {
      let watchId = null;
      loadCapacitorGeolocationModule()
        .then(({ Geolocation }) => Geolocation.watchPosition(
          { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
          (pos, err) => {
            if (err) {
              handleError(err);
              return;
            }
            if (pos) handlePosition(pos);
          }
        ).then((id) => ({ Geolocation, id })))
        .then((id) => {
          watchId = id;
        })
        .catch((err) => {
          handleError(err);
        });

      return () => {
        if (!watchId) return;
        watchId.Geolocation.clearWatch({ id: watchId.id }).catch(() => {});
      };
    }

    const id = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );

    return () => {
      try { navigator.geolocation.clearWatch(id); } catch {}
    };
  }, [autoFollow, followCamera, travelFollowMode]);

  useEffect(() => () => {
    cancelFlyAnimation();
    clearFlyInfoTimer();
    stopFollowCameraAnimation();
    if (userLocRafRef.current) {
      cancelAnimationFrame(userLocRafRef.current);
      userLocRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (followCamera) return;
    stopFollowCameraAnimation();
  }, [followCamera]);

  useEffect(() => {
    if (!followCamera && travelFollowMode) {
      setTravelFollowMode(false);
    }
  }, [followCamera, travelFollowMode]);

  useEffect(() => {
    let cancelled = false;
    let cleanup = null;

    void loadDeferredWakeLockRuntimeModule()
      .then(({ attachWakeLockRuntimeShared }) => {
        if (cancelled) return;
        cleanup = attachWakeLockRuntimeShared(
          { wakeLockRef },
          {
            navigatorLike: navigator,
            documentLike: document,
            shouldKeepAwake: () => isNativeAppRuntime() && followCamera && travelFollowMode,
            logger: console,
          },
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [followCamera, travelFollowMode]);


  // -------------------------
  // Render
  // -------------------------

  // ✅ Load Google Maps JS before rendering <GoogleMap />
  // Uses Vite env var: VITE_GOOGLE_MAPS_API_KEY
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GMAPS_ACTIVE_KEY,
    libraries: GMAPS_LIBRARIES,
  });

  useEffect(() => {
    if (!gmapsRef || !isTouchDevice) return;
    let cancelled = false;
    let cleanup = null;

    void loadDeferredTouchInteractionRuntimeModule()
      .then(({ attachGoogleMapTouchGestureRuntimeShared }) => {
        if (cancelled) return;
        cleanup = attachGoogleMapTouchGestureRuntimeShared(
          {
            gmapsRef,
            clickDelayRef,
            suppressMapClickRef,
          },
          { clamp },
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [gmapsRef, isTouchDevice]);

  useEffect(() => {
    if (!isLoaded) {
      setMapTilesReady(false);
      return;
    }
    if (!isAppleTouchWeb || forceRasterMapCompat || mapTilesReady) return;
    const timer = window.setTimeout(() => {
      setForceRasterMapCompat((prev) => {
        if (prev) return prev;
        console.warn("[google maps] enabling raster compatibility fallback for Apple touch browser");
        return true;
      });
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [forceRasterMapCompat, isAppleTouchWeb, isLoaded, mapTilesReady]);

  const mapOptions = useMemo(() => {
    const useRasterCompatMode = forceRasterMapCompat || isAppleTouchWeb;
    return {
      mapTypeId: mapType,
      mapId: useRasterCompatMode ? undefined : (GMAPS_MAP_ID || undefined),
      gestureHandling: "greedy",
      disableDoubleClickZoom: false,
      isFractionalZoomEnabled: false,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      clickableIcons: false,
      rotateControl: !useRasterCompatMode,
      headingInteractionEnabled: !useRasterCompatMode,
      tiltInteractionEnabled: false,
    };
  }, [forceRasterMapCompat, isAppleTouchWeb, mapType]);

  // -------------------------
  // Popup button styles (Google InfoWindow)
  // -------------------------
  const mapHasAnyLoadedData =
    reports.length > 0 ||
    officialLights.length > 0 ||
    hasConfiguredIncidentSeededRows ||
    hasConfiguredIncidentReportRows ||
    hasIncidentDrivenDomainMarkers;
  const showInitialMapDataLoading =
    loading &&
    !mapHasAnyLoadedData;
  const showResumeMapDataLoading =
    resumeRefreshActive &&
    !mapHasAnyLoadedData;
  const mapRefreshingNotice = UI_NOTICE_META?.map_refreshing || {};
  const mapLoadingMessage = tenant?.switchingTenant
    ? "Switching city..."
    : (showResumeMapDataLoading || showInitialMapDataLoading)
      ? String(mapRefreshingNotice?.title || "Loading map data...")
      : "";
  const canShowOfficialLightsByZoom = true;
  const showOfficialLights = canShowOfficialLightsByZoom;
  const adminDomainMeta =
    visibleDomainOptionsByKey.get(adminReportDomain) || visibleDomainOptions[0] || builtInReportDomainOptions[0];
  const domainMarkerColor = defaultMarkerColorForDomain(adminReportDomain);
  const isSavedStreetlightFilterOn = isStreetlightsLayerActive && normalizedStreetlightInViewFilterMode === "saved";
  const isUtilityStreetlightFilterOn = isStreetlightsLayerActive && normalizedStreetlightInViewFilterMode === "utility";
  const inViewCounterColor = "var(--sl-ui-text)";
  const inViewCounterBg = "var(--sl-ui-surface-bg)";
  const inViewCounterBorder = "var(--sl-ui-surface-border)";

  useEffect(() => {
    mapZoomRef.current = mapZoom;
  }, [mapZoom]);

  useEffect(() => {
    return () => {
      if (dragFollowOffTimerRef.current) {
        clearTimeout(dragFollowOffTimerRef.current);
        dragFollowOffTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (canShowOfficialLightsByZoom) return;
    if (selectedOfficialId) setSelectedOfficialId(null);
  }, [canShowOfficialLightsByZoom, selectedOfficialId]);

  useEffect(() => {
    if (isAssetReportingDomain) return;
    if (bulkMode) {
      setBulkMode(false);
      setBulkConfirmOpen(false);
      clearBulkSelection();
    }
    if (mappingMode) {
      setMappingMode(false);
      setMappingQueue([]);
    }
    if (openReportMapFilterOn) setOpenReportMapFilterOn(false);
    if (streetlightInViewFilterMode) setStreetlightInViewFilterMode("");
    if (selectedOfficialId) setSelectedOfficialId(null);
  }, [
    isAssetReportingDomain,
    bulkMode,
    mappingMode,
    openReportMapFilterOn,
    streetlightInViewFilterMode,
    selectedOfficialId,
    clearBulkSelection,
  ]);

  useEffect(() => {
    if (isAdmin) return;
    if (!deleteCircleMode && !deleteCircleDraft && !deleteCircleConfirmOpen) return;
    setDeleteCircleMode(false);
    setDeleteCircleDraft(null);
    setDeleteCircleConfirmOpen(false);
    setDeleteCircleNote("");
  }, [isAdmin, deleteCircleMode, deleteCircleDraft, deleteCircleConfirmOpen]);

  useEffect(() => {
    if (canUseStreetlightBulk || !bulkMode) return;
    setBulkMode(false);
    setBulkConfirmOpen(false);
    clearBulkSelection();
  }, [canUseStreetlightBulk, bulkMode, clearBulkSelection]);

  const beginMapInteraction = useCallback(() => {
    if (mapInteractIdleTimerRef.current) {
      clearTimeout(mapInteractIdleTimerRef.current);
      mapInteractIdleTimerRef.current = null;
    }
    setSelectionPopupWarmupReady((prev) => (prev ? prev : true));
    setPrimaryReportFlowWarmupReady((prev) => (prev ? prev : true));
    setDeferredRealtimeReady((prev) => (prev ? prev : true));
    setMapInteracting((prev) => (prev ? prev : true));
  }, []);

  const endMapInteractionSoon = useCallback((delayMs = 80) => {
    if (mapInteractIdleTimerRef.current) {
      clearTimeout(mapInteractIdleTimerRef.current);
    }
    mapInteractIdleTimerRef.current = setTimeout(() => {
      setMapInteracting(false);
      mapInteractIdleTimerRef.current = null;
    }, delayMs);
  }, []);

  useEffect(() => () => {
    if (mapInteractIdleTimerRef.current) {
      clearTimeout(mapInteractIdleTimerRef.current);
      mapInteractIdleTimerRef.current = null;
    }
    if (toolHintTimerRef.current) {
      clearTimeout(toolHintTimerRef.current);
      toolHintTimerRef.current = null;
    }
  }, []);

  const handleDeferredMapDragStart = useCallback(() => {
    void loadDeferredMapInteractionRuntimeModule()
      .then(({ handleMapDragStartRuntimeShared }) => {
        handleMapDragStartRuntimeShared(
          {
            userDragPanRef,
            followCamera,
            travelFollowMode,
          },
          {
            beginMapInteraction,
            closeAnyPopup,
            stopFollowCameraAnimation,
            setFollowCamera,
            setTravelFollowMode,
          },
        );
      })
      .catch(() => {});
  }, [beginMapInteraction, closeAnyPopup, followCamera, stopFollowCameraAnimation, travelFollowMode]);

  const handleDeferredMapZoomChanged = useCallback(() => {
    void loadDeferredMapInteractionRuntimeModule()
      .then(({ handleMapZoomChangedRuntimeShared }) => {
        handleMapZoomChangedRuntimeShared(
          {
            mapRef,
            mapZoomRef,
            lastZoomGestureAtRef,
          },
          {
            beginMapInteraction,
            setMapZoom,
          },
        );
      })
      .catch(() => {});
  }, [beginMapInteraction]);

  const handleDeferredMapIdle = useCallback(() => {
    void loadDeferredMapInteractionRuntimeModule()
      .then(({ handleMapIdleRuntimeShared }) => {
        handleMapIdleRuntimeShared(
          {
            userDragPanRef,
            travelFollowMode,
            followCamera,
            mapRef,
          },
          {
            endMapInteractionSoon,
            setMapZoom,
            setMapCenter,
            setMapBounds,
            resumeFollowCameraFromLiveMotion,
          },
        );
      })
      .catch(() => {});
  }, [endMapInteractionSoon, followCamera, resumeFollowCameraFromLiveMotion, travelFollowMode]);

  const processGoogleMapTap = useCallback((lat, lng) => {
    void loadDeferredMapTapRuntimeModule()
      .then(({ processGoogleMapTapRuntimeShared }) => {
        processGoogleMapTapRuntimeShared(lat, lng, {
          deleteCircleMode,
          isAdmin,
          deleteCircleDraft,
          showOfficialLights,
          selectedOfficialId,
          selectedQueuedTempId,
          selectedDomainMarker,
          selectedIncidentStackMarker,
          activeMapLayerKey,
          visibleDomainOptions,
          adminReportDomain,
          mappingMode,
          mapZoom: mapZoomRef.current || mapZoom,
          residentIncidentPickerOptions,
        }, {
          setDeleteCircleDraft,
          openNotice,
          metersBetween,
          setDeleteCircleConfirmOpen,
          officialCanvasOverlayRef,
          handleOfficialMarkerClick,
          setSelectedOfficialId,
          setSelectedQueuedTempId,
          setSelectedDomainMarker,
          setSelectedIncidentStackMarker,
          INCIDENT_REPORTING_LAYER_KEY,
          incidentDomainAdminMappingQueueVariant,
          requestQueueOfficialSign,
          REPORTING_MIN_ZOOM,
          openConfiguredNotice,
          setIncidentTypePickerOpenedAt,
          setPendingIncidentTypeTarget,
          setIncidentTypePickerOpen,
          queueOfficialLight,
        });
      })
      .catch(() => {});
  }, [
    activeMapLayerKey,
    adminReportDomain,
    deleteCircleDraft,
    deleteCircleMode,
    handleOfficialMarkerClick,
    incidentDomainAdminMappingQueueVariant,
    isAdmin,
    mapZoom,
    mappingMode,
    openConfiguredNotice,
    residentIncidentPickerOptions,
    selectedDomainMarker,
    selectedIncidentStackMarker,
    selectedOfficialId,
    selectedQueuedTempId,
    showOfficialLights,
    visibleDomainOptions,
  ]);

  const handleGoogleMapClick = useCallback((event) => {
    void loadDeferredMapTapRuntimeModule()
      .then(({ handleGoogleMapClickRuntimeShared }) => {
        handleGoogleMapClickRuntimeShared(event, {
          isTouchDevice,
          clickDelayRef,
          suppressMapClickRef,
        }, {
          setAdminDomainMenuOpen,
          setMobileIncidentDomainMenuOpen,
          setAdminToolboxOpen,
          processGoogleMapTap,
        });
      })
      .catch(() => {});
  }, [isTouchDevice, processGoogleMapTap]);

  const handleGoogleMapDoubleClick = useCallback(() => {
    void loadDeferredMapTapRuntimeModule()
      .then(({ handleGoogleMapDoubleClickRuntimeShared }) => {
        handleGoogleMapDoubleClickRuntimeShared({
          clickDelayRef,
          suppressMapClickRef,
        });
      })
      .catch(() => {});
  }, []);

  if (!GMAPS_ACTIVE_KEY) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        {isNativeAppRuntime()
          ? "Google Maps key is missing. Set `VITE_GOOGLE_MAPS_API_KEY_NATIVE` (or platform-specific `VITE_GOOGLE_MAPS_API_KEY_IOS` / `VITE_GOOGLE_MAPS_API_KEY_ANDROID`)."
          : "Google Maps key is missing. Set `VITE_GOOGLE_MAPS_API_KEY` (and optionally `VITE_GOOGLE_MAPS_API_KEY_DEV` for localhost/ngrok)."}
      </div>
    );
  }

  if (loadError || googleMapsAuthError) {
    if (isNativeAppRuntime()) {
      return (
        <div style={{ padding: 16, fontFamily: "system-ui" }}>
          <div style={{ marginBottom: 8 }}>
            {googleMapsAuthError || "Google Maps failed to load in the native app."}
          </div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            Use a native-safe Google Maps key in `VITE_GOOGLE_MAPS_API_KEY_NATIVE`
            {GMAPS_PLATFORM === "ios"
              ? " or `VITE_GOOGLE_MAPS_API_KEY_IOS`"
              : GMAPS_PLATFORM === "android"
                ? " or `VITE_GOOGLE_MAPS_API_KEY_ANDROID`"
                : ""}
            . Browser referrer-restricted keys usually fail inside Capacitor because the app loads from `capacitor://localhost`.
          </div>
        </div>
      );
    }
    const activeHost = typeof window !== "undefined" ? String(window.location.host || "").trim() : "";
    const referrerHint = activeHost
      ? `${typeof window !== "undefined" ? window.location.protocol : "https:"}//${activeHost}/*`
      : "(your-current-host)/*";
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        <div style={{ marginBottom: 8 }}>
          {googleMapsAuthError || "Google Maps failed to load. Check API key and referrer restrictions."}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Add this referrer in Google Cloud Console for your browser key:
          <div style={{ marginTop: 4, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{referrerHint}</div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <AppLaunchScreen
        eyebrow="Reporting Map"
        title={organizationDisplayName || "CityReport.io"}
        subtitle="Loading map layers, city boundaries, and reporting tools..."
        status="Loading map..."
      />
    );
  }

  return (
    <div
      className="sl-root"
      style={{
        "--sl-mobile-page-enter-x": mobileTabTransitionDirection === "back" ? "-18px" : "18px",
      }}
    >
      {(authGateOpen && !session) ? (
      <Suspense fallback={null}>
        <LazyAuthGateModal
          open={authGateOpen && !session}
          step={authGateStep}
          setStep={setAuthGateStep}
          onContinueGuest={() => {
            setAuthGateOpen(false);
            setAuthGateStep("welcome");
            setSignupLegalAccepted(false);
          }}
          authEmail={authEmail}
          setAuthEmail={setAuthEmail}
          authPassword={authPassword}
          setAuthPassword={setAuthPassword}
          authLoading={authLoading}
          loginError={loginError}
          clearLoginError={() => setLoginError("")}
          onOpenForgotPassword={openForgotPasswordModal}
          onLogin={async () => {
            const ok = await signIn();
            if (!ok) return;

            setAuthGateOpen(false);
            setAuthGateStep("welcome");
          }}
          signupName={signupName}
          setSignupName={setSignupName}
          signupPhone={signupPhone}
          setSignupPhone={setSignupPhone}
          signupEmail={signupEmail}
          setSignupEmail={setSignupEmail}
          signupPassword={signupPassword}
          setSignupPassword={setSignupPassword}
          signupPassword2={signupPassword2}
          setSignupPassword2={setSignupPassword2}
          signupLoading={signupLoading}
          signupLegalAccepted={signupLegalAccepted}
          setSignupLegalAccepted={setSignupLegalAccepted}
          onOpenTerms={() => setTermsOpen(true)}
          onOpenPrivacy={() => setPrivacyOpen(true)}
          onCreateAccount={handleCreateAccount}
          inputStyle={inputStyle}
        />

      </Suspense>
      ) : null}

      {termsOpen ? (
      <Suspense fallback={null}>
        <LazyTermsOfUseModal
          open={termsOpen}
          onClose={() => setTermsOpen(false)}
          btnPrimary={btnPrimary}
        />
      </Suspense>
      ) : null}

      {privacyOpen ? (
      <Suspense fallback={null}>
        <LazyPrivacyPolicyModal
          open={privacyOpen}
          onClose={() => setPrivacyOpen(false)}
          btnPrimary={btnPrimary}
        />
      </Suspense>
      ) : null}

      {forgotPasswordOpen ? (
      <Suspense fallback={null}>
        <LazyForgotPasswordModal
          open={forgotPasswordOpen}
          email={forgotPasswordEmail}
          setEmail={(v) => { setForgotPasswordEmail(v); if (forgotPasswordError) setForgotPasswordError(""); }}
          loading={authResetLoading}
          errorText={forgotPasswordError}
          onSend={sendPasswordReset}
          onClose={() => {
            if (authResetLoading) return;
            setForgotPasswordOpen(false);
            setForgotPasswordError("");
          }}
          inputStyle={inputStyle}
          btnSecondary={btnSecondary}
          btnPrimaryDark={btnPrimaryDark}
        />
      </Suspense>
      ) : null}

      {guestInfoOpen ? (
      <Suspense fallback={null}>
        <LazyGuestInfoModal
          open={guestInfoOpen}
          info={guestInfoDraft}
          setInfo={setGuestInfoDraft}
          onCancel={() => {
            setGuestInfoOpen(false);
            setPendingSubmit(false);
            setPendingGuestAction(null);
          }}
          onContinue={() => {
            setGuestInfo({
              name: String(guestInfoDraft?.name || ""),
              phone: String(guestInfoDraft?.phone || ""),
              email: String(guestInfoDraft?.email || ""),
            });
            guestSubmitBypassRef.current = true;
            setGuestInfoOpen(false);
            setAuthGateOpen(false);
            setAuthGateStep("welcome");
            resumePendingGuestAction();
          }}
          inputStyle={inputStyle}
          btnPrimary={btnPrimary}
          btnSecondary={btnSecondary}
        />
      </Suspense>
      ) : null}

      {showLocationPrompt ? (
      <Suspense fallback={null}>
        <LazyLocationPromptModal
          open={showLocationPrompt}
          onContinue={async () => {
            setShowLocationPrompt(false);
            await findMyLocation(true);
          }}
          btnPrimary={btnPrimary}
        />
      </Suspense>
      ) : null}

      {locationDiagnosticsOpen ? (
      <Suspense fallback={null}>
        <LazyLocationDiagnosticsModal
          open={locationDiagnosticsOpen}
          onClose={() => setLocationDiagnosticsOpen(false)}
          debug={locationDiagnostics}
          onCopy={copyLocationDiagnostics}
          isMobile={isMobile}
          pageTopInset={mobileTabPageTopInset}
          pageBottomInset={mobileReportsPageBottomInset}
        />
      </Suspense>
      ) : null}

      {contactChoiceOpen ? (
      <Suspense fallback={null}>
        <LazyContactRequiredModal
          open={contactChoiceOpen}
          onClose={() => {
            setContactChoiceOpen(false);
            setPendingSubmit(false);
            setPendingGuestAction(null);
          }}
          onLogin={() => {
            setContactChoiceOpen(false);
            setAuthGateStep("login");
            setAuthGateOpen(true);
          }}
          onSignup={() => {
            setContactChoiceOpen(false);
            setAuthGateStep("signup");
            setAuthGateOpen(true);
          }}
          onGuest={() => {
            const pendingKind = String(pendingGuestAction?.kind || "").trim().toLowerCase();
            const fromStreetlightSaveFlow =
              pendingKind === "report" ||
              pendingKind === "bulk" ||
              Boolean(activeLight) ||
              Boolean(bulkConfirmOpen);
            if (fromStreetlightSaveFlow) {
              setContactChoiceOpen(false);
              setPendingSubmit(false);
              setPendingGuestAction(null);
              openNotice("⚠️", "Account required", "Account Required to Save Light");
              return;
            }
            setContactChoiceOpen(false);
            setGuestInfoDraft({
              name: "",
              phone: "",
              email: "",
            });
            setGuestInfoOpen(true);
          }}
          btnPrimary={btnPrimary}
          btnSecondary={btnSecondary}
          btnPrimaryDark={btnPrimaryDark}
        />
      </Suspense>
      ) : null}

      {infoMenuOpen ? (
      <Suspense fallback={null}>
        <LazyInfoMenuModal
          open={infoMenuOpen}
          onClose={() => setInfoMenuOpen(false)}
          isAdmin={isAdmin}
          onOpenTerms={() => {
            setInfoMenuOpen(false);
            setTermsOpen(true);
          }}
          onOpenPrivacy={() => {
            setInfoMenuOpen(false);
            setPrivacyOpen(true);
          }}
          showCitySwitcher={false}
          currentCityLabel={organizationDisplayName}
          currentTenantKey={tenant?.tenantKey || activeTenantKey() || ""}
          environmentGuardrailLabel={environmentGuardrailLabel}
          signedIn={Boolean(session?.user?.id)}
          onOpenCitySwitcher={() => {
            setInfoMenuOpen(false);
            void tenant?.ensureAvailableTenantsLoaded?.();
            setCitySwitcherOpen(true);
          }}
          appVersion={APP_VERSION}
          streetlightIconSrc={String(
            RUNTIME_DOMAIN_META.iconSrcByDomain.get("streetlights")
            || defaultIconSrcForDomain("streetlights")
            || UI_ICON_SRC.streetlight
            || ""
          ).trim()}
          streetlightMarkerColor={defaultMarkerColorForDomain("streetlights")}
          streetlightHighConfidenceColor={resolveHighConfidenceMarkerColorForDomain("streetlights")}
          mapMarkerSize={MAP_MARKER_SIZE}
          mapMarkerStroke={MAP_MARKER_STROKE}
          mapMarkerGlyphSize={MAP_MARKER_GLYPH_SIZE}
          incidentDomainIconSize={INCIDENT_DOMAIN_ICON_SIZE}
        />
      </Suspense>
      ) : null}

      {citySwitcherOpen ? (
      <Suspense fallback={null}>
        <LazyCitySwitcherModal
          open={citySwitcherOpen}
          onClose={() => setCitySwitcherOpen(false)}
          cities={tenant?.availableTenants || []}
          sessionUserId={session?.user?.id || ""}
          supabase={supabase}
          currentTenantKey={tenant?.tenantKey || ""}
          currentCityLabel={organizationDisplayName}
          switchingTenant={tenant?.switchingTenant || ""}
          onSwitchTenant={async (nextTenantKey) => {
            closeAnyPopup();
            setCitySwitcherOpen(false);
            setInfoMenuOpen(false);
            await tenant?.switchTenant?.(nextTenantKey);
          }}
          inputStyle={inputStyle}
          btnSecondary={btnSecondary}
        />
      </Suspense>
      ) : null}

      {notice.open ? (
      <Suspense fallback={null}>
        <LazyNoticeModal
          open={notice.open}
          icon={notice.icon}
          iconKey={notice.iconKey}
          title={notice.title}
          message={notice.message}
          compact={notice.compact}
          buttonText="OK"
          onClose={closeNotice}
        />
      </Suspense>
      ) : null}

      {reportSuccess.open ? (
      <Suspense fallback={null}>
        <LazyReportSuccessModal
          open={reportSuccess.open}
          kind={reportSuccess.kind}
          domainKey={reportSuccess.domainKey}
          title={reportSuccess.title}
          message={reportSuccess.message}
          reportNumbers={reportSuccess.reportNumbers}
          submittedAt={reportSuccess.submittedAt}
          onClose={() => {
            closeReportSuccess();
          }}
          onViewReports={() => {
            const domainKey = String(
              reportSuccess.domainKey
              || preferredInitialDomainKey(visibleDomainOptions)
              || "streetlights"
            ).trim() || "streetlights";
            closeReportSuccess();
            openMyReports({ domainKey, reportedByMode: "me", inViewOnly: false });
          }}
          onReportToUtility={() => {
            closeReportSuccess();
            openMyReports({ domainKey: "streetlights", reportedByMode: "me", inViewOnly: false });
            void loadPlatformExternalModule().then(({ openExternalUrl }) => openExternalUrl(STREETLIGHT_UTILITY_REPORT_URL));
          }}
        />
      </Suspense>
      ) : null}

      {Boolean(domainDisclosureGateTarget) ? (
      <Suspense fallback={null}>
        <LazyDomainDisclosureGateModal
          open={Boolean(domainDisclosureGateTarget)}
          domain={domainDisclosureGateTarget?.domain || ""}
          domainLabel={domainDisclosureGateTarget?.domainLabel || "this issue"}
          acknowledgements={domainDisclosureAcknowledgements}
          setAcknowledgements={setDomainDisclosureAcknowledgements}
          onCancel={() => {
            setDomainDisclosureGateTarget(null);
            resetIncidentDomainReportDraft("");
          }}
          onContinue={continueDomainReportAfterDisclosureGate}
        />
      </Suspense>
      ) : null}

      {(Boolean(activeLight) || bulkConfirmOpen) ? (
      <Suspense fallback={null}>
        <LazyConfirmReportModal
          open={Boolean(activeLight) || bulkConfirmOpen}
          onCancel={() => {
            if (saving) return;

            // close single
            setActiveLight(null);
            setPicked(null);
            setNote("");
            setStreetlightAreaPowerOn("");
            setStreetlightHazardYesNo("");

            // close bulk
            setBulkConfirmOpen(false);
          }}
          onConfirm={() => {
            if (bulkConfirmOpen) submitBulkReports();
            else submitReport();
          }}
          reportType={reportType}
          setReportType={setReportType}
          note={note}
          setNote={setNote}
          areaPowerOn={streetlightAreaPowerOn}
          setAreaPowerOn={setStreetlightAreaPowerOn}
          hazardYesNo={streetlightHazardYesNo}
          setHazardYesNo={setStreetlightHazardYesNo}
          saving={saving}
          titleLabel={bulkConfirmOpen ? "Save selected lights?" : "Save this light?"}
          confirmLabel={bulkConfirmOpen ? "Save lights" : "Save light"}
        />
      </Suspense>
      ) : null}

      {Boolean(domainReportTarget) ? (
      <Suspense fallback={null}>
        <LazyDomainReportModal
          open={Boolean(domainReportTarget)}
          domain={domainReportTarget?.domain || ""}
          domainLabel={domainReportTarget?.domainLabel || "Issue"}
          locationLabel={domainReportTarget?.locationLabel || ""}
          note={domainReportNote}
          setNote={setDomainReportNote}
          issueValue={domainReportIssue}
          setIssueValue={setDomainReportIssue}
          typeSelections={domainReportTypeSelections}
          setTypeSelections={setDomainReportTypeSelections}
          acknowledgements={domainDisclosureAcknowledgements}
          setAcknowledgements={setDomainDisclosureAcknowledgements}
          imageFile={domainReportImageFile}
          imagePreviewUrl={domainReportImagePreviewUrl}
          setImageFile={setDomainReportImageFile}
          saving={saving}
          onCancel={() => {
            setDomainReportTarget(null);
            setDomainDisclosureGateTarget(null);
            resetIncidentDomainReportDraft("");
          }}
          onSubmit={submitDomainReport}
          btnPrimary={btnPrimary}
          btnSecondary={btnSecondary}
        />
      </Suspense>
      ) : null}

      {incidentTypePickerOpen ? (
      <Suspense fallback={null}>
        <LazyIncidentTypePickerModal
          open={incidentTypePickerOpen}
          onClose={closeIncidentTypePicker}
          options={residentIncidentPickerOptions}
          onSelectOption={(domainKey) => {
            if (Date.now() - Number(incidentTypePickerOpenedAt || 0) < 250) return;
            const target = pendingIncidentTypeTarget;
            closeIncidentTypePicker();
            if (!target) return;
            void startIncidentReportAtPoint(domainKey, target.lat, target.lng, { domainExplicitlySelected: true, fromMapTap: true });
          }}
          btnSecondary={btnSecondary}
        />
      </Suspense>
      ) : null}

      {shouldMountAuthBootstrapController ? (
        <Suspense fallback={null}>
          <LazyMapAuthBootstrapController
            shouldHydrateMapAuthEagerly={shouldHydrateMapAuthEagerly}
            hydrateImmediately={shouldWaitForAuthBeforePublicMapLoad}
            supabase={supabase}
            sessionUserId={session?.user?.id || ""}
            authReady={authReady}
            openNotice={openNotice}
            setSession={setSession}
            setAuthReady={setAuthReady}
            setAccountView={setAccountView}
            setAccountMenuOpen={setAccountMenuOpen}
            setAuthGateOpen={setAuthGateOpen}
            setAuthGateStep={setAuthGateStep}
            setForgotPasswordOpen={setForgotPasswordOpen}
            setRecoveryPasswordValue={setRecoveryPasswordValue}
            setRecoveryPasswordValue2={setRecoveryPasswordValue2}
            setRecoveryPasswordOpen={setRecoveryPasswordOpen}
            publicAppOnboardingPendingAuthKey={PUBLIC_APP_ONBOARDING_PENDING_AUTH_KEY}
            publicAccountDeletePendingAuthKey={PUBLIC_ACCOUNT_DELETE_PENDING_AUTH_KEY}
            readDeleteAccountDeepLinkRequest={readDeleteAccountDeepLinkRequest}
            clearDeleteAccountQuery={clearDeleteAccountQuery}
            openDeleteAccountFlow={openDeleteAccountFlow}
          />
        </Suspense>
      ) : null}

      {shouldMountAbuseSummaryController ? (
        <Suspense fallback={null}>
          <LazyMapAbuseSummaryController
            isAdmin={isAdmin}
            adminToolboxOpen={adminToolboxOpen}
            moderationFlagsOpen={moderationFlagsOpen}
            startupWarmupReady={startupWarmupReady}
            supabase={supabase}
            setOpenAbuseFlagSummary={setOpenAbuseFlagSummary}
            abuseFlagBannerShownRef={abuseFlagBannerShownRef}
            isExpectedPermissionError={isExpectedPermissionError}
          />
        </Suspense>
      ) : null}

      {shouldMountTenantRuntimeController ? (
        <Suspense fallback={null}>
          <LazyMapTenantRuntimeController
            loading={loading}
            nonCriticalStartupReady={nonCriticalStartupReady}
            startupWarmupReady={startupWarmupReady}
            mapInteracting={mapInteracting}
            tenantReady={tenant?.ready}
            sessionUserId={session?.user?.id || ""}
            resolvedTenantDomainConfigTenantKey={resolvedTenantDomainConfigTenantKey}
            tenantScopedReadClient={tenantScopedReadClient}
            supabase={supabase}
            enableTenantVisibilityConfig={ENABLE_TENANT_VISIBILITY_CONFIG}
            setTenantVisibilityByDomain={setTenantVisibilityByDomain}
            setTenantVisibilityLoaded={setTenantVisibilityLoaded}
            resolvedTenantMapFeaturesTenantKey={resolvedTenantMapFeaturesTenantKey}
            authReady={publicReadAccessReady}
            activeTenantKey={activeTenantKey}
            getSupabaseTenantKey={getSupabaseTenantKey}
            createTenantScopedReadClient={createTenantScopedReadClient}
            defaultTenantMapFeatures={DEFAULT_TENANT_MAP_FEATURES}
            tenantMapFeaturesSourceRef={tenantMapFeaturesSourceRef}
            setTenantMapFeatures={setTenantMapFeatures}
            setTenantMapFeaturesLoaded={setTenantMapFeaturesLoaded}
            pushTenantBoundaryDiagnostic={pushTenantBoundaryDiagnostic}
            summarizeTenantMapFeaturesRow={summarizeTenantMapFeaturesRow}
            sessionAccessToken={session?.access_token || ""}
            tenantTenantKey={tenant?.tenantKey || ""}
            tenantConfigTenantKey={tenant?.tenantConfig?.tenant_key || ""}
            shouldPrioritizeTenantParksLoad={shouldPrioritizeTenantParksLoad}
            tenantParksLoaded={tenantParksLoaded}
            loadTenantParksNow={loadTenantParksNow}
          />
        </Suspense>
      ) : null}

      {shouldMountAccountAccessController ? (
        <Suspense fallback={null}>
          <LazyMapAccountAccessController
            session={session}
            sessionUserId={session?.user?.id || ""}
            tenantKey={activeTenantKey()}
            nonCriticalStartupReady={nonCriticalStartupReady}
            authGateOpen={authGateOpen}
            authGateStep={authGateStep}
            useAppShellLayout={useAppShellLayout}
            accountMenuOpen={accountMenuOpen}
            adminDomainMenuOpen={adminDomainMenuOpen}
            showNotificationPreferencesEntry={showNotificationPreferencesEntry}
            notificationPreferencesOpen={notificationPreferencesOpen}
            activeMapLayerKey={activeMapLayerKey}
            incidentLayerDomainOptionCount={incidentLayerDomainOptions.length}
            manageOpen={manageOpen}
            profile={profile}
            desktopAccountMenuAnchorRef={desktopAccountMenuAnchorRef}
            desktopAccountMenuPanelRef={desktopAccountMenuPanelRef}
            domainMenuAnchorRef={domainMenuAnchorRef}
            domainMenuPanelRef={domainMenuPanelRef}
            shouldLoadAdminStateEagerly={shouldLoadAdminStateEagerly}
            shouldLoadReportAccessEagerly={shouldLoadReportAccessEagerly}
            shouldLoadProfileEagerly={shouldLoadProfileEagerly}
            supabase={supabase}
            isExpectedPermissionError={isExpectedPermissionError}
            isMissingFunctionError={isMissingFunctionError}
            buildProfileFallbackFromSession={buildProfileFallbackFromSession}
            setIsAdmin={setIsAdmin}
            setAdminStateResolved={setAdminStateResolved}
            setCanAccessAdminReports={setCanAccessAdminReports}
            setCanAccessDomainReports={setCanAccessDomainReports}
            setCanEditDomainReports={setCanEditDomainReports}
            setReportAccessResolved={setReportAccessResolved}
            setProfile={setProfile}
            setAccountView={setAccountView}
            setAccountMenuOpen={setAccountMenuOpen}
            setLoginError={setLoginError}
            setSignupLegalAccepted={setSignupLegalAccepted}
            setTermsOpen={setTermsOpen}
            setPrivacyOpen={setPrivacyOpen}
            setSavedNotificationPreferencesByTopic={setSavedNotificationPreferencesByTopic}
            setAdminDomainMenuOpen={setAdminDomainMenuOpen}
            setNotificationPreferencesOpen={setNotificationPreferencesOpen}
            setMobileIncidentDomainMenuOpen={setMobileIncidentDomainMenuOpen}
            setManageForm={setManageForm}
          />
        </Suspense>
      ) : null}

      {shouldMountResidentFeedBadgeController ? (
        <Suspense fallback={null}>
          <LazyResidentFeedBadgeController
            authReady={authReady}
            tenantReady={tenant?.ready !== false}
            loading={loading}
            startupWarmupReady={startupWarmupReady}
            showMapNotificationsIcon={showMapNotificationsIcon}
            resolvedCommunityFeedTenantKey={resolvedCommunityFeedTenantKey}
            currentTenantKey={tenant?.tenantKey || resolvedCommunityFeedTenantKey}
            supabase={supabase}
            communityFeedViewerUserId={communityFeedViewerUserId}
            communityFeedViewerKey={communityFeedViewerKey}
            sessionAccessToken={session?.access_token || ""}
            mapCommunityFeedReadKey={MAP_COMMUNITY_FEED_READ_KEY}
            mapCommunityFeedRemoteTable={MAP_COMMUNITY_FEED_REMOTE_TABLE}
            tenantScopedReadClient={tenantScopedReadClient}
            createTenantScopedAuthedClient={createTenantScopedAuthedClient}
            createTenantScopedReadClient={createTenantScopedReadClient}
            mapCommunityFeedRequestSeqRef={mapCommunityFeedRequestSeqRef}
            residentFeedRuntimeReady={residentFeedRuntimeReady}
            residentFeedRuntimeSupport={residentFeedRuntimeSupport}
            setResidentFeedRuntimeSupport={setResidentFeedRuntimeSupport}
            mapCommunityAlerts={mapCommunityAlerts}
            setMapCommunityAlerts={setMapCommunityAlerts}
            mapCommunityEvents={mapCommunityEvents}
            setMapCommunityEvents={setMapCommunityEvents}
            savedNotificationPreferencesByTopic={savedNotificationPreferencesByTopic}
            notificationTopics={notificationTopics}
            mapCommunityFeedReadState={mapCommunityFeedReadState}
            setMapCommunityFeedReadState={setMapCommunityFeedReadState}
            residentNotificationLocations={residentNotificationLocations}
            residentNotificationsRefreshToken={residentNotificationsRefreshToken}
            communityFeedEditorOpen={communityFeedEditor.open}
            notificationsWindowOpen={notificationsWindowOpen}
            notificationPreferencesOpen={notificationPreferencesOpen}
            alertsWindowOpen={alertsWindowOpen}
            eventsWindowOpen={eventsWindowOpen}
            mapCommunityFeedLoading={mapCommunityFeedLoading}
            pendingResidentNotificationTarget={pendingResidentNotificationTarget}
            setResidentNotificationLocations={setResidentNotificationLocations}
            setResidentNotificationsRefreshToken={setResidentNotificationsRefreshToken}
            setFocusedResidentAlertId={setFocusedResidentAlertId}
            setFocusedResidentEventId={setFocusedResidentEventId}
            setPendingResidentNotificationTarget={setPendingResidentNotificationTarget}
            setAlertsWindowOpen={setAlertsWindowOpen}
            setEventsWindowOpen={setEventsWindowOpen}
            setNotificationsWindowOpen={setNotificationsWindowOpen}
            setAccountMenuOpen={setAccountMenuOpen}
            setMobileHeaderMenuOpen={setMobileHeaderMenuOpen}
            setAdminDomainMenuOpen={setAdminDomainMenuOpen}
            setAdminToolboxOpen={setAdminToolboxOpen}
            setMyReportsOpen={setMyReportsOpen}
            setOpenReportsOpen={setOpenReportsOpen}
            setAlertsSessionNewKeys={setAlertsSessionNewKeys}
            setEventsSessionNewKeys={setEventsSessionNewKeys}
            setMapCommunityTopics={setMapCommunityTopics}
            setMapCommunityFeedLoading={setMapCommunityFeedLoading}
            setMapCommunityFeedError={setMapCommunityFeedError}
            alertsFeedMarkedForOpenRef={alertsFeedMarkedForOpenRef}
            eventsFeedMarkedForOpenRef={eventsFeedMarkedForOpenRef}
            nativePushEnabled={NATIVE_PUSH_ENABLED}
            nativePushShouldRegister={nativePushShouldRegister}
            nativePushRegisteringRef={nativePushRegisteringRef}
            nativePushRegisteredKey={NATIVE_PUSH_REGISTERED_KEY}
            tenantSwitch={tenant?.switchTenant}
            isMissingFunctionError={isMissingFunctionError}
            isMissingRelationError={isMissingRelationError}
            isExpectedPermissionError={isExpectedPermissionError}
            scheduleDeferredWarmup={scheduleDeferredWarmup}
            onBadgeCountsChange={setResidentFeedBadgeCounts}
            onResidentFeedApiChange={setResidentFeedControllerApi}
          />
        </Suspense>
      ) : null}

      {shouldMountIncidentRepairProgressController ? (
        <Suspense fallback={null}>
          <LazyMapIncidentRepairProgressController
            tenantKey={tenant?.tenantKey || ""}
            activeTenantKeyValue={activeTenantKey()}
            viewerIdentityKey={viewerIdentityKey}
            shouldHydrateIncidentRepairProgress={shouldHydrateIncidentRepairProgress}
            incidentRepairProgressReadyForContext={incidentRepairProgressReadyForContext}
            incidentRepairProgressAttemptedContextKey={incidentRepairProgressAttemptedContextKey}
            incidentRepairProgressContextKey={incidentRepairProgressContextKey}
            refreshIncidentRepairProgress={refreshIncidentRepairProgress}
            supabase={supabase}
            loadPersistedIncidentRepairConfirmedKeysDeferred={loadPersistedIncidentRepairConfirmedKeysDeferred}
            setPersistedIncidentRepairConfirmedKeySet={setPersistedIncidentRepairConfirmedKeySet}
            setIncidentRepairProgressAttemptedContextKey={setIncidentRepairProgressAttemptedContextKey}
            setIncidentRepairProgressReadyContextKey={setIncidentRepairProgressReadyContextKey}
            setIncidentRepairProgressByKey={setIncidentRepairProgressByKey}
          />
        </Suspense>
      ) : null}

      {shouldMountWorkspaceHost ? (
        <Suspense fallback={null}>
        <LazyMapWorkspaceHost
          secondaryVisible={secondaryWorkspaceVisible}
          markWorkingConfirmOpen={isWorkingConfirmOpen}
          pendingWorkingLightId={pendingWorkingLightId}
          setPendingWorkingLightId={setPendingWorkingLightId}
          setIsWorkingConfirmOpen={setIsWorkingConfirmOpen}
          submitIsWorking={submitIsWorking}
          incidentRepairConfirmOpen={incidentRepairConfirmOpen}
          pendingIncidentRepairId={pendingIncidentRepairId}
          pendingIncidentRepairDomainKey={pendingIncidentRepairDomainKey}
          closeIncidentRepairConfirmDialog={closeIncidentRepairConfirmDialog}
          submitIncidentRepairConfirmation={submitIncidentRepairConfirmation}
          utilityReportDialogOpen={utilityReportDialogOpen}
          pendingUtilityReportReference={pendingUtilityReportReference}
          setPendingUtilityReportReference={setPendingUtilityReportReference}
          pendingUtilityReportLightId={pendingUtilityReportLightId}
          closeUtilityReportDialog={closeUtilityReportDialog}
          markUtilityReportedForViewer={markUtilityReportedForViewer}
          openConfiguredNotice={openConfiguredNotice}
          markFixedConfirmOpen={markFixedConfirmOpen}
          pendingIncidentLabel={pendingIncidentLabel}
          pendingIncidentCurrentState={pendingIncidentCurrentState}
          pendingIncidentDomainKey={pendingIncidentDomainKey}
          pendingIncidentNextState={pendingIncidentNextState}
          setPendingIncidentNextState={setPendingIncidentNextState}
          setPendingIncidentActionType={setPendingIncidentActionType}
          markFixedNote={markFixedNote}
          setMarkFixedNote={setMarkFixedNote}
          markFixedSubmitting={markFixedSubmitting}
          markFixedImageFile={markFixedImageFile}
          markFixedImagePreviewUrl={markFixedImagePreviewUrl}
          setMarkFixedImageFile={setMarkFixedImageFile}
          pendingIncidentPin={pendingIncidentPin}
          setPendingIncidentPin={setPendingIncidentPin}
          pendingIncidentStatusError={pendingIncidentStatusError}
          setPendingIncidentStatusError={setPendingIncidentStatusError}
          submitPendingIncidentAction={submitPendingIncidentAction}
          resetMarkFixedDialogState={resetMarkFixedDialogState}
          moderationFlagsOpen={moderationFlagsOpen}
          setModerationFlagsOpen={setModerationFlagsOpen}
          isAdmin={isAdmin}
          loadOpenAbuseFlagSummary={loadOpenAbuseFlagSummary}
          isMobile={isMobile}
          mobileTabPageTopInset={mobileTabPageTopInset}
          mobileReportsPageBottomInset={mobileReportsPageBottomInset}
          notificationsWindowOpen={notificationsWindowOpen}
          setNotificationsWindowOpen={setNotificationsWindowOpen}
          residentFeedRuntimeReady={residentFeedRuntimeReady}
          showMapNotificationsIcon={showMapNotificationsIcon}
          setResidentNotificationLocations={setResidentNotificationLocations}
          residentNotificationsRefreshToken={residentNotificationsRefreshToken}
          prefersDarkMode={prefersDarkMode}
          useAppShellLayout={useAppShellLayout}
          openResidentNotificationTarget={openResidentNotificationTarget}
          supabase={supabase}
          authReady={authReady}
          tenantReady={tenant?.ready !== false}
          resolvedCommunityFeedTenantKey={resolvedCommunityFeedTenantKey}
          communityFeedViewerKey={communityFeedViewerKey}
          residentFeedRuntimeSupport={residentFeedRuntimeSupport}
          isMissingFunctionError={isMissingFunctionError}
          isMissingRelationError={isMissingRelationError}
          isExpectedPermissionError={isExpectedPermissionError}
          alertsWindowOpen={alertsWindowOpen}
          setAlertsWindowOpen={setAlertsWindowOpen}
          mapCommunityAlerts={mapCommunityAlerts}
          mapCommunityFeedLoading={mapCommunityFeedLoading}
          mapCommunityFeedError={mapCommunityFeedError}
          alertsSessionNewKeys={alertsSessionNewKeys}
          focusedResidentAlertId={focusedResidentAlertId}
          openCommunityFeedEditor={openCommunityFeedEditor}
          handleResidentAlertVisible={handleResidentAlertVisible}
          eventsWindowOpen={eventsWindowOpen}
          setEventsWindowOpen={setEventsWindowOpen}
          mapCommunityEvents={mapCommunityEvents}
          eventsSessionNewKeys={eventsSessionNewKeys}
          focusedResidentEventId={focusedResidentEventId}
          handleResidentEventVisible={handleResidentEventVisible}
          sessionUserId={session?.user?.id || ""}
          communityFeedEditor={communityFeedEditor}
          mapCommunityTopics={mapCommunityTopics}
          closeCommunityFeedEditor={closeCommunityFeedEditor}
          loadMapCommunityFeed={loadMapCommunityFeed}
          openNotice={openNotice}
          reports={reports}
          officialLights={officialLights}
          slIdByUuid={slIdByUuid}
          fixedLights={fixedLights}
          lastFixByLightId={lastFixByLightId}
          actionsByLightId={actionsByLightId}
          session={session}
          profile={profile}
          incidentStateByKey={incidentStateByKey}
          reportKnownAssetIdSetsByDomain={reportKnownAssetIdSetsByDomain}
          cityBoundaryLoaded={cityLimitPolygons.length > 0}
          isWithinAshtabulaCityLimits={isWithinAshtabulaCityLimits}
          reverseGeocodeRoadLabel={reverseGeocodeRoadLabel}
          handleUtilityReportedChange={handleUtilityReportedChange}
          streetlightConfidenceByLightId={streetlightConfidenceByLightId}
          incidentRepairProgressByKey={incidentRepairProgressByKey}
          persistedIncidentRepairConfirmedKeySet={persistedIncidentRepairConfirmedKeySet}
          canShowPublicRepairAction={canShowPublicRepairAction}
          requestIncidentRepairConfirmation={requestIncidentRepairConfirmation}
          useNativeAppBehavior={useNativeAppBehavior}
          incidentLocationCacheByKey={incidentLocationCacheByKey}
          persistIncidentLocationCacheEntry={persistIncidentLocationCacheEntry}
          isSharedIncidentDomain={isSharedIncidentDomain}
          persistedIncidentRecordStateByDomain={persistedIncidentRecordStateByDomain}
          configuredIncidentSeededByIdByDomain={configuredIncidentSeededByIdByDomain}
          configuredIncidentReportRowsByDomain={configuredIncidentReportRowsByDomain}
          configuredIncidentSeededRowsByDomain={configuredIncidentSeededRowsByDomain}
          viewerIdentityKey={viewerIdentityKey}
          openIncidentStatusDialogForTarget={openIncidentStatusDialogForTarget}
          isTenantAssetBackedDomain={isTenantAssetBackedDomain}
          flyToLightAndOpen={flyToLightAndOpen}
          myReportsOpen={myReportsOpen}
          closeMyReports={closeMyReports}
          myReportsLaunchOptions={myReportsLaunchOptions}
          isReportsAdminView={isReportsAdminView}
          isPublicRepairEnabledForDomain={isPublicRepairEnabledForDomain}
          myReportsDomain={myReportsDomain}
          myReportsAllReportsDomainOptions={myReportsAllReportsDomainOptions}
          setMyReportsDomain={setMyReportsDomain}
          setAdminReportDomain={setAdminReportDomain}
          setMyReportsDomainFilters={setMyReportsDomainFilters}
          myReportsDomainFilters={myReportsDomainFilters}
          toggleMyReportsDomainFilter={toggleMyReportsDomainFilter}
          resetMyReportsDomainFilters={resetMyReportsDomainFilters}
          mapBounds={mapBounds}
          canToggleReportedByInMyReports={canToggleReportedByInMyReports}
          myReportsReportedByMode={myReportsReportedByMode}
          setMyReportsReportedByMode={setMyReportsReportedByMode}
          showAllInMyReports={showAllInMyReports}
          canMutateAnyMyReportsSelection={canMutateAnyMyReportsSelection}
          canManageIncidentDomainRepairs={canManageIncidentDomainRepairs}
          openReportsOpen={openReportsOpen}
          closeOpenReports={closeOpenReports}
          openReportsLaunchOptions={openReportsLaunchOptions}
          isPlatformAdmin={isPlatformAdmin}
          resolvedOpenReportsActiveDomain={resolvedOpenReportsActiveDomain}
          canMutateAnyOpenReportsSelection={canMutateAnyOpenReportsSelection}
          canOpenAdminReports={canOpenAdminReports}
          openReportsDomainOptions={openReportsDomainOptions}
          openReportsDomainFilters={openReportsDomainFilters}
          toggleOpenReportsDomainFilter={toggleOpenReportsDomainFilter}
          resetOpenReportsDomainFilters={resetOpenReportsDomainFilters}
          isTenantOrganizationManagedIncidentDomain={isTenantOrganizationManagedIncidentDomain}
          shouldRenderStreetlightSelectionPopup={shouldRenderStreetlightSelectionPopup}
          bulkMode={bulkMode}
          closeAnyPopup={closeAnyPopup}
          clearUtilityReportedForViewer={clearUtilityReportedForViewer}
          isStreetlightsLayerActive={isStreetlightsLayerActive}
          mappingMode={mappingMode}
          mapCenter={mapCenter}
          mapInteracting={mapInteracting}
          mapZoom={mapZoom}
          openConfirmForLight={openConfirmForLight}
          openMyReports={openMyReports}
          openUtilityReportDialogForLight={openUtilityReportDialogForLight}
          projectPopupPixel={projectPopupPixel}
          selectedOfficialId={selectedOfficialId}
          setDeleteOfficialConfirmOpen={setDeleteOfficialConfirmOpen}
          setOfficialLights={setOfficialLights}
          setPendingDeleteOfficialLightId={setPendingDeleteOfficialLightId}
          setSelectedOfficialId={setSelectedOfficialId}
          viewerSavedStreetlightLightIdSet={viewerSavedStreetlightLightIdSet}
          viewerStreetlightRingOpenIdSet={viewerStreetlightRingOpenIdSet}
          viewerUtilityReportedLightIdSet={viewerUtilityReportedLightIdSet}
          utilityReportReferenceByLightId={utilityReportReferenceByLightId}
          shouldRenderIncidentDomainPopupWorkspace={shouldRenderIncidentDomainPopupWorkspace}
          isOrganizationManagedIncidentDomain={isOrganizationManagedIncidentDomain}
          incidentDomainCanonicalIncidentId={incidentDomainCanonicalIncidentId}
          incidentDrivenRowsByDomain={incidentDrivenRowsByDomain}
          isPublicRepairEnabledForDomainFn={isPublicRepairEnabledForDomain}
          selectedDomainMarker={selectedDomainMarker}
          setPendingDeleteOfficialSignId={setPendingDeleteOfficialSignId}
          setDeleteOfficialSignConfirmOpen={setDeleteOfficialSignConfirmOpen}
          setSelectedDomainMarker={setSelectedDomainMarker}
          adminReportDomain={adminReportDomain}
          getIncidentSnapshot={getIncidentSnapshot}
          resolveIncidentDrivenFixTsForId={resolveIncidentDrivenFixTsForId}
          shouldRenderMapSelectionPopups={shouldRenderMapSelectionPopups}
          mappingQueue={mappingQueue}
          openDomainReportFlow={openDomainReportFlow}
          openIncidentDomainMarker={openIncidentDomainMarker}
          removeFromMappingQueue={removeFromMappingQueue}
          selectedIncidentStackMarker={selectedIncidentStackMarker}
          selectedQueuedTempId={selectedQueuedTempId}
          setSelectedIncidentStackMarker={setSelectedIncidentStackMarker}
          setSelectedQueuedTempId={setSelectedQueuedTempId}
          updateQueuedSignType={updateQueuedSignType}
        />
      </Suspense>
      ) : null}

      {shouldRenderAccountWorkspace ? (
        <Suspense fallback={null}>
          <LazyMapAccountWorkspace
            useAppShellLayout={useAppShellLayout}
            session={session}
            profile={profile}
            tenant={tenant}
            prefersDarkMode={prefersDarkMode}
            mobileTabPageTopInset={mobileTabPageTopInset}
            mobileReportsPageBottomInset={mobileReportsPageBottomInset}
            inputStyle={inputStyle}
            btnPrimary={btnPrimary}
            btnSecondary={btnSecondary}
            btnPrimaryDark={btnPrimaryDark}
            organizationDisplayName={organizationDisplayName}
            headerOrganizationProfile={headerOrganizationProfile}
            sessionUserId={session?.user?.id || ""}
            activeTenantKeyValue={activeTenantKey()}
            supabase={supabase}
            openNotice={openNotice}
            closeAnyPopup={closeAnyPopup}
            accountMenuOpen={accountMenuOpen}
            showNotificationPreferencesEntry={showNotificationPreferencesEntry}
            desktopAccountMenuPanelRef={desktopAccountMenuPanelRef}
            setAccountMenuOpen={setAccountMenuOpen}
            setAccountView={setAccountView}
            setNotificationPreferencesOpen={setNotificationPreferencesOpen}
            setFollowedLocationsOpen={setFollowedLocationsOpen}
            setManageEditing={setManageEditing}
            setManageOpen={setManageOpen}
            openMyReports={openMyReports}
            setInfoMenuOpen={setInfoMenuOpen}
            setCitySwitcherOpen={setCitySwitcherOpen}
            setContactUsOpen={setContactUsOpen}
            signOut={signOut}
            manageOpen={manageOpen}
            manageSaving={manageSaving}
            manageEditing={manageEditing}
            manageForm={manageForm}
            setManageForm={setManageForm}
            saveManagedProfile={saveManagedProfile}
            requestEditManagedProfile={requestEditManagedProfile}
            setChangePasswordValue={setChangePasswordValue}
            setChangePasswordValue2={setChangePasswordValue2}
            setChangePasswordCurrentValue={setChangePasswordCurrentValue}
            setChangePasswordOpen={setChangePasswordOpen}
            openDeleteAccountFlow={openDeleteAccountFlow}
            deleteAccountOpen={deleteAccountOpen}
            deleteAccountSaving={deleteAccountSaving}
            setDeleteAccountOpen={setDeleteAccountOpen}
            setDeleteAccountConfirmText={setDeleteAccountConfirmText}
            setDeleteAccountDisclosureAccepted={setDeleteAccountDisclosureAccepted}
            deleteAccountConfirmText={deleteAccountConfirmText}
            deleteAccountDisclosureAccepted={deleteAccountDisclosureAccepted}
            requestDeleteAccount={requestDeleteAccount}
            reauthOpen={reauthOpen}
            reauthSaving={reauthSaving}
            setReauthOpen={setReauthOpen}
            setReauthPassword={setReauthPassword}
            setReauthIntent={setReauthIntent}
            reauthPassword={reauthPassword}
            confirmReauth={confirmReauth}
            changePasswordOpen={changePasswordOpen}
            changePasswordSaving={changePasswordSaving}
            changePasswordValue={changePasswordValue}
            changePasswordValue2={changePasswordValue2}
            changePasswordCurrentValue={changePasswordCurrentValue}
            handleChangePassword={handleChangePassword}
            recoveryPasswordOpen={recoveryPasswordOpen}
            recoveryPasswordSaving={recoveryPasswordSaving}
            setRecoveryPasswordOpen={setRecoveryPasswordOpen}
            setRecoveryPasswordValue={setRecoveryPasswordValue}
            setRecoveryPasswordValue2={setRecoveryPasswordValue2}
            recoveryPasswordValue={recoveryPasswordValue}
            recoveryPasswordValue2={recoveryPasswordValue2}
            handleRecoveryPasswordUpdate={handleRecoveryPasswordUpdate}
            followedLocationsOpen={followedLocationsOpen}
            notificationPreferencesOpen={notificationPreferencesOpen}
            notificationTopics={notificationTopics}
            savedNotificationPreferencesByTopic={savedNotificationPreferencesByTopic}
            setSavedNotificationPreferencesByTopic={setSavedNotificationPreferencesByTopic}
            contactUsOpen={contactUsOpen}
          />
        </Suspense>
      ) : null}

      {shouldMountRealtimeController ? (
        <Suspense fallback={null}>
          <LazyMapRealtimeController
            reportsAdminView={reportsAdminView}
            isAdmin={isAdmin}
            sessionUserId={session?.user?.id || ""}
            activeTenantKeyValue={activeTenantKey()}
            configuredIncidentDemandDomainKeys={configuredIncidentDemandDomainKeys}
            configuredIncidentRuntimeEntryByDomain={configuredIncidentRuntimeEntryByDomain}
            configuredIncidentPersistedStateSupportedDomainKeys={configuredIncidentPersistedStateSupportedDomainKeys}
            myReportsOpen={myReportsOpen}
            openReportsOpen={openReportsOpen}
            domainReportTarget={domainReportTarget}
            domainDisclosureGateTarget={domainDisclosureGateTarget}
            confirmReportTarget={confirmReportTarget}
            selectedDomainMarker={selectedDomainMarker}
            selectedIncidentStackMarker={selectedIncidentStackMarker}
            shouldForceAdminConfiguredIncidentDomain={shouldForceAdminConfiguredIncidentDomain}
            deferredRealtimeReady={deferredRealtimeReady}
            shouldPrioritizeStreetlightRuntimeStartup={shouldPrioritizeStreetlightRuntimeStartup}
            shouldComputeStreetlightRuntimeState={shouldComputeStreetlightRuntimeState}
            activeMapLayerKey={activeMapLayerKey}
            supabase={supabase}
            loadDeferredConfiguredIncidentStateRuntimeHelpers={loadDeferredConfiguredIncidentStateRuntimeHelpers}
            normalizeDomainKeyOrSlug={normalizeDomainKeyOrSlug}
            normalizeReportQuality={normalizeReportQuality}
            lightIdFor={lightIdFor}
            reportDomainForRow={reportDomainForRow}
            isAssetBackedDomainType={isAssetBackedDomainType}
            resolveRuntimeDomainTypeForMap={resolveRuntimeDomainTypeForMap}
            buildGenericIncidentBaseMarkersForDomain={buildGenericIncidentBaseMarkersForDomain}
            mergeGenericIncidentBaseMarkers={mergeGenericIncidentBaseMarkers}
            officialIdSet={officialIdSet}
            isOutageReportType={isOutageReportType}
            incidentSnapshotKey={incidentSnapshotKey}
            normalizeOfficialLightRow={normalizeOfficialLightRow}
            notifyDbConnectionIssue={notifyDbConnectionIssue}
            resetDbConnectionIssueStreak={resetDbConnectionIssueStreak}
            domainForIncidentId={domainForIncidentId}
            setReports={setReports}
            setSharedIncidentReportRowsStateByDomain={setSharedIncidentReportRowsStateByDomain}
            setSharedIncidentBaseMarkersStateByDomain={setSharedIncidentBaseMarkersStateByDomain}
            setStreetlightOutageTsByLightId={setStreetlightOutageTsByLightId}
            setIncidentStateByKey={setIncidentStateByKey}
            setOfficialLights={setOfficialLights}
            setFixedLights={setFixedLights}
            setActionsByLightId={setActionsByLightId}
            setLastFixByLightId={setLastFixByLightId}
            setPersistedIncidentRecordStateByDomain={setPersistedIncidentRecordStateByDomain}
            setUtilityReportedLightIdSet={setUtilityReportedLightIdSet}
            setUtilityReportReferenceByLightId={setUtilityReportReferenceByLightId}
            setUtilityReportedAtByLightId={setUtilityReportedAtByLightId}
            setUtilitySignalCountsByLightId={setUtilitySignalCountsByLightId}
            getIncidentDomainHelper={getIncidentDomainHelper}
            incidentDomainCanonicalIncidentId={incidentDomainCanonicalIncidentId}
          />
        </Suspense>
      ) : null}

      {/* =========================
          Map (Google Maps)
         ========================= */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          bottom: useAppShellLayout ? mobileBottomRailHeight : 0,
          display: useAppShellLayout && (myReportsOpen || notificationsWindowOpen || accountMenuOpen || alertsWindowOpen || eventsWindowOpen || notificationPreferencesOpen || followedLocationsOpen) ? "none" : "block",
        }}
      >
        <GoogleMap
          key={`tenant-map:${String(tenant?.tenantKey || "unknown").trim().toLowerCase()}:${forceRasterMapCompat || isAppleTouchWeb ? "raster" : "vector"}`}
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={mapZoom}
          onLoad={(map) => {
            setGmapsRef(map);
            mapRef.current = map; // keep your existing ref name working
            setMapTilesReady(false);
          }}
          onTilesLoaded={() => {
            setMapTilesReady(true);
          }}
          onDragStart={handleDeferredMapDragStart}
          onZoomChanged={handleDeferredMapZoomChanged}
          onIdle={handleDeferredMapIdle}
          options={mapOptions}
          onClick={handleGoogleMapClick}
          onDblClick={handleGoogleMapDoubleClick}
        >
        <Suspense fallback={null}>
          <LazyBoundaryAndParksLayer
            showCityOutsideShade={showCityOutsideShade}
            cityOutsideMaskPaths={cityOutsideMaskPaths}
            cityOutsideShadeOpacity={cityOutsideShadeOpacity}
            showCityBoundaryBorder={showCityBoundaryBorder}
            cityBoundaryOuterRings={cityBoundaryOuterRings}
            cityBoundaryBorderColor={cityBoundaryBorderColor}
            cityBoundaryBorderWidth={cityBoundaryBorderWidth}
            tenantParksLoaded={tenantParksLoaded}
            tenantParkVisuals={tenantParkVisuals}
          />
        </Suspense>
        {userLoc ? (
          <Suspense fallback={null}>
            <LazySmoothUserMarker
              position={{ lat: userLoc[0], lng: userLoc[1] }}
              heading={userHeading}
              travelFollowMode={travelFollowMode}
            />
          </Suspense>
        ) : null}
        {/* Canvas overlay replaces thousands of MarkerF nodes for smoother pan/zoom */}
        {gmapsRef ? (
          <Suspense fallback={null}>
            <LazyOfficialLightsCanvasOverlay
              ref={officialCanvasOverlayRef}
              map={gmapsRef}
              show={showOfficialLights && !mapInteracting}
              lights={visibleOfficialLights}
              bulkMode={bulkMode}
              bulkSelectedSet={bulkSelectedSet}
              getMarkerColor={officialMarkerColorForViewer}
              getMarkerRingColor={officialMarkerRingColorForViewer}
              getMarkerPresentation={officialMarkerPresentationForViewer}
              glyphSrc={resolveVisibleDomainIconSrc("streetlights", UI_ICON_SRC.streetlight)}
            />
          </Suspense>
        ) : null}
        {deleteCircleMode && isAdmin && deleteCircleDraft?.center && (
          <CircleF
            center={deleteCircleDraft.center}
            radius={Math.max(2, Number(deleteCircleDraft.radiusMeters || 0))}
            options={{
              clickable: false,
              draggable: false,
              editable: false,
              strokeColor: "#ff1744",
              strokeOpacity: 0.95,
              strokeWeight: 2,
              fillColor: "#ff1744",
              fillOpacity: 0.12,
              zIndex: 2100,
            }}
          />
        )}

        <Suspense fallback={null}>
          <LazyIncidentDomainMarkersLayer
            activeMapLayerKey={activeMapLayerKey}
            adminReportDomain={adminReportDomain}
            markers={displayedDomainMarkers}
            mappingMode={mappingMode}
            isAdmin={isAdmin}
            queuedMarkers={mappingQueue}
            adminDomainMetaIcon={adminDomainMeta.icon}
            adminDomainMetaIconSrc={adminDomainMeta.iconSrc}
            defaultMarkerColorForDomain={defaultMarkerColorForDomain}
            defaultMarkerGlyphForDomain={defaultMarkerGlyphForDomain}
            defaultMarkerGlyphSrcForDomain={defaultMarkerGlyphSrcForDomain}
            domainMarkerColor={domainMarkerColor}
            fallbackIconSrc={UI_ICON_SRC.streetlight}
            normalizeDomainKeyOrSlug={normalizeDomainKeyOrSlug}
            resolveDomainMarkerIconPresentation={resolveDomainMarkerIconPresentation}
            resolveVisibleDomainIconSrc={resolveVisibleDomainIconSrc}
            onIncidentMarkerClick={handleDisplayedDomainMarkerClick}
            onQueuedMarkerClick={handleQueuedPreviewMarkerClick}
          />
        </Suspense>

        </GoogleMap>
      </div>

      {mapLoadingMessage && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            top: useAppShellLayout
              ? mobileTabPageTopInset
              : "calc(var(--desktop-header-height) + 14px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2350,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 999,
            color: "var(--sl-ui-text)",
            background: "color-mix(in srgb, var(--sl-ui-surface-bg) 92%, transparent)",
            border: "1px solid var(--sl-ui-surface-border)",
            boxShadow: "0 8px 22px rgba(0,0,0,0.22)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            fontSize: useAppShellLayout ? 12 : 13,
            fontWeight: 850,
            letterSpacing: 0.15,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "#28c39a",
              boxShadow: "0 0 0 5px rgba(40,195,154,0.18)",
            }}
          />
          {mapLoadingMessage}
        </div>
      )}

      {/* =========================
          Floating tool buttons (mobile + desktop)
         ========================= */}
      <div className="sl-map-tool">
        {!!toolHintText && !useAppShellLayout && (
          <div
            style={{
              position: "absolute",
              right: "calc(100% + 10px)",
              top: `${(Number.isFinite(toolHintIndex) ? toolHintIndex : 0) * 56 + 24}px`,
              transform: "translateY(-50%)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <div className="sl-map-tool-hint">{toolHintText}</div>
          </div>
        )}

        {!useAppShellLayout ? (
          <Suspense fallback={null}>
            <LazyMapDesktopMapControls
              mapType={mapType}
              setMapType={setMapType}
              showToolHint={showToolHint}
              prefersDarkMode={prefersDarkMode}
              setTravelFollowMode={setTravelFollowMode}
              followHeadingEnabledRef={followHeadingEnabledRef}
              mapRef={mapRef}
              locating={locating}
              geoDenied={geoDenied}
              setShowLocationPrompt={setShowLocationPrompt}
              findMyLocation={findMyLocation}
              travelFollowMode={travelFollowMode}
              toggleTravelFollowMode={toggleTravelFollowMode}
              setAutoFollow={setAutoFollow}
              setFollowCamera={setFollowCamera}
              recenterToTenantHome={recenterToTenantHome}
              incidentLayerButtonEnabled={incidentLayerButtonEnabled}
              incidentLayerDomainOptions={incidentLayerDomainOptions}
              domainMenuAnchorRef={domainMenuAnchorRef}
              adminDomainMenuOpen={adminDomainMenuOpen}
              activeMapLayerKey={activeMapLayerKey}
              resolvedIncidentLayerOption={resolvedIncidentLayerOption}
              requestMapLayerSwitch={requestMapLayerSwitch}
              setAdminDomainMenuOpen={setAdminDomainMenuOpen}
              setAdminToolboxOpen={setAdminToolboxOpen}
              hasExplicitIncidentMapFilter={hasExplicitIncidentMapFilter}
              activeIncidentMapFilterKeys={activeIncidentMapFilterKeys}
              domainMenuPanelRef={domainMenuPanelRef}
              allIncidentReportsOptionEnabled={allIncidentReportsOptionEnabled}
              resetIncidentMapFilter={resetIncidentMapFilter}
              toggleIncidentMapDomainFilter={toggleIncidentMapDomainFilter}
              webStreetlightsPrimaryOption={webStreetlightsPrimaryOption}
              canUseStreetlightBulk={canUseStreetlightBulk}
              bulkMode={bulkMode}
              setBulkConfirmOpen={setBulkConfirmOpen}
              setBulkMode={setBulkMode}
              setDeleteCircleMode={setDeleteCircleMode}
              setDeleteCircleDraft={setDeleteCircleDraft}
              setDeleteCircleConfirmOpen={setDeleteCircleConfirmOpen}
              setSelectedOfficialId={setSelectedOfficialId}
              setMappingMode={setMappingMode}
              setMappingQueue={setMappingQueue}
              closeAnyPopup={closeAnyPopup}
              suppressPopupsSafe={suppressPopupsSafe}
              clearBulkSelection={clearBulkSelection}
              canOpenDomainReports={canOpenDomainReports}
              openReportsOpen={openReportsOpen}
              mappingMode={mappingMode}
              requestExitMappingMode={requestExitMappingMode}
              setNotificationsWindowOpen={setNotificationsWindowOpen}
              setAlertsWindowOpen={setAlertsWindowOpen}
              setEventsWindowOpen={setEventsWindowOpen}
              openOpenReports={openOpenReports}
            />
          </Suspense>
        ) : null}

        {shouldMountDesktopAdminControls ? (
          <Suspense fallback={null}>
            <LazyMapDesktopAdminControls
              deferredDialogsVisible={desktopAdminDeferredDialogsVisible}
              exitMappingConfirmOpen={exitMappingConfirmOpen}
              mappingQueueLength={mappingQueue.length}
              saving={saving}
              confirmMappingQueue={confirmMappingQueue}
              setExitMappingConfirmOpen={setExitMappingConfirmOpen}
              exitMappingMode={exitMappingMode}
              clearQueuedConfirmOpen={clearQueuedConfirmOpen}
              confirmClearQueuedLights={confirmClearQueuedLights}
              setClearQueuedConfirmOpen={setClearQueuedConfirmOpen}
              domainSwitchConfirmOpen={domainSwitchConfirmOpen}
              pendingDomainSwitchTarget={pendingDomainSwitchTarget}
              placeQueuedAndSwitchDomain={placeQueuedAndSwitchDomain}
              clearQueuedAndSwitchDomain={clearQueuedAndSwitchDomain}
              cancelAdminDomainSwitch={cancelAdminDomainSwitch}
              queueSignTypeOpen={queueSignTypeOpen}
              pendingQueuedSign={pendingQueuedSign}
              setPendingQueuedSign={setPendingQueuedSign}
              confirmQueueOfficialSign={confirmQueueOfficialSign}
              cancelQueueOfficialSign={cancelQueueOfficialSign}
              prefersDarkMode={prefersDarkMode}
              deleteCircleConfirmOpen={deleteCircleConfirmOpen}
              deleteCircleCandidateIds={deleteCircleCandidateIds}
              deleteCircleNote={deleteCircleNote}
              setDeleteCircleNote={setDeleteCircleNote}
              markIncidentsFixedByIds={markIncidentsFixedByIds}
              setDeleteCircleConfirmOpen={setDeleteCircleConfirmOpen}
              setDeleteCircleDraft={setDeleteCircleDraft}
              deleteOfficialConfirmOpen={deleteOfficialConfirmOpen}
              pendingDeleteOfficialLightId={pendingDeleteOfficialLightId}
              setDeleteOfficialConfirmOpen={setDeleteOfficialConfirmOpen}
              setPendingDeleteOfficialLightId={setPendingDeleteOfficialLightId}
              deleteOfficialLight={deleteOfficialLight}
              closeAnyPopup={closeAnyPopup}
              deleteOfficialSignConfirmOpen={deleteOfficialSignConfirmOpen}
              pendingDeleteOfficialSignId={pendingDeleteOfficialSignId}
              setDeleteOfficialSignConfirmOpen={setDeleteOfficialSignConfirmOpen}
              setPendingDeleteOfficialSignId={setPendingDeleteOfficialSignId}
              deleteOfficialSign={deleteOfficialSign}
              useAppShellLayout={useAppShellLayout}
              isAdmin={isAdmin}
              showAdminTools={showAdminTools}
              adminToolboxOpen={adminToolboxOpen}
              setAdminToolboxOpen={setAdminToolboxOpen}
              setAdminDomainMenuOpen={setAdminDomainMenuOpen}
              showToolHint={showToolHint}
              isStreetlightsLayerActive={isStreetlightsLayerActive}
              deleteCircleMode={deleteCircleMode}
              setDeleteCircleMode={setDeleteCircleMode}
              setMappingMode={setMappingMode}
              setMappingQueue={setMappingQueue}
              setBulkMode={setBulkMode}
              setBulkConfirmOpen={setBulkConfirmOpen}
              clearBulkSelection={clearBulkSelection}
              suppressPopupsSafe={suppressPopupsSafe}
              openNotice={openNotice}
              locationDiagnosticsOpen={locationDiagnosticsOpen}
              setLocationDiagnosticsOpen={setLocationDiagnosticsOpen}
              isAssetReportingDomain={isAssetReportingDomain}
              mappingMode={mappingMode}
              showMobileMapTabContent={showMobileMapTabContent}
              canUseStreetlightBulk={canUseStreetlightBulk}
              bulkMode={bulkMode}
              bulkMaxLightsPerSubmit={BULK_MAX_LIGHTS_PER_SUBMIT}
              bulkSelectedCount={bulkSelectedCount}
              mapZoomRef={mapZoomRef}
              mapZoom={mapZoom}
              openConfiguredNotice={openConfiguredNotice}
              setNote={setNote}
              setReportType={setReportType}
              setStreetlightAreaPowerOn={setStreetlightAreaPowerOn}
              setStreetlightHazardYesNo={setStreetlightHazardYesNo}
              requestClearQueuedLights={requestClearQueuedLights}
              mappingUnitLabel={mappingUnitLabel}
            />
          </Suspense>
        ) : null}
      </div>

      {/* =========================
          Mobile UI overlays
         ========================= */}
          
      {/* =========================
          Desktop UI overlays
        ========================= */}
      {!useAppShellLayout ? (
        <div className="sl-desktop-only">
        {/* TOP overlay */}
        <Suspense fallback={null}>
          <LazyMapDesktopOverlay
            mapHeaderTheme={mapHeaderTheme}
            titleLogoError={titleLogoError}
            titleLogoSrc={titleLogoSrc}
            titleLogoAlt={TITLE_LOGO_ALT}
            setTitleLogoError={setTitleLogoError}
            environmentGuardrailLabel={environmentGuardrailLabel}
            organizationDisplayName={organizationDisplayName}
            desktopAccountMenuAnchorRef={desktopAccountMenuAnchorRef}
            session={session}
            handleAccountMenuToggle={handleAccountMenuToggle}
            nudgeMapZoom={nudgeMapZoom}
            showMapNotificationsIcon={showMapNotificationsIcon}
            showMapAlertIcon={showMapAlertIcon}
            showMapEventIcon={showMapEventIcon}
            viewerIdentityKey={viewerIdentityKey}
            hasMapSession={hasMapSession}
            notificationsWindowOpen={notificationsWindowOpen}
            alertsWindowOpen={alertsWindowOpen}
            eventsWindowOpen={eventsWindowOpen}
            residentNotificationsUnreadCount={residentNotificationsUnreadCount}
            mapAlertsUnreadCount={mapAlertsUnreadCount}
            mapEventsUnreadCount={mapEventsUnreadCount}
            setAdminDomainMenuOpen={setAdminDomainMenuOpen}
            setAdminToolboxOpen={setAdminToolboxOpen}
            setNotificationsWindowOpen={setNotificationsWindowOpen}
            setEventsWindowOpen={setEventsWindowOpen}
            setAlertsWindowOpen={setAlertsWindowOpen}
            setAccountMenuOpen={setAccountMenuOpen}
            prefersDarkMode={prefersDarkMode}
            isAggregatedReportingDomain={isAggregatedReportingDomain}
            canOpenDomainReports={canOpenDomainReports}
            canOpenAdminReports={canOpenAdminReports}
            openMyReports={openMyReports}
            openOpenReports={openOpenReports}
            openReportsInViewLabel={openReportsInViewLabel}
            openReportsInViewCount={openReportsInViewCount}
            inViewCounterColor={inViewCounterColor}
            inViewCounterBorder={inViewCounterBorder}
            inViewCounterBg={inViewCounterBg}
            isStreetlightsLayerActive={isStreetlightsLayerActive}
            isSavedStreetlightFilterOn={isSavedStreetlightFilterOn}
            isUtilityStreetlightFilterOn={isUtilityStreetlightFilterOn}
            streetlightPersonalInViewStats={streetlightPersonalInViewStats}
            toggleStreetlightInViewFilter={toggleStreetlightInViewFilter}
            isAdmin={isAdmin}
            openAbuseFlagSummary={openAbuseFlagSummary}
            setModerationFlagsOpen={setModerationFlagsOpen}
          />
        </Suspense>

        </div>
      ) : null}

      {useAppShellLayout ? (
        <div className="sl-mobile-only">
          <Suspense fallback={null}>
            <LazyMapMobileChrome
              mapHeaderTheme={mapHeaderTheme}
              mobileHeaderMinHeight={mobileHeaderMinHeight}
              mobileHeaderContentTopInset={mobileHeaderContentTopInset}
              mobileHeaderBottomInset={mobileHeaderBottomInset}
              mobileTitleLogoSrc={mobileTitleLogoSrc}
              titleLogoAlt={TITLE_LOGO_ALT}
              titleLogoError={titleLogoError}
              mobileHeaderCopyMaxWidth={mobileHeaderCopyMaxWidth}
              mobileHeaderCopyPadding={mobileHeaderCopyPadding}
              mobileHeaderCopyBottomPadding={mobileHeaderCopyBottomPadding}
              mobileHeaderCopyTranslateY={mobileHeaderCopyTranslateY}
              mobileHeaderEyebrowSize={mobileHeaderEyebrowSize}
              environmentGuardrailLabel={environmentGuardrailLabel}
              mobileHeaderGuardrailPadding={mobileHeaderGuardrailPadding}
              mobileHeaderGuardrailFontSize={mobileHeaderGuardrailFontSize}
              mobileHeaderGuardrailMarginTop={mobileHeaderGuardrailMarginTop}
              mobileHeaderTitleSize={mobileHeaderTitleSize}
              mobileHeaderTitleMarginTop={mobileHeaderTitleMarginTop}
              organizationDisplayName={organizationDisplayName}
              session={session}
              profile={profile}
              mobileTabPageTopInset={mobileTabPageTopInset}
              mobileReportsPageBottomInset={mobileReportsPageBottomInset}
              prefersDarkMode={prefersDarkMode}
              tenant={tenant}
              openMyReports={openMyReports}
              setAccountMenuOpen={setAccountMenuOpen}
              setAccountView={setAccountView}
              setNotificationPreferencesOpen={setNotificationPreferencesOpen}
              setFollowedLocationsOpen={setFollowedLocationsOpen}
              setManageEditing={setManageEditing}
              setManageOpen={setManageOpen}
              setInfoMenuOpen={setInfoMenuOpen}
              setCitySwitcherOpen={setCitySwitcherOpen}
              setContactUsOpen={setContactUsOpen}
              signOut={signOut}
              setMobileHeaderMenuOpen={setMobileHeaderMenuOpen}
              setLocationDiagnosticsOpen={setLocationDiagnosticsOpen}
              tenantKeyValue={tenant?.tenantKey || activeTenantKey() || ""}
              tenantScopedReadClient={tenantScopedReadClient}
              showAdminTools={showAdminTools}
              showMobileMapTabContent={showMobileMapTabContent}
              accountMenuOpen={accountMenuOpen}
              showNotificationPreferencesEntry={showNotificationPreferencesEntry}
              handleMobileTitleLogoError={handleMobileTitleLogoError}
              handleToggleMobileHeaderMenu={handleToggleMobileHeaderMenu}
              mobileHeaderMenuOpen={mobileHeaderMenuOpen}
              mapType={mapType}
              locating={locating}
              travelFollowMode={travelFollowMode}
              mobileMapToolButtonStyle={mobileMapToolButtonStyle}
              mobileMapLayerButtonStyle={mobileMapLayerButtonStyle}
              mobilePrimaryLayerOptions={mobilePrimaryLayerOptions}
              activeMapLayerKey={activeMapLayerKey}
              isStreetlightsLayerActive={isStreetlightsLayerActive}
              canUseStreetlightBulk={canUseStreetlightBulk}
              incidentLayerDomainOptions={incidentLayerDomainOptions}
              mobileIncidentDomainMenuOpen={mobileIncidentDomainMenuOpen}
              allIncidentReportsOptionEnabled={allIncidentReportsOptionEnabled}
              hasExplicitIncidentMapFilter={hasExplicitIncidentMapFilter}
              activeIncidentMapFilterKeys={activeIncidentMapFilterKeys}
              resolvedIncidentLayerOption={resolvedIncidentLayerOption}
              bulkMode={bulkMode}
              mappingMode={mappingMode}
              handleMobileToggleSatellite={handleMobileToggleSatellite}
              handleMobileResetHeading={handleMobileResetHeading}
              handleMobileLocate={handleMobileLocate}
              handleMobileToggleTravelFollow={handleMobileToggleTravelFollow}
              handleMobileRecenterHome={handleMobileRecenterHome}
              handleMobileSelectMapLayer={handleMobileSelectMapLayer}
              runMobileIncidentMenuAction={runMobileIncidentMenuAction}
              shouldIgnoreMobileIncidentMenuClick={shouldIgnoreMobileIncidentMenuClick}
              handleMobileResetIncidentFilter={handleMobileResetIncidentFilter}
              handleMobileToggleIncidentDomainFilter={handleMobileToggleIncidentDomainFilter}
              handleMobileToggleBulkMode={handleMobileToggleBulkMode}
              handleMobileToggleMappingMode={handleMobileToggleMappingMode}
              isAggregatedReportingDomain={isAggregatedReportingDomain}
              canOpenDomainReports={canOpenDomainReports}
              openReportsInViewLabel={openReportsInViewLabel}
              openReportsInViewCount={openReportsInViewCount}
              inViewCounterColor={inViewCounterColor}
              inViewCounterBorder={inViewCounterBorder}
              inViewCounterBg={inViewCounterBg}
              isSavedStreetlightFilterOn={isSavedStreetlightFilterOn}
              isUtilityStreetlightFilterOn={isUtilityStreetlightFilterOn}
              streetlightPersonalInViewStats={streetlightPersonalInViewStats}
              isAdmin={isAdmin}
              openAbuseFlagSummary={openAbuseFlagSummary}
              handleOpenMobileInViewReports={handleOpenMobileInViewReports}
              handleToggleSavedStreetlightInViewFilter={handleToggleSavedStreetlightInViewFilter}
              handleToggleUtilityStreetlightInViewFilter={handleToggleUtilityStreetlightInViewFilter}
              handleOpenModerationFlags={handleOpenModerationFlags}
              mobileBottomRailOffset={mobileBottomRailOffset}
              bulkSelectedCount={bulkSelectedCount}
              saving={saving}
              clearBulkSelection={clearBulkSelection}
              openNotice={openNotice}
              mapZoomRef={mapZoomRef}
              mapZoom={mapZoom}
              reportingMinZoom={REPORTING_MIN_ZOOM}
              openConfiguredNotice={openConfiguredNotice}
              closeAnyPopup={closeAnyPopup}
              suppressPopupsSafe={suppressPopupsSafe}
              setNote={setNote}
              setReportType={setReportType}
              setStreetlightAreaPowerOn={setStreetlightAreaPowerOn}
              setStreetlightHazardYesNo={setStreetlightHazardYesNo}
              setBulkConfirmOpen={setBulkConfirmOpen}
              bulkMaxLightsPerSubmit={BULK_MAX_LIGHTS_PER_SUBMIT}
              mappingQueueLength={mappingQueue.length}
              requestClearQueuedLights={requestClearQueuedLights}
              confirmMappingQueue={confirmMappingQueue}
              mappingUnitLabel={mappingUnitLabel}
              mobileBottomRailHeight={mobileBottomRailHeight}
              mobileBottomRailSurfaceBg={mobileBottomRailSurfaceBg}
              mobileBottomRailColumnCount={mobileBottomRailColumnCount}
              useWideIosTabletShell={useWideIosTabletShell}
              useAppShellLayout={useAppShellLayout}
              useWideAppShellHeader={useWideAppShellHeader}
              myReportsOpen={myReportsOpen}
              notificationsWindowOpen={notificationsWindowOpen}
              alertsWindowOpen={alertsWindowOpen}
              eventsWindowOpen={eventsWindowOpen}
              accountTabActive={accountTabActive}
              showMapNotificationsIcon={showMapNotificationsIcon}
              showMapAlertIcon={showMapAlertIcon}
              showMapEventIcon={showMapEventIcon}
              residentNotificationsUnreadCount={residentNotificationsUnreadCount}
              mapAlertsUnreadCount={mapAlertsUnreadCount}
              mapEventsUnreadCount={mapEventsUnreadCount}
              handleMobileBottomRailMapClick={handleMobileBottomRailMapClick}
              handleMobileBottomRailReportsClick={handleMobileBottomRailReportsClick}
              handleMobileBottomRailNotificationsClick={handleMobileBottomRailNotificationsClick}
              handleMobileBottomRailAlertsClick={handleMobileBottomRailAlertsClick}
              handleMobileBottomRailEventsClick={handleMobileBottomRailEventsClick}
              handleMobileBottomRailAccountClick={handleMobileBottomRailAccountClick}
            />
          </Suspense>
        </div>
      ) : null}

    </div>
  );
}
