import { useState } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MapLazyRealtimeController from "../mapLazyRealtimeController.jsx";

const { refreshUtilityStatusRealtimeShared } = vi.hoisted(() => ({
  refreshUtilityStatusRealtimeShared: vi.fn(),
}));

vi.mock("../lib/mapDeferredPublicMapFollowupSupport.js", () => ({
  refreshUtilityStatusRealtimeShared,
}));

function createSupabaseStub() {
  const removeChannel = vi.fn();
  const channel = vi.fn(() => {
    const instance = {
      on: vi.fn(),
      subscribe: vi.fn(),
    };
    instance.on.mockImplementation(() => instance);
    instance.subscribe.mockImplementation((onStatus?: (status: string) => void) => {
      onStatus?.("SUBSCRIBED");
      return instance;
    });
    return instance;
  });
  return { channel, removeChannel };
}

const emptyArray: string[] = [];
const emptyMap = new Map();
const emptySet = new Set<string>();
const supabase = createSupabaseStub();
const noop = vi.fn();
const normalizeDomainKeyOrSlug = vi.fn((value: string) => value);
const incidentSnapshotKey = vi.fn((domain: string, id: string) => `${domain}:${id}`);

const stableProps = {
  reportsAdminView: false,
  isAdmin: false,
  sessionUserId: "",
  activeTenantKeyValue: "ashtabulacity",
  configuredIncidentDemandDomainKeys: emptyArray,
  configuredIncidentRuntimeEntryByDomain: emptyMap,
  configuredIncidentPersistedStateSupportedDomainKeys: emptyArray,
  myReportsOpen: false,
  openReportsOpen: false,
  domainReportTarget: null,
  domainDisclosureGateTarget: null,
  confirmReportTarget: null,
  selectedDomainMarker: null,
  selectedIncidentStackMarker: null,
  shouldForceAdminConfiguredIncidentDomain: false,
  deferredRealtimeReady: true,
  shouldPrioritizeStreetlightRuntimeStartup: true,
  shouldComputeStreetlightRuntimeState: true,
  activeMapLayerKey: "streetlights",
  supabase,
  loadDeferredConfiguredIncidentStateRuntimeHelpers: vi.fn(),
  normalizeDomainKeyOrSlug,
  normalizeReportQuality: noop,
  lightIdFor: noop,
  reportDomainForRow: noop,
  isAssetBackedDomainType: noop,
  resolveRuntimeDomainTypeForMap: noop,
  buildGenericIncidentBaseMarkersForDomain: noop,
  mergeGenericIncidentBaseMarkers: noop,
  officialIdSet: emptySet,
  isOutageReportType: noop,
  incidentSnapshotKey,
  normalizeOfficialLightRow: noop,
  domainForIncidentId: noop,
  setReports: noop,
  setSharedIncidentReportRowsStateByDomain: noop,
  setSharedIncidentBaseMarkersStateByDomain: noop,
  setStreetlightOutageTsByLightId: noop,
  setIncidentStateByKey: noop,
  setOfficialLights: noop,
  setFixedLights: noop,
  setActionsByLightId: noop,
  setLastFixByLightId: noop,
  setPersistedIncidentRecordStateByDomain: noop,
  setUtilityReportedLightIdSet: noop,
  setUtilityReportReferenceByLightId: noop,
  setUtilityReportedAtByLightId: noop,
  getIncidentDomainHelper: noop,
  incidentDomainCanonicalIncidentId: noop,
};

function RealtimeHarness() {
  const [, setUtilitySignalCountsByLightId] = useState({});
  return (
    <MapLazyRealtimeController
      {...stableProps}
      officialIdSet={new Set(["streetlight-1"])}
      notifyDbConnectionIssue={() => {}}
      resetDbConnectionIssueStreak={() => {}}
      setUtilitySignalCountsByLightId={setUtilitySignalCountsByLightId}
    />
  );
}

function RecreatedIncidentConfigHarness() {
  const [utilitySignalCountsByLightId, setUtilitySignalCountsByLightId] = useState({});
  const demandDomainKeys = Object.keys(utilitySignalCountsByLightId).length ? [] : ["potholes"];
  const configuredIncidentRuntimeEntryByDomain = new Map([
    ["potholes", {
      domainKey: "potholes",
      setSeededRows: () => {},
      setReportRows: () => {},
    }],
  ]);
  return (
    <MapLazyRealtimeController
      {...stableProps}
      configuredIncidentDemandDomainKeys={demandDomainKeys}
      configuredIncidentRuntimeEntryByDomain={configuredIncidentRuntimeEntryByDomain}
      configuredIncidentPersistedStateSupportedDomainKeys={["potholes"]}
      deferredRealtimeReady={false}
      activeMapLayerKey={Object.keys(utilitySignalCountsByLightId).length ? "streetlights" : "incident_reporting"}
      shouldComputeStreetlightRuntimeState={!Object.keys(utilitySignalCountsByLightId).length}
      shouldPrioritizeStreetlightRuntimeStartup={!Object.keys(utilitySignalCountsByLightId).length}
      notifyDbConnectionIssue={() => {}}
      resetDbConnectionIssueStreak={() => {}}
      setUtilitySignalCountsByLightId={setUtilitySignalCountsByLightId}
    />
  );
}

describe("MapLazyRealtimeController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    refreshUtilityStatusRealtimeShared.mockImplementation(async (_state, deps) => {
      deps.setUtilitySignalCountsByLightId({
        "streetlight-1": { reportedCount: 1, referenceCount: 0, latestReportedTs: 1 },
      });
      return true;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not restart channels when parent callbacks or loaded official IDs change identity", async () => {
    render(<RealtimeHarness />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(refreshUtilityStatusRealtimeShared).toHaveBeenCalledTimes(1);
    expect(supabase.channel).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(refreshUtilityStatusRealtimeShared).toHaveBeenCalledTimes(1);
    expect(supabase.channel).toHaveBeenCalledTimes(2);
  });

  it("does not recreate channels when incident configuration objects retain the same topology", async () => {
    render(<RecreatedIncidentConfigHarness />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(refreshUtilityStatusRealtimeShared).toHaveBeenCalledTimes(1);
    expect(supabase.channel).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(refreshUtilityStatusRealtimeShared).toHaveBeenCalledTimes(1);
    expect(supabase.channel).toHaveBeenCalledTimes(2);
  });

  it("does not create the high-risk incident Realtime channel", async () => {
    render(<RealtimeHarness />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(supabase.channel).toHaveBeenCalledTimes(2);
    expect(supabase.channel).not.toHaveBeenCalledWith("realtime-incident-state-current");
  });
});
