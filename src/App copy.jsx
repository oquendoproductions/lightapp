// ==================================================
// App.jsx — Full file
// ==================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { supabase } from "./supabaseClient";

import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";


// ==================================================
// SECTION 1 — Fix Leaflet default icon paths
// ==================================================
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ==================================================
// SECTION 2 — App Settings
// ==================================================
const ASHTABULA = [41.8651, -80.7898];
const GROUP_RADIUS_METERS = 25;

// 💡 OFFICIAL LIGHTS (admin-only mapping layer)
const OFFICIAL_LIGHTS_MIN_ZOOM = 14;
const LOCATE_ZOOM = 17;


// Per-light cooldown (client-side guardrail; reversible)
const REPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cooldown persistence key
const COOLDOWNS_KEY = "streetlight_cooldowns_v1";

// Location request prompt upon opening page
const LOC_PROMPTED_SESSION_KEY = "streetlight_loc_prompted_session_v1";


// ==================================================
// SECTION 3 — Report Metadata + Status Logic
// ==================================================
const REPORT_TYPES = {
  out: "Light is out",
  flickering: "Dim / Flickering",
  dayburner: "On during daytime",
  downed_pole: "Pole down",
  other: "Other",
};

function statusFromCount(count) {
  if (count >= 4) return { label: "Confirmed Out", color: "#b71c1c" };
  if (count >= 2) return { label: "Likely Out", color: "#f57c00" };
  return { label: "Reported", color: "#616161" };
}

// Official-light severity based on reports since last fix
function officialStatusFromSinceFixCount(count) {
  if (count >= 7) return { label: "Confirmed Out", color: "#b71c1c" }; // red
  if (count >= 4) return { label: "Likely Out", color: "#f57c00" };    // orange
  if (count >= 1) return { label: "Reported", color: "#fbc02d" };      // yellow
  return { label: "Operational", color: "#111" };                      // black
}

function majorityReportType(reports) {
  const counts = new Map();
  for (const r of reports || []) counts.set(r.type, (counts.get(r.type) || 0) + 1);

  let best = null;
  let bestN = -1;
  for (const [t, n] of counts.entries()) {
    if (n > bestN) {
      bestN = n;
      best = t;
    }
  }
  return best;
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

function lightIdFor(lat, lng) {
  return `${lat.toFixed(5)}:${lng.toFixed(5)}`;
}

function canReport(lightId, cooldowns) {
  const last = cooldowns[lightId];
  if (!last) return true;
  return Date.now() - last > REPORT_COOLDOWN_MS;
}

function normalizeEmail(e) {
  return String(e || "").trim().toLowerCase();
}

function normalizePhone(p) {
  return String(p || "").replace(/[^\d]/g, ""); // digits only
}

function reporterIdentityKey({ session, profile, guestInfo }) {
  const uid = session?.user?.id;
  if (uid) return `uid:${uid}`;

  const email = normalizeEmail(guestInfo?.email);
  if (email) return `email:${email}`;

  // fallback so guests can’t bypass cooldown by omitting email
  const phone = normalizePhone(guestInfo?.phone);
  if (phone) return `phone:${phone}`;

  // last-resort fallback (should be rare because you require name + phone/email for guests)
  const name = String(guestInfo?.name || "").trim().toLowerCase();
  if (name) return `name:${name}`;

  return null;
}

function canIdentityReportLight(lightId, { session, profile, guestInfo, reports, cooldowns }) {
  const key = reporterIdentityKey({ session, profile, guestInfo });

  // ✅ If we have an identity key, enforce via DB-backed history (works for authed + guests)
  if (key) {
    let newestTs = 0;

    for (const r of reports || []) {
      if (r.light_id !== lightId) continue;

      const rKey =
        r.reporter_user_id ? `uid:${r.reporter_user_id}` :
        (normalizeEmail(r.reporter_email) ? `email:${normalizeEmail(r.reporter_email)}` :
         (normalizePhone(r.reporter_phone) ? `phone:${normalizePhone(r.reporter_phone)}` : null));

      if (rKey && rKey === key) {
        const ts = Number(r.ts || 0);
        if (ts > newestTs) newestTs = ts;
      }
    }

    if (!newestTs) return true;
    return Date.now() - newestTs > REPORT_COOLDOWN_MS;
  }

  // ✅ No identity yet → do NOT enforce device cooldown here.
  // The submit flow forces guest contact before cooldown is checked.
  return true;
}

// Bearing (direction of travel) from 2 coords, degrees 0-360
function bearingBetween(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lng - a.lng);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return brng;
}

// ==================================================
// SECTION 4A — Cooldown persistence helpers
// ==================================================
function loadCooldownsFromStorage() {
  try {
    const raw = localStorage.getItem(COOLDOWNS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function pruneCooldowns(cooldowns) {
  const now = Date.now();
  const next = {};
  for (const [lightId, ts] of Object.entries(cooldowns || {})) {
    const t = Number(ts);
    if (!Number.isFinite(t)) continue;
    if (now - t <= REPORT_COOLDOWN_MS) next[lightId] = t;
  }
  return next;
}

function saveCooldownsToStorage(cooldowns) {
  try {
    localStorage.setItem(COOLDOWNS_KEY, JSON.stringify(cooldowns));
  } catch {
    // ignore
  }
}

// ==================================================
// SECTION 5 — Group reports into streetlights
// ==================================================
function groupIntoLights(reports) {
  const lights = [];

  for (const r of reports) {
    let placed = false;

    for (const light of lights) {
      const dist = metersBetween(
        { lat: r.lat, lng: r.lng },
        { lat: light.lat, lng: light.lng }
      );

      if (dist <= GROUP_RADIUS_METERS) {
        light.reports.push(r);

        const n = light.reports.length;
        light.lat = (light.lat * (n - 1) + r.lat) / n;
        light.lng = (light.lng * (n - 1) + r.lng) / n;

        placed = true;
        break;
      }
    }

    if (!placed) {
      lights.push({
        lat: r.lat,
        lng: r.lng,
        reports: [r],
      });
    }
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
function dotIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

function userDotIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:#1976d2;border:2px solid white;
      box-shadow:0 1px 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

function officialLightIcon(bg = "#111") {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:22px;height:22px;border-radius:999px;
        background:${bg}; color:#fff;
        display:flex;align-items:center;justify-content:center;
        border:2px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        font-size:14px; line-height:1;
      ">💡</div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

function displayLightId(lightUuid, slIdByUuid) {
  const key = (lightUuid || "").trim();
  return (slIdByUuid?.get?.(key) || "").trim() || key || "—";
}



// ==================================================
// SECTION 7 — Map helpers
// ==================================================
function MapClickHandler({ onPick, suppressClickRef, clickDelayRef, enableTwoTapZoom = true }) {
  useMapEvents({
    click(e) {
      // block clicks triggered by zoom gesture / suppress window
      const until = suppressClickRef?.current?.until || 0;
      if (Date.now() < until) return;

      const t = e?.originalEvent?.target;

      // Ignore clicks inside popup / controls
      if (t && (t.closest?.(".leaflet-popup") || t.closest?.(".leaflet-control"))) return;

      // If we’re not using the two-tap zoom behavior, act immediately
      if (!enableTwoTapZoom) {
        onPick([e.latlng.lat, e.latlng.lng]);
        return;
      }

      // ✅ Delay the "report" action so a second tap can cancel it
      const ref = clickDelayRef?.current;
      if (!ref) {
        onPick([e.latlng.lat, e.latlng.lng]);
        return;
      }

      const now = Date.now();
      const dt = now - (ref.lastTs || 0);
      ref.lastTs = now;

      // If this is a second tap quickly after the first, cancel pending report
      if (dt < 350) {
        if (ref.timer) clearTimeout(ref.timer);
        ref.timer = null;

        // also suppress the synthetic click that might follow
        if (suppressClickRef?.current) suppressClickRef.current.until = Date.now() + 800;
        return;
      }

      // Start / restart the delayed report timer
      if (ref.timer) clearTimeout(ref.timer);
      ref.lastLatLng = e.latlng;

      ref.timer = setTimeout(() => {
        ref.timer = null;
        const p = ref.lastLatLng || e.latlng;
        onPick([p.lat, p.lng]);
      }, 360);
    },
  });

  // cleanup if component unmounts
  useEffect(() => {
    return () => {
      const ref = clickDelayRef?.current;
      if (ref?.timer) clearTimeout(ref.timer);
    };
  }, [clickDelayRef]);

  return null;
}


function MapUserInteractionWatcher({ onUserInteract }) {
  useMapEvents({
    dragstart: onUserInteract,
    zoomstart: onUserInteract,
  });
  return null;
}

function MapZoomWatcher({ onZoom }) {
  const map = useMap();

  useEffect(() => {
    const emit = () => onZoom(map.getZoom());
    emit();
    map.on("zoomend", emit);
    return () => map.off("zoomend", emit);
  }, [map, onZoom]);

  return null;
}

function MapInteractionLock({ locked }) {
  const map = useMap();

  useEffect(() => {
    if (!locked) return;

    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();

    return () => {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
    };
  }, [locked, map]);

  return null;
}

function MapTwoTapHoldDragZoom({ enabled = true, suppressClickRef, clickDelayRef }) {
  const map = useMap();

  const stateRef = useRef({
    lastTapTs: 0,
    tapCount: 0,
    resetTimer: null,

    longPressTimer: null,
    active: false,

    startY: 0,
    startZoom: 0,
    anchorLatLng: null,
    pointerId: null,
  });

  useEffect(() => {
    if (!enabled) return;

    const container = map.getContainer();

    const isUI = (target) => {
      if (!target?.closest) return false;
      return Boolean(
        target.closest(".leaflet-control") ||
          target.closest(".leaflet-popup") ||
          target.closest(".leaflet-marker-icon") ||
          target.closest(".leaflet-interactive")
      );
    };

    const clearTimers = () => {
      const s = stateRef.current;
      if (s.resetTimer) clearTimeout(s.resetTimer);
      if (s.longPressTimer) clearTimeout(s.longPressTimer);
      s.resetTimer = null;
      s.longPressTimer = null;
    };

    const onPointerDown = (ev) => {
      if (!enabled) return;
      if (ev.pointerType !== "touch") return; // only touch gesture
      if (isUI(ev.target)) return;

      const s = stateRef.current;
      const now = Date.now();
      const dt = now - (s.lastTapTs || 0);
      s.lastTapTs = now;

      if (dt < 350) s.tapCount += 1;
      else s.tapCount = 1;

      clearTimers();

      s.resetTimer = setTimeout(() => {
        s.tapCount = 0;
      }, 500);

      // only arm on 2nd tap
      if (s.tapCount !== 2) return;

      // ✅ cancel any pending "report" timer from MapClickHandler
      const cref = clickDelayRef?.current;
      if (cref?.timer) {
        clearTimeout(cref.timer);
        cref.timer = null;
      }

      // ✅ tap #2 begins zoom gesture → suppress upcoming synthetic click
      if (suppressClickRef?.current) suppressClickRef.current.until = Date.now() + 900;

      // capture this pointer so we only track this finger
      s.pointerId = ev.pointerId;
      try {
        container.setPointerCapture?.(ev.pointerId);
      } catch {}

      const p = map.mouseEventToLatLng(ev);
      s.anchorLatLng = p;
      s.startY = ev.clientY;
      s.startZoom = map.getZoom();

      // long-press threshold to enter zoom mode
      s.longPressTimer = setTimeout(() => {
        s.active = true;

        // disable default interactions while zoom-dragging
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
      }, 140);
    };

    const onPointerMove = (ev) => {
      const s = stateRef.current;
      if (!enabled) return;
      if (!s.active) return;
      if (ev.pointerId !== s.pointerId) return;

      ev.preventDefault?.();

      const dy = ev.clientY - s.startY;
      const deltaZoom = -(dy / 120); // 120px ~= 1 zoom
      let nextZoom = s.startZoom + deltaZoom;

      const minZ = map.getMinZoom?.() ?? 0;
      const maxZ = map.getMaxZoom?.() ?? 22;
      nextZoom = Math.max(minZ, Math.min(maxZ, nextZoom));

      const anchor = s.anchorLatLng || map.getCenter();
      map.setZoomAround(anchor, nextZoom, { animate: false });

      // keep clicks suppressed while actively zooming
      if (suppressClickRef?.current) suppressClickRef.current.until = Date.now() + 800;
    };

    const endZoom = () => {
      const s = stateRef.current;

      if (s.longPressTimer) {
        clearTimeout(s.longPressTimer);
        s.longPressTimer = null;
      }

      if (s.active) {
        s.active = false;

        // ✅ small extra suppression window for the release click
        if (suppressClickRef?.current) suppressClickRef.current.until = Date.now() + 500;

        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
      }

      s.pointerId = null;
    };

    const onPointerUp = (ev) => {
      const s = stateRef.current;
      if (ev.pointerId !== s.pointerId) {
        // even if not captured, still end timers
        endZoom();
        return;
      }
      endZoom();
    };

    container.addEventListener("pointerdown", onPointerDown, { passive: true });
    container.addEventListener("pointermove", onPointerMove, { passive: false });
    container.addEventListener("pointerup", onPointerUp, { passive: true });
    container.addEventListener("pointercancel", onPointerUp, { passive: true });

    return () => {
      clearTimers();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
    };
  }, [enabled, map, suppressClickRef]);

  return null;
}

function MapFlyTo({ target }) {
  const map = useMap();

  useEffect(() => {
    if (!target?.pos) return;
    const z = Number.isFinite(target.zoom) ? target.zoom : map.getZoom();
    map.flyTo(target.pos, z, { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, target?.nonce]);

  return null;
}

// Smooth marker movement (removes stutter)
function SmoothUserMarker({ position }) {
  const markerRef = useRef(null);
  const lastRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!position) return;
    const marker = markerRef.current;
    if (!marker) return;

    const next = { lat: position[0], lng: position[1] };
    const prev = lastRef.current || next;

    // Cancel any in-flight animation
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const start = performance.now();
    const duration = 650; // ms (feels smooth on mobile)

    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);

      const lat = prev.lat + (next.lat - prev.lat) * eased;
      const lng = prev.lng + (next.lng - prev.lng) * eased;

      marker.setLatLng([lat, lng]);

      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else lastRef.current = next;
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [position]);

  // Important: initial position must exist for Marker
  if (!position) return null;

  return <Marker position={position} icon={userDotIcon()} ref={markerRef} />;
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

function WelcomeModal({ open, onLogin, onCreate, onGuest }) {
  return (
    <ModalShell open={open} zIndex={10005}>
      <div style={{ fontSize: 18, fontWeight: 950 }}>Welcome</div>
      <div style={{ fontSize: 13.5, opacity: 0.9, lineHeight: 1.35 }}>
        You can sign in to track your reports, or continue as a guest.
        <div style={{ marginTop: 8, fontWeight: 900 }}>
          Guests must provide a name and either a phone number or email to submit reports.
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <button onClick={onLogin} style={btnPrimary}>Login</button>
        <button onClick={onCreate} style={btnPrimaryDark}>Create Account</button>
        <button onClick={onGuest} style={btnSecondary}>Continue as Guest</button>
      </div>
    </ModalShell>
  );
}

function GuestInfoModal({ open, info, setInfo, onContinue, onCancel }) {
  const nameOk = info.name.trim().length > 0;
  const phoneOk = info.phone.trim().length > 0;
  const emailOk = info.email.trim().length > 0;
  const ok = nameOk && (phoneOk || emailOk);

  return (
    <ModalShell open={open} zIndex={10006}>
      <div style={{ fontSize: 16, fontWeight: 950 }}>Guest info required</div>
      <div style={{ fontSize: 12.5, opacity: 0.85, lineHeight: 1.35 }}>
        Please provide your name and either a phone number or email.
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Name</div>
        <input
          value={info.name}
          onChange={(e) => setInfo((p) => ({ ...p, name: e.target.value }))}
          style={inputStyle}
          placeholder="Your name"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Phone (optional)</div>
        <input
          value={info.phone}
          onChange={(e) => setInfo((p) => ({ ...p, phone: e.target.value }))}
          style={inputStyle}
          placeholder="555-555-5555"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Email (optional)</div>
        <input
          value={info.email}
          onChange={(e) => setInfo((p) => ({ ...p, email: e.target.value }))}
          style={inputStyle}
          placeholder="name@email.com"
        />
      </label>

      {!ok && (
        <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 900 }}>
          Name and either phone or email are required.
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={btnSecondary}>Cancel</button>
        <button onClick={onContinue} disabled={!ok} style={{ ...btnPrimary, opacity: ok ? 1 : 0.6 }}>
          Continue
        </button>
      </div>
    </ModalShell>
  );
}

function LocationPromptModal({ open, onEnable, onSkip }) {
  return (
    <ModalShell open={open} zIndex={10007}>
      <div style={{ fontSize: 16, fontWeight: 950 }}>Enable location?</div>
      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
        Location helps center the map near you. You can skip this and still use the app.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onSkip} style={btnSecondary}>Not now</button>
        <button onClick={onEnable} style={btnPrimary}>Enable location</button>
      </div>
    </ModalShell>
  );
}

function ContactRequiredModal({ open, onLogin, onSignup, onGuest, onClose }) {
  return (
    <ModalShell open={open} zIndex={10008}>
      <div style={{ fontSize: 16, fontWeight: 950 }}>Contact required</div>

      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
        To submit a report, we need your name and either a phone number or email.
        <div style={{ marginTop: 8, fontWeight: 900 }}>
          Choose an option to continue:
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <button onClick={onLogin} style={btnPrimaryDark}>Log in</button>
        <button onClick={onSignup} style={btnPrimary}>Create account</button>
        <button onClick={onGuest} style={btnSecondary}>Continue as guest</button>
      </div>

      <button onClick={onClose} style={{ ...btnSecondary, marginTop: 2 }}>
        Cancel
      </button>
    </ModalShell>
  );
}

// shared styles for the modals above
const inputStyle = { padding: 10, borderRadius: 8, border: "1px solid #ddd" };
const btnPrimary = { padding: 10, borderRadius: 10, border: "none", background: "#1976d2", color: "white", fontWeight: 900, cursor: "pointer", width: "100%" };
const btnPrimaryDark = { padding: 10, borderRadius: 10, border: "none", background: "#111", color: "white", fontWeight: 900, cursor: "pointer", width: "100%" };
const btnSecondary = { padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)", background: "white", fontWeight: 900, cursor: "pointer", width: "100%" };
const btnPopupPrimary = {
  padding: 10,
  width: "100%",
  borderRadius: 10,
  border: "none",
  background: "#1976d2",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

function IntroModal({ open, onClose }) {
  return (
    <ModalShell open={open} zIndex={10009}>
      <div style={{ fontSize: 18, fontWeight: 950 }}>Welcome</div>
      <div style={{ fontSize: 13.5, opacity: 0.9, lineHeight: 1.35 }}>
        Tap a streetlight to report an issue. Zoom in to see official lights.
      </div>

      <button onClick={onClose} style={btnPrimary}>
        Got it
      </button>
    </ModalShell>
  );
}

function NoticeModal({ open, icon, title, message, buttonText = "OK", onClose, compact = false }) {
  if (!open) return null;

  return (
    <ModalShell open={open} zIndex={10001}>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: compact ? "center" : "flex-start",
          padding: compact ? "6px 0" : 0,
        }}
      >
        <div style={{ fontSize: compact ? 26 : 22, lineHeight: 1 }}>{icon}</div>

        {!compact && (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
            <div style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.35 }}>{message}</div>
          </div>
        )}
      </div>

      {!compact && (
        <button
          onClick={onClose}
          style={{
            marginTop: 6,
            padding: 10,
            borderRadius: 10,
            border: "none",
            background: "#1976d2",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
            width: "100%",
          }}
        >
          {buttonText}
        </button>
      )}
    </ModalShell>
  );
}

function AuthGateModal({
  open,
  step,
  setStep,
  onContinueGuest,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authLoading,
  onLogin,

  signupName,
  setSignupName,
  signupPhone,
  setSignupPhone,
  signupEmail,
  setSignupEmail,
  signupPassword,
  setSignupPassword,
  signupLoading,
  onCreateAccount,
  signupPassword2,
  setSignupPassword2,
}) {
  if (!open) return null;

  return (
    <ModalShell open={open} zIndex={10003}>
      {step === "welcome" && (
        <>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Welcome</div>

          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            Log in or create an account to view your past reports.
            <br />
            Guests can report, but must provide name + phone or email.
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <button
              onClick={() => setStep("login")}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "none",
                background: "#111",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Log in
            </button>

            <button
              onClick={() => setStep("signup")}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Create account
            </button>

            <button
              onClick={onContinueGuest}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "none",
                background: "#1976d2",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Continue as guest
            </button>
          </div>
        </>
      )}

      {step === "login" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Log in</div>
            <button
              onClick={() => setStep("welcome")}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
              aria-label="Back"
              title="Back"
            >
              ←
            </button>
          </div>

          <input
            placeholder="Email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            style={{ padding: 10, width: "100%", borderRadius: 10, border: "1px solid #ddd" }}
            autoCapitalize="none"
          />
          <input
            placeholder="Password"
            type="password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            style={{ padding: 10, width: "100%", borderRadius: 10, border: "1px solid #ddd" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !authLoading) onLogin();
            }}
          />

          <button
            onClick={onLogin}
            disabled={authLoading}
            style={{
              padding: 10,
              width: "100%",
              borderRadius: 10,
              border: "none",
              background: "#111",
              color: "white",
              fontWeight: 900,
              cursor: authLoading ? "not-allowed" : "pointer",
              opacity: authLoading ? 0.75 : 1,
            }}
          >
            {authLoading ? "Signing in…" : "Sign in"}
          </button>
        </>
      )}

      {step === "signup" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Create account</div>
            <button
              onClick={() => setStep("welcome")}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
              aria-label="Back"
              title="Back"
            >
              ←
            </button>
          </div>

          <input
            placeholder="Full name"
            value={signupName}
            onChange={(e) => setSignupName(e.target.value)}
            style={{ padding: 10, width: "100%", borderRadius: 10, border: "1px solid #ddd" }}
          />

          <input
            placeholder="Phone (optional)"
            value={signupPhone}
            onChange={(e) => setSignupPhone(e.target.value)}
            style={{ padding: 10, width: "100%", borderRadius: 10, border: "1px solid #ddd" }}
          />

          <input
            placeholder="Email"
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
            style={{ padding: 10, width: "100%", borderRadius: 10, border: "1px solid #ddd" }}
            autoCapitalize="none"
          />

          <input
            placeholder="Password (min 6 chars)"
            type="password"
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
            style={{ padding: 10, width: "100%", borderRadius: 10, border: "1px solid #ddd" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !signupLoading) onCreateAccount();
            }}
          />

          <input
            placeholder="Re-enter password"
            type="password"
            value={signupPassword2}
            onChange={(e) => setSignupPassword2(e.target.value)}
            style={{ padding: 10, width: "100%", borderRadius: 10, border: "1px solid #ddd" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !signupLoading) onCreateAccount();
            }}
          />
          {signupPassword2 && signupPassword !== signupPassword2 && (
            <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 900 }}>
              Passwords do not match.
            </div>
          )}


          <button
            onClick={onCreateAccount}
            disabled={signupLoading}
            style={{
              padding: 10,
              width: "100%",
              borderRadius: 10,
              border: "none",
              background: "#111",
              color: "white",
              fontWeight: 900,
              cursor: signupLoading ? "not-allowed" : "pointer",
              opacity: signupLoading ? 0.75 : 1,
            }}
          >
            {signupLoading ? "Creating…" : "Create account"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
            If your project requires email confirmation, you may need to confirm before logging in.
          </div>
        </>
      )}
    </ModalShell>
  );
}

function ReporterDetailsModal({ open, onClose, reportItem }) {
  if (!open) return null;

    const [resolvedName, setResolvedName] = useState(null);

    useEffect(() => {
      let cancelled = false;

      async function resolveName() {
        setResolvedName(null);

        const uid = (reportItem?.reporter_user_id || "").trim();
        if (!uid) return;

        const { data, error } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", uid)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error("[profiles] reporter name lookup error:", error);
          return;
        }

        const full = (data?.full_name || "").trim();
        if (full) setResolvedName(full);
      }

      resolveName();

      return () => {
        cancelled = true;
      };
    }, [open, reportItem?.reporter_user_id]);


  useEffect(() => {
    let cancelled = false;

    async function resolveName() {
      setResolvedName(null);

      const uid = (reportItem?.reporter_user_id || "").trim();
      if (!uid) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", uid)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("[profiles] reporter name lookup error:", error);
        return;
      }

      const full = (data?.full_name || "").trim();
      if (full) setResolvedName(full);
    }

    resolveName();

    return () => {
      cancelled = true;
    };
  }, [open, reportItem?.reporter_user_id]);

  const name =
    (resolvedName || "").trim() ||
    (reportItem?.reporter_name || "").trim() ||
    "—";
  const phone = (reportItem?.reporter_phone || "").trim() || "—";
  const email = (reportItem?.reporter_email || "").trim() || "—";
  const uid = (reportItem?.reporter_user_id || "").trim() || "—";

  return (
    <ModalShell open={open} zIndex={10011}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Reporter Details</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
        <div style={{ marginBottom: 8 }}><b>Name:</b> {name}</div>
        <div style={{ marginBottom: 8 }}><b>Phone:</b> {phone}</div>
        <div style={{ marginBottom: 8 }}><b>Email:</b> {email}</div>
      </div>

      <button onClick={onClose} style={{ ...btnPrimaryDark, width: "100%" }}>
        Close
      </button>
    </ModalShell>
  );
}

function AllReportsModal({ open, title, items, onClose, onReporterDetails }) {
  return (
    <ModalShell open={open} zIndex={10002}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>{title || "All Reports"}</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        History of reports + “marked fixed” actions for this light.
      </div>

      <div
        style={{
          marginTop: 6,
          maxHeight: "55vh",
          overflow: "auto",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
        }}
      >
        {!items?.length ? (
          <div style={{ fontSize: 13, opacity: 0.8 }}>No history for this light yet.</div>
        ) : (
          items.map((it, idx) => {
            const isFix = it.kind === "fix";

              // Treat all "pole down" variants as red
              const isPoleDown =
                !isFix &&
                ["downed_pole", "pole_down", "downed-pole"].includes(String(it.type || "").toLowerCase());

              // ✅ Color rules:
              // - Fix: green
              // - Pole down: red
              // - All other reports: yellow
              const dot = isFix ? "#2e7d32" : isPoleDown ? "#b71c1c" : "#fbc02d";


            return (
              <div
                key={`${it.kind}-${it.ts}-${idx}`}
                style={{
                  display: "grid",
                  gap: 4,
                  paddingBottom: 10,
                  borderBottom: idx === items.length - 1 ? "none" : "1px solid rgba(0,0,0,0.08)",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: dot,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                      flex: "0 0 auto",
                    }}
                  />
                  <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.1 }}>
                    {it.label}
                  </div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {formatDateTime(it.ts)}
                </div>

                {it.kind === "report" && (
                  <button
                    onClick={() => onReporterDetails?.(it)}
                    style={{
                      padding: 9,
                      width: "100%",
                      cursor: "pointer",
                      background: "#ffffff",
                      color: "#111",
                      border: "1px solid rgba(0,0,0,0.18)",
                      borderRadius: 8,
                      fontWeight: 850,
                    }}
                  >
                    Reporter Details
                  </button>
                )}

                {!!it.note?.trim() && (
                  <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.3 }}>
                    <b>Note:</b> {it.note}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={onClose}
        style={{
          marginTop: 6,
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
    </ModalShell>
  );
}

function MyReportsModal({
  open,
  onClose,
  groups, // [{ lightId, mineRows, lastTs }]
  expandedSet,
  onToggleExpand,
  reports,
  officialLights,
  slIdByUuid,
  fixedLights,
  lastFixByLightId,
  onFlyTo, // (lat,lng,zoom)
}) {
  if (!open) return null;

  return (
    <ModalShell open={open} zIndex={10004}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>My Reports</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        Your past reports grouped by streetlight.
      </div>

      <div
        style={{
          marginTop: 6,
          maxHeight: "60vh",
          overflow: "auto",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
        }}
      >
        {!groups?.length ? (
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            No reports yet.
          </div>
        ) : (
          groups.map((g) => {
            const coords = getCoordsForLightId(g.lightId, reports, officialLights);
            const info = computePublicStatusForLightId(g.lightId, { reports, fixedLights, lastFixByLightId });
            const dot = statusDotForLightId(g.lightId, coords, info, reports);

            const isOpen = expandedSet?.has(g.lightId);

            return (
              <div
                key={g.lightId}
                style={{
                  border: "1px solid rgba(0,0,0,0.10)",
                  borderRadius: 10,
                  padding: 10,
                  display: "grid",
                  gap: 8,
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: dot.color,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                      flex: "0 0 auto",
                    }}
                    title={dot.label}
                  />

                  <button
                    onClick={() => onToggleExpand(g.lightId)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      fontWeight: 950,
                      fontSize: 12.5,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    }}
                    title="Toggle details"
                  >
                    {displayLightId(g.lightId, slIdByUuid)}
                  </button>

                  <button
                    onClick={() => {
                      if (!coords) return;
                      onFlyTo([coords.lat, coords.lng], 18);
                    }}
                    disabled={!coords}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "white",
                      fontWeight: 900,
                      cursor: coords ? "pointer" : "not-allowed",
                      opacity: coords ? 1 : 0.6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Fly to
                  </button>
                </div>

                {/* Current status summary */}
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  Status: <b>{info.majorityLabel}</b>
                </div>

                {/* Dropdown details */}
                {isOpen && (
                  <div style={{ display: "grid", gap: 8, paddingTop: 6, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                    <div style={{ fontSize: 12, fontWeight: 950 }}>Your reports for this light</div>

                    <div style={{ display: "grid", gap: 6 }}>
                      {g.mineRows.map((r) => (
                        <div
                          key={r.id}
                          style={{
                            display: "grid",
                            gap: 2,
                            padding: 8,
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.08)",
                          }}
                        >
                          <div style={{ fontSize: 12.5, fontWeight: 900 }}>
                            {REPORT_TYPES[r.type] || r.type}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>
                            {formatDateTime(r.ts)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={onClose}
        style={{
          marginTop: 6,
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
    </ModalShell>
  );
}

function OpenReportsModal({
  open,
  onClose,
  groups, // [{ lightId, rows, count, lastTs }]
  expandedSet,
  onToggleExpand,
  reports,
  officialLights,
  slIdByUuid,
  fixedLights,
  lastFixByLightId,
  onFlyTo, // (posArray, zoom)
  onOpenAllReports, // (title, items)
}) {
  if (!open) return null;

  return (
    <ModalShell open={open} zIndex={10004}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Open Reports</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        All streetlights with current outage reports (since last fix), sorted by most reports.
      </div>

      <div
        style={{
          marginTop: 6,
          maxHeight: "60vh",
          overflow: "auto",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
        }}
      >
        {!groups?.length ? (
          <div style={{ fontSize: 13, opacity: 0.8 }}>No open reports right now.</div>
        ) : (
          groups.map((g) => {
            const coords = getCoordsForLightId(g.lightId, reports, officialLights);
            const info = computePublicStatusForLightId(g.lightId, { reports, fixedLights, lastFixByLightId });
            const dot = statusDotForLightId(g.lightId, coords, info, reports);
            const isOpen = expandedSet?.has(g.lightId);

            return (
              <div
                key={g.lightId}
                style={{
                  border: "1px solid rgba(0,0,0,0.10)",
                  borderRadius: 10,
                  padding: 10,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: dot.color,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                      flex: "0 0 auto",
                    }}
                    title={dot.label}
                  />

                  <button
                    onClick={() => onToggleExpand(g.lightId)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      fontWeight: 950,
                      fontSize: 12.5,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    }}
                    title="Toggle details"
                  >
                    {displayLightId(g.lightId, slIdByUuid)}
                  </button>

                  <button
                    onClick={() => {
                      onClose?.();
                      onOpenAllReports?.(g.lightId);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                    title="View reports"
                  >
                    View
                  </button>

                  <button
                    onClick={() => {
                      if (!coords) return;
                      onFlyTo?.([coords.lat, coords.lng], 18);
                    }}
                    disabled={!coords}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "white",
                      fontWeight: 900,
                      cursor: coords ? "pointer" : "not-allowed",
                      opacity: coords ? 1 : 0.6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Fly to
                  </button>
                </div>

                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  <b>{g.count}</b> report{g.count === 1 ? "" : "s"} • Status: <b>{info.majorityLabel}</b>
                </div>

                {isOpen && (
                  <div
                    style={{
                      borderTop: "1px dashed rgba(0,0,0,0.15)",
                      paddingTop: 8,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    {(g.rows || []).slice(0, 5).map((r) => (
                      <div
                        key={r.id}
                        style={{
                          fontSize: 12,
                          padding: 8,
                          borderRadius: 10,
                          border: "1px solid rgba(0,0,0,0.10)",
                          background: "rgba(0,0,0,0.02)",
                          lineHeight: 1.3,
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>
                          {REPORT_TYPES?.[r.type] || r.type || "Report"}
                        </div>
                        <div style={{ opacity: 0.8 }}>
                          {formatTs(r.ts)}
                          {r.note ? ` • ${r.note}` : ""}
                        </div>
                      </div>
                    ))}

                    {(g.rows || []).length > 5 && (
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Showing latest 5 of {g.rows.length}.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={onClose}
        style={{
          marginTop: 6,
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
    </ModalShell>
  );
}

function ManageAccountModal({
  open,
  onClose,
  profile,
  session,
  saving,
  editing,
  setEditing,
  form,
  setForm,
  onSave,
}) {
  if (!open) return null;

  const email = (profile?.email || session?.user?.email || "").trim() || "—";

  return (
    <ModalShell open={open} zIndex={10010}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Manage Account</div>
        <button
          onClick={() => {
            setEditing(false);
            onClose();
          }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
        <div style={{ marginBottom: 8 }}>
          <b>Email:</b> {email}
        </div>

        <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Full name</div>
          <input
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
            style={inputStyle}
            disabled={!editing || saving}
            placeholder="Your full name"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Phone</div>
          <input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            style={inputStyle}
            disabled={!editing || saving}
            placeholder="555-555-5555"
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            style={{ ...btnPrimaryDark, width: "100%" }}
            disabled={saving}
          >
            Edit
          </button>
        ) : (
          <>
            <button
              onClick={() => {
                setEditing(false);
                // revert changes on cancel edit
                setForm({
                  full_name: (profile?.full_name || "").trim(),
                  phone: (profile?.phone || "").trim(),
                });
              }}
              style={btnSecondary}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              onClick={onSave}
              style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        )}
      </div>

      <div style={{ fontSize: 11.5, opacity: 0.7, lineHeight: 1.35 }}>
        Email changes will be a later step (requires verification).
      </div>
    </ModalShell>
  );
}

function AccountMenuPanel({
  open,
  session,
  profile,
  onClose,
  onManage,
  onMyReports,
  onLogout,
}) {
  if (!open) return null;

  const sessionEmail = session?.user?.email || "";
  const meta = session?.user?.user_metadata || {};

  const displayName =
    (profile?.full_name || "").trim() ||
    (meta.full_name || meta.name || "").trim() ||
    (sessionEmail ? sessionEmail.split("@")[0] : "—");

  const displayEmail =
    (profile?.email || "").trim() ||
    sessionEmail ||
    "—";

  const displayPhone =
    (profile?.phone || "").trim() ||
    (meta.phone || meta.phone_number || "").trim() ||
    "—";

  return (
    <div
      className="sl-overlay-pass"
      style={{
        position: "fixed",
        top: `calc(${window.innerWidth <= 640 ? 74 : 92}px + env(safe-area-inset-top))`,
        left: 0,
        right: 0,
        zIndex: 1700,
        display: "grid",
        placeItems: "center",
        padding: "0 16px",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          width: "min(280px, calc(100vw - 32px))",
          background: "rgba(255,255,255,0.98)",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 12,
          boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
          padding: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 950 }}>Account</div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
            aria-label="Close account menu"
            title="Close"
          >
            ✕
          </button>
        </div>

        {session ? (
          <>
            <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.35 }}>
              <div><b>Name:</b> {displayName}</div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <button
                onClick={onManage}
                style={{
                  padding: 10,
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Manage Account
              </button>

              <button
                onClick={onMyReports}
                style={{
                  padding: 10,
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                My Reports
              </button>

              <button
                onClick={onLogout}
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
                Logout
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 11.5, opacity: 0.7, lineHeight: 1.35 }}>
              Manage Account editing will require a password challenge (next step).
            </div>
          </>
        ) : (
          <>
            <div style={{ marginTop: 10, fontSize: 12.5, opacity: 0.85, lineHeight: 1.35 }}>
              You’re not signed in. Log in or create an account to view your report history.
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <button
                onClick={() => {
                  onClose();
                  // open auth gate straight to login
                  window.__openAuthGate?.("login");
                }}
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
                Log in
              </button>

              <button
                onClick={() => {
                  onClose();
                  // open auth gate straight to signup
                  window.__openAuthGate?.("signup");
                }}
                style={{
                  padding: 10,
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Create account
              </button>

              <button
                onClick={onClose}
                style={{
                  padding: 10,
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


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

function uniqueLightIdsForCluster(light) {
  const ids = new Set();
  if (light?.lightId) ids.add(light.lightId);
  for (const r of light?.reports || []) {
    const id = r.light_id || lightIdFor(r.lat, r.lng);
    ids.add(id);
  }
  return Array.from(ids);
}

function formatDateTime(ts) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function getCoordsForLightId(lightId, reports, officialLights) {
  // official lights have exact coords
  const ol = (officialLights || []).find((x) => x.id === lightId);
  if (ol) return { lat: ol.lat, lng: ol.lng, isOfficial: true };

  // community: use average of all reports on that lightId
  const rows = (reports || []).filter((r) => (r.light_id || "") === lightId);
  if (!rows.length) return null;

  const avg = rows.reduce(
    (acc, r) => ({ lat: acc.lat + r.lat, lng: acc.lng + r.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: avg.lat / rows.length, lng: avg.lng / rows.length, isOfficial: false };
}

function makeLightIdFromCoords(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const latDec = Math.abs(lat).toFixed(6).split(".")[1] || "";
  const lngDec = Math.abs(lng).toFixed(6).split(".")[1] || "";

  const latPart = latDec.slice(0, 5).padEnd(5, "0");
  const lngPart = lngDec.slice(0, 5).padEnd(5, "0");

  return `SL${latPart}${lngPart}`;
}

function computePublicStatusForLightId(lightId, { reports, fixedLights, lastFixByLightId }) {
  const all = (reports || []).filter((r) => (r.light_id || "") === lightId);

  const lastFixTs = Math.max(lastFixByLightId?.[lightId] || 0, fixedLights?.[lightId] || 0);

  const sinceFix = lastFixTs ? all.filter((r) => (r.ts || 0) > lastFixTs) : all;
  const isFixed = sinceFix.length === 0;

  const majorityKey = majorityReportType(sinceFix);
  const majorityLabel = majorityKey ? (REPORT_TYPES[majorityKey] || majorityKey) : "Operational";

  // dot logic: match your official/community logic
  // - Official: black when fixed, otherwise severity by count since fix
  // - Community: green when fixed, otherwise likelihood by total count (your existing statusFromCount)
  return {
    isFixed,
    sinceFixCount: sinceFix.length,
    majorityKey,
    majorityLabel: isFixed ? "Operational" : majorityLabel,
  };
}

function statusDotForLightId(lightId, coords, statusInfo, reports) {
  const isOfficial = Boolean(coords?.isOfficial);

  if (isOfficial) {
    if (statusInfo.isFixed) return { label: "Operational", color: "#111" };
    return officialStatusFromSinceFixCount(statusInfo.sinceFixCount); // yellow/orange/red
  }

  // community
  if (statusInfo.isFixed) return { label: "Fixed", color: "#2e7d32" };
  // use your community "likelihood" logic based on total reports for that lightId
  // (you can switch this to sinceFix if you want consistency)
  return statusFromCount(
    (reports || []).filter((r) => (r.light_id || "") === lightId).length
  );
}

// Build "All Reports" timeline: reports + fix events
function buildLightHistory({ reportRows, fixActionRows }) {
  const items = [];

  // reports
  for (const r of reportRows || []) {
    const label = REPORT_TYPES[r.type] || r.type || "Report";
      items.push({
        kind: "report",
        ts: r.ts || 0,
        label,
        note: r.note || "",
        type: r.type || "",

        // ✅ reporter fields (for admin "Reporter Details" button)
        reporter_user_id: r.reporter_user_id || null,
        reporter_name: r.reporter_name || null,
        reporter_phone: r.reporter_phone || null,
        reporter_email: r.reporter_email || null,
      });
  }

  // fix / reopen actions (full history)
  for (const a of fixActionRows || []) {
    const action = String(a.action || "").toLowerCase();
    const ts = a.ts || 0;

    if (action === "fix") {
      items.push({ kind: "fix", ts, label: "Marked fixed", note: "" });
    } else if (action === "reopen") {
      items.push({ kind: "reopen", ts, label: "Re-opened", note: "" });
    }
  }

  items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return items;
}

function isValidCoord(n) {
  const x = Number(n);
  return Number.isFinite(x);
}

function isValidLatLng(lat, lng) {
  return isValidCoord(lat) && isValidCoord(lng);
}




// ==================================================
// SECTION 8 — Main App
// ==================================================
export default function App() {
  const mapRef = useRef(null);
  const isMobile = useIsMobile(640);
  const suppressMapClickRef = useRef({ until: 0 });
  const clickDelayRef = useRef({ lastTs: 0, timer: null, lastLatLng: null });

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
  const [mappingMode, setMappingMode] = useState(false);
  const [mapZoom, setMapZoom] = useState(OFFICIAL_LIGHTS_MIN_ZOOM);

  const [reports, setReports] = useState([]);
  const [picked, setPicked] = useState(null);

  const [reportType, setReportType] = useState("out");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // fixedLights: { [light_id]: fixed_at_ms }
  const [fixedLights, setFixedLights] = useState({});
  const [lastFixByLightId, setLastFixByLightId] = useState({});
  const [actionsByLightId, setActionsByLightId] = useState({});

  // per-light cooldowns: persisted
  const [cooldowns, setCooldowns] = useState(() => pruneCooldowns(loadCooldownsFromStorage()));

  // activeLight: object for modal context
  const [activeLight, setActiveLight] = useState(null);

  // Notice modal state
  const [notice, setNotice] = useState({ open: false, icon: "", title: "", message: "", compact: false });
  const noticeTimerRef = useRef(null);

  function openNotice(icon, title, message, opts = {}) {
    const { autoCloseMs = 0, compact = false } = opts;

    // clear any prior timer
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }

    setNotice({ open: true, icon, title, message, compact });

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

  const [allReportsModal, setAllReportsModal] = useState({
    open: false,
    title: "",
    items: [],
  });

  const [reporterDetails, setReporterDetails] = useState({ open: false, item: null });

  function openReporterDetails(item) {
    setReporterDetails({ open: true, item });
  }

  function closeReporterDetails() {
    setReporterDetails({ open: false, item: null });
  }

  const [myReportsOpen, setMyReportsOpen] = useState(false);
  const [myReportsExpanded, setMyReportsExpanded] = useState(() => new Set()); // lightIds expanded

  const [openReportsOpen, setOpenReportsOpen] = useState(false);
  const [openReportsExpanded, setOpenReportsExpanded] = useState(() => new Set()); // lightIds expanded


  function toggleMyReportsExpanded(lightId) {
    setMyReportsExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(lightId)) next.delete(lightId);
      else next.add(lightId);
      return next;
    });
  }

  function closeMyReports() {
    setMyReportsOpen(false);
    setMyReportsExpanded(new Set());
  }

  function toggleOpenReportsExpanded(lightId) {
    setOpenReportsExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(lightId)) next.delete(lightId);
      else next.add(lightId);
      return next;
    });
  }

  function closeOpenReports() {
    setOpenReportsOpen(false);
    setOpenReportsExpanded(new Set());
  }


  function openAllReports(title, items) {
    setAllReportsModal({ open: true, title: title || "All Reports", items: items || [] });
  }

  function closeAllReports() {
    setAllReportsModal((p) => ({ ...p, open: false }));
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
    // Ask for location immediately on first load (once per tab session)
    try {
      const alreadyPrompted = sessionStorage.getItem(LOC_PROMPTED_SESSION_KEY) === "1";
      if (!alreadyPrompted) {
        sessionStorage.setItem(LOC_PROMPTED_SESSION_KEY, "1");
        setShowLocationPrompt(true);
      }
    } catch {
      // If sessionStorage fails, still show once
      setShowLocationPrompt(true);
    }
  }, []);



  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authGateStep, setAuthGateStep] = useState("welcome"); // welcome | login | signup | guest

  const [showLocationPrompt, setShowLocationPrompt] = useState(false);


  // Auth
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

      useEffect(() => {
      // simple bridge so AccountMenuPanel can open auth gate without prop-drilling
      window.__openAuthGate = (step = "welcome") => {
        // ✅ If already logged in, don’t open auth gate
        if (session?.user?.id) return;

        setAuthGateStep(step);
        setAuthGateOpen(true);
      };

      return () => {
        try {
          delete window.__openAuthGate;
        } catch {}
      };
    }, [session?.user?.id]);


  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Signup fields
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPassword2, setSignupPassword2] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);


  // Gate flow
  const [guestInfo, setGuestInfo] = useState({ name: "", phone: "", email: "" });
  const [guestInfoOpen, setGuestInfoOpen] = useState(false);
  const [contactChoiceOpen, setContactChoiceOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
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
  const [accountView, setAccountView] = useState("menu"); 
  // "menu" | "manage" | "myReports"

 const [manageOpen, setManageOpen] = useState(false);
  const [manageEditing, setManageEditing] = useState(false);
  const [manageSaving, setManageSaving] = useState(false);
  const [manageForm, setManageForm] = useState({ full_name: "", phone: "" });

  const showAdminTools = isAdmin || showAdminLogin;



  // =========================
  // BULK REPORTING (official lights)
  // =========================
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]); // array of official light UUIDs
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const bulkSelectedSet = useMemo(() => new Set(bulkSelectedIds), [bulkSelectedIds]);
  const bulkSelectedCount = bulkSelectedIds.length;

  function clearBulkSelection() {
    setBulkSelectedIds([]);
  }
  

  function toggleBulkSelection(id) {
    setBulkSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  function exitBulkMode() {
    setBulkMode(false);
    setBulkConfirmOpen(false);
    clearBulkSelection();
  }

  const [exitMappingConfirmOpen, setExitMappingConfirmOpen] = useState(false);

  function exitMappingMode() {
    setMappingMode(false);
    setMappingQueue([]);
  }

  function requestExitMappingMode() {
    if (mappingQueue.length > 0) {
      setExitMappingConfirmOpen(true);
      return;
    }
    exitMappingMode();
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
  const [mappingQueue, setMappingQueue] = useState([]);
  // { lat, lng, tempId }



  // Persist cooldowns anytime they change
  useEffect(() => {
    const pruned = pruneCooldowns(cooldowns);
    if (Object.keys(pruned).length !== Object.keys(cooldowns).length) {
      setCooldowns(pruned);
      saveCooldownsToStorage(pruned);
      return;
    }
    saveCooldownsToStorage(pruned);
  }, [cooldowns]);

  // -------------------------
  // Auth: session + admin check
  // -------------------------
    // -------------------------
  // Email confirmation flash (one-time)
  // -------------------------
  useEffect(() => {
    const KEY = "sl_email_confirmed_flash_shown";
    if (sessionStorage.getItem(KEY)) return;

    const search = window.location.search || "";
    const hash = window.location.hash || "";

    // Supabase confirmation links can arrive as:
    // - ?code=...&type=signup (PKCE)
    // - #access_token=...&type=signup (implicit)
    // - ?token_hash=...&type=signup (older patterns)
    const looksLikeEmailConfirm =
      /type=signup/i.test(search + hash) &&
      (/(^|[?#&])code=/i.test(search) ||
        /(^|[?#&])token_hash=/i.test(search) ||
        /(^|[?#&])access_token=/i.test(hash));

    if (!looksLikeEmailConfirm) return;

    sessionStorage.setItem(KEY, "1");

    // Clean URL so refresh doesn't re-trigger the flash
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      // ignore
    }

    openNotice("✅", "Email confirmed", "You're all set.", {
      autoCloseMs: 2000,
      compact: true,
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function checkAdmin() {
      if (!session?.user?.id) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(Boolean(data?.user_id));
    }

    checkAdmin();
  }, [session]);

    useEffect(() => {
      let cancelled = false;

      async function loadProfile() {
        if (!session?.user?.id) {
          setProfile(null);
          return;
        }

        const uid = session.user.id;

        const { data, error: profErr } = await supabase
          .from("profiles")
          .select("full_name, phone, email")
          .eq("user_id", uid)
          .maybeSingle();

        // ✅ Self-heal profile after email confirmation:
        // If no row exists (or phone/name missing), upsert from auth metadata.
        const meta = session?.user?.user_metadata || {};
        const desiredFullName = (meta.full_name || meta.name || "").trim() || null;
        const desiredPhone = (meta.phone || meta.phone_number || "").trim() || null;
        const desiredEmail = (session?.user?.email || "").trim() || null;

        const missingRow = !data;
        const missingName = !((data?.full_name || "").trim()) && !!desiredFullName;
        const missingPhone = !((data?.phone || "").trim()) && !!desiredPhone;

        if (!profErr && (missingRow || missingName || missingPhone)) {
          const { error: upErr } = await supabase
            .from("profiles")
            .upsert(
              [{
                user_id: uid,
                full_name: desiredFullName,
                phone: desiredPhone,
                email: desiredEmail,
              }],
              { onConflict: "user_id" }
            );

          if (upErr) {
            console.error("[profiles] upsert error:", upErr);
          }
        }

        if (cancelled) return;

        if (profErr) {
          console.error("[profiles] load error:", profErr);

          // ✅ fallback to auth metadata instead of nuking profile
          setProfile({
            full_name: (session?.user?.user_metadata?.full_name || "").trim() || null,
            phone:
              (session?.user?.user_metadata?.phone || "").trim() ||
              (session?.user?.user_metadata?.phone_number || "").trim() ||
              null,
            email: session?.user?.email || null,
          });
          return;
        }

        // ✅ if no row, still fallback (prevents email-prefix behavior)
        setProfile(
          data || {
            full_name: (session?.user?.user_metadata?.full_name || "").trim() || null,
            phone:
              (session?.user?.user_metadata?.phone || "").trim() ||
              (session?.user?.user_metadata?.phone_number || "").trim() ||
              null,
            email: session?.user?.email || null,
          }
        );
      }

      loadProfile();

      return () => {
        cancelled = true;
      };
    }, [session?.user?.id]);


  useEffect(() => {
    if (!manageOpen) return;

    setManageForm({
      full_name: (profile?.full_name || "").trim(),
      phone: (profile?.phone || "").trim(),
    });
  }, [manageOpen, profile?.full_name, profile?.phone]);


  useEffect(() => {
    if (!isAdmin && mappingMode) setMappingMode(false);
  }, [isAdmin, mappingMode]);

  async function signIn() {
    setAuthLoading(true);

    const email = (authEmail || "").trim().toLowerCase();
    const password = authPassword || "";

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setAuthLoading(false);

    if (error) {
      openNotice("⚠️", "Sign-in failed", error.message);
      return false;
    }

    setAccountMenuOpen(false);
    return true;
  }

    async function userLogin(email, password) {
      const e = (email || "").trim().toLowerCase();
      const p = password || "";

      const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
      if (error) {
        openNotice("📨", "Email Confirmation Sent", error.message);
        return false;
      }
      return true;
    }

  async function userCreateAccount({ email, password, full_name, phone }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          phone,
        },
      },
    });

    if (error) {
      openNotice("⚠️", "Sign up failed", error.message);
      return false;
    }

    // user may be immediately available or may require email confirmation depending on your Supabase settings
    const uid = data?.user?.id;
    if (uid) {
      const { error: profErr } = await supabase
        .from("profiles")
        .insert([{ user_id: uid, full_name, phone: phone || null, email }]);

      if (profErr) {
        console.error(profErr);
      }
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
    if (!password || password.length < 6) {
      openNotice("⚠️", "Password too short", "Use at least 6 characters.");
      return;
    }
    if (signupPassword !== signupPassword2) {
      openNotice("⚠️", "Passwords don’t match", "Please re-enter your password so both fields match.");
      return;
    }


    setSignupLoading(true);
    const ok = await userCreateAccount({ email, password, full_name, phone });
      setSignupLoading(false);

      if (!ok) return;

      // Close gate first so the notice is foreground
      setAuthGateOpen(false);
      setAuthGateStep("welcome");

      // ✅ Show correct message (no auto-login attempt)
      openNotice(
        "✅",
        "Confirmation sent",
        "Check your email for the confirmation link. After you confirm, come back here to sign in."
      );
  

    // Clear fields
    setSignupName("");
    setSignupPhone("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupPassword2("");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setAuthEmail("");
    setAuthPassword("");
    setAccountMenuOpen(false);
  }

  async function saveManagedProfile() {
    if (!session?.user?.id) return;

    const full_name = (manageForm.full_name || "").trim();
    const phone = (manageForm.phone || "").trim();

    if (!full_name) {
      openNotice("⚠️", "Name required", "Please enter your full name.");
      return;
    }

    setManageSaving(true);

    // 1) Update profiles table
    const { error: upErr } = await supabase
      .from("profiles")
      .upsert(
        [{
          user_id: session.user.id,
          full_name,
          phone: phone || null,
          email: (profile?.email || session.user.email || null),
        }],
        { onConflict: "user_id" }
      );

    if (upErr) {
      console.error(upErr);
      openNotice("⚠️", "Save failed", "Could not update your profile. Please try again.");
      setManageSaving(false);
      return;
    }

    // 2) Best-effort: mirror into auth metadata too (helps fallbacks)
    const { error: metaErr } = await supabase.auth.updateUser({
      data: { full_name, phone: phone || null },
    });

    if (metaErr) {
      // not fatal
      console.warn("[auth.updateUser] warning:", metaErr);
    }

    // 3) Update local state immediately
    setProfile((prev) => ({
      ...(prev || {}),
      full_name,
      phone: phone || null,
      email: (prev?.email || session.user.email || null),
    }));

    setManageSaving(false);
    setManageEditing(false);
    openNotice("✅", "Saved", "Your account details were updated.");
  }

  // -------------------------
  // Load reports + fixed + official
  // -------------------------
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setError("");

      const [
        { data: reportData, error: repErr },
        { data: fixedData, error: fixErr },
        { data: actionData, error: actErr },
        { data: officialData, error: offErr },
      ] = await Promise.all([
        supabase.from("reports").select("*").order("created_at", { ascending: false }),
        supabase.from("fixed_lights").select("*"),
        supabase
          .from("light_actions")
          .select("light_id, action, created_at")
          .eq("action", "fix")
          .order("created_at", { ascending: false }),
        supabase.from("official_lights").select("id, sl_id, lat, lng").order("created_at", { ascending: true }),
      ]);

      if (repErr) {
        console.error(repErr);
        setError(repErr.message || "Failed to load reports");
        setLoading(false);
        return;
      }
      if (fixErr) {
        console.error(fixErr);
        setError(fixErr.message || "Failed to load fixed lights");
        setLoading(false);
        return;
      }

      if (offErr) console.error(offErr);
      else setOfficialLights(
        (officialData || [])
          .filter((r) => r && r.id && isValidLatLng(r.lat, r.lng))
          .map((r) => ({
            id: r.id,
            sl_id: r.sl_id || null,
            lat: Number(r.lat),
            lng: Number(r.lng),
          }))
      );

      setReports(
        (reportData || []).map((r) => ({
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          type: r.report_type,
          note: r.note || "",
          ts: new Date(r.created_at).getTime(),
          light_id: r.light_id || lightIdFor(r.lat, r.lng),

          reporter_user_id: r.reporter_user_id || null,
          reporter_name: r.reporter_name || null,
          reporter_phone: r.reporter_phone || null,
          reporter_email: r.reporter_email || null,
        }))
      );

      const fixedMap = {};
      for (const row of fixedData || []) fixedMap[row.light_id] = new Date(row.fixed_at).getTime();
      setFixedLights(fixedMap);

      let map = {};
      if (actErr) console.error(actErr);
      else {
        for (const a of actionData || []) {
          const ts = new Date(a.created_at).getTime();
          if (!map[a.light_id] || ts > map[a.light_id]) map[a.light_id] = ts;
        }
        const byId = {};
        for (const a of actionData || []) {
          const ts = new Date(a.created_at).getTime();
          if (!byId[a.light_id]) byId[a.light_id] = [];
          byId[a.light_id].push({ action: a.action, ts });
        }
        setActionsByLightId(byId);

        setLastFixByLightId(map);
      }

      setLoading(false);
    }

    loadAll();
  }, []);

  // -------------------------
  // Realtime subscriptions
  // -------------------------
  useEffect(() => {
    const reportsChannel = supabase
      .channel("realtime-reports")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, (payload) => {
        const r = payload.new;
        const incoming = {
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          type: r.report_type,
          note: r.note || "",
          ts: new Date(r.created_at).getTime(),
          light_id: r.light_id || lightIdFor(r.lat, r.lng),

          reporter_user_id: r.reporter_user_id || null,
          reporter_name: r.reporter_name || null,
          reporter_phone: r.reporter_phone || null,
          reporter_email: r.reporter_email || null,
        };

        setReports((prev) => {
          if (prev.some((x) => x.id === incoming.id)) return prev;
          return [incoming, ...prev];
        });
      })
      .subscribe();

    const fixedChannel = supabase
      .channel("realtime-fixed")
      .on("postgres_changes", { event: "*", schema: "public", table: "fixed_lights" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const lightId = payload?.old?.light_id;
          if (!lightId) {
            console.warn("[fixed_lights DELETE] missing payload.old.light_id", payload);
            return;
          }

          setFixedLights((prev) => {
            const next = { ...prev };
            delete next[lightId];
            return next;
          });
          return;
        }

        const row = payload.new;
        setFixedLights((prev) => ({
          ...prev,
          [row.light_id]: new Date(row.fixed_at).getTime(),
        }));
      })
      .subscribe();

    const actionsChannel = supabase
      .channel("realtime-actions")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "light_actions" }, (payload) => {
        const a = payload.new;
        const ts = new Date(a.created_at).getTime();

        setActionsByLightId((prev) => {
          const list = prev[a.light_id] ? [...prev[a.light_id]] : [];
          list.unshift({ action: a.action, ts });
          return { ...prev, [a.light_id]: list };
        });

        const t = String(a.action || "").toLowerCase();
        if (t !== "fix") return;

        setLastFixByLightId((prev) => {
          const cur = prev[a.light_id] || 0;
          if (ts <= cur) return prev;
          return { ...prev, [a.light_id]: ts };
        });
      })
      .subscribe();


    const officialChannel = supabase
      .channel("realtime-official-lights")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "official_lights" },
        (payload) => {
          const row = payload.new;

          // INSERT/UPDATE give payload.new, DELETE does not
          if (!row) return;

          // ✅ never allow invalid coords into state
          if (!row.id || !isValidLatLng(row.lat, row.lng)) {
            console.warn("[official_lights realtime] invalid row, ignoring:", row);
            return;
          }

          const clean = { id: row.id, lat: Number(row.lat), lng: Number(row.lng) };

          setOfficialLights((prev) => {
            const idx = prev.findIndex((x) => x.id === clean.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = clean;
              return next;
            }
            return [...prev, clean];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "official_lights" },
        (payload) => {
          const id = payload?.old?.id; // ✅ may be missing depending on replica identity / realtime config
          if (!id) {
            console.warn("[official_lights DELETE] missing payload.old.id", payload);
            return; // ✅ don’t crash the app
          }
          setOfficialLights((prev) => prev.filter((x) => x.id !== id));
        }
      )
      .subscribe((status) => {
        console.log("OFFICIAL realtime subscribe status:", status);
      });


    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(fixedChannel);
      supabase.removeChannel(actionsChannel);
      supabase.removeChannel(officialChannel);
    };
  }, []);

  // Build a fast lookup of official IDs
  const officialIdSet = useMemo(() => new Set(officialLights.map((o) => o.id)), [officialLights]);

  const slIdByUuid = useMemo(() => {
    const m = new Map();
    for (const l of officialLights || []) {
      const uuid = (l.id || "").trim();
      const sl = (l.sl_id || "").trim();
      if (uuid && sl) m.set(uuid, sl);
    }
    return m;
  }, [officialLights]);

  // Only "community" reports get clustered into community lights
  const communityReports = useMemo(
    () => reports.filter((r) => !officialIdSet.has(r.light_id)),
    [reports, officialIdSet]
  );

  const myReportsByLight = useMemo(() => {
    const uid = session?.user?.id;
    if (!uid) return [];

    // reports you already store are normalized as:
    // { id, lat, lng, type, note, ts, light_id }
    const mine = reports.filter((r) => r.reporter_user_id === uid); 
    // ⚠️ If your local `reports` state does NOT include reporter_user_id,
    // we’ll fix that in step 3 (small patch).

    const map = new Map(); // lightId -> array of reports
    for (const r of mine) {
      const lid = r.light_id || lightIdFor(r.lat, r.lng);
      if (!map.has(lid)) map.set(lid, []);
      map.get(lid).push(r);
    }

    // sort each group newest first
    for (const [lid, arr] of map.entries()) {
      arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }

    // return list sorted by most recent activity in that light
    const groups = Array.from(map.entries()).map(([lightId, mineRows]) => ({
      lightId,
      mineRows,
      lastTs: mineRows?.[0]?.ts || 0,
    }));

    groups.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
    return groups;
  }, [session?.user?.id, reports]);

  const openReportsByLight = useMemo(() => {
    // "Open" means: reports exist since last fix (or ever, if never fixed)
    const map = new Map(); // lightId -> rows (since-fix)
    const all = Array.isArray(reports) ? reports : [];

    for (const r of all) {
      const lightId = (r.light_id || "").trim();
      if (!lightId) continue;

      // Only official lights
      if (officialIdSet && !officialIdSet.has(lightId)) continue;

      const lastFixTs = Math.max(lastFixByLightId?.[lightId] || 0, fixedLights?.[lightId] || 0);
      if (lastFixTs && (r.ts || 0) <= lastFixTs) continue; // not "open" (pre-fix)

      if (!map.has(lightId)) map.set(lightId, []);
      map.get(lightId).push(r);
    }

    // sort each group newest first
    for (const [lid, arr] of map.entries()) {
      arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }

    // groups sorted by MOST reports → least; tie-breaker: newest activity
    const groups = Array.from(map.entries()).map(([lightId, rows]) => ({
      lightId,
      rows,
      count: rows.length,
      lastTs: rows?.[0]?.ts || 0,
    }));

    groups.sort((a, b) => (b.count - a.count) || (b.lastTs - a.lastTs));
    return groups;
  }, [reports, officialIdSet, fixedLights, lastFixByLightId]);

  const lights = useMemo(() => [], []);


  // -------------------------
  // SECTION 8F — Actions
  // -------------------------
  async function insertReportWithFallback(payload) {
    const tryValues = [payload.report_type];

    if (payload.report_type === "downed_pole") {
      tryValues.push("pole_down");
      tryValues.push("downed-pole");
    }

    let lastErr = null;

    for (const rt of tryValues) {
      const attempt = { ...payload, report_type: rt };
      const { data, error: insErr } = await supabase
        .from("reports")
        .insert([attempt])
        .select("*")
        .single();

      if (!insErr) return { data, usedReportType: rt };
      lastErr = insErr;
    }

    return { data: null, error: lastErr };
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
    setPicked([lat, lng]);
    setActiveLight({ lat, lng, lightId, isOfficial, reports });
    setNote("");           // optional: reset note each time
    setReportType("out");  // optional: default each time
  }

  async function submitReport() {
    if (!picked || saving || !activeLight) return;

    const lightId = activeLight.lightId || lightIdFor(picked[0], picked[1]);

    if (reportType === "other" && !note.trim()) {
      openNotice("⚠️", "Notes required", "Please add a brief note for “Other”.");
      return;
    }

        const isAuthed = Boolean(session?.user?.id);

        // Best-effort fallbacks for authed users (so we never block them)
        const authedEmail = session?.user?.email || "";
        const authedName =
          (profile?.full_name || "").trim() ||
          (session?.user?.user_metadata?.full_name || "").trim() ||
          (authedEmail ? authedEmail.split("@")[0] : "User");

        const name = isAuthed ? authedName : (guestInfo.name || "");
        const phone = isAuthed ? (profile?.phone || "") : (guestInfo.phone || "");
        const email = isAuthed
          ? ((profile?.email || authedEmail) || "")
          : (guestInfo.email || "");

        // ✅ Only guests get blocked and routed to login/create/guest
        if (!isAuthed) {
          if (!name.trim() || (!phone.trim() && !email.trim())) {
            setPendingSubmit(true);
            setContactChoiceOpen(isAuthed ? false : true);
            setSaving(false);
            return;
          }
        }

        // ✅ Cooldown enforcement AFTER identity is known
        const identityGuestInfo = isAuthed ? null : { name, phone, email };

        if (!canIdentityReportLight(lightId, {
          session,
          profile,
          guestInfo: identityGuestInfo,
          reports,
          cooldowns,
        })) {
          openNotice("⏳", "Already reported", "You can report this light again after 24 hours.");
          setActiveLight(null);
          setPicked(null);
          return;
        }

        setSaving(true);

        const payload = {
          lat: picked[0],
          lng: picked[1],
          report_type: reportType,
          note: note.trim() || null,
          light_id: lightId,

          reporter_user_id: isAuthed ? session.user.id : null,
          reporter_name: name.trim(),
          reporter_phone: phone.trim() || null,
          reporter_email: email.trim() || null,
        };


    const { data, error: insErr } = await insertReportWithFallback(payload);

    if (insErr) {
      console.error(insErr);
      setActiveLight(null);
      setPicked(null);
      openNotice("⚠️", "Couldn’t submit", "Something went wrong while submitting your report. Please try again.");
      setSaving(false);
      return;
    }

    const saved = {
      id: data.id,
      lat: data.lat,
      lng: data.lng,
      type: data.report_type,
      note: data.note || "",
      ts: new Date(data.created_at).getTime(),
      light_id: data.light_id || lightId,

      reporter_user_id: data.reporter_user_id || null,
      reporter_name: data.reporter_name || null,
      reporter_phone: data.reporter_phone || null,
      reporter_email: data.reporter_email || null,
    };

    setReports((prev) => [saved, ...prev]);

    if (!session?.user?.id) {
      setCooldowns((prev) => {
        const next = pruneCooldowns({ ...prev, [lightId]: Date.now() });
        saveCooldownsToStorage(next);
        return next;
      });
    }

    mapRef.current?.closePopup(); // ✅ ensure popup is closed

    setActiveLight(null);
    setPicked(null);
    setNote("");
    setSaving(false);

    // ✅ hard-close any popup + suppress any late/synthetic click
    mapRef.current?.closePopup();
    setTimeout(() => mapRef.current?.closePopup(), 0);
    suppressMapClickRef.current.until = Date.now() + 900;

    // ✅ tiny success toast 
    openNotice("✅", "", "", { autoCloseMs: 500, compact: true });
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
  
  function removeFromMappingQueue(tempId) {
    setMappingQueue((prev) => prev.filter((q) => q.tempId !== tempId));
  }

  async function confirmMappingQueue() {
    if (!mappingQueue.length) return false;

    const rows = mappingQueue.map((q) => ({
      sl_id: makeLightIdFromCoords(q.lat, q.lng),
      lat: q.lat,
      lng: q.lng,
      created_by: session?.user?.id || null,
    }));

    setSaving(true);

    const uniqueRows = rows.filter(
      (r, i, arr) => arr.findIndex((x) => x.sl_id === r.sl_id) === i
    );

    const { error } = await supabase
      .from("official_lights")
      .insert(uniqueRows)

    setSaving(false);

    if (error) {
      console.error(error);
      openNotice("⚠️", "Failed to Place lights", error.message || "Unknown error");
      return false;
    }

    setMappingQueue([]);
    openNotice("✅", "", "", { autoCloseMs: 500, compact: true });
    return true;
  }

  // Submit bulk reports
  async function submitBulkReports() {
  if (saving) return;

  const ids = bulkSelectedIds;
  if (!ids.length) return;

  // guests must have contact; authed users are never blocked
  const isAuthed = Boolean(session?.user?.id);

  const authedEmail = session?.user?.email || "";
  const authedName =
    (profile?.full_name || "").trim() ||
    (session?.user?.user_metadata?.full_name || "").trim() ||
    (authedEmail ? authedEmail.split("@")[0] : "User");

  const name = isAuthed ? authedName : (guestInfo.name || "");
  const phone = isAuthed ? (profile?.phone || "") : (guestInfo.phone || "");
  const email = isAuthed ? ((profile?.email || authedEmail) || "") : (guestInfo.email || "");

  if (!isAuthed) {
    if (!name.trim() || (!phone.trim() && !email.trim())) {
      setPendingSubmit(true);
      setContactChoiceOpen(true);
      return;
    }
  }


  // close any popup + suppress popups while modal closes
  mapRef.current?.closePopup?.();
  suppressPopups?.(1600);

  setSaving(true);

  let okCount = 0;
  let skipCooldown = 0;

  for (const lightId of ids) {
    // cooldown guard (identity-based)
    const identityGuestInfo = isAuthed ? null : { name, phone, email };

    if (!canIdentityReportLight(lightId, {
      session,
      profile,
      guestInfo: identityGuestInfo,
      reports,
      cooldowns,
    })) {
      skipCooldown += 1;
      continue;
    }

    const ol = officialLights.find((x) => x.id === lightId);
    if (!ol) continue;

    // notes required rule
    if (reportType === "other" && !note.trim()) {
      openNotice("⚠️", "Notes required", "Please add a brief note for “Other”.");
      setSaving(false);
      return;
    }

    const payload = {
      lat: ol.lat,
      lng: ol.lng,
      report_type: reportType,
      note: note.trim() || null,
      light_id: lightId,

      reporter_user_id: isAuthed ? session.user.id : null,
      reporter_name: name.trim(),
      reporter_phone: phone.trim() || null,
      reporter_email: email.trim() || null,
    };

    const { data, error: insErr } = await insertReportWithFallback(payload);

    if (insErr) {
      console.error(insErr);
      continue; // keep going; bulk shouldn’t fail entirely
    }

    okCount += 1;

    // optimistic local list (same shape you use)
    const saved = {
      id: data.id,
      lat: data.lat,
      lng: data.lng,
      type: data.report_type,
      note: data.note || "",
      ts: new Date(data.created_at).getTime(),
      light_id: data.light_id || lightId,

      reporter_user_id: data.reporter_user_id || null,
      reporter_name: data.reporter_name || null,
      reporter_phone: data.reporter_phone || null,
      reporter_email: data.reporter_email || null,
    };

    setReports((prev) => [saved, ...prev]);

    // update per-light cooldown
    if (!session?.user?.id) {
      setCooldowns((prev) => {
        const next = pruneCooldowns({ ...prev, [lightId]: Date.now() });
        saveCooldownsToStorage(next);
        return next;
      });
    }
  } // ✅ CLOSE the for-loop HERE

  setSaving(false);
  setBulkConfirmOpen(false);
  clearBulkSelection();
  setNote("");

  if (okCount > 0) {
    openNotice("✅", "Submitted", `Submitted ${okCount} report${okCount === 1 ? "" : "s"}.`);
  } else if (skipCooldown > 0) {
    openNotice("⏳", "Already reported", "Those selected lights are still on cooldown.");
  } else {
    openNotice("⚠️", "No reports submitted", "Nothing was submitted. Try again.");
  }
}


  // Admin: optimistic add official light (no OK spam)
  async function addOfficialLight(lat, lng) {
    if (!isAdmin) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, sl_id: makeLightIdFromCoords(lat, lng), lat, lng };

    // Show immediately
    setOfficialLights((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("official_lights")
      .insert([{ lat, lng, created_by: session?.user?.id }])
      .select("id, sl_id, lat, lng")
      .single();

    if (error) {
      console.error(error);
      // Rollback optimistic
      setOfficialLights((prev) => prev.filter((x) => x.id !== tempId));
      openNotice("⚠️", "Insert failed", error.message || "Couldn’t add official light.");
      return;
    }

    // Replace temp with real
    setOfficialLights((prev) =>
      prev.map((x) => (x.id === tempId ? data : x))
    );
  }

  async function deleteOfficialLight(id) {
    if (!isAdmin) return;

    // ✅ close popup before mutating marker list
    mapRef.current?.closePopup?.();
    suppressPopups?.(900);

    // ✅ snapshot must be a COPY, not the same array reference
    const snapshot = [...officialLights];

    // optimistic remove
    setOfficialLights((prev) => prev.filter((x) => x.id !== id));

    try {
      const { error } = await supabase.from("official_lights").delete().eq("id", id);

      if (error) {
        console.error(error);
        setOfficialLights(snapshot);
        openNotice("⚠️", "Couldn’t delete light", error.message || "Delete failed.");
      }
    } catch (err) {
      console.error(err);
      setOfficialLights(snapshot);
      openNotice("⚠️", "Couldn’t delete light", "Delete failed.");
    }
  }

  async function markFixed(light) {
    if (!light) return;

    const isOfficial = Boolean(light?.isOfficial);

    const ids = isOfficial
      ? [light.lightId] // official = single id (uuid)
      : uniqueLightIdsForCluster(light); // community cluster = many ids

    // 1) Write to light_actions for EACH affected light_id (this is the permanent history)
    const { data: actRows, error: actErr } = await supabase
      .from("light_actions")
      .insert(
        ids.map((id) => ({
          light_id: id,
          action: "fix",
          actor_user_id: session?.user?.id || null,
        }))
      )
      .select("light_id, created_at");

    if (actErr) {
      console.error(actErr);
      openNotice("⚠️", "Action failed", "Couldn’t record fix history.");
      return;
    }

    // Use server time from the newest insert row (they’ll be basically identical)
    const newest = (actRows || []).reduce((best, r) => {
      const t = new Date(r.created_at).getTime();
      return !best || t > best.t ? { t, iso: r.created_at } : best;
    }, null);

    const fixIso = newest?.iso || new Date().toISOString();
    const fixMs = new Date(fixIso).getTime();

    // 2) Update fixed_lights cache for fast reads
    const { error: fixErr } = await supabase
      .from("fixed_lights")
      .upsert(ids.map((id) => ({ light_id: id, fixed_at: fixIso })));

    if (fixErr) {
      console.error(fixErr);
      openNotice("⚠️", "Action failed", "Couldn’t update fixed state.");
      return;
    }

    // 3) Update local state so UI reflects instantly
    setFixedLights((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = fixMs;
      return next;
    });

    setLastFixByLightId((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = fixMs;
      return next;
    });
  }


  async function reopenLight(light) {
    if (!light) return;

    const isOfficial = Boolean(light?.isOfficial);

    const ids = isOfficial
      ? [light.lightId]
      : uniqueLightIdsForCluster(light);

    // 1) Record reopen history for each id
    const { error: logErr } = await supabase
      .from("light_actions")
      .insert(
        ids.map((id) => ({
          light_id: id,
          action: "reopen",
          actor_user_id: session?.user?.id || null,
        }))
      );

    if (logErr) console.error(logErr);

    // 2) Clear fixed_lights cache
    const { error: reErr } = await supabase
      .from("fixed_lights")
      .delete()
      .in("light_id", ids);

    if (reErr) {
      console.error(reErr);
      openNotice("⚠️", "Action failed", "Couldn’t re-open this light.");
      return;
    }

    // 3) Update local state
    setFixedLights((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });

    setLastFixByLightId((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  }

    // Helper: always forces MapFlyTo to re-run (even on fast re-clicks)
  function flyToTarget(pos, zoom) {
    setMapTarget((prev) => ({
      pos,
      zoom,
      nonce: (prev?.nonce || 0) + 1, // always changes
    }));
  }

  async function findMyLocation(force = false) {
    if (!window.isSecureContext) {
      openNotice("⚠️", "Needs HTTPS", "Location requires HTTPS. Use your ngrok HTTPS URL when testing.");
      return;
    }

    if (!navigator.geolocation) {
      openNotice("⚠️", "Location unavailable", "Location is not available on this device.");
      return;
    }

    // ✅ Only block auto attempts when geoDenied is true
    // ✅ Allow explicit user retry (force=true)
    if (geoDenied && !force) {
      openNotice("⚠️", "Location denied", "Location access is blocked. Tap 📍 if you want to try again.");
      return;
    }

    try {
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: "geolocation" });

        // ✅ If denied and NOT forced → block
        if (status.state === "denied" && !force) {
          setGeoDeniedPersist(true);
          openNotice("⚠️", "Location denied", "Location access is blocked. Check device Settings / browser site permissions.");
          return;
        }

        // ✅ If it’s granted, clear flag
        if (status.state === "granted" && geoDenied) {
          setGeoDeniedPersist(false);
        }
      }
    } catch {
      // ignore
    }

    setLocating(true);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          setUserLoc([lat, lng]);
          flyToTarget([lat, lng], LOCATE_ZOOM);


          setAutoFollow(true);
          setFollowCamera(true);

          if (geoDenied) setGeoDeniedPersist(false);

          setLocating(false);
        },
        () => {
          setLocating(false);
          setGeoDeniedPersist(true);
          openNotice("⚠️", "Location denied", "Unable to access location. You can still pan and tap the map.");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000,
        }
      );
    }


  // Watch position (smoother + heading updates)
  useEffect(() => {
    if (!autoFollow) return;
    if (!window.isSecureContext || !navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const next = [lat, lng];
        setUserLoc(next);

        if (followCamera) {
          flyToTarget([lat, lng], LOCATE_ZOOM);
        }
      },
      (err) => {
        if (err?.code === 1) {
          setAutoFollow(false);
          setGeoDeniedPersist(true);
          openNotice("⚠️", "Location denied", "Location access was blocked.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 250,
        timeout: 15000,
      }
    );

    return () => {
      try {
        navigator.geolocation.clearWatch(id);
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFollow, followCamera, mapZoom]);

  // -------------------------
  // Render
  // -------------------------
  const connected = !loading && !error;

  return (
    <div
      className="sl-root"
      style={{
        position: "relative",
        height: "100dvh",
        minHeight: "100vh",
        width: "100vw",
        overflow: "hidden",
      }}
    >
      <style>{`
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          overscroll-behavior: none;
          -webkit-overflow-scrolling: auto;
          background: #fff;
        }
        #root { height: 100%; overflow: hidden; }

        .sl-overlay-pass { pointer-events: none; }
        .sl-overlay-pass > * { pointer-events: auto; }

        .sl-desktop-panel { pointer-events: auto; }

        .sl-desktop-only { display: block; }
        .sl-mobile-only { display: none; }
        @media (max-width: 640px) {
          .sl-desktop-only { display: none; }
          .sl-mobile-only { display: block; }
        }

        .sl-map-tool {
          position: fixed;
          top: calc(86px + env(safe-area-inset-top));
          right: 14px;
          z-index: 2200;
          pointer-events: auto;
          display: grid;
          gap: 8px;
          justify-items: end;
        }

        .sl-map-tool-btn {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.14);
          background: rgba(255,255,255,0.96);
          box-shadow: 0 10px 22px rgba(0,0,0,0.18);
          display: grid;
          place-items: center;
          font-size: 18px;
          font-weight: 900;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        .sl-map-tool-btn.is-on {
          background: rgba(17,17,17,0.92);
          color: white;
          border: 1px solid rgba(0,0,0,0.35);
        }

        .sl-map-tool-mini {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.14);
          background: rgba(255,255,255,0.96);
          box-shadow: 0 10px 22px rgba(0,0,0,0.18);
          display: grid;
          place-items: center;
          font-size: 16px;
          font-weight: 950;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        .sl-map-tool-mini.is-on {
          background: rgba(17,17,17,0.92);
          color: white;
          border: 1px solid rgba(0,0,0,0.35);
        }

        .sl-map-tool-hint {
          font-size: 11px;
          font-weight: 900;
          background: rgba(17,17,17,0.88);
          color: white;
          padding: 6px 8px;
          border-radius: 10px;
          width: max-content;
          max-width: 240px;
          box-shadow: 0 10px 22px rgba(0,0,0,0.18);
        }
      `}</style>

      <AuthGateModal
        open={authGateOpen && !session}
        step={authGateStep}
        setStep={setAuthGateStep}
        onContinueGuest={() => {
          setAuthGateOpen(false);
          setAuthGateStep("welcome");
        }}

        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        authLoading={authLoading}
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
        onCreateAccount={handleCreateAccount}
      />

      <GuestInfoModal
        open={guestInfoOpen}
        info={guestInfo}
        setInfo={setGuestInfo}
        onCancel={() => {
          setGuestInfoOpen(false);
          setPendingSubmit(false);
        }}
        onContinue={() => {
          setGuestInfoOpen(false);
          setAuthGateOpen(false);
          setAuthGateStep("welcome");
        }}
      />

      <LocationPromptModal
        open={showLocationPrompt}
        onEnable={async () => {
          await findMyLocation(true);  // ✅ forced retry
          setShowLocationPrompt(false);
        }}
        onSkip={() => {
          setShowLocationPrompt(false);
        }}
      />

      <ContactRequiredModal
        open={contactChoiceOpen}
        onClose={() => {
          setContactChoiceOpen(false);
          setPendingSubmit(false);
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
          setContactChoiceOpen(false);
          setGuestInfoOpen(true);
        }}
      />

      <NoticeModal
        open={notice.open}
        icon={notice.icon}
        title={notice.title}
        message={notice.message}
        compact={notice.compact}
        buttonText="OK"
        onClose={closeNotice}
      />

      <ModalShell open={exitMappingConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Save queued lights?</div>

          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            You have <b>{mappingQueue.length}</b> queued light{mappingQueue.length === 1 ? "" : "s"}.
            Place them before turning mapping off?
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={async () => {
                const ok = await confirmMappingQueue();
                if (!ok) return; // keep modal open if insert failed
                setExitMappingConfirmOpen(false);
                exitMappingMode();
              }}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "#2e7d32",
                color: "white",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Placing…" : "Place & Turn Off"}
            </button>

            <button
              type="button"
              onClick={() => {
                setExitMappingConfirmOpen(false);
                exitMappingMode(); // discard queue
              }}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Discard & Turn Off
            </button>

            <button
              type="button"
              onClick={() => setExitMappingConfirmOpen(false)}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ConfirmReportModal
        open={Boolean(activeLight) || bulkConfirmOpen}
        onCancel={() => {
          if (saving) return;

          // close single
          setActiveLight(null);
          setPicked(null);
          setNote("");

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
        saving={saving}
      />

      <AllReportsModal
        open={allReportsModal.open}
        title={allReportsModal.title}
        items={allReportsModal.items}
        onClose={closeAllReports}
        onReporterDetails={openReporterDetails}
      />

      <ReporterDetailsModal
        open={reporterDetails.open}
        reportItem={reporterDetails.item}
        onClose={closeReporterDetails}
      />

      <MyReportsModal
        open={myReportsOpen}
        onClose={closeMyReports}
        groups={myReportsByLight}
        expandedSet={myReportsExpanded}
        onToggleExpand={toggleMyReportsExpanded}
        reports={reports}
        officialLights={officialLights}
        slIdByUuid={slIdByUuid}
        fixedLights={fixedLights}
        lastFixByLightId={lastFixByLightId}
        onFlyTo={(pos, zoom) => {
          closeMyReports();
          flyToTarget(pos, zoom);
        }}
      />

      <OpenReportsModal
        open={openReportsOpen}
        onClose={closeOpenReports}
        groups={openReportsByLight}
        expandedSet={openReportsExpanded}
        onToggleExpand={toggleOpenReportsExpanded}
        reports={reports}
        officialLights={officialLights}
        slIdByUuid={slIdByUuid}
        fixedLights={fixedLights}
        lastFixByLightId={lastFixByLightId}
        onFlyTo={(pos, zoom) => {
          closeOpenReports();
          flyToTarget(pos, zoom);
        }}
        onOpenAllReports={(lightId) => {
          const reportRows = (reports || [])
            .filter((r) => (r.light_id || "").trim() === (lightId || "").trim())
            .sort((a, b) => (b.ts || 0) - (a.ts || 0));

          const history = buildLightHistory({
            reportRows,
            fixActionRows: actionsByLightId?.[lightId] || [],
          });

          openAllReports("All Reports (Official light)", history);
        }}
      />

      <ManageAccountModal
        open={manageOpen}
        onClose={() => {
          setManageOpen(false);
          setManageEditing(false);
        }}
        profile={profile}
        session={session}
        saving={manageSaving}
        editing={manageEditing}
        setEditing={setManageEditing}
        form={manageForm}
        setForm={setManageForm}
        onSave={saveManagedProfile}
      />


      {/* =========================
          Map
         ========================= */}
      <MapContainer
        center={ASHTABULA}
        zoom={OFFICIAL_LIGHTS_MIN_ZOOM}
        style={{ height: "100%", width: "100%" }}
        whenCreated={(m) => { mapRef.current = m; }}
      >
        {mapStyle === "streets" ? (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
        ) : (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
          />
        )}

        <MapFlyTo target={mapTarget} />
        <MapTwoTapHoldDragZoom
          enabled={true}
          suppressClickRef={suppressMapClickRef}
          clickDelayRef={clickDelayRef}
        />

        <MapInteractionLock
          locked={
            authGateOpen ||
            Boolean(activeLight) ||
            notice.open ||
            allReportsModal.open
          }
        />

        <MapClickHandler
          suppressClickRef={suppressMapClickRef}
          clickDelayRef={clickDelayRef}
          enableTwoTapZoom={true}
          onPick={(latlng) => {
            const [lat, lng] = latlng;

            // Admin mapping mode
            if (isAdmin && mappingMode) {
              if (mapZoom < OFFICIAL_LIGHTS_MIN_ZOOM) {
                openNotice(
                  "🔍",
                  "Zoom in",
                  `Zoom to ${OFFICIAL_LIGHTS_MIN_ZOOM}+ to place lights.`
                );
                return;
              }

              setMappingQueue((prev) => [
                ...prev,
                {
                  lat,
                  lng,
                  tempId: `queued-${Date.now()}-${Math.random()}`,
                },
              ]);

              return;
            }

            // ✅ No proximity reporting from map taps.
            // Only marker popup button can open ConfirmReportModal.
            return;

            // No community fallback + no notice.
            // If tap isn't near an official light, ignore the tap.
            return;
          }}
        />

        <MapUserInteractionWatcher
          onUserInteract={() => {
            setFollowCamera(false);
          }}
        />

        <MapZoomWatcher onZoom={setMapZoom} />

        {/* Smoothed user location dot */}
        <SmoothUserMarker position={userLoc} />

        {/* OFFICIAL LIGHTS — only show when zoomed in */}
        {mapZoom >= OFFICIAL_LIGHTS_MIN_ZOOM && (
          <>
            {mappingMode &&
              mappingQueue.map((q) => (
                <Marker
                  key={q.tempId}
                  position={[q.lat, q.lng]}
                  icon={officialLightIcon("#2e7d32")}
                  eventHandlers={{
                    click: () => removeFromMappingQueue(q.tempId),
                  }}
                />
              ))}

            {officialLights

            .filter((ol) => ol?.id && isValidLatLng(ol.lat, ol.lng))
            .map((ol) => {
            const officialReports = reports.filter((r) => r.light_id === ol.id);
          
            // ✅ Source of truth for last fix = light_actions (fix)
            const lastFixTs = Math.max(
              lastFixByLightId[ol.id] || 0,
              fixedLights[ol.id] || 0
            );

            // ✅ Since-fix reports
            const reportsSinceFix = lastFixTs
              ? officialReports.filter((r) => (r.ts || 0) > lastFixTs)
              : officialReports;

            // ✅ Official lights: fixed = 0 reports since last fix
            const isFixed = reportsSinceFix.length === 0;


            // ✅ Majority issue since fix
            const majorityKey = majorityReportType(reportsSinceFix);
            const majorityLabel = majorityKey ? (REPORT_TYPES[majorityKey] || majorityKey) : "—";

            // Public-facing “Status:” label
            const publicStatusLabel = isFixed ? "Operational" : (majorityLabel || "Reported");

            // Marker color still based on total count (your original likelihood logic)
            // Official lights:
            // ✅ Severity based ONLY on reports since last fix
            // - 0 reports → normal black
            // - 1-3 reports = yellow
            // - 4-6 reports = orange
            // - >7 reports = red
            const baseStatus = officialStatusFromSinceFixCount(reportsSinceFix.length);

            // ✅ Fixed official lights use normal color (not green)
            const status = isFixed
              ? { label: "Operational", color: "#111" } // normal/default 💡 color
              : baseStatus;

            return (
              <Marker
                key={ol.id}
                position={[ol.lat, ol.lng]}
                icon={officialLightIcon(
                  bulkSelectedSet.has(ol.id) ? "#1976d2" : status.color
                )}
                eventHandlers={{
                  click: () => {
                    if (!bulkMode) return;
                    toggleBulkSelection(ol.id);
                    // keep map from opening popups
                    mapRef.current?.closePopup?.();
                    suppressPopups?.(1200);
                  },
                }}
              >
                {!bulkMode && !popupsSuppressed && (
                  <Popup>
                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        width: "min(240px, calc(100vw - 40px))",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>Official streetlight</div>

                      {isAdmin && (
                        <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
                          Light ID:{" "}
                          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                            {displayLightId(ol.id, slIdByUuid)}
                          </span>
                        </div>
                      )}

                      <div style={{ fontSize: 13 }}>
                        Status: <b>{publicStatusLabel}</b>
                      </div>

                      {!mappingMode && (
                      <button
                          style={btnPopupPrimary}
                          onPointerDown={(e) => guardPopupAction(e, 1100, { prevent: false })}
                          onMouseDown={(e) => guardPopupAction(e, 1100, { prevent: false })}
                          onTouchStart={(e) => guardPopupAction(e, 1100, { prevent: false })}
                          onClick={(e) => {
                            guardPopupAction(e, 1100, { prevent: true });

                            mapRef.current?.closePopup();
                            setTimeout(() => mapRef.current?.closePopup(), 0);

                            openConfirmForLight({
                              lat: ol.lat,
                              lng: ol.lng,
                              lightId: ol.id,
                              isOfficial: true,
                              reports: officialReports,
                            });
                          }}
                        >
                          Report issue
                        </button>
                      )}

                      {isAdmin && (
                        <div style={{ display: "grid", gap: 8 }}>
                          <hr style={{ margin: "4px 0" }} />

                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();

                              const history = buildLightHistory({
                                reportRows: officialReports,
                                fixActionRows: actionsByLightId[ol.id] || [],
                              });


                              openAllReports("All Reports (Official light)", history);
                            }}
                            style={{
                              padding: 9,
                              width: "100%",
                              cursor: "pointer",
                              background: "#ffffff",
                              color: "#111",
                              border: "1px solid rgba(0,0,0,0.18)",
                              borderRadius: 8,
                              fontWeight: 850,
                            }}
                          >
                            All Reports
                          </button>

                          {/* ✅ Totals + majority since fixed */}
                          {!isFixed && (
                            <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.25 }}>
                              <div>
                                <b>Total reports:</b> {reportsSinceFix.length}
                              </div>
                              <div>
                                <b>Majority issue:</b> {majorityLabel}
                              </div>
                            </div>
                          )}

                          {!isFixed ? (
                            <button
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                markFixed({ lightId: ol.id, reports: officialReports, isOfficial: true });
                              }}
                              style={{
                                padding: 9,
                                width: "100%",
                                cursor: "pointer",
                                background: "#2e7d32",
                                color: "white",
                                border: "none",
                                borderRadius: 8,
                                fontWeight: 800,
                              }}
                            >
                              Mark fixed
                            </button>
                          ) : (
                            <button
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                reopenLight({ lightId: ol.id, reports: officialReports, isOfficial: true });
                              }}
                              style={{
                                padding: 9,
                                width: "100%",
                                cursor: "pointer",
                                background: "#ffffff",
                                color: "#2e7d32",
                                border: "1px solid #2e7d32",
                                borderRadius: 8,
                                fontWeight: 800,
                              }}
                            >
                              Re-open
                            </button>
                          )}
                        </div>
                      )}

                      {isAdmin && mappingMode && (
                        <button
                          onPointerDown={(e) => guardPopupAction(e, 1400, { prevent: false })}
                          onMouseDown={(e) => guardPopupAction(e, 1400, { prevent: false })}
                          onTouchStart={(e) => guardPopupAction(e, 1400, { prevent: false })}
                          onClick={(e) => {
                            guardPopupAction(e, 1400, { prevent: true });

                            // ✅ close popup BEFORE removing marker from React state
                            mapRef.current?.closePopup?.();
                            setTimeout(() => mapRef.current?.closePopup?.(), 0);

                            // ✅ temporarily suppress popups so Leaflet doesn't freak out
                            suppressPopups?.(1200);

                            // ✅ delete on next tick (after popup begins closing)
                            setTimeout(() => {
                              deleteOfficialLight(ol.id);
                            }, 0);
                          }}
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            border: "none",
                            background: "#b71c1c",
                            color: "white",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          Delete light
                        </button>
                      )}

                      <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.35 }}>
                        {mappingMode
                          ? "Mapping mode: tap map to add lights, delete is enabled."
                          : "Tap “Report issue” to submit a report for this official light."}
                      </div>
                    </div>
                  </Popup>
                )}
              </Marker>
            );
          })}


          {/* Community report lights */}
            {lights.map((light) => {
              const fixedAt = fixedLights[light.lightId] || 0;

              const hasReportAfterFix = fixedAt
                ? light.reports.some((r) => (r.ts || 0) > fixedAt)
                : false;

              const isFixed = Boolean(fixedAt) && !hasReportAfterFix;

              const baseStatus = statusFromCount(light.reports.length);
              const status = isFixed ? { label: "Fixed", color: "#2e7d32" } : baseStatus;

              const onCooldown = !canReport(light.lightId, cooldowns);

              const lastFixTs = Math.max(
                lastFixByLightId[light.lightId] || 0,
                fixedAt || 0
              );

              const reportsSinceFix = lastFixTs
                ? light.reports.filter((r) => (r.ts || 0) > lastFixTs)
                : light.reports;

              const majorityKey = majorityReportType(reportsSinceFix);
              const majorityLabel = majorityKey ? (REPORT_TYPES[majorityKey] || majorityKey) : "—";
              const publicStatusLabel = isFixed ? "Operational" : (majorityLabel || "Reported");

              return (
                <Marker key={light.lightId} position={[light.lat, light.lng]} icon={dotIcon(status.color)}>
                  <Popup>
                    <div style={{ display: "grid", gap: 10, minWidth: 210 }}>
                      <div style={{ fontWeight: 900 }}>Streetlight</div>

                      {isAdmin && (
                        <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
                          Light ID:{" "}
                          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                            {displayLightId(light.lightId, slIdByUuid)}
                          </span>
                        </div>
                      )}

                      <div style={{ fontSize: 13 }}>
                        Status: <b>{publicStatusLabel}</b>
                      </div>

                      <button
                        style={btnPopupPrimary}
                        onPointerDown={(e) => guardPopupAction(e, 1100, { prevent: false })}
                        onMouseDown={(e) => guardPopupAction(e, 1100, { prevent: false })}
                        onTouchStart={(e) => guardPopupAction(e, 1100, { prevent: false })}
                        onClick={(e) => {
                          guardPopupAction(e, 1100, { prevent: true });

                          mapRef.current?.closePopup();
                          setTimeout(() => mapRef.current?.closePopup(), 0);

                          openConfirmForLight({
                            lat: light.lat,
                            lng: light.lng,
                            lightId: light.lightId,
                            isOfficial: false,
                            reports: light.reports,
                          });
                        }}
                      >
                        Report issue
                      </button>

                      {isAdmin && (
                        <div style={{ display: "grid", gap: 8 }}>
                          <hr style={{ margin: "4px 0" }} />

                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();

                              const fixedAt = fixedLights[light.lightId] || 0;
                              const fallbackFix = lastFixByLightId[light.lightId] || 0;
                              const fixTs = fixedAt || fallbackFix;

                              const history = buildLightHistory({
                                reportRows: light.reports,
                                fixActionRows: actionsByLightId[light.lightId] || [],
                              });


                              openAllReports("All Reports (Community light)", history);
                            }}
                            style={{
                              padding: 9,
                              width: "100%",
                              cursor: "pointer",
                              background: "#ffffff",
                              color: "#111",
                              border: "1px solid rgba(0,0,0,0.18)",
                              borderRadius: 8,
                              fontWeight: 850,
                            }}
                          >
                            All Reports
                          </button>


                          {!isFixed && (
                            <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.25 }}>
                              <div>
                                <b>Total reports:</b> {reportsSinceFix.length}
                              </div>
                              <div>
                                <b>Majority issue:</b> {majorityLabel}
                              </div>
                            </div>
                          )}

                          {!isFixed ? (
                            <button
                              onClick={() => markFixed(light)}
                              style={{
                                padding: 9,
                                width: "100%",
                                cursor: "pointer",
                                background: "#2e7d32",
                                color: "white",
                                border: "none",
                                borderRadius: 8,
                                fontWeight: 800,
                              }}
                            >
                              Mark fixed
                            </button>
                          ) : (
                            <button
                              onClick={() => reopenLight(light)}
                              style={{
                                padding: 9,
                                width: "100%",
                                cursor: "pointer",
                                background: "#ffffff",
                                color: "#2e7d32",
                                border: "1px solid #2e7d32",
                                borderRadius: 8,
                                fontWeight: 800,
                              }}
                            >
                              Re-open
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
        </>
      )}
      </MapContainer>

      {/* =========================
          Floating tool buttons (mobile + desktop)
         ========================= */}
      <div className="sl-map-tool">
        {/* Satellite toggle */}
        <button
          type="button"
          className="sl-map-tool-mini"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMapStyle((p) => (p === "streets" ? "sat" : "streets"));
          }}
          title={mapStyle === "sat" ? "Satellite" : "Street map"}
          aria-label="Toggle satellite map"
        >
          {mapStyle === "sat" ? "🗺️" : "🛰️"}
        </button>

        <button
          type="button"
          className={`sl-map-tool-mini ${locating ? "is-on" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();

            // ✅ If user previously denied, show the prompt modal first
            if (geoDenied) {
              setShowLocationPrompt(true);
              return;
            }

            // ✅ If not denied, just locate immediately
            findMyLocation(false);
          }}
          title="Find my location"
          aria-label="Find my location"
        >
          📍
        </button>


        {/* =========================
          Bulk Reporting Button
         ========================= */}
        {isAdmin && (
          <button
            type="button"
            className={`sl-map-tool-mini ${openReportsOpen ? "is-on" : ""}`}
            title="Open Reports"
            aria-label="Open Reports"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              // keep modes mutually exclusive / reduce confusion
              if (mappingMode) requestExitMappingMode();
              if (bulkMode) setBulkMode(false);

              setOpenReportsOpen(true);
            }}
          >
            📋
          </button>
        )}

        <button
          type="button"
          className={`sl-map-tool-mini ${bulkMode ? "is-on" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();

            setBulkConfirmOpen(false);

            setBulkMode((on) => {
              const next = !on;

              if (next) {
                // ✅ turning BULK ON → force mapping OFF
                setMappingMode(false);
                setMappingQueue([]);

                mapRef.current?.closePopup?.();
                suppressPopups?.(1200);
              } else {
                // turning BULK OFF clears selection
                clearBulkSelection();
              }

              return next;
            });
          }}
          title={bulkMode ? "Bulk selection ON" : "Bulk selection OFF"}
          aria-label="Toggle bulk selection"
        >
          ⚡️
        </button>

        {showAdminTools && (
          <button
            type="button"
            className={`sl-map-tool-btn ${mappingMode ? "is-on" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              setMappingMode((on) => {
                const next = !on;

                if (next) {
                  // ✅ turning MAPPING ON → force bulk OFF
                  setBulkMode(false);
                  setBulkConfirmOpen(false);
                  clearBulkSelection();

                  suppressPopups?.(900);
                  mapRef.current?.closePopup?.();
                } else {
                  // turning MAPPING OFF: if queue has items, confirm first
                  if (mappingQueue.length > 0) {
                    setExitMappingConfirmOpen(true);
                    return true; // keep mapping mode ON until user decides
                  }

                  // no queued items => safe to turn off
                  setMappingQueue([]);
                }

                return next;
              });
            }}
            title={mappingMode ? "Light mapping ON" : "Light mapping OFF"}
            aria-label="Toggle light mapping"
          >
            💡
          </button>
        )}
      </div>

      {/* =========================
          Mobile UI overlays
         ========================= */}
          
      {/* =========================
          Desktop UI overlays
        ========================= */}
      <div className="sl-desktop-only">
        {/* TOP overlay */}
        <div
          className="sl-overlay-pass"
          style={{
            position: "fixed",
            top: "14px",
            left: 0,
            right: 0,
            zIndex: 1600,
            display: "grid",
            placeItems: "center",
            padding: "0 16px",
          }}
        >
          <div
            style={{
              width: "min(720px, calc(100vw - 32px))",
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 14,
              boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
              padding: "12px 14px",
              display: "grid",
              gap: 6,
              position: "relative",
            }}
          >
            
              <button
                type="button"
                onClick={() => setAccountMenuOpen((p) => !p)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: 10,
                  width: 40,
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
                aria-label="Account menu"
                title={session ? "Account" : "Login / Account"}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 13,
                    background: session?.user ? "#111" : "transparent",
                    color: session?.user ? "white" : "inherit",
                  }}
                >
                  {session?.user
                    ? getInitials(profile?.full_name || session.user.email)
                    : "👤"}
                </span>
              </button>


            <div style={{ fontSize: 22, fontWeight: 950, textAlign: "center", lineHeight: 1.1 }}>
              Ashtabula Streetlight Reports
            </div>

            <div style={{ fontSize: 14, opacity: 0.75, textAlign: "center", lineHeight: 1.2 }}>
              Community-reported streetlight outages
            </div>

            <div style={{ fontSize: 14, opacity: 0.92, textAlign: "center", lineHeight: 1.25, fontWeight: 800 }}>
              Tap the location of the light to report an outage.
            </div>

            <div
              style={{
                position: "absolute",
                left: 12,
                top: 12,
                width: 12,
                height: 12,
                borderRadius: 999,
                background: connected ? "#2ecc71" : "#e74c3c",
                border: "2px solid white",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}
              title={connected ? "Connected" : "Not connected"}
            />
          </div>
        </div>

        {/* Account menu panel (desktop) */}
        <AccountMenuPanel
          open={accountMenuOpen}
          session={session}
          profile={profile}
          onClose={() => {
            setAccountMenuOpen(false);
            setAccountView("menu");
          }}
          onManage={() => {
            setAccountMenuOpen(false);
            setManageEditing(false);
            setManageOpen(true);
          }}
          onMyReports={() => {
            setAccountMenuOpen(false);
            setMyReportsOpen(true);
          }}
          onLogout={() => {
            signOut();
            setAccountMenuOpen(false);
          }}
        />


        {/* =========================
              Bulk Action Bar (desktop)
            ========================= */}
          {bulkMode && (
            <div
              className="sl-overlay-pass"
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: "calc(14px + 86px)", // sits above the disclaimer card
                zIndex: 1601,
                padding: "0 16px",
              }}
            >
              <div
                style={{
                  width: "min(720px, calc(100vw - 32px))",
                  margin: "0 auto",
                  display: "flex",
                  gap: 10,
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    clearBulkSelection();
                  }}
                  disabled={bulkSelectedCount === 0 || saving}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "rgba(255,255,255,0.96)",
                    boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
                    fontWeight: 900,
                    cursor: bulkSelectedCount === 0 || saving ? "not-allowed" : "pointer",
                    opacity: bulkSelectedCount === 0 || saving ? 0.6 : 1,
                  }}
                >
                  Clear Selection
                </button>

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (bulkSelectedCount === 0) {
                      openNotice("⚠️", "No lights selected", "Tap multiple official 💡 lights first.");
                      return;
                    }

                    mapRef.current?.closePopup?.();
                    suppressPopups?.(1400);

                    setNote("");
                    setReportType("out");
                    setBulkConfirmOpen(true);
                  }}
                  disabled={bulkSelectedCount === 0 || saving}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "none",
                    background: "#1976d2",
                    color: "white",
                    boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
                    fontWeight: 900,
                    cursor: bulkSelectedCount === 0 || saving ? "not-allowed" : "pointer",
                    opacity: bulkSelectedCount === 0 || saving ? 0.6 : 1,
                  }}
                >
                  Report {bulkSelectedCount ? `(${bulkSelectedCount})` : ""}
                </button>
              </div>
            </div>
          )}

          {mappingMode && mappingQueue.length > 0 && (
            <div
              className="sl-overlay-pass"
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: "calc(14px + 86px)",
                zIndex: 1601,
                padding: "0 16px",
              }}
            >
              <div
                style={{
                  width: "min(720px, calc(100vw - 32px))",
                  margin: "0 auto",
                  display: "flex",
                  gap: 10,
                }}
              >
                <button
                  onClick={() => setMappingQueue([])}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "white",
                    fontWeight: 900,
                  }}
                >
                  Clear
                </button>

                <button
                  onClick={confirmMappingQueue}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "none",
                    background: "#2e7d32",
                    color: "white",
                    fontWeight: 900,
                  }}
                >
                  Place {mappingQueue.length} Light{mappingQueue.length !== 1 && "s"}
                </button>
              </div>
            </div>
          )}


        {/* BOTTOM about/disclaimer */}
        <div
          className="sl-overlay-pass"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1600,
            padding: "0 16px 14px",
          }}
        >
          <div
            style={{
              width: "min(720px, calc(100vw - 32px))",
              margin: "0 auto",
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 14,
              boxShadow: "0 -10px 22px rgba(0,0,0,0.18)",
              padding: 12,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12.5, opacity: 0.78, lineHeight: 1.35 }}>
              <b>About:</b> Community reporting tool to help track streetlight issues.
              <br />
              <b>Disclaimer:</b> This does not replace emergency services or official utility reporting.
            </div>
          </div>
        </div>
      </div>

        <div className="sl-mobile-only">
        {/* TOP overlay */}
        <div
          className="sl-overlay-pass"
          style={{
            position: "fixed",
            top: "calc(8px + env(safe-area-inset-top))",
            left: 0,
            right: 0,
            zIndex: 1600,
            display: "grid",
            placeItems: "center",
            padding: "0 50px",
          }}
        >
          <div
            style={{
              width: "min(340px, calc(100vw - 90px))",
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 12,
              boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
              padding: "10px 12px",
              display: "grid",
              gap: 5,
              position: "relative",
            }}
          >
            
              <button
                type="button"
                onClick={() => setAccountMenuOpen((p) => !p)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: 6,
                  width: 36,
                  height: 32,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
                aria-label="Account menu"
                title={session ? "Account" : "Login / Account"}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 13,
                    background: session?.user ? "#111" : "transparent",
                    color: session?.user ? "white" : "inherit",
                  }}
                >
                  {session?.user
                    ? getInitials(profile?.full_name || session.user.email)
                    : "👤"}
                </span>
              </button>

            {/* Account Menu panel (mobile) */}
            <AccountMenuPanel
              open={accountMenuOpen}
              session={session}
              profile={profile}
              onClose={() => {
                setAccountMenuOpen(false);
                setAccountView("menu");
              }}
              onManage={() => {
                setAccountMenuOpen(false);
                setManageEditing(false);
                setManageOpen(true);
              }}
              onMyReports={() => {
                setAccountMenuOpen(false);
                setMyReportsOpen(true);
              }}
              onLogout={() => {
                signOut();
                setAccountMenuOpen(false);
              }}
            />

            <div style={{ fontSize: 16, fontWeight: 950, textAlign: "center", lineHeight: 1.15 }}>
              Ashtabula Streetlight Reports
            </div>

            <div style={{ fontSize: 12, opacity: 0.75, textAlign: "center", lineHeight: 1.2 }}>
              Community-reported streetlight outages
            </div>

            <div style={{ fontSize: 12.5, opacity: 0.92, textAlign: "center", lineHeight: 1.25, fontWeight: 800 }}>
              Tap the location of the light to report an outage.
            </div>

            <div
              style={{
                position: "absolute",
                left: 10,
                top: 8,
                width: 12,
                height: 12,
                borderRadius: 999,
                background: connected ? "#2ecc71" : "#e74c3c",
                border: "2px solid white",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}
              title={connected ? "Connected" : "Not connected"}
            />
          </div>
        </div>


        {/* =========================
              Bulk Action Bar (mobile)
            ========================= */}
          {bulkMode && (
            <div
              className="sl-overlay-pass"
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: "calc(10px + env(safe-area-inset-bottom) + 78px)",
                zIndex: 1601,
                padding: "0 10px",
              }}
            >
              <div
                style={{
                  width: "min(520px, calc(100vw - 20px))",
                  margin: "0 auto",
                  display: "flex",
                  gap: 10,
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    clearBulkSelection();
                  }}
                  disabled={bulkSelectedCount === 0 || saving}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "rgba(255,255,255,0.96)",
                    boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
                    fontWeight: 950,
                    cursor: bulkSelectedCount === 0 || saving ? "not-allowed" : "pointer",
                    opacity: bulkSelectedCount === 0 || saving ? 0.6 : 1,
                  }}
                >
                  Clear
                </button>

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (bulkSelectedCount === 0) {
                      openNotice("⚠️", "No lights selected", "Tap multiple official 💡 lights first.");
                      return;
                    }

                    mapRef.current?.closePopup?.();
                    suppressPopups?.(1400);

                    setNote("");
                    setReportType("out");
                    setBulkConfirmOpen(true);
                  }}
                  disabled={bulkSelectedCount === 0 || saving}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "none",
                    background: "#1976d2",
                    color: "white",
                    boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
                    fontWeight: 950,
                    cursor: bulkSelectedCount === 0 || saving ? "not-allowed" : "pointer",
                    opacity: bulkSelectedCount === 0 || saving ? 0.6 : 1,
                  }}
                >
                  Report {bulkSelectedCount ? `(${bulkSelectedCount})` : ""}
                </button>
              </div>
            </div>
          )}

        {/* =========================
              Mapping Action Bar (mobile)
            ========================= */}
        {mappingMode && mappingQueue.length > 0 && (
          <div
            className="sl-overlay-pass"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: "calc(10px + env(safe-area-inset-bottom) + 78px)",
              zIndex: 1601,
              padding: "0 10px",
            }}
          >
            <div
              style={{
                width: "min(520px, calc(100vw - 20px))",
                margin: "0 auto",
                display: "flex",
                gap: 10,
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMappingQueue([]);
                }}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "rgba(255,255,255,0.96)",
                  boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
                  fontWeight: 950,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                Clear
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  confirmMappingQueue();
                }}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 12,
                  border: "none",
                  background: "#2e7d32",
                  color: "white",
                  boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
                  fontWeight: 950,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                Place {mappingQueue.length} Light{mappingQueue.length !== 1 && "s"}
              </button>
            </div>
          </div>
        )}


        {/* BOTTOM fixed actions */}
        <div
          className="sl-overlay-pass"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1600,
            padding: "0 10px calc(10px + env(safe-area-inset-bottom))",
          }}
        >
          <div
            style={{
              width: "min(520px, calc(100vw - 20px))",
              margin: "0 auto",
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 14,
              boxShadow: "0 -10px 22px rgba(0,0,0,0.18)",
              padding: 10,
              display: "grid",
              gap: 8,
            }}
          >

            <div style={{ fontSize: 11.5, opacity: 0.75, lineHeight: 1.35 }}>
              <b>About:</b> Community reporting tool to help track streetlight issues.
              <br />
              <b>Disclaimer:</b> This does not replace emergency services or official utility reporting.
            </div>
          </div>
        </div>
      </div>

      {/* Desktop panel removed here for brevity — you can paste yours back in if you want it */}
    </div>
  );
}
