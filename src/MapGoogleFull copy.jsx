import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";
import { supabase } from "./supabaseClient";

const ASHTABULA = { lat: 41.866, lng: -80.789 };

const REPORT_TYPES = {
  out: "Light is out",
  flickering: "Dim / Flickering",
  dayburner: "On during daytime",
  downed_pole: "Pole down",
  other: "Other",
};

function toMs(tsLike) {
  if (!tsLike) return 0;
  if (typeof tsLike === "number") return tsLike;
  const d = new Date(tsLike);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function statusColorFromSinceFixCount(n) {
  if (!n) return { label: "Operational", color: "#111" };
  if (n <= 3) return { label: "Reported", color: "#f6c343" }; // yellow
  if (n <= 6) return { label: "Likely out", color: "#f39c12" }; // orange
  return { label: "Confirmed out", color: "#d32f2f" }; // red
}

function majorityReportType(rows) {
  if (!rows?.length) return null;
  const counts = {};
  for (const r of rows) {
    const k = r.report_type || r.type || "other";
    counts[k] = (counts[k] || 0) + 1;
  }
  let best = null;
  let bestN = -1;
  for (const k of Object.keys(counts)) {
    if (counts[k] > bestN) {
      bestN = counts[k];
      best = k;
    }
  }
  return best;
}

function circleSvgIcon(color) {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
      <circle cx="9" cy="9" r="7" fill="${color}" stroke="#111" stroke-width="2" />
    </svg>`
  );

  return {
    url: `data:image/svg+xml,${svg}`,
    scaledSize: new window.google.maps.Size(18, 18),
    anchor: new window.google.maps.Point(9, 9),
  };
}

function ModalShell({ open, children, zIndex = 9999 }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "grid",
        placeItems: "center",
        zIndex,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "white",
          padding: 18,
          borderRadius: 10,
          width: "min(360px, 100%)",
          display: "grid",
          gap: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ConfirmReportModal({
  open,
  onCancel,
  onConfirm,
  reportType,
  setReportType,
  note,
  setNote,
  saving,
}) {
    // Utility-company required questions
  const [areaPowerOn, setAreaPowerOn] = useState(""); // "", "yes", "no"
  const [hazardYesNo, setHazardYesNo] = useState(""); // "", "yes", "no"

  const notesRequired = reportType === "other";
  const notesMissing = notesRequired && !note.trim();
  const showSafetyNote = reportType === "downed_pole";
  const powerAnswered = areaPowerOn === "yes" || areaPowerOn === "no";
  const hazardRequired = areaPowerOn === "yes";
  const hazardAnswered = !hazardRequired || hazardYesNo === "yes" || hazardYesNo === "no";

  const canSubmit =
    !saving &&
    !notesMissing &&
    powerAnswered &&
    hazardAnswered &&
    hazardYesNo !== "yes";



  useEffect(() => {
    if (open) {
      setAreaPowerOn("");
      setHazardYesNo("");
    }
  }, [open]);

  return (
    <ModalShell open={open} zIndex={9999}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>Report this streetlight?</div>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>What are you seeing?</div>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          disabled={saving}
        >
          {Object.entries(REPORT_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>
          Notes {notesRequired ? "(required)" : "(optional)"}
        </div>

        <input
          placeholder='Anything helpful? (e.g., "flickers at night")'
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          disabled={saving}
        />

        {notesMissing && (
          <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 800 }}>
            Please add a brief note for “Other”.
          </div>
        )}
      </label>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Power & Safety</div>

        <div style={{ fontSize: 13, lineHeight: 1.25 }}>
          Is power on in the immediate area of the affected light?{" "}
          <span style={{ color: "#b71c1c", fontWeight: 900 }}>*</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setAreaPowerOn("yes");
              setHazardYesNo("");
            }}
            disabled={saving}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.15)",
              background: areaPowerOn === "yes" ? "#111" : "white",
              color: areaPowerOn === "yes" ? "white" : "#111",
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            Yes
          </button>

          <button
            type="button"
            onClick={() => {
              setAreaPowerOn("no");
              setHazardYesNo("");
            }}
            disabled={saving}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.15)",
              background: areaPowerOn === "no" ? "#111" : "white",
              color: areaPowerOn === "no" ? "white" : "#111",
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            No
          </button>
        </div>

        {areaPowerOn === "no" && (
          <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
            Note: If power is out in the area, this may be part of a larger outage. (Power outage
            reporting will be added later.)
          </div>
        )}

        {areaPowerOn === "yes" && (
          <>
            <div style={{ fontSize: 13, lineHeight: 1.25 }}>
              Does the light present a hazardous situation?{" "}
              <span style={{ color: "#b71c1c", fontWeight: 900 }}>*</span>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setHazardYesNo("yes")}
                disabled={saving}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: hazardYesNo === "yes" ? "#111" : "white",
                  color: hazardYesNo === "yes" ? "white" : "#111",
                  fontWeight: 900,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                Yes
              </button>

              <button
                type="button"
                onClick={() => setHazardYesNo("no")}
                disabled={saving}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: hazardYesNo === "no" ? "#111" : "white",
                  color: hazardYesNo === "no" ? "white" : "#111",
                  fontWeight: 900,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                No
              </button>
            </div>

            {hazardYesNo === "yes" && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(183,28,28,0.35)",
                  background: "rgba(183,28,28,0.08)",
                  color: "#b71c1c",
                  fontWeight: 900,
                  fontSize: 12.5,
                  lineHeight: 1.35,
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ fontSize: 16, lineHeight: 1 }}>⚠️</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 950 }}>Safety warning</div>
                  <div style={{ marginTop: 2 }}>
                    Please stay away from the area and call emergency services if this is an immediate
                    hazard.
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!powerAnswered && (
          <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 800 }}>
            Please answer whether power is on in the area.
          </div>
        )}

        {hazardRequired && !hazardAnswered && (
          <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 800 }}>
            Please answer whether this is a hazardous situation.
          </div>
        )}
      </div>

      {showSafetyNote && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(183,28,28,0.35)",
            background: "rgba(183,28,28,0.08)",
            color: "#b71c1c",
            fontWeight: 900,
            fontSize: 12.5,
            lineHeight: 1.35,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <div style={{ fontSize: 16, lineHeight: 1 }}>⚠️</div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 950 }}>Safety Notice!</div>
            <div style={{ marginTop: 2 }}>
              If there’s immediate danger, contact emergency services.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "white",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
            fontWeight: 700,
          }}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          onClick={onConfirm}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: "none",
            background: "#1976d2",
            color: "white",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.6,
            fontWeight: 800,
          }}
          disabled={!canSubmit}
        >
          {saving ? "Submitting…" : "Report"}
        </button>
      </div>

      <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.35 }}>
        Reports help track outages and do not replace emergency services.
      </div>
    </ModalShell>
  );
}

export default function MapGoogleFull() {
  const [activeLight, setActiveLight] = useState(null); // { id, lat, lng, sl_id }

  // If you already have Supabase auth/session/profile in Google file, reuse them:
  const [pendingSubmit, setPendingSubmit] = useState(false);

  // Guest identity + cooldowns (Leaflet parity)
  const [guestInfo, setGuestInfo] = useState({ name: "", phone: "", email: "" });
  const [cooldowns, setCooldowns] = useState(() => loadCooldownsFromStorage()); // you will copy helper
  const [officialLights, setOfficialLights] = useState([]);
  const [selectedOfficialId, setSelectedOfficialId] = useState(null);
  const [activeLightId, setActiveLightId] = useState(null);
  const [reportType, setReportType] = useState("out");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [reportLightId, setReportLightId] = useState(null); // official_lights.id being reported
  const [reportNotes, setReportNotes] = useState("");
  const [powerNearby, setPowerNearby] = useState(null); // null | true | false
  const [reportError, setReportError] = useState("");

  function openReportModal(lightId) {
    setReportLightId(lightId);
    setReportType("out");
    setReportNotes("");
    setPowerNearby(null);
    setReportError("");
  }

  function openReportForLight(lightId) {
    if (!lightId) return;
    setActiveLightId(lightId);
    setReportType("out");
    setNote("");
  }

  function closeReportModal() {
    setReportLightId(null);
    setReportError("");
  }
  const [officialReports, setOfficialReports] = useState([]); // rows from reports table
  const [fixedByLightId, setFixedByLightId] = useState({});   // { [uuid]: ms }
  

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const mapRef = useRef(null);
  const geoWatchIdRef = useRef(null);

  const [userPos, setUserPos] = useState(null);
  const [followHeading, setFollowHeading] = useState(true);
  const [heading, setHeading] = useState(0);
  const [hasMotionPermission, setHasMotionPermission] = useState(false);

  const resetCompass = () => {
    if (!mapRef.current) return;
    mapRef.current.setHeading(0);
    mapRef.current.setTilt(0);
  };

  const center = useMemo(() => userPos || ASHTABULA, [userPos]);

  // --- Helpers
  function setMapHeading(h) {
    const map = mapRef.current;
    if (!map) return;
    map.setHeading(h);
  }

  function setMapCenter(pos) {
    const map = mapRef.current;
    if (!map) return;
    map.panTo(pos);
  }

    useEffect(() => {
      let alive = true;

      (async () => {
        const { data, error } = await supabase
          .from("official_lights")
          .select("id, lat, lng, sl_id")
          .order("created_at", { ascending: false });

        if (!alive) return;

        if (error) {
          console.error("official_lights load error:", error);
          return;
        }

        setOfficialLights(Array.isArray(data) ? data : []);

        // --- Load reports + fixed timestamps for these official lights
        const lightIds = (Array.isArray(data) ? data : []).map((x) => x.id).filter(Boolean);
        if (lightIds.length === 0) return;

        // --- PostgREST 400 fix: chunk large .in() lists (URLs get too long)
        async function fetchByLightIdsInChunks({ table, select, ids, chunkSize = 200, build }) {
          const out = [];
          let err = null;

          for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            let q = supabase.from(table).select(select).in("light_id", chunk);
            if (build) q = build(q);

            const { data, error } = await q;
            if (error) {
              err = error;
              break;
            }
            if (Array.isArray(data) && data.length) out.push(...data);
          }

          return { data: out, error: err };
        }

        const { data: fixedRows, error: fixedErr } = await fetchByLightIdsInChunks({
          table: "fixed_lights",
          select: "light_id, fixed_at",
          ids: lightIds,
          chunkSize: 200,
        });

        const { data: actionRows, error: actErr } = await fetchByLightIdsInChunks({
          table: "light_actions",
          select: "light_id, action, created_at",
          ids: lightIds,
          chunkSize: 200,
          build: (q) => q.eq("action", "fix").order("created_at", { ascending: false }),
        });

        const { data: reportRows, error: repErr } = await fetchByLightIdsInChunks({
          table: "reports",
          select: "id, light_id, report_type, created_at",
          ids: lightIds,
          chunkSize: 200,
          build: (q) => q.order("created_at", { ascending: false }).limit(5000),
        });

        // fixed_lights → map
        const fixedMap = {};
        if (fixedErr) console.error("fixed_lights load error:", fixedErr);
        else {
          for (const row of fixedRows || []) {
            fixedMap[row.light_id] = toMs(row.fixed_at);
          }
        }

        // light_actions (fix) → map (latest per light)
        const actionFixMap = {};
        if (actErr) console.error("light_actions load error:", actErr);
        else {
          for (const a of actionRows || []) {
            const ms = toMs(a.created_at);
            actionFixMap[a.light_id] = Math.max(actionFixMap[a.light_id] || 0, ms);
          }
        }

        // Merge: last fix = max(fixed_lights, light_actions fix)
        const mergedFix = { ...fixedMap };
        for (const id of Object.keys(actionFixMap)) {
          mergedFix[id] = Math.max(mergedFix[id] || 0, actionFixMap[id] || 0);
        }
        setFixedByLightId(mergedFix);

        // reports → store (Leaflet derives ts from created_at)
        if (repErr) {
          console.error("reports load error:", repErr);
          setOfficialReports([]);
        } else {
          setOfficialReports(
            (reportRows || []).map((r) => ({
              id: r.id,
              light_id: r.light_id,
              report_type: r.report_type,
              created_at: r.created_at,
              ts: toMs(r.created_at),
            }))
          );
        }

        // --- Diagnostics: verify report light_id matches official_lights.id
        const lightIdSet = new Set(lightIds);
        const reportArr = Array.isArray(reportRows) ? reportRows : [];
        const matched = reportArr.filter((r) => lightIdSet.has(r.light_id));
        const unmatched = reportArr.filter((r) => !lightIdSet.has(r.light_id));

        console.log("GMAPS reports load:", {
          lightIds: lightIds.length,
          reportRows: reportArr.length,
          matchedToOfficialIds: matched.length,
          unmatchedToOfficialIds: unmatched.length,
          sampleReportRow: reportArr[0] || null,
          sampleMatched: matched[0] || null,
          sampleUnmatchedLightIds: unmatched.slice(0, 8).map((r) => r.light_id),
          repErr,
        });
      })();

      return () => {
        alive = false;
      };
    }, []);

  // --- Geolocation tracking (position)
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        setUserPos(next);

        // follow camera
        if (followHeading) setMapCenter(next);
      },
      (err) => {
        console.warn("geolocation error", err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    return () => {
      if (geoWatchIdRef.current != null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
        geoWatchIdRef.current = null;
      }
    };
  }, [followHeading]);

  // --- Device orientation (heading)
  useEffect(() => {
    let handler;

    function normalizeDeg(d) {
      let x = d % 360;
      if (x < 0) x += 360;
      return x;
    }

    handler = (e) => {
      // iOS Safari usually provides webkitCompassHeading
      const iosHeading = typeof e.webkitCompassHeading === "number" ? e.webkitCompassHeading : null;

      // Others provide alpha (0-360) relative to device orientation
      const alpha = typeof e.alpha === "number" ? e.alpha : null;

      // Best effort:
      const nextHeading = iosHeading != null ? iosHeading : alpha != null ? (360 - alpha) : null;

      if (nextHeading == null) return;

      const h = normalizeDeg(nextHeading);
      setHeading(h);

      if (followHeading) setMapHeading(h);
    };

    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, [followHeading]);

  // --- Map events: if user manually rotates/drags, pause followHeading (so gestures work)
  function onMapLoad(map) {
    mapRef.current = map;

    // enable rotation gesture UX
    map.setOptions({
      gestureHandling: "greedy",
      rotateControl: true,
      tilt: 0,
      heading: 0,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      clickableIcons: false,
      mapId: import.meta.env.VITE_GOOGLE_MAP_ID,
      disableDefaultUI: false,
    });

    // If user starts interacting, temporarily stop auto-follow so manual rotate is usable
    map.addListener("dragstart", () => setFollowHeading(false));
    map.addListener("zoom_changed", () => {
      // no-op; keeps future hooks open
    });
    map.addListener("heading_changed", () => {
      // If user rotates manually, reflect that heading in state (optional)
      const h = map.getHeading() || 0;
      setHeading(h);
    });
  }

  function onMapUnmount() {
    mapRef.current = null;
  }

  // --- iOS permission prompt for motion/orientation
  async function requestMotionPermission() {
    try {
      const D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === "function") {
        const res = await D.requestPermission();
        if (res === "granted") setHasMotionPermission(true);
        else setHasMotionPermission(false);
      } else {
        // not iOS / not required
        setHasMotionPermission(true);
      }
    } catch (e) {
      console.warn("motion permission error", e);
      setHasMotionPermission(false);
    }
  }

  if (!apiKey) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        Missing <b>VITE_GOOGLE_MAPS_API_KEY</b> in <code>.env.local</code>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <LoadScript googleMapsApiKey={apiKey}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={17}
          onLoad={onMapLoad}
          onUnmount={onMapUnmount}
          options={{
            // Rotation works via gestures on mobile; ctrl+drag on desktop
            gestureHandling: "greedy",
          }}
        >

          {officialLights.map((ol) => {
            const fixMs = fixedByLightId[ol.id] || 0;

            const allForLight = officialReports.filter((r) => r.light_id === ol.id);
            const sinceFix = fixMs ? allForLight.filter((r) => (r.ts || 0) > fixMs) : allForLight;

            const status = statusColorFromSinceFixCount(sinceFix.length);

            return (
              <Marker
                key={ol.id}
                position={{ lat: Number(ol.lat), lng: Number(ol.lng) }}
                onClick={() => setSelectedOfficialId(ol.id)}
                icon={window.google ? circleSvgIcon(status.color) : undefined}
              />
            );
          })}

          {selectedOfficialId && (
            
            <InfoWindow
              position={{
                lat: officialLights.find((x) => x.id === selectedOfficialId)?.lat || ASHTABULA.lat,
                lng: officialLights.find((x) => x.id === selectedOfficialId)?.lng || ASHTABULA.lng,
              }}
              onCloseClick={() => setSelectedOfficialId(null)}
            >
              <div style={{ display: "grid", gap: 10, width: "min(240px, calc(100vw - 40px))" }}>
                <div style={{ fontWeight: 900 }}>Official streetlight</div>

                {(() => {
                  const ol = officialLights.find((x) => x.id === selectedOfficialId);
                  if (!ol) return null;

                  const fixMs = fixedByLightId[ol.id] || 0;
                  const allForLight = officialReports.filter((r) => r.light_id === ol.id);
                  const sinceFix = fixMs ? allForLight.filter((r) => (r.ts || 0) > fixMs) : allForLight;

                  const isFixed = sinceFix.length === 0;
                  const majorityKey = majorityReportType(sinceFix);
                  const majorityLabel = majorityKey ? (REPORT_TYPES[majorityKey] || majorityKey) : "Reported";
                  const publicStatusLabel = isFixed ? "Operational" : majorityLabel;

                  return (
                    <>
                      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
                        Light ID:{" "}
                        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                          {ol.sl_id || "—"}
                        </span>
                      </div>

                      <div style={{ fontSize: 13 }}>
                        Status: <b>{publicStatusLabel}</b>
                      </div>
                    </>
                  );
                })()}

                <button
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: "none",
                    background: "#1976d2",
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                  onClick={() => openReportForLight(selectedOfficialId)}
                >
                  Report issue
                </button>

                <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.35 }}>
                  (Prototype) Next we’ll bring over your real report flow + cooldown rules.
                </div>
              </div>
            </InfoWindow>
          )}
          {userPos && (
            <Marker
              position={userPos}
              // Simple default marker for now; we'll swap to a heading arrow later
            />
          )}
        </GoogleMap>
      </LoadScript>

      <ConfirmReportModal
        open={Boolean(activeLightId)}
        saving={saving}
        reportType={reportType}
        setReportType={setReportType}
        note={note}
        setNote={setNote}
        onCancel={() => {
          if (saving) return;
          setActiveLightId(null);
          setNote("");
        }}
        onConfirm={() => {
          // TEMP: we will replace this with the real App.jsx submit flow next
          console.log("GMAPS report submit payload (draft):", {
            light_id: activeLightId,
            report_type: reportType,
            note,
          });
          setActiveLightId(null);
        }}
      />

      {/* Report modal (UI parity first — submit wired next) */}
      {reportLightId && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
            fontFamily: "system-ui",
          }}
          onMouseDown={(e) => {
            // click outside closes
            if (e.target === e.currentTarget) closeReportModal();
          }}
        >
          <div
            style={{
              width: 360,
              maxWidth: "calc(100vw - 32px)",
              background: "white",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              padding: 18,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
              Report this streetlight?
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, opacity: 0.9 }}>
              What are you seeing?
            </div>

            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.18)",
                outline: "none",
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              <option value="out">Light is out</option>
              <option value="flicker">Flickering</option>
              <option value="dim">Dim</option>
              <option value="on_day">On during day</option>
              <option value="other">Other</option>
            </select>

            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, opacity: 0.9 }}>
              Notes (optional)
            </div>

            <input
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              placeholder={`Anything helpful? (e.g., "flickers at night")`}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.18)",
                outline: "none",
                marginBottom: 14,
              }}
            />

            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>
              Power &amp; Safety
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
              Is power on in the immediate area of the affected light?{" "}
              <span style={{ color: "#d32f2f" }}>*</span>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
              <button
                type="button"
                onClick={() => {
                  setPowerNearby(true);
                  setReportError("");
                }}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: powerNearby === true ? "#111" : "white",
                  color: powerNearby === true ? "white" : "#111",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Yes
              </button>

              <button
                type="button"
                onClick={() => {
                  setPowerNearby(false);
                  setReportError("");
                }}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: powerNearby === false ? "#111" : "white",
                  color: powerNearby === false ? "white" : "#111",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                No
              </button>
            </div>

            {reportError && (
              <div style={{ color: "#d32f2f", fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
                {reportError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={closeReportModal}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  if (powerNearby === null) {
                    setReportError("Please answer whether power is on in the area.");
                    return;
                  }

                  // UI parity first — submission wired next change
                  console.log("GMAPS report draft:", {
                    light_id: reportLightId,
                    report_type: reportType,
                    notes: reportNotes,
                    power_nearby: powerNearby,
                  });

                  closeReportModal();
                }}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  border: "none",
                  background: "#77aee6",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Report
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 11, opacity: 0.7, lineHeight: 1.25 }}>
              Reports help track outages and do not replace emergency services.
            </div>
          </div>
        </div>
      )}

      {/* Minimal controls overlay */}
      <div
        style={{
          position: "absolute",
          left: 12,
          top: 12,
          display: "grid",
          gap: 8,
          padding: 10,
          borderRadius: 12,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(0,0,0,0.12)",
          fontFamily: "system-ui",
          fontSize: 13,
          width: 220,
        }}
      >
        <div style={{ fontWeight: 900 }}>Google Map Prototype</div>

        <div style={{ opacity: 0.75 }}>
          Heading: <b>{Math.round(heading)}°</b>
        </div>

        <button
          onClick={() => setFollowHeading((v) => !v)}
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
            background: followHeading ? "#111" : "white",
            color: followHeading ? "white" : "#111",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {followHeading ? "Follow + Rotate: ON" : "Follow + Rotate: OFF"}
        </button>

        <button
          onClick={requestMotionPermission}
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Enable Motion (iPhone)
        </button>

        {heading !== 0 && (
          <button
            onClick={resetCompass}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🧭 Reset North
          </button>
          )}

        <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.25 }}>
          Tip: On desktop, rotation is typically <b>Ctrl + drag</b>. On mobile, use <b>two-finger rotate</b>.
        </div>

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Motion permission: <b>{hasMotionPermission ? "OK" : "Unknown/Not granted"}</b>
        </div>
      </div>
    </div>
  );
}
