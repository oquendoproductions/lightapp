// ==================================================
// App.jsx — Full file
// ==================================================
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { GoogleMap, MarkerF, InfoWindowF, useJsApiLoader } from "@react-google-maps/api";
import { supabase } from "./supabaseClient";

// ✅ Google Maps API key
const GMAPS_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_KEY ||
  "";
const GMAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || "";



// ==================================================
// SECTION 2 — App Settings
// ==================================================
const containerStyle = { height: "100%", width: "100%" };
const ASHTABULA = [41.8651, -80.7898];
const GROUP_RADIUS_METERS = 25;

// 💡 OFFICIAL LIGHTS (admin-only mapping layer)
const OFFICIAL_LIGHTS_MIN_ZOOM = 13;
const LOCATE_ZOOM = 17;
const MAPPING_MIN_ZOOM = 17;
const APP_VERSION = "v2026.02.23.3";


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
  if (count >= 5) return { label: "Likely Out", color: "#f57c00" };    // orange
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

function normalizeReportTypeValue(t) {
  return String(t || "").trim().toLowerCase();
}

function normalizeReportQuality(q) {
  const v = String(q || "").trim().toLowerCase();
  if (v === "good" || v === "bad") return v;
  return "";
}

function isWorkingReportType(tOrRow) {
  if (tOrRow && typeof tOrRow === "object") {
    const quality = normalizeReportQuality(tOrRow.report_quality || tOrRow.quality);
    if (quality === "good") return true;
    if (quality === "bad") return false;
  }
  const raw = typeof tOrRow === "object"
    ? (tOrRow?.type || tOrRow?.report_type)
    : tOrRow;
  const t = normalizeReportTypeValue(raw);
  return t === "working" || t === "reported_working" || t === "is_working";
}

function isOutageReportType(tOrRow) {
  return !isWorkingReportType(tOrRow);
}

function parseWorkingContactFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return { name: null, email: null, phone: null };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { name: null, email: null, phone: null };

    const name = String(parsed.reporter_name || parsed.actor_name || "").trim() || null;
    const email = normalizeEmail(parsed.reporter_email || parsed.actor_email || "") || null;
    const phone = normalizePhone(parsed.reporter_phone || parsed.actor_phone || "") || null;
    return { name, email, phone };
  } catch {
    return { name: null, email: null, phone: null };
  }
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

function canIdentityReportLight(lightId, { session, profile, guestInfo, reports, fixedLights, lastFixByLightId }) {
  const key = reporterIdentityKey({ session, profile, guestInfo });

  // ✅ If we have an identity key, enforce via DB-backed history (works for authed + guests)
  // Rule: one report per light per identity since the light was last fixed.
  if (key) {
    const lastFixTs = Math.max(
      Number(lastFixByLightId?.[lightId] || 0),
      Number(fixedLights?.[lightId] || 0)
    );

    for (const r of reports || []) {
      if (r.light_id !== lightId) continue;

      const rKey =
        r.reporter_user_id ? `uid:${r.reporter_user_id}` :
        (normalizeEmail(r.reporter_email) ? `email:${normalizeEmail(r.reporter_email)}` :
         (normalizePhone(r.reporter_phone) ? `phone:${normalizePhone(r.reporter_phone)}` : null));

      if (!(rKey && rKey === key)) continue;

      const ts = Number(r.ts || 0);
      if (!Number.isFinite(ts)) continue;

      // If never fixed, any prior report by this identity blocks another report.
      // If fixed, only reports after the last fix block another report.
      if (!lastFixTs || ts > lastFixTs) return false;
    }

    return true;
  }

  // ✅ No identity yet → do NOT enforce device cooldown here.
  // The submit flow forces guest contact before cooldown is checked.
  return true;
}

function actionIdentityKey(a) {
  if (a?.actor_user_id) return `uid:${a.actor_user_id}`;
  const email = normalizeEmail(a?.actor_email);
  if (email) return `email:${email}`;
  const phone = normalizePhone(a?.actor_phone);
  if (phone) return `phone:${phone}`;
  return null;
}

function reportIdentityKey(r) {
  if (r?.reporter_user_id) return `uid:${r.reporter_user_id}`;
  const email = normalizeEmail(r?.reporter_email);
  if (email) return `email:${email}`;
  const phone = normalizePhone(r?.reporter_phone);
  if (phone) return `phone:${phone}`;
  return null;
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

function destinationPointMeters(start, distanceMeters, bearingDeg) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const R = 6378137;

  const dist = Math.max(0, Number(distanceMeters) || 0);
  const bearing = toRad(Number(bearingDeg) || 0);
  const lat1 = toRad(start.lat);
  const lon1 = toRad(start.lng);
  const angDist = dist / R;

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
function svgDotDataUrl(fill = "#111", r = 7) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
      <circle cx="10" cy="10" r="${r}" fill="${fill}" stroke="white" stroke-width="2"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// CMD+F: function gmapsDotIcon
function gmapsDotIcon(color = "#1976d2") {
  const c = color || "#1976d2";
  const g = window.google?.maps;
  const cacheKey = `${c}|${g ? "g" : "nog"}`;
  gmapsDotIcon._cache ||= new Map();
  if (gmapsDotIcon._cache.has(cacheKey)) return gmapsDotIcon._cache.get(cacheKey);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="${c}" stroke="white" stroke-width="2" />
      <text x="12" y="12" text-anchor="middle" dominant-baseline="central" font-size="10">&#x1F4A1;</text>
    </svg>
  `.trim();

  const url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);

  // If google maps isn't ready yet, returning {url} is fine
  if (!g) return { url };

  const icon = {
    url,
    scaledSize: new g.Size(24, 24),
    anchor: new g.Point(12, 12),
  };
  gmapsDotIcon._cache.set(cacheKey, icon);
  return icon;
}

function gmapsUserLocIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="5" fill="#1976d2" stroke="white" stroke-width="2" />
    </svg>
  `.trim();

  const url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);

  const g = window.google?.maps;
  if (!g) return { url };

  return {
    url,
    scaledSize: new g.Size(18, 18),
    anchor: new g.Point(9, 9),
  };
}

const OFFICIAL_MARKER_SHAPE = {
  type: "circle",
  // Smaller hit area than the full 24x24 icon so pan/zoom gestures are easier to start.
  coords: [12, 12, 8],
};

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
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!position) return;

    const next = { lat: Number(position.lat), lng: Number(position.lng) };
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;

    const marker = markerRef.current;
    if (!marker) {
      lastRef.current = next;
      return;
    }

    const prev = lastRef.current || next;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const start = performance.now();
    const duration = 520;

    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);

      const lat = prev.lat + (next.lat - prev.lat) * eased;
      const lng = prev.lng + (next.lng - prev.lng) * eased;
      marker.setPosition({ lat, lng });

      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        lastRef.current = next;
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }, [position?.lat, position?.lng]);

  if (!position) return null;

  return (
    <MarkerF
      position={position}
      icon={gmapsUserLocIcon()}
      title="You are here"
      clickable={false}
      zIndex={1}
      onLoad={(marker) => {
        markerRef.current = marker;
        lastRef.current = { lat: Number(position.lat), lng: Number(position.lng) };
      }}
    />
  );
}

const OfficialLightsLayer = memo(function OfficialLightsLayer({
  show,
  lights,
  bulkMode,
  bulkSelectedSet,
  getMarkerColor,
  onMarkerClick,
}) {
  if (!show) return null;
  return (lights || []).map((ol) => {
    const isSelected = bulkMode && bulkSelectedSet.has(ol.id);
    const baseColor = getMarkerColor(ol.id);
    const iconColor = isSelected ? "#1976d2" : baseColor;

    return (
      <MarkerF
        key={ol.id}
        position={{ lat: ol.lat, lng: ol.lng }}
        icon={gmapsDotIcon(iconColor)}
        shape={OFFICIAL_MARKER_SHAPE}
        optimized
        onClick={() => onMarkerClick(ol.id)}
      />
    );
  });
});

const OfficialLightsCanvasOverlay = memo(forwardRef(function OfficialLightsCanvasOverlay({
  map,
  show,
  lights,
  bulkMode,
  bulkSelectedSet,
  getMarkerColor,
}, ref) {
  const overlayObjRef = useRef(null);
  const canvasRef = useRef(null);
  const hitPointsRef = useRef([]);
  const latestRef = useRef({
    show,
    lights,
    bulkMode,
    bulkSelectedSet,
    getMarkerColor,
  });

  latestRef.current = { show, lights, bulkMode, bulkSelectedSet, getMarkerColor };

  const drawOverlayCanvas = useCallback(() => {
    const overlay = overlayObjRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas || !map) return;

    const projection = overlay.getProjection?.();
    if (!projection) return;

    const div = map.getDiv?.();
    const width = Number(div?.clientWidth || 0);
    const height = Number(div?.clientHeight || 0);
    if (width <= 0 || height <= 0) return;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const state = latestRef.current;
    if (!state.show) {
      hitPointsRef.current = [];
      return;
    }

    const hit = [];
    const margin = 24;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "10px system-ui, -apple-system, sans-serif";

    for (const ol of state.lights || []) {
      const ll = new window.google.maps.LatLng(ol.lat, ol.lng);
      const pt = projection.fromLatLngToContainerPixel
        ? projection.fromLatLngToContainerPixel(ll)
        : projection.fromLatLngToDivPixel(ll);
      const x = Number(pt?.x);
      const y = Number(pt?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < -margin || x > width + margin || y < -margin || y > height + margin) continue;

      const isSelected = state.bulkMode && state.bulkSelectedSet?.has?.(ol.id);
      const baseColor = state.getMarkerColor(ol.id);
      const color = isSelected ? "#1976d2" : baseColor;

      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = color || "#1976d2";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff";
      ctx.stroke();

      // Preserve the visual "bulb in dot" look without thousands of MarkerF DOM overlays.
      ctx.fillStyle = "#111";
      ctx.fillText("💡", x, y + 0.5);

      hit.push({ id: ol.id, x, y });
    }

    hitPointsRef.current = hit;
  }, [map]);

  useImperativeHandle(ref, () => ({
    redraw() {
      drawOverlayCanvas();
    },
    hitTestByLatLng(lat, lng, radiusPx = 14) {
      const overlay = overlayObjRef.current;
      if (!overlay || !latestRef.current?.show) return null;
      const projection = overlay.getProjection?.();
      if (!projection) return null;
      const ll = new window.google.maps.LatLng(Number(lat), Number(lng));
      const pt = projection.fromLatLngToContainerPixel
        ? projection.fromLatLngToContainerPixel(ll)
        : projection.fromLatLngToDivPixel(ll);
      const x = Number(pt?.x);
      const y = Number(pt?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

      let best = null;
      let bestD2 = radiusPx * radiusPx;
      for (const h of hitPointsRef.current || []) {
        const dx = h.x - x;
        const dy = h.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestD2) {
          best = h.id;
          bestD2 = d2;
        }
      }
      return best;
    },
    projectLatLngToContainerPixel(lat, lng) {
      const overlay = overlayObjRef.current;
      if (!overlay) return null;
      const projection = overlay.getProjection?.();
      if (!projection) return null;
      const ll = new window.google.maps.LatLng(Number(lat), Number(lng));
      const pt = projection.fromLatLngToContainerPixel
        ? projection.fromLatLngToContainerPixel(ll)
        : projection.fromLatLngToDivPixel(ll);
      const x = Number(pt?.x);
      const y = Number(pt?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x, y };
    },
  }), [drawOverlayCanvas]);

  useEffect(() => {
    if (!map || !window.google?.maps) return;

    const overlay = new window.google.maps.OverlayView();
    overlay.onAdd = () => {
      const canvas = document.createElement("canvas");
      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "1";
      canvasRef.current = canvas;
      const mapDiv = map.getDiv?.();
      if (mapDiv) {
        const pos = window.getComputedStyle(mapDiv).position;
        if (!pos || pos === "static") mapDiv.style.position = "relative";
        mapDiv.insertBefore(canvas, mapDiv.firstChild || null);
      }
    };
    overlay.draw = () => {
      drawOverlayCanvas();
    };
    overlay.onRemove = () => {
      try { canvasRef.current?.remove(); } catch {}
      canvasRef.current = null;
      hitPointsRef.current = [];
    };

    overlay.setMap(map);
    overlayObjRef.current = overlay;

    return () => {
      try { overlay.setMap(null); } catch {}
      overlayObjRef.current = null;
      canvasRef.current = null;
      hitPointsRef.current = [];
    };
  }, [map, drawOverlayCanvas]);

  useEffect(() => {
    drawOverlayCanvas();
  }, [drawOverlayCanvas, show, lights, bulkMode, bulkSelectedSet, getMarkerColor]);

  return null;
}));

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
          background: "var(--sl-ui-modal-bg)",
          border: "1px solid var(--sl-ui-modal-border)",
          color: "var(--sl-ui-text)",
          padding: 18,
          borderRadius: 10,
          width: "min(360px, 100%)",
          display: "grid",
          gap: 12,
          boxShadow: "var(--sl-ui-modal-shadow)",
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
                  border: "1px solid var(--sl-ui-alert-danger-border)",
                  background: "var(--sl-ui-alert-danger-bg)",
                  color: "var(--sl-ui-alert-danger-text)",
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

      <label style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 13.5, opacity: 0.9, fontWeight: 800, lineHeight: 1.2 }}>
          What are you seeing?
        </div>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          style={{
            padding: 10,
            height: 40,
            boxSizing: "border-box",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#fff",
            color: "#111",
            fontSize: 14,
            lineHeight: 1.2,
          }}
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

      {showSafetyNote && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--sl-ui-alert-danger-border)",
            background: "var(--sl-ui-alert-danger-bg)",
            color: "var(--sl-ui-alert-danger-text)",
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
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
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
  const ok = nameOk && phoneOk && emailOk;

  return (
    <ModalShell open={open} zIndex={10006}>
      <div style={{ fontSize: 16, fontWeight: 950 }}>Guest info required</div>
      <div style={{ fontSize: 12.5, opacity: 0.85, lineHeight: 1.35 }}>
        Please provide your name, phone number, and email.
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
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Phone</div>
        <input
          value={info.phone}
          onChange={(e) => setInfo((p) => ({ ...p, phone: e.target.value }))}
          style={inputStyle}
          placeholder="555-555-5555"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Email</div>
        <input
          value={info.email}
          onChange={(e) => setInfo((p) => ({ ...p, email: e.target.value }))}
          style={inputStyle}
          placeholder="name@email.com"
        />
      </label>

      {!ok && (
        <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 900 }}>
          Name, phone, and email are required.
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
const inputStyle = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid var(--sl-ui-modal-input-border)",
  background: "var(--sl-ui-modal-input-bg)",
  color: "var(--sl-ui-text)",
};
const btnPrimary = { padding: 10, borderRadius: 10, border: "none", background: "#1976d2", color: "white", fontWeight: 900, cursor: "pointer", width: "100%" };
const btnPrimaryDark = { padding: 10, borderRadius: 10, border: "none", background: "var(--sl-ui-modal-btn-dark-bg)", color: "var(--sl-ui-modal-btn-dark-text)", fontWeight: 900, cursor: "pointer", width: "100%" };
const btnSecondary = { padding: 10, borderRadius: 10, border: "1px solid var(--sl-ui-modal-btn-secondary-border)", background: "var(--sl-ui-modal-btn-secondary-bg)", color: "var(--sl-ui-modal-btn-secondary-text)", fontWeight: 900, cursor: "pointer", width: "100%" };
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
    <ModalShell open={open} zIndex={10020}>
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

function ForgotPasswordModal({ open, email, setEmail, loading, errorText, onSend, onClose }) {
  if (!open) return null;

  return (
    <ModalShell open={open} zIndex={10011}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Reset password</div>
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
          ×
        </button>
      </div>

      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
        Enter your account email and we’ll send a password reset link.
      </div>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
        autoCapitalize="none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading) onSend();
        }}
      />

      {!!errorText && (
        <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 900 }}>
          {errorText}
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        <button onClick={onSend} disabled={loading} style={{ ...btnPrimaryDark, opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Sending reset…" : "Send reset email"}
        </button>
        <button onClick={onClose} style={btnSecondary}>Cancel</button>
      </div>
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
  onOpenForgotPassword,
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
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
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
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
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
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
            autoCapitalize="none"
          />
          <input
            placeholder="Password"
            type="password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !authLoading) onLogin();
            }}
          />

          <button
            type="button"
            onClick={onOpenForgotPassword}
            disabled={authLoading}
            style={{
              padding: 0,
              width: "fit-content",
              borderRadius: 0,
              border: "none",
              background: "transparent",
              color: "#1976d2",
              fontWeight: 800,
              cursor: authLoading ? "not-allowed" : "pointer",
              opacity: authLoading ? 0.65 : 1,
              justifySelf: "start",
            }}
          >
            Forgot password?
          </button>

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
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
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
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
          />

          <input
            placeholder="Phone"
            value={signupPhone}
            onChange={(e) => setSignupPhone(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
          />

          <input
            placeholder="Email"
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
            autoCapitalize="none"
          />

          <input
            placeholder="Password (min 6 chars)"
            type="password"
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !signupLoading) onCreateAccount();
            }}
          />

          <input
            placeholder="Re-enter password"
            type="password"
            value={signupPassword2}
            onChange={(e) => setSignupPassword2(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
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
  const [resolvedProfile, setResolvedProfile] = useState({
    name: null,
    phone: null,
    email: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function resolveProfile() {
      setResolvedProfile({ name: null, phone: null, email: null });
      if (!open) return;

      const uid = (reportItem?.reporter_user_id || "").trim();
      if (!uid) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, email")
        .eq("user_id", uid)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("[profiles] reporter name lookup error:", error);
        return;
      }

      const full = (data?.full_name || "").trim();
      const phone = (data?.phone || "").trim();
      const email = (data?.email || "").trim();
      setResolvedProfile({
        name: full || null,
        phone: phone || null,
        email: email || null,
      });
    }

    resolveProfile();

    return () => {
      cancelled = true;
    };
  }, [open, reportItem?.reporter_user_id]);

  if (!open) return null;

  const profileEmailFallback = (resolvedProfile.email || "").trim();
  const profileNameFallback = profileEmailFallback ? profileEmailFallback.split("@")[0] : "";
  const name =
    (reportItem?.reporter_name || "").trim() ||
    (resolvedProfile.name || "").trim() ||
    profileNameFallback ||
    "—";
  const phone =
    (reportItem?.reporter_phone || "").trim() ||
    (resolvedProfile.phone || "").trim() ||
    "—";
  const email =
    (reportItem?.reporter_email || "").trim() ||
    (resolvedProfile.email || "").trim() ||
    "—";

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
    <ModalShell open={open} zIndex={10010}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>{title || "All Reports"}</div>
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
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        History of reports + light actions for this light.
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
            const isWorking = it.kind === "working";
            const isWorkingReport = it.kind === "report" && isWorkingReportType(it.type);

              // Treat all "pole down" variants as red
              const isPoleDown =
                !isFix &&
                ["downed_pole", "pole_down", "downed-pole"].includes(String(it.type || "").toLowerCase());

              // ✅ Color rules:
              // - Fix: black
              // - Working: green
              // - Pole down: red
              // - All other reports: yellow
              const dot = isFix ? "#111" : (isWorking || isWorkingReport) ? "#2e7d32" : isPoleDown ? "#b71c1c" : "#fbc02d";


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

                {(it.kind === "report" || it.kind === "working") && (
                  <button
                    onClick={() => onReporterDetails?.(it)}
                    style={{
                      padding: 9,
                      width: "100%",
                      cursor: "pointer",
                      background: "var(--sl-ui-modal-btn-secondary-bg)",
                      color: "var(--sl-ui-modal-btn-secondary-text)",
                      border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
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
  onFlyTo, // (lat,lng,zoom,lightId)
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
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        Your past reports grouped by streetlight.
      </div>

      <div
        style={{
          marginTop: 6,
          maxHeight: "60vh",
          overflow: "auto",
          border: "1px solid rgba(0,0,0,0.35)",
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
                  border: "1px solid var(--sl-ui-open-reports-item-border)",
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
                      onFlyTo([coords.lat, coords.lng], 18, g.lightId);
                    }}
                    disabled={!coords}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: "var(--sl-ui-modal-btn-secondary-bg)",
                      color: "var(--sl-ui-modal-btn-secondary-text)",
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

// CMD+F: function formatTs
function formatTs(ms) {
  try {
    const d = new Date(ms || 0);
    if (!ms || Number.isNaN(d.getTime())) return "";
    return d.toLocaleString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
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
  onFlyTo, // (posArray, zoom, lightId)
  onOpenAllReports, // (title, items)
}) {
  const [sortMode, setSortMode] = useState("count"); // count | recent
  const sortedGroups = useMemo(() => {
    const arr = Array.isArray(groups) ? [...groups] : [];
    if (sortMode === "recent") {
      arr.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
      return arr;
    }
    arr.sort((a, b) => (b.count - a.count) || ((b.lastTs || 0) - (a.lastTs || 0)));
    return arr;
  }, [groups, sortMode]);
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
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        All streetlights with current outage reports (since last fix).
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        <button
          onClick={() => setSortMode("count")}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: sortMode === "count" ? "var(--sl-ui-modal-btn-dark-bg)" : "var(--sl-ui-modal-btn-secondary-bg)",
            color: sortMode === "count" ? "var(--sl-ui-modal-btn-dark-text)" : "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Most reports
        </button>
        <button
          onClick={() => setSortMode("recent")}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: sortMode === "recent" ? "var(--sl-ui-modal-btn-dark-bg)" : "var(--sl-ui-modal-btn-secondary-bg)",
            color: sortMode === "recent" ? "var(--sl-ui-modal-btn-dark-text)" : "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Most recent
        </button>
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
        {!sortedGroups?.length ? (
          <div style={{ fontSize: 13, opacity: 0.8 }}>No open reports right now.</div>
        ) : (
          sortedGroups.map((g) => {
            const coords = getCoordsForLightId(g.lightId, reports, officialLights);
            const info = computePublicStatusForLightId(g.lightId, { reports, fixedLights, lastFixByLightId });
            const dot = statusDotForLightId(g.lightId, coords, info, reports);
            const isOpen = expandedSet?.has(g.lightId);

            return (
              <div
                key={g.lightId}
                style={{
                  border: "1px solid var(--sl-ui-open-reports-item-border)",
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
                      onOpenAllReports?.(g.lightId);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: "var(--sl-ui-modal-btn-secondary-bg)",
                      color: "var(--sl-ui-modal-btn-secondary-text)",
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
                      onFlyTo?.([coords.lat, coords.lng], 18, g.lightId);
                    }}
                    disabled={!coords}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: "var(--sl-ui-modal-btn-secondary-bg)",
                      color: "var(--sl-ui-modal-btn-secondary-text)",
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
                      borderTop: "1px dashed var(--sl-ui-open-reports-item-border)",
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
                          border: "1px solid var(--sl-ui-open-reports-item-border)",
                          background: "var(--sl-ui-modal-subtle-bg)",
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
        inset: 0,
        zIndex: 10010,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        padding: "16px 56px 16px 16px",
      }}
    >
      <div
        style={{
          width: "min(260px, calc(100vw - 112px))",
          background: "var(--sl-ui-modal-bg)",
          border: "1px solid var(--sl-ui-modal-border)",
          borderRadius: 12,
          boxShadow: "var(--sl-ui-modal-shadow)",
          padding: 12,
          pointerEvents: "auto",
          color: "var(--sl-ui-text)",
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
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
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
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
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
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
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
            <div style={{ marginTop: 8, fontSize: 10.5, opacity: 0.62, textAlign: "right", lineHeight: 1 }}>
              {APP_VERSION}
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
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
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
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 10.5, opacity: 0.62, textAlign: "right", lineHeight: 1 }}>
              {APP_VERSION}
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

// CMD+F: function makeLightIdFromCoords
function makeLightIdFromCoords(lat, lng) {
  const lat5 = Math.abs(Number(lat)).toFixed(5).split(".")[1] || "00000";
  const lng5 = Math.abs(Number(lng)).toFixed(5).split(".")[1] || "00000";
  // ✅ order: lng then lat (per your spec)
  return `SL${lng5}${lat5}`;
}


function computePublicStatusForLightId(lightId, { reports, fixedLights, lastFixByLightId }) {
  const all = (reports || [])
    .filter((r) => (r.light_id || "") === lightId)
    .filter((r) => isOutageReportType(r));

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
    (reports || [])
      .filter((r) => (r.light_id || "") === lightId)
      .filter((r) => isOutageReportType(r))
      .length
  );
}

// Build "All Reports" timeline: reports + fix events
function buildLightHistory({ reportRows, fixActionRows }) {
  const items = [];
  const hasWorkingReport = (reportRows || []).some((r) => isWorkingReportType(r));

  // reports
  for (const r of reportRows || []) {
    const typeKey = normalizeReportTypeValue(r.type || r.report_type);
    const label = isWorkingReportType(typeKey)
      ? "Reported Working"
      : (REPORT_TYPES[typeKey] || r.type || "Report");
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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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
  };
}




// ==================================================
// SECTION 8 — Main App
// ==================================================
export default function App() {
  const mapRef = useRef(null);
  const flyAnimRef = useRef(null);
  const flyInfoTimerRef = useRef(null);
  const officialCanvasOverlayRef = useRef(null);
  const smoothedHeadingRef = useRef(null);
  const lastFollowCameraRef = useRef({ lat: null, lng: null, heading: null });
  const followTargetRef = useRef(null);
  const followRafRef = useRef(null);
  const lastFollowStateSyncRef = useRef(0);
  const liveMotionRef = useRef({ lat: null, lng: null, heading: null, speed: 0, ts: 0 });
  const lastUserLocUiRef = useRef({ lat: null, lng: null, ts: 0 });
  const zoomDragRef = useRef({
    lastTapTs: 0,
    lastTapX: 0,
    lastTapY: 0,
    armUntil: 0,
    pendingTap: false,
    tapStartX: 0,
    tapStartY: 0,
    tapStartTs: 0,
    active: false,
    startY: 0,
    startZoom: OFFICIAL_LIGHTS_MIN_ZOOM,
    lastAppliedZoom: OFFICIAL_LIGHTS_MIN_ZOOM,
  });
  const isMobile = useIsMobile(640);
  const suppressMapClickRef = useRef({ until: 0 });
  const clickDelayRef = useRef({ lastTs: 0, timer: null, lastLatLng: null });

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
    setUserLoc([next.lat, next.lng]);
  }

  function stopFollowCameraAnimation() {
    if (followRafRef.current) {
      cancelAnimationFrame(followRafRef.current);
      followRafRef.current = null;
    }
    followTargetRef.current = null;
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
  // Google Maps InfoWindow selection
  const [selectedOfficialId, setSelectedOfficialId] = useState(null);
  const [selectedQueuedTempId, setSelectedQueuedTempId] = useState(null);
  // Bulk select toggle for official lights
  const toggleBulkSelect = useCallback((lightId) => {
    setBulkSelectedIds((prev) => {
      const has = prev.includes(lightId);
      if (!has && Number(mapZoomRef.current) < 17) {
        openNotice("🔎", "Zoom in to select", "Zoom in closer (level 17+) before selecting lights for bulk reporting.");
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
  const [mapZoom, setMapZoom] = useState(OFFICIAL_LIGHTS_MIN_ZOOM);
  const mapZoomRef = useRef(OFFICIAL_LIGHTS_MIN_ZOOM);
  const [mapInteracting, setMapInteracting] = useState(false);
  const mapInteractIdleTimerRef = useRef(null);

  // Google Maps center (actual camera center)
  const [mapCenter, setMapCenter] = useState({ lat: ASHTABULA[0], lng: ASHTABULA[1] });

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
  const [toolHintText, setToolHintText] = useState("");
  const [toolHintIndex, setToolHintIndex] = useState(null);
  const toolHintTimerRef = useRef(null);

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

  function showToolHint(text, ms = 1100, index = null) {
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
  }

  const [allReportsModal, setAllReportsModal] = useState({
    open: false,
    title: "",
    items: [],
  });
  const officialLightHistoryCacheRef = useRef(new Map());

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

  async function getOfficialLightHistoryDetailed(lightId, { preferCache = true } = {}) {
    const lid = (lightId || "").trim();
    if (!lid) return { reportRows: [], fixActionRows: [] };

    const cache = officialLightHistoryCacheRef.current;
    if (preferCache && cache.has(lid)) return cache.get(lid);

    const [repRes, actRes] = await Promise.all([
      supabase
        .from("reports")
        .select("id, created_at, lat, lng, report_type, report_quality, note, light_id, reporter_user_id, reporter_name, reporter_phone, reporter_email")
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

  async function openOfficialLightAllReports(lightId) {
    const lid = (lightId || "").trim();
    if (!lid) return;

    let reportRows = (reports || [])
      .filter((r) => (r.light_id || "").trim() === lid)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
    let fixActionRows = actionsByLightId?.[lid] || [];

    try {
      const detailed = await getOfficialLightHistoryDetailed(lid);
      reportRows = detailed.reportRows;
      fixActionRows = detailed.fixActionRows;
    } catch (e) {
      console.warn("[official light history] detailed fetch failed, using cached in-memory rows:", e);
    }

    const history = buildLightHistory({ reportRows, fixActionRows });
    openAllReports("All Reports (Official light)", history);
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
  const isIOSSafari = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isWebKit = /WebKit/.test(ua);
    const isNonSafariIOS = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isIOS && isWebKit && !isNonSafariIOS;
  }, []);
  const isTouchDevice = useMemo(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    return ("ontouchstart" in window) || Number(navigator.maxTouchPoints || 0) > 0;
  }, []);


  // Auth
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
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
    }, [session?.user?.id, session?.user?.email]);


  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
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


  // Gate flow
  const [guestInfo, setGuestInfo] = useState({ name: "", phone: "", email: "" });
  const [guestInfoDraft, setGuestInfoDraft] = useState({ name: "", phone: "", email: "" });
  const [guestInfoOpen, setGuestInfoOpen] = useState(false);
  const [contactChoiceOpen, setContactChoiceOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [pendingGuestAction, setPendingGuestAction] = useState(null); // { kind: "report" | "working" | "bulk", lightId?: string }
  const guestSubmitBypassRef = useRef(false);
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
  const [isWorkingConfirmOpen, setIsWorkingConfirmOpen] = useState(false);
  const [pendingWorkingLightId, setPendingWorkingLightId] = useState(null);
  const [markFixedConfirmOpen, setMarkFixedConfirmOpen] = useState(false);
  const [pendingMarkFixedLightId, setPendingMarkFixedLightId] = useState(null);
  const [deleteOfficialConfirmOpen, setDeleteOfficialConfirmOpen] = useState(false);
  const [pendingDeleteOfficialLightId, setPendingDeleteOfficialLightId] = useState(null);
  const [clearQueuedConfirmOpen, setClearQueuedConfirmOpen] = useState(false);

  const bulkSelectedSet = useMemo(() => new Set(bulkSelectedIds), [bulkSelectedIds]);
  const bulkSelectedCount = bulkSelectedIds.length;

  function clearBulkSelection() {
    setBulkSelectedIds([]);
  }
  

  function toggleBulkSelection(id) {
    const alreadySelected = bulkSelectedSet.has(id);
    if (!alreadySelected && Number(mapZoomRef.current || mapZoom) < 17) {
      openNotice("🔎", "Zoom in to select", "Zoom in closer (level 17+) before selecting lights for bulk reporting.");
      return;
    }
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

  function requestClearQueuedLights() {
    if (!mappingQueue.length) return;
    setClearQueuedConfirmOpen(true);
  }

  function confirmClearQueuedLights() {
    setMappingQueue([]);
    setSelectedQueuedTempId(null);
    setClearQueuedConfirmOpen(false);
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
      { lat: Number(lat), lng: Number(lng), tempId, sl_id },
    ]);
  }


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
      setAuthReady(true); // ✅ important
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setAuthReady(true); // ✅ important
      }
    );

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
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
    }, [session?.user?.id, session?.user?.email]);


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

  function openForgotPasswordModal() {
    setForgotPasswordEmail((authEmail || "").trim());
    setForgotPasswordError("");
    setForgotPasswordOpen(true);
  }

  async function sendPasswordReset() {
    const email = (forgotPasswordEmail || "").trim().toLowerCase();
    if (!email) {
      setForgotPasswordError("Enter email");
      return false;
    }

    setForgotPasswordError("");
    setAuthResetLoading(true);
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    setAuthResetLoading(false);

    if (error) {
      openNotice("⚠️", "Couldn’t send reset", error.message || "Password reset email failed.");
      return false;
    }

    setForgotPasswordOpen(false);
    openNotice("✅", "Check your email", "If an account exists for that email, a password reset link has been sent.");
    return true;
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
    if (!phone) {
      openNotice("⚠️", "Phone required", "Please enter your phone number.");
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
  // CMD+F: async function fetchAllOfficialLights
  async function fetchAllOfficialLights() {
    const pageSize = 1000;
    let from = 0;
    let all = [];

    while (true) {
      const { data, error } = await supabase
        .from("official_lights")
        .select("id, sl_id, lat, lng")
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;

      all = all.concat(data || []);

      if (!data || data.length < pageSize) break; // done
      from += pageSize;
    }

    return all;
  }

  useEffect(() => {
    if (!authReady) return; // ✅ wait until auth restored
    async function loadAll() {
      setLoading(true);
      setError("");

      const isAuthed = Boolean(session?.user?.id);
      const reportSelectPublic = "id, created_at, lat, lng, report_type, report_quality, note, light_id";
      const reportSelectFull = "id, created_at, lat, lng, report_type, report_quality, note, light_id, reporter_user_id, reporter_name, reporter_phone, reporter_email";
      const actionsSelectPublic = "id, light_id, action, created_at";
      const actionsSelectFull = "id, light_id, action, note, created_at, actor_user_id";

      const reportsPromise = isAdmin
        ? supabase.from("reports").select(reportSelectFull).order("created_at", { ascending: false })
        : supabase.from("reports_public").select(reportSelectPublic).order("created_at", { ascending: false });

      const ownReportsPromise = (!isAdmin && isAuthed)
        ? supabase
            .from("reports")
            .select(reportSelectFull)
            .eq("reporter_user_id", session.user.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null });

      const actionsPromise = isAdmin
        ? supabase.from("light_actions").select(actionsSelectFull).order("created_at", { ascending: false })
        : supabase.from("light_actions_public").select(actionsSelectPublic).order("created_at", { ascending: false });

      const [
        { data: reportData, error: repErr },
        { data: ownReportData, error: ownRepErr },
        { data: fixedData, error: fixErr },
        { data: actionData, error: actErr },
      ] = await Promise.all([
        reportsPromise,
        ownReportsPromise,
        supabase.from("fixed_lights").select("*"),
        actionsPromise,
      ]);

      let officialData = [];
      let offErr = null;
      try {
        officialData = await fetchAllOfficialLights();
      } catch (e) {
        offErr = e;
        console.error("[official_lights] load error:", e);
      }

      if (offErr) {
        openNotice("⚠️", "Official lights failed to load", offErr.message || "Check Supabase RLS policies.");
      } else {
        setOfficialLights(
          (officialData || [])
            .map(normalizeOfficialLightRow)
            .filter(Boolean)
        );
      }

      if (repErr) console.error(repErr);
      if (ownRepErr) console.error("[reports own] load error:", ownRepErr);

      const normalizedPublicReports = (reportData || []).map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        type: r.report_type,
        report_quality: normalizeReportQuality(r.report_quality),
        note: r.note || "",
        ts: new Date(r.created_at).getTime(),
        light_id: r.light_id || lightIdFor(r.lat, r.lng),
        reporter_user_id: r.reporter_user_id || null,
        reporter_name: r.reporter_name || null,
        reporter_phone: r.reporter_phone || null,
        reporter_email: r.reporter_email || null,
      }));

      const normalizedOwnReports = (ownReportData || []).map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        type: r.report_type,
        report_quality: normalizeReportQuality(r.report_quality),
        note: r.note || "",
        ts: new Date(r.created_at).getTime(),
        light_id: r.light_id || lightIdFor(r.lat, r.lng),
        reporter_user_id: r.reporter_user_id || null,
        reporter_name: r.reporter_name || null,
        reporter_phone: r.reporter_phone || null,
        reporter_email: r.reporter_email || null,
      }));

      const reportMap = new Map();
      for (const r of normalizedPublicReports) reportMap.set(r.id, r);
      for (const r of normalizedOwnReports) reportMap.set(r.id, r); // own rows overwrite public-safe rows
      setReports(Array.from(reportMap.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0)));

      const fixedMap = {};
      for (const row of fixedData || []) fixedMap[row.light_id] = new Date(row.fixed_at).getTime();
      setFixedLights(fixedMap);

      let map = {};
      if (fixErr) console.error(fixErr);
      if (actErr) console.error(actErr);
      else {
        for (const a of actionData || []) {
          if (String(a.action || "").toLowerCase() !== "fix") continue;
          const ts = new Date(a.created_at).getTime();
          if (!map[a.light_id] || ts > map[a.light_id]) map[a.light_id] = ts;
        }
        const byId = {};
        for (const a of actionData || []) {
          const ts = new Date(a.created_at).getTime();
          if (!byId[a.light_id]) byId[a.light_id] = [];
          const noteContact = parseWorkingContactFromNote(a.note);
          const actorEmail = a.actor_email || a.reporter_email || noteContact.email || null;
          const actorPhone = a.actor_phone || a.reporter_phone || noteContact.phone || null;
          const actorUserId = a.actor_user_id || a.reporter_user_id || null;
          const actorNameRaw = (a.actor_name || a.reporter_name || noteContact.name || "").trim();
          const actorNameFallback = actorEmail ? String(actorEmail).split("@")[0] : "";
          byId[a.light_id].push({
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
          });
        }
        setActionsByLightId(byId);

        setLastFixByLightId(map);
      }

      setLoading(false);
    }

    loadAll();
  }, [authReady, isAdmin, session?.user?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    const lid = (selectedOfficialId || "").trim();
    if (!lid) return;
    getOfficialLightHistoryDetailed(lid).catch((e) => {
      console.warn("[official light history prefetch] failed:", e);
    });
  }, [isAdmin, selectedOfficialId]);


  // -------------------------
  // Realtime subscriptions
  // -------------------------
  useEffect(() => {
    const reportsChannel = isAdmin ? supabase
      .channel("realtime-reports")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, (payload) => {
        const r = payload.new;
        const incoming = {
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          type: r.report_type,
          report_quality: normalizeReportQuality(r.report_quality),
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
      .subscribe() : null;

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

    const actionsChannel = isAdmin ? supabase
      .channel("realtime-actions")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "light_actions" }, (payload) => {
        const a = payload.new;
        const ts = new Date(a.created_at).getTime();

        setActionsByLightId((prev) => {
          const list = prev[a.light_id] ? [...prev[a.light_id]] : [];
          const noteContact = parseWorkingContactFromNote(a.note);
          const actorEmail = a.actor_email || a.reporter_email || noteContact.email || null;
          const actorPhone = a.actor_phone || a.reporter_phone || noteContact.phone || null;
          const actorUserId = a.actor_user_id || a.reporter_user_id || null;
          const actorNameRaw = (a.actor_name || a.reporter_name || noteContact.name || "").trim();
          const actorNameFallback = actorEmail ? String(actorEmail).split("@")[0] : "";
          list.unshift({
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
          });
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
      .subscribe() : null;


    const officialChannel = supabase
      .channel("realtime-official-lights")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "official_lights" },
        (payload) => {
          const row = payload.new;

          // INSERT/UPDATE give payload.new, DELETE does not
          if (!row) return;

          const clean = normalizeOfficialLightRow(row);
          if (!clean) {
            console.warn("[official_lights realtime] invalid row, ignoring:", row);
            return;
          }

          setOfficialLights((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            const idx = next.findIndex((x) => x.id === clean.id);

            if (idx >= 0) next[idx] = { ...next[idx], ...clean };
            else next.push(clean);

            // final de-dupe guard by id
            const dedup = new Map();
            for (const item of next) dedup.set(item.id, item);
            return Array.from(dedup.values());
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
      if (reportsChannel) supabase.removeChannel(reportsChannel);
      if (fixedChannel) supabase.removeChannel(fixedChannel);
      if (actionsChannel) supabase.removeChannel(actionsChannel);
      if (officialChannel) supabase.removeChannel(officialChannel);
    };
  }, [isAdmin]);

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

  const renderedOfficialLights = useMemo(
    () => (Array.isArray(officialLights) ? officialLights : []).map(normalizeOfficialLightRow).filter(Boolean),
    [officialLights]
  );

  const viewerIdentityKey = useMemo(
    () => reporterIdentityKey({ session, profile, guestInfo }),
    [session?.user?.id, guestInfo?.email, guestInfo?.phone, guestInfo?.name]
  );

  const selectedOfficialLightForPopup = useMemo(() => {
    if (bulkMode) return null;
    const id = (selectedOfficialId || "").trim();
    if (!id) return null;
    return (officialLights || []).find((x) => (x.id || "").trim() === id) || null;
  }, [bulkMode, selectedOfficialId, officialLights]);

  const selectedOfficialPopupPixel = useMemo(() => {
    const ol = selectedOfficialLightForPopup;
    if (!ol) return null;
    return officialCanvasOverlayRef.current?.projectLatLngToContainerPixel?.(ol.lat, ol.lng) || null;
  }, [selectedOfficialLightForPopup, mapCenter, mapZoom, mapInteracting]);

  const selectedQueuedLightForPopup = useMemo(() => {
    if (bulkMode || !mappingMode || !isAdmin) return null;
    const id = (selectedQueuedTempId || "").trim();
    if (!id) return null;
    return (mappingQueue || []).find((x) => (x.tempId || "").trim() === id) || null;
  }, [bulkMode, mappingMode, isAdmin, selectedQueuedTempId, mappingQueue]);

  const selectedQueuedPopupPixel = useMemo(() => {
    const q = selectedQueuedLightForPopup;
    if (!q) return null;
    return officialCanvasOverlayRef.current?.projectLatLngToContainerPixel?.(q.lat, q.lng) || null;
  }, [selectedQueuedLightForPopup, mapCenter, mapZoom, mapInteracting]);

    // ✅ Per-official-light report counts since last fix
    const reportsByOfficialId = useMemo(() => {
      const out = {}; // id -> { sinceFixCount }
      const all = Array.isArray(reports) ? reports : [];

      for (const r of all) {
        if (!isOutageReportType(r)) continue;
        const lid = (r.light_id || "").trim();
        if (!lid) continue;

        // only official lights
        if (!officialIdSet.has(lid)) continue;

        const lastFixTs = Math.max(lastFixByLightId?.[lid] || 0, fixedLights?.[lid] || 0);
        const ts = r.ts || 0;

        // only count reports after last fix (or all if never fixed)
        if (lastFixTs && ts <= lastFixTs) continue;

        if (!out[lid]) out[lid] = { sinceFixCount: 0 };
        out[lid].sinceFixCount += 1;
      }

      return out;
    }, [reports, officialIdSet, fixedLights, lastFixByLightId]);

    // ✅ Simple status mapping based on count since last fix
    function statusColorFromSinceFixCount(n) {
      const x = Number(n || 0);

      if (x >= 7) return { label: "Confirmed Out", color: "#e74c3c" };
      if (x >= 5) return { label: "Likely Out", color: "#f57c00" };
      if (x >= 2) return { label: "Reported", color: "#f1c40f" };
      return { label: "OK", color: "#111" };
    }

  const myOnlyReportLightIdSet = useMemo(() => {
    const out = new Set();
    if (!viewerIdentityKey) return out;

    const byLight = new Map(); // lightId -> { count, mineCount }
    for (const r of reports || []) {
      if (!isOutageReportType(r)) continue;
      const lid = (r.light_id || "").trim();
      if (!lid || !officialIdSet.has(lid)) continue;

      const lastFixTs = Math.max(lastFixByLightId?.[lid] || 0, fixedLights?.[lid] || 0);
      const ts = Number(r.ts || 0);
      if (lastFixTs && ts <= lastFixTs) continue;

      const prev = byLight.get(lid) || { count: 0, mineCount: 0 };
      prev.count += 1;

      const rKey =
        r.reporter_user_id ? `uid:${r.reporter_user_id}` :
        (normalizeEmail(r.reporter_email) ? `email:${normalizeEmail(r.reporter_email)}` :
         (normalizePhone(r.reporter_phone) ? `phone:${normalizePhone(r.reporter_phone)}` : null));

      if (rKey && rKey === viewerIdentityKey) prev.mineCount += 1;
      byLight.set(lid, prev);
    }

    for (const [lid, stats] of byLight.entries()) {
      if (stats.count === 1 && stats.mineCount === 1) out.add(lid);
    }

    return out;
  }, [reports, officialIdSet, fixedLights, lastFixByLightId, viewerIdentityKey]);

  const globallyWorkingResolvedSet = useMemo(() => {
    const out = new Set();

    for (const l of officialLights || []) {
      const lid = (l.id || "").trim();
      if (!lid) continue;

      const lastFixTs = Math.max(lastFixByLightId?.[lid] || 0, fixedLights?.[lid] || 0);
      const events = [];

      for (const r of reports || []) {
        if ((r.light_id || "").trim() !== lid) continue;
        const ts = Number(r.ts || 0);
        if (!Number.isFinite(ts) || (lastFixTs && ts <= lastFixTs)) continue;
        events.push({ kind: isWorkingReportType(r) ? "working" : "report", ts });
      }

      for (const a of actionsByLightId?.[lid] || []) {
        if (String(a.action || "").toLowerCase() !== "working") continue;
        const ts = Number(a.ts || 0);
        if (!Number.isFinite(ts) || (lastFixTs && ts <= lastFixTs)) continue;
        events.push({ kind: "working", ts });
      }

      events.sort((a, b) => (a.ts || 0) - (b.ts || 0));

      let streak = 0;
      for (const ev of events) {
        if (ev.kind === "report") {
          streak = 0;
          continue;
        }
        streak += 1;
        if (streak >= 3) {
          out.add(lid);
          break;
        }
      }
    }

    return out;
  }, [officialLights, reports, actionsByLightId, fixedLights, lastFixByLightId]);

  const viewerWorkingAckLightIdSet = useMemo(() => {
    const out = new Set();
    if (!viewerIdentityKey) return out;

    for (const l of officialLights || []) {
      const lid = (l.id || "").trim();
      if (!lid) continue;

      const lastFixTs = Math.max(lastFixByLightId?.[lid] || 0, fixedLights?.[lid] || 0);
      let lastReportTs = 0;

      for (const r of reports || []) {
        if (!isOutageReportType(r)) continue;
        if ((r.light_id || "").trim() !== lid) continue;
        const ts = Number(r.ts || 0);
        if (!Number.isFinite(ts) || (lastFixTs && ts <= lastFixTs)) continue;
        if (ts > lastReportTs) lastReportTs = ts;
      }

      const minTs = Math.max(lastFixTs, lastReportTs);

      for (const r of reports || []) {
        if (!isWorkingReportType(r)) continue;
        if ((r.light_id || "").trim() !== lid) continue;
        const ts = Number(r.ts || 0);
        if (!Number.isFinite(ts) || ts <= minTs) continue;
        if (reportIdentityKey(r) === viewerIdentityKey) {
          out.add(lid);
          break;
        }
      }

      if (out.has(lid)) continue;

      for (const a of actionsByLightId?.[lid] || []) {
        if (String(a.action || "").toLowerCase() !== "working") continue;
        const ts = Number(a.ts || 0);
        if (!Number.isFinite(ts) || ts <= minTs) continue;

        if (actionIdentityKey(a) === viewerIdentityKey) {
          out.add(lid);
          break;
        }
      }
    }

    return out;
  }, [officialLights, reports, actionsByLightId, fixedLights, lastFixByLightId, viewerIdentityKey]);

  const officialMarkerColorForViewer = useCallback((lightId) => {
    const lid = (lightId || "").trim();
    if (!lid) return "#111";

    if (globallyWorkingResolvedSet.has(lid)) return "#111";
    const sinceFixCount = Number(reportsByOfficialId?.[lid]?.sinceFixCount ?? 0);

    // Admin view: any report since last fix should be visible as at least yellow.
    if (isAdmin && sinceFixCount >= 1) {
      if (sinceFixCount >= 7) return "#e74c3c";
      if (sinceFixCount >= 5) return "#f57c00";
      return "#f1c40f";
    }

    if (viewerWorkingAckLightIdSet.has(lid)) return "#111";
    if (myOnlyReportLightIdSet.has(lid)) return "#f1c40f";

    const status = statusColorFromSinceFixCount(sinceFixCount);
    return status.color;
  }, [
    globallyWorkingResolvedSet,
    reportsByOfficialId,
    isAdmin,
    viewerWorkingAckLightIdSet,
    myOnlyReportLightIdSet,
  ]);

  function officialStatusLabelForViewer(lightId) {
    const lid = (lightId || "").trim();
    if (!lid) return "Operational";

    if (globallyWorkingResolvedSet.has(lid)) return "Operational";

    const color = officialMarkerColorForViewer(lid);
    if (color === "#111") return "Operational";

    const sinceFixCount = Number(reportsByOfficialId?.[lid]?.sinceFixCount ?? 0);
    if (sinceFixCount >= 7) return "Confirmed Out";
    if (sinceFixCount >= 5) return "Likely Out";
    return "Reported";
  }

  const handleOfficialMarkerClick = useCallback((lightId) => {
    if (mappingMode) {
      setSelectedQueuedTempId(null);
      setSelectedOfficialId(lightId);
      return;
    }

    if (bulkMode) {
      toggleBulkSelect(lightId);
      return;
    }

    setSelectedOfficialId(lightId);
  }, [mappingMode, bulkMode, toggleBulkSelect]);

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
      if (!isOutageReportType(r)) continue;
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


  // -------------------------
  // SECTION 8F — Actions
  // -------------------------
  
  // CMD+F: function prettyReportType
  function prettyReportType(t) {
    const key = String(t || "").toLowerCase().trim();
    const map = {
      out: "Light is out",
      flicker: "Flickering",
      on_day: "On during day",
      downed_pole: "Downed pole",
      pole_down: "Downed pole",
      "downed-pole": "Downed pole",
      other: "Other",
    };
    return map[key] || (key ? key.replace(/_/g, " ") : "Report");
  }

  // CMD+F: function officialReportsSinceFix
  function officialReportsSinceFix(lightId) {
    const id = (lightId || "").trim();
    if (!id) return [];

    const lastFixTs = Math.max(lastFixByLightId?.[id] || 0, fixedLights?.[id] || 0);

    return (reports || [])
      .filter((r) => (r.light_id || "").trim() === id)
      .filter((r) => isOutageReportType(r))
      .filter((r) => (!lastFixTs ? true : (r.ts || 0) > lastFixTs))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }

  // CMD+F: function majorityIssueSinceFix
  function majorityIssueSinceFix(lightId) {
    const rows = officialReportsSinceFix(lightId);
    if (!rows.length) {
      return { total: 0, type: null, label: "No open reports", count: 0 };
    }

    const counts = new Map();
    const latestByType = new Map();

    for (const r of rows) {
      const t = String(r.type || r.report_type || "").trim() || "unknown";
      counts.set(t, (counts.get(t) || 0) + 1);
      latestByType.set(t, Math.max(latestByType.get(t) || 0, r.ts || 0));
    }

    let bestType = null;
    let bestCount = -1;
    let bestLatest = -1;

    for (const [t, c] of counts.entries()) {
      const latest = latestByType.get(t) || 0;
      if (c > bestCount || (c === bestCount && latest > bestLatest)) {
        bestType = t;
        bestCount = c;
        bestLatest = latest;
      }
    }

    return {
      total: rows.length,
      type: bestType,
      label: prettyReportType(bestType),
      count: bestCount,
    };
  }

  // CMD+F: function closeAnyPopup
  function closeAnyPopup() {
    // Google Maps InfoWindow (official)
    try { setSelectedOfficialId(null); } catch {}

    // ✅ queued marker popup
    try { setSelectedQueuedTempId(null); } catch {}

    // Leaflet legacy (safe no-op if not present)
    try { mapRef.current?.closePopup?.(); } catch {}
  }

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

  function requestGuestChallenge(kind, lightId = "") {
    setPendingGuestAction(
      kind === "working"
        ? { kind, lightId: (lightId || "").trim() }
        : { kind }
    );
    setContactChoiceOpen(true);
  }

  function resumePendingGuestAction() {
    const action = pendingGuestAction;
    if (!action) return;
    setPendingGuestAction(null);

    setTimeout(() => {
      if (action.kind === "working") {
        submitIsWorking(action.lightId || "");
        return;
      }
      if (action.kind === "bulk") {
        submitBulkReports();
        return;
      }
      submitReport();
    }, 0);
  }


function canRetryInsertWithoutSelect(err) {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("select") ||
    msg.includes("violates row-level security policy")
  );
}

async function insertReportWithFallback(payload) {
    const tryValues = [payload.report_type];

    if (payload.report_type === "downed_pole") {
      tryValues.push("pole_down");
      tryValues.push("downed-pole");
    }

    let lastErr = null;

    for (const rt of tryValues) {
      const attempt = { ...payload, report_type: rt };
      const canReadInsertedRow = Boolean(attempt.reporter_user_id);
      let data = null;
      let insErr = null;

      if (canReadInsertedRow) {
        const first = await supabase
          .from("reports")
          .insert([attempt])
          .select("*")
          .single();
        data = first.data;
        insErr = first.error;

        // Backward-compatible fallback when report_quality column is not present yet.
        if (insErr && String(insErr.message || "").toLowerCase().includes("report_quality")) {
          const { report_quality, ...withoutQuality } = attempt;
          const second = await supabase
            .from("reports")
            .insert([withoutQuality])
            .select("*")
            .single();
          data = second.data;
          insErr = second.error;
        }
      } else {
        let plain = await supabase.from("reports").insert([attempt]);
        if (plain.error && String(plain.error.message || "").toLowerCase().includes("report_quality")) {
          const { report_quality, ...withoutQuality } = attempt;
          plain = await supabase.from("reports").insert([withoutQuality]);
        }
        if (!plain.error) {
          return {
            data: {
              id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
              created_at: new Date().toISOString(),
              ...attempt,
            },
            usedReportType: rt,
          };
        }
        insErr = plain.error;
      }

      if (!insErr) return { data, usedReportType: rt };

      // If SELECT on reports is restricted (security hardening), retry insert without RETURNING row.
      if (canRetryInsertWithoutSelect(insErr)) {
        let plain = await supabase.from("reports").insert([attempt]);
        if (plain.error && String(plain.error.message || "").toLowerCase().includes("report_quality")) {
          const { report_quality, ...withoutQuality } = attempt;
          plain = await supabase.from("reports").insert([withoutQuality]);
        }
        if (!plain.error) {
          return {
            data: {
              id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
              created_at: new Date().toISOString(),
              ...attempt,
            },
            usedReportType: rt,
          };
        }
      }

      lastErr = insErr;
    }

    return { data: null, error: lastErr };
  }

  async function submitIsWorking(lightId) {
    const lid = (lightId || "").trim();
    if (!lid || saving) return;

    const isAuthed = Boolean(session?.user?.id);
    const usingGuestBypass = !isAuthed && guestSubmitBypassRef.current;
    if (!isAuthed && !usingGuestBypass) {
      requestGuestChallenge("working", lid);
      return;
    }
    const guestSource = usingGuestBypass ? guestInfoDraft : guestInfo;
    if (usingGuestBypass) guestSubmitBypassRef.current = false;

    const name = isAuthed
      ? ((profile?.full_name || session?.user?.user_metadata?.full_name || "").trim() || "User")
      : (guestSource?.name || "");
    const phone = isAuthed ? (profile?.phone || "") : (guestSource?.phone || "");
    const email = isAuthed
      ? ((profile?.email || session?.user?.email) || "")
      : (guestSource?.email || "");

    if (!isAuthed && (!name.trim() || !normalizeEmail(email) || !normalizePhone(phone))) {
      requestGuestChallenge("working", lid);
      openNotice("⚠️", "Contact required", "Please add your name, email, and phone before submitting Is working.");
      return;
    }

    setSaving(true);

    const normName = (name || "").trim() || null;
    const normEmail = normalizeEmail(email) || null;
    const normPhone = normalizePhone(phone) || null;
    const light = (officialLights || []).find((x) => (x.id || "").trim() === lid);
    const lat = Number(light?.lat);
    const lng = Number(light?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setSaving(false);
      openNotice("⚠️", "Couldn’t save", "Could not locate this light.");
      return;
    }

    const workingPayloadBase = {
      lat,
      lng,
      report_type: "working",
      report_quality: "good",
      note: null,
      light_id: lid,
      reporter_user_id: isAuthed ? session.user.id : null,
      reporter_name: normName,
      reporter_phone: normPhone,
      reporter_email: normEmail,
    };

    const workingTypeCandidates = ["working", "is_working", "reported_working"];
    let savedWorking = null;
    let workingErr = null;

    for (const rt of workingTypeCandidates) {
      const attempt = { ...workingPayloadBase, report_type: rt };
      const canReadInsertedRow = Boolean(attempt.reporter_user_id);
      let res = canReadInsertedRow
        ? await supabase
            .from("reports")
            .insert([attempt])
            .select("*")
            .single()
        : await supabase.from("reports").insert([attempt]);

      if (!canReadInsertedRow && !res.error) {
        res = {
          data: {
            id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            created_at: new Date().toISOString(),
            ...attempt,
          },
          error: null,
        };
      }

      if (res.error && canRetryInsertWithoutSelect(res.error)) {
        const plain = await supabase.from("reports").insert([attempt]);
        if (!plain.error) {
          res = {
            data: {
              id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
              created_at: new Date().toISOString(),
              ...attempt,
            },
            error: null,
          };
        }
      }

      if (!res.error) {
        savedWorking = res.data || null;
        workingErr = null;
        break;
      }
      workingErr = res.error;
    }

    setSaving(false);

    if (!savedWorking) {
      console.error(workingErr);
      openNotice("⚠️", "Couldn’t save", workingErr?.message || "Could not record working report.");
      return;
    }

    setReports((prev) => {
      const incoming = {
        id: savedWorking.id,
        lat: savedWorking.lat,
        lng: savedWorking.lng,
        type: savedWorking.report_type,
        report_quality: normalizeReportQuality(savedWorking.report_quality) || "good",
        note: savedWorking.note || "",
        ts: new Date(savedWorking.created_at).getTime(),
        light_id: savedWorking.light_id || lid,
        reporter_user_id: savedWorking.reporter_user_id || null,
        reporter_name: savedWorking.reporter_name || normName,
        reporter_phone: savedWorking.reporter_phone || normPhone,
        reporter_email: savedWorking.reporter_email || normEmail,
      };
      if (prev.some((x) => x.id === incoming.id)) return prev;
      return [incoming, ...prev];
    });

    if (!isAuthed) clearGuestContact();
    openNotice("✅", "Thanks", "Reported working.");
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
    if (isOfficial && Number(mapZoomRef.current || mapZoom) < 17) {
      openNotice("🔎", "Zoom in to report", "Zoom in closer (level 17+) before submitting a report on a light.");
      return;
    }
    setPicked([lat, lng]);
    setActiveLight({ lat, lng, lightId, isOfficial, reports });
    setNote("");           // optional: reset note each time
    setReportType("out");  // optional: default each time
  }

  async function submitReport() {
    if (!picked || saving || !activeLight) return;

    const lightId = activeLight.lightId || lightIdFor(picked[0], picked[1]);
    const isAuthed = Boolean(session?.user?.id);
    const usingGuestBypass = !isAuthed && guestSubmitBypassRef.current;
    if (!isAuthed && !usingGuestBypass) {
      requestGuestChallenge("report");
      return;
    }
    const guestSource = usingGuestBypass ? guestInfoDraft : guestInfo;
    if (usingGuestBypass) guestSubmitBypassRef.current = false;

    if (reportType === "other" && !note.trim()) {
      openNotice("⚠️", "Notes required", "Please add a brief note for “Other”.");
      return;
    }

        // Best-effort fallbacks for authed users (so we never block them)
        const authedEmail = session?.user?.email || "";
        const authedName =
          (profile?.full_name || "").trim() ||
          (session?.user?.user_metadata?.full_name || "").trim() ||
          (authedEmail ? authedEmail.split("@")[0] : "User");

        const name = isAuthed ? authedName : (guestSource.name || "");
        const phone = isAuthed ? (profile?.phone || "") : (guestSource.phone || "");
        const email = isAuthed
          ? ((profile?.email || authedEmail) || "")
          : (guestSource.email || "");

        // ✅ Only guests get blocked and routed to login/create/guest
        if (!isAuthed) {
          if (!name.trim() || (!phone.trim() && !email.trim())) {
            requestGuestChallenge("report");
            setSaving(false);
            return;
          }
        }

        // ✅ Identity enforcement AFTER identity is known
        const identityGuestInfo = isAuthed ? null : { name, phone, email };

        if (!canIdentityReportLight(lightId, {
          session,
          profile,
          guestInfo: identityGuestInfo,
          reports,
          fixedLights,
          lastFixByLightId,
        })) {
          openNotice("⏳", "Already reported", "You already reported this light. You can report again after it is marked fixed.");
          setActiveLight(null);
          setPicked(null);
          return;
        }

        setSaving(true);

        const payload = {
          lat: picked[0],
          lng: picked[1],
          report_type: reportType,
          report_quality: "bad",
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
      report_quality: normalizeReportQuality(data.report_quality) || "bad",
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

    setActiveLight(null);
    setPicked(null);
    setNote("");
    setSaving(false);
    if (!isAuthed) clearGuestContact();

    // ✅ hard-close any popup + suppress any late/synthetic click
    closeAnyPopup();
    setTimeout(() => closeAnyPopup(), 0);
    suppressMapClickRef.current.until = Date.now() + 900;

    openNotice("✅", "Outage reported successfully", "", { autoCloseMs: 900 });
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
    if (!session?.user?.id) {
      openNotice("⚠️", "Not signed in", "You must be logged in to place lights.");
      return false;
    }
    if (!isAdmin) {
      openNotice("⚠️", "Admin only", "Only admins can place official lights.");
      return false;
    }
    if (!mappingQueue.length) return true;

    setSaving(true);

    try {
      // Build rows (and de-dupe by sl_id)
      const rows = mappingQueue.map((q) => ({
        sl_id: makeLightIdFromCoords(q.lat, q.lng),
        lat: Number(q.lat),
        lng: Number(q.lng),
        created_by: session.user.id,
      }));

      const uniqueRows = rows.filter(
        (r, i, arr) => arr.findIndex((x) => x.sl_id === r.sl_id) === i
      );

      const { data, error } = await supabase
        .from("official_lights")
        .insert(uniqueRows)
        .select("id, sl_id, lat, lng")

      if (error) {
        console.error("[confirmMappingQueue] insert error:", error);
        openNotice("⚠️", "Save failed", error.message || "Could not save mapped lights.");
        setSaving(false);
        return false;
      }

      const cleanInserted = (data || [])
        .map((r) => ({
          id: r.id,
          sl_id: r.sl_id || null,
          lat: Number(r.lat),
          lng: Number(r.lng),
        }))
        .filter((r) => r.id && isValidLatLng(r.lat, r.lng));

      // Merge + de-dupe by id
      setOfficialLights((prev) => {
        const next = Array.isArray(prev) ? [...prev] : [];
        for (const row of cleanInserted) {
          const idx = next.findIndex((x) => x.id === row.id);
          if (idx >= 0) next[idx] = { ...next[idx], ...row };
          else next.push(row);
        }
        return next;
      });

      setMappingQueue([]);
      openNotice("✅", "Lights added successfully.", "", { autoCloseMs: 1200 });

      setSaving(false);
      return true;
    } catch (e) {
      console.error("[confirmMappingQueue] exception:", e);
      openNotice("⚠️", "Save failed", "Unexpected error saving mapped lights.");
      setSaving(false);
      return false;
    }
  }

  // Submit bulk reports
  async function submitBulkReports() {
  if (saving) return;

  if (Number(mapZoomRef.current || mapZoom) < 17) {
    openNotice("🔎", "Zoom in to report", "Zoom in closer (level 17+) before submitting bulk reports.");
    return;
  }

  const ids = bulkSelectedIds;
  if (!ids.length) return;
  

  // guests must have contact; authed users are never blocked
  const isAuthed = Boolean(session?.user?.id);
  const usingGuestBypass = !isAuthed && guestSubmitBypassRef.current;
  if (!isAuthed && !usingGuestBypass) {
    requestGuestChallenge("bulk");
    return;
  }
  const guestSource = usingGuestBypass ? guestInfoDraft : guestInfo;
  if (usingGuestBypass) guestSubmitBypassRef.current = false;

  const authedEmail = session?.user?.email || "";
  const authedName =
    (profile?.full_name || "").trim() ||
    (session?.user?.user_metadata?.full_name || "").trim() ||
    (authedEmail ? authedEmail.split("@")[0] : "User");

  const name = isAuthed ? authedName : (guestSource.name || "");
  const phone = isAuthed ? (profile?.phone || "") : (guestSource.phone || "");
  const email = isAuthed ? ((profile?.email || authedEmail) || "") : (guestSource.email || "");

  if (!isAuthed) {
    if (!name.trim() || (!phone.trim() && !email.trim())) {
      requestGuestChallenge("bulk");
      return;
    }
  }


  // close any popup + suppress popups while modal closes
  closeAnyPopup();
  suppressPopupsSafe(1600);

  setSaving(true);

  let okCount = 0;
  let skipAlreadyReported = 0;

  for (const lightId of ids) {
    // identity guard (one report per light since last fixed)
    const identityGuestInfo = isAuthed ? null : { name, phone, email };

    if (!canIdentityReportLight(lightId, {
      session,
      profile,
      guestInfo: identityGuestInfo,
      reports,
      fixedLights,
      lastFixByLightId,
    })) {
      skipAlreadyReported += 1;
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
      report_quality: "bad",
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
      report_quality: normalizeReportQuality(data.report_quality) || "bad",
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
  if (!isAuthed) clearGuestContact();

  if (okCount > 0) {
    openNotice("✅", "Submitted", `Submitted ${okCount} report${okCount === 1 ? "" : "s"}.`);
  } else if (skipAlreadyReported > 0) {
    openNotice("⏳", "Already reported", "Some selected lights were already reported by you and are waiting to be marked fixed.");
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
      .insert([{
        sl_id: makeLightIdFromCoords(lat, lng), // ✅ add this
        lat,
        lng,
        created_by: session?.user?.id
      }])
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
    closeAnyPopup();
    suppressPopupsSafe(1600);

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

  // CMD+F: function isLightFixed
  function isLightFixed(lightId) {
    const id = (lightId || "").trim();
    if (!id) return false;
    const lastFixTs = Math.max(lastFixByLightId?.[id] || 0, fixedLights?.[id] || 0);
    return Boolean(lastFixTs);
  }

  // CMD+F: function toggleFixed
  function toggleFixed(lightId) {
    const light = { lightId, isOfficial: true };
    if (isLightFixed(lightId)) return reopenLight(light);
    return markFixed(light);
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

  // Helper: always forces map camera move
  function flyToTarget(pos, zoom) {
    const lat = Number(pos?.[0]);
    const lng = Number(pos?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const map = mapRef.current;
    const targetZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : Number(mapZoom);

    if (mapInteractIdleTimerRef.current) {
      clearTimeout(mapInteractIdleTimerRef.current);
      mapInteractIdleTimerRef.current = null;
    }
    setMapInteracting(true);

    if (!map) {
      setMapCenter({ lat, lng });
      if (Number.isFinite(targetZoom)) setMapZoom(targetZoom);
      mapInteractIdleTimerRef.current = setTimeout(() => {
        setMapInteracting(false);
        mapInteractIdleTimerRef.current = null;
      }, 750);
    } else {
      cancelFlyAnimation();

      const curCenter = map.getCenter?.();
      const startLat = Number(curCenter?.lat?.() ?? mapCenter.lat);
      const startLng = Number(curCenter?.lng?.() ?? mapCenter.lng);
      const startZoom = Number(map.getZoom?.() ?? mapZoom);
      const endZoom = Number.isFinite(targetZoom) ? targetZoom : startZoom;
      const t0 = performance.now();
      const duration = 650;
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

      const frame = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const e = easeOutCubic(p);

        const clat = startLat + (lat - startLat) * e;
        const clng = startLng + (lng - startLng) * e;
        const cz = startZoom + (endZoom - startZoom) * e;

        try {
          if (map.moveCamera) {
            map.moveCamera({ center: { lat: clat, lng: clng }, zoom: cz });
          } else {
            map.panTo?.({ lat: clat, lng: clng });
            map.setZoom?.(cz);
          }
        } catch {
          // ignore
        }

        setMapCenter({ lat: clat, lng: clng });
        setMapZoom(cz);

        if (p < 1) {
          flyAnimRef.current = requestAnimationFrame(frame);
        } else {
          flyAnimRef.current = null;
          if (mapInteractIdleTimerRef.current) {
            clearTimeout(mapInteractIdleTimerRef.current);
            mapInteractIdleTimerRef.current = null;
          }
          mapInteractIdleTimerRef.current = setTimeout(() => {
            setMapInteracting(false);
            mapInteractIdleTimerRef.current = null;
          }, 750);
        }
      };

      flyAnimRef.current = requestAnimationFrame(frame);
    }

    // keep your existing nonce pattern too (safe if you still use mapTarget elsewhere)
    setMapTarget((prev) => ({
      pos: [lat, lng],
      zoom: targetZoom,
      nonce: (prev?.nonce || 0) + 1,
    }));
  }

  function flyToLightAndOpen(pos, zoom, lightId) {
    flyToTarget(pos, zoom);
    clearFlyInfoTimer();

    const lid = (lightId || "").trim();
    if (!lid || !officialIdSet?.has?.(lid)) return;

    flyInfoTimerRef.current = setTimeout(() => {
      setSelectedQueuedTempId(null);
      setSelectedOfficialId(lid);
      flyInfoTimerRef.current = null;
    }, 700);
  }

  function nudgeMapZoom(delta) {
    const map = mapRef.current;
    if (!map) return;
    const cur = Number(map.getZoom?.() ?? mapZoomRef.current ?? mapZoom);
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
  }

  function moveFollowCamera({ lat, lng, heading, syncState = false }) {
    const map = mapRef.current;
    if (!map) return;

    const nextHeading = Number(heading);

    try {
      if (map.moveCamera) {
        map.moveCamera({
          center: { lat, lng },
          zoom: LOCATE_ZOOM,
          heading: Number.isFinite(nextHeading) ? nextHeading : (map.getHeading?.() || 0),
          tilt: 0,
        });
      } else {
        map.setCenter?.({ lat, lng });
        map.setZoom?.(LOCATE_ZOOM);
        if (Number.isFinite(nextHeading)) map.setHeading?.(nextHeading);
      }
    } catch {
      // ignore
    }

    if (syncState) {
      setMapCenter({ lat, lng });
      setMapZoom(LOCATE_ZOOM);
    }
  }

  function queueFollowCameraTarget({ lat, lng, heading }) {
    followTargetRef.current = { lat, lng, heading };
    if (followRafRef.current) return;

    const step = () => {
      const map = mapRef.current;
      const target = followTargetRef.current;
      if (!map || !target || !followCamera) {
        followRafRef.current = null;
        return;
      }

      let targetLat = Number(target.lat);
      let targetLng = Number(target.lng);
      let targetHeading = Number(target.heading);
      if (!followHeadingEnabledRef.current) targetHeading = NaN;

      const motion = liveMotionRef.current;
      const motionLat = Number(motion?.lat);
      const motionLng = Number(motion?.lng);
      const motionHeading = Number(motion?.heading);
      const motionSpeed = Number(motion?.speed);
      const motionTs = Number(motion?.ts);
      const headingFreezeMps = 1.6; // ~3.6 mph
      const headingHeavyDampMps = 3.6; // ~8 mph

      if (Number.isFinite(motionSpeed) && motionSpeed < headingFreezeMps) {
        targetHeading = NaN;
      }

      if (
        Number.isFinite(motionLat) &&
        Number.isFinite(motionLng) &&
        Number.isFinite(motionHeading) &&
        Number.isFinite(motionSpeed) &&
        motionSpeed > 2.5 &&
        Number.isFinite(motionTs)
      ) {
        const elapsedSec = Math.max(0, (Date.now() - motionTs) / 1000);
        const predictSec = clamp(elapsedSec, 0, 0.55);
        const predictMeters = clamp(motionSpeed * predictSec, 0, 12);

        if (predictMeters > 0.5) {
          const predicted = destinationPointMeters(
            { lat: motionLat, lng: motionLng },
            predictMeters,
            motionHeading
          );
          const predictBlend = clamp(motionSpeed / 20, 0.2, 0.55);
          targetLat = targetLat + (predicted.lat - targetLat) * predictBlend;
          targetLng = targetLng + (predicted.lng - targetLng) * predictBlend;
          if (!Number.isFinite(targetHeading)) targetHeading = motionHeading;
        }
      }

      const curCenter = map.getCenter?.();
      const curLat = Number(curCenter?.lat?.() ?? targetLat);
      const curLng = Number(curCenter?.lng?.() ?? targetLng);
      const distToTarget = metersBetween(
        { lat: curLat, lng: curLng },
        { lat: targetLat, lng: targetLng }
      );

      const centerAlpha = distToTarget > 25 ? 0.34 : distToTarget > 8 ? 0.22 : 0.14;
      const nextLat = curLat + (targetLat - curLat) * centerAlpha;
      const nextLng = curLng + (targetLng - curLng) * centerAlpha;

      let nextHeading = Number(map.getHeading?.());
      if (!Number.isFinite(nextHeading)) nextHeading = 0;

      if (Number.isFinite(targetHeading) && followHeadingEnabledRef.current) {
        const delta = ((targetHeading - nextHeading + 540) % 360) - 180;
        const rotateAlpha =
          motionSpeed >= 12 ? 0.18 :
          motionSpeed >= 6 ? 0.14 :
          motionSpeed >= headingHeavyDampMps ? 0.10 : 0.08;
        const rotateDeadband =
          motionSpeed >= 12 ? 3 :
          motionSpeed >= 6 ? 5 :
          motionSpeed >= headingHeavyDampMps ? 8 : 12;
        if (Math.abs(delta) >= rotateDeadband) {
          nextHeading = (nextHeading + delta * rotateAlpha + 360) % 360;
        }
      }

      moveFollowCamera({
        lat: nextLat,
        lng: nextLng,
        heading: Number.isFinite(targetHeading) ? nextHeading : null,
        syncState: false,
      });

      const now = Date.now();
      if (now - lastFollowStateSyncRef.current >= 120) {
        setMapCenter({ lat: nextLat, lng: nextLng });
        setMapZoom(LOCATE_ZOOM);
        lastFollowStateSyncRef.current = now;
      }

      followRafRef.current = requestAnimationFrame(step);
    };

    followRafRef.current = requestAnimationFrame(step);
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

    // If previously denied, only proceed if forced
    if (geoDenied && !force) {
      setShowLocationPrompt(true);
      return;
    }

    // Best-effort: check permission state when available
    try {
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: "geolocation" });

        if (status.state === "denied" && !force) {
          setGeoDeniedPersist(true);
          setShowLocationPrompt(true);
          return;
        }

        if (status.state === "granted" && geoDenied) {
          setGeoDeniedPersist(false);
        }
      }
    } catch {
      // ignore
    }

    setLocating(true);
    // Explicit locate action re-enables heading orientation while tracking.
    followHeadingEnabledRef.current = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        updateUserLocUi(lat, lng, true);
        lastTrackedPosRef.current = { lat, lng };
        smoothedHeadingRef.current = null;
        lastFollowCameraRef.current = { lat, lng, heading: null };
        flyToTarget([lat, lng], LOCATE_ZOOM);

        setAutoFollow(true);
        setFollowCamera(true);

        if (geoDenied) setGeoDeniedPersist(false);
        setLocating(false);
      },
      (err) => {
        setLocating(false);

        const code = Number(err?.code);
        if (code === 1) {
          setGeoDeniedPersist(true);
          setShowLocationPrompt(true);
          openNotice("⚠️", "Location denied", "Unable to access location. You can still pan and tap the map.");
          return;
        }

        // Timeout/unavailable are not permission denials.
        setGeoDeniedPersist(false);

        if (code === 3) {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              const lat = fallbackPos.coords.latitude;
              const lng = fallbackPos.coords.longitude;
              updateUserLocUi(lat, lng, true);
              lastTrackedPosRef.current = { lat, lng };
              flyToTarget([lat, lng], LOCATE_ZOOM);
              setAutoFollow(true);
              setFollowCamera(true);
            },
            () => {
              openNotice("⚠️", "Location timeout", "Couldn’t get GPS quickly. Try again in a clearer area.");
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
          );
          return;
        }

        if (code === 2) {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              const lat = fallbackPos.coords.latitude;
              const lng = fallbackPos.coords.longitude;
              updateUserLocUi(lat, lng, true);
              lastTrackedPosRef.current = { lat, lng };
              flyToTarget([lat, lng], LOCATE_ZOOM);
              setAutoFollow(true);
              setFollowCamera(true);
            },
            () => {
              openNotice("⚠️", "Location unavailable", "Your device could not determine location right now.");
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
          );
          return;
        }

        openNotice("⚠️", "Location error", "Could not determine your location right now.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
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
        const nextPos = { lat, lng };
        const prevPos = lastTrackedPosRef.current;
        const ts = Number(pos?.timestamp) || Date.now();
        const accuracyM = Number(pos?.coords?.accuracy);

        updateUserLocUi(lat, lng, false);
        lastTrackedPosRef.current = nextPos;

        const rawSpeed = Number(pos?.coords?.speed);
        let speedMps = Number.isFinite(rawSpeed) && rawSpeed >= 0 ? rawSpeed : NaN;
        const headingFreezeMps = 1.6; // ~3.6 mph
        const headingHeavyDampMps = 3.6; // ~8 mph

        const prevMotionTs = Number(liveMotionRef.current?.ts);
        if ((!Number.isFinite(speedMps) || speedMps < 0) && prevPos && Number.isFinite(prevMotionTs)) {
          const dtSec = (ts - prevMotionTs) / 1000;
          if (dtSec > 0.2) speedMps = metersBetween(prevPos, nextPos) / dtSec;
        }

        let heading = Number(pos?.coords?.heading);
        if (!Number.isFinite(heading) || heading < 0) {
          if (prevPos) {
            const movedMeters = metersBetween(prevPos, nextPos);
            if (movedMeters >= 4) heading = bearingBetween(prevPos, nextPos);
          }
        }

        if (Number.isFinite(heading)) {
          const prev = smoothedHeadingRef.current;
          if (!Number.isFinite(prev)) {
            if (!Number.isFinite(speedMps) || speedMps >= headingFreezeMps) {
              smoothedHeadingRef.current = heading;
            }
          } else {
            const speedForSmoothing = Number.isFinite(speedMps) ? speedMps : 0;
            const headingAlpha =
              speedForSmoothing >= 12 ? 0.28 :
              speedForSmoothing >= 6 ? 0.22 :
              speedForSmoothing >= headingHeavyDampMps ? 0.14 :
              0.08;
            const delta = ((heading - prev + 540) % 360) - 180;
            const headingDeadband =
              speedForSmoothing >= 12 ? 2 :
              speedForSmoothing >= 6 ? 3.5 :
              speedForSmoothing >= headingHeavyDampMps ? 6 :
              12;
            if (speedForSmoothing >= headingFreezeMps && Math.abs(delta) >= headingDeadband) {
              smoothedHeadingRef.current = (prev + delta * headingAlpha + 360) % 360;
            }
          }
        }

        const speedForHeading = Number.isFinite(speedMps) ? speedMps : 0;
        const effectiveHeading =
          speedForHeading < headingFreezeMps
            ? Number(liveMotionRef.current?.heading)
            : (Number.isFinite(smoothedHeadingRef.current) ? smoothedHeadingRef.current : heading);

        liveMotionRef.current = {
          lat,
          lng,
          heading: Number.isFinite(effectiveHeading)
            ? effectiveHeading
            : Number(liveMotionRef.current?.heading),
          speed: Number.isFinite(speedMps) && speedMps > 0 ? speedMps : 0,
          ts,
        };

        if (followCamera) {
          const speedForThresholds = Number.isFinite(speedMps) && speedMps > 0 ? speedMps : 0;
          const poorAccuracySmallMove =
            Number.isFinite(accuracyM) &&
            accuracyM > 25 &&
            prevPos &&
            metersBetween(prevPos, nextPos) < Math.min(accuracyM * 0.5, 18);

          const last = lastFollowCameraRef.current;
          const movedMeters = Number.isFinite(last.lat) && Number.isFinite(last.lng)
            ? metersBetween({ lat: last.lat, lng: last.lng }, nextPos)
            : Infinity;

          const headingDelta = !followHeadingEnabledRef.current
            ? 0
            : Number.isFinite(last.heading) && Number.isFinite(effectiveHeading)
              ? Math.abs(((effectiveHeading - last.heading + 540) % 360) - 180)
              : Infinity;

          const moveTriggerMeters =
            Number.isFinite(accuracyM) && accuracyM > 40 ? 3 :
            Number.isFinite(accuracyM) && accuracyM > 20 ? 2 :
            speedForThresholds >= 12 ? 1.5 :
            speedForThresholds >= 6 ? 1.2 :
            speedForThresholds >= headingHeavyDampMps ? 2.2 : 3.2;
          const headingTriggerDeg =
            speedForThresholds >= 12 ? 3 :
            speedForThresholds >= 6 ? 4 :
            speedForThresholds >= headingHeavyDampMps ? 8 :
            14;

          if (!poorAccuracySmallMove && (movedMeters >= moveTriggerMeters || headingDelta >= headingTriggerDeg || !followTargetRef.current)) {
            const queuedHeading =
              (followHeadingEnabledRef.current && speedForThresholds >= headingFreezeMps)
                ? effectiveHeading
                : null;
            queueFollowCameraTarget({ lat, lng, heading: queuedHeading });
            lastFollowCameraRef.current = { lat, lng, heading: queuedHeading };
          }
        }
      },
      (err) => {
        const code = Number(err?.code);
        if (code === 1) {
          setAutoFollow(false);
          setGeoDeniedPersist(true);
          setShowLocationPrompt(true);
          openNotice("⚠️", "Location denied", "Location access was blocked.");
          return;
        }

        // Keep current mode; non-permission errors should not lock user into denied state.
        setGeoDeniedPersist(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );

    return () => {
      try { navigator.geolocation.clearWatch(id); } catch {}
    };
  }, [autoFollow, followCamera]);

  useEffect(() => () => {
    cancelFlyAnimation();
    clearFlyInfoTimer();
    stopFollowCameraAnimation();
  }, []);

  useEffect(() => {
    if (followCamera) return;
    stopFollowCameraAnimation();
  }, [followCamera]);


  // -------------------------
  // Render
  // -------------------------

  // ✅ Load Google Maps JS before rendering <GoogleMap />
  // Uses Vite env var: VITE_GOOGLE_MAPS_API_KEY
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // Touch fallback: tap once, then quickly tap+hold and drag up/down to zoom.
  useEffect(() => {
    if (!isTouchDevice) return;
    if (!isLoaded) return;
    const map = mapRef.current;
    const div = map?.getDiv?.();
    if (!div) return;

    const state = zoomDragRef.current;
    const TAP_MOVE_MAX = 24;
    const TAP_DURATION_MAX = 320;
    const SECOND_TAP_WINDOW_MS = 560;

    const lockMapForDragZoom = () => {
      try {
        map.setOptions?.({ draggable: false, gestureHandling: "none" });
      } catch {}
    };

    const unlockMapForDragZoom = () => {
      try {
        map.setOptions?.({ draggable: true, gestureHandling: "greedy" });
      } catch {}
    };

    // Transparent overlay catches second-tap-hold drag so map cannot pan.
    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.background = "transparent";
    overlay.style.pointerEvents = "none";
    overlay.style.touchAction = "none";
    overlay.style.zIndex = "3";
    div.appendChild(overlay);

    let armTimer = null;
    const clearArmTimer = () => {
      if (armTimer) {
        clearTimeout(armTimer);
        armTimer = null;
      }
    };

    const disarmSecondTap = () => {
      state.armUntil = 0;
      overlay.style.pointerEvents = state.active ? "auto" : "none";
      clearArmTimer();
    };

    const armSecondTap = (x, y) => {
      const now = Date.now();
      state.lastTapTs = now;
      state.lastTapX = x;
      state.lastTapY = y;
      state.armUntil = now + SECOND_TAP_WINDOW_MS;
      overlay.style.pointerEvents = "auto";
      clearArmTimer();
      armTimer = setTimeout(() => {
        if (!state.active) disarmSecondTap();
      }, SECOND_TAP_WINDOW_MS + 80);
    };

    const beginActiveDragZoom = (touch, e) => {
      state.pendingTap = false;
      state.active = true;
      state.startY = touch.clientY;
      state.startZoom = Number(map.getZoom?.() ?? mapZoomRef.current);
      state.lastAppliedZoom = state.startZoom;
      div.style.touchAction = "none";
      overlay.style.pointerEvents = "auto";
      lockMapForDragZoom();
      suppressMapClickRef.current.until = Date.now() + 450;
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
      e.preventDefault();
    };

    const endActiveDragZoom = () => {
      state.active = false;
      div.style.touchAction = "";
      unlockMapForDragZoom();
      disarmSecondTap();
    };

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) {
        state.pendingTap = false;
        state.active = false;
        disarmSecondTap();
        return;
      }
      const t = e.touches[0];
      state.pendingTap = true;
      state.tapStartTs = Date.now();
      state.tapStartX = t.clientX;
      state.tapStartY = t.clientY;
    };

    const onTouchMove = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (state.pendingTap) {
        const dx = t.clientX - state.tapStartX;
        const dy = t.clientY - state.tapStartY;
        if (Math.hypot(dx, dy) > TAP_MOVE_MAX) {
          state.pendingTap = false;
        }
      }
    };

    const onTouchEnd = (e) => {
      if (!state.pendingTap) return;
      const now = Date.now();
      const touch = e.changedTouches?.[0];
      const endX = Number(touch?.clientX);
      const endY = Number(touch?.clientY);
      const dx = Number.isFinite(endX) ? endX - state.tapStartX : 0;
      const dy = Number.isFinite(endY) ? endY - state.tapStartY : 0;
      const dist = Math.hypot(dx, dy);
      const dur = now - state.tapStartTs;

      if (dur <= TAP_DURATION_MAX && dist <= TAP_MOVE_MAX) {
        armSecondTap(
          Number.isFinite(endX) ? endX : state.tapStartX,
          Number.isFinite(endY) ? endY : state.tapStartY
        );
      }
      state.pendingTap = false;
    };

    const onOverlayTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const now = Date.now();
      const canActivate = now <= state.armUntil;
      const dx = t.clientX - state.lastTapX;
      const dy = t.clientY - state.lastTapY;
      if (!canActivate || Math.hypot(dx, dy) > 80) {
        disarmSecondTap();
        return;
      }
      beginActiveDragZoom(t, e);
    };

    const onOverlayTouchMove = (e) => {
      if (!state.active || e.touches.length !== 1) return;
      const t = e.touches[0];
      const deltaY = state.startY - t.clientY; // up -> zoom in
      const nextZoom = clamp(state.startZoom + (deltaY / 60), 3, 22);
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
      e.preventDefault();
      if (Number.isFinite(nextZoom) && Math.abs(nextZoom - state.lastAppliedZoom) >= 0.05) {
        if (map.moveCamera) map.moveCamera({ zoom: nextZoom });
        else map.setZoom?.(nextZoom);
        state.lastAppliedZoom = nextZoom;
      }
    };

    const onOverlayTouchEnd = (e) => {
      if (state.active) {
        e.stopPropagation?.();
        e.stopImmediatePropagation?.();
        e.preventDefault();
        endActiveDragZoom();
        return;
      }
      disarmSecondTap();
    };

    div.addEventListener("touchstart", onTouchStart, { passive: false, capture: true });
    div.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });
    div.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    div.addEventListener("touchcancel", onTouchEnd, { passive: true, capture: true });
    overlay.addEventListener("touchstart", onOverlayTouchStart, { passive: false, capture: true });
    overlay.addEventListener("touchmove", onOverlayTouchMove, { passive: false, capture: true });
    overlay.addEventListener("touchend", onOverlayTouchEnd, { passive: false, capture: true });
    overlay.addEventListener("touchcancel", onOverlayTouchEnd, { passive: false, capture: true });

    return () => {
      clearArmTimer();
      div.style.touchAction = "";
      unlockMapForDragZoom();
      try { overlay.remove(); } catch {}
      div.removeEventListener("touchstart", onTouchStart, true);
      div.removeEventListener("touchmove", onTouchMove, true);
      div.removeEventListener("touchend", onTouchEnd, true);
      div.removeEventListener("touchcancel", onTouchEnd, true);
      overlay.removeEventListener("touchstart", onOverlayTouchStart, true);
      overlay.removeEventListener("touchmove", onOverlayTouchMove, true);
      overlay.removeEventListener("touchend", onOverlayTouchEnd, true);
      overlay.removeEventListener("touchcancel", onOverlayTouchEnd, true);
    };
  }, [isLoaded, isTouchDevice]);
  
  // -------------------------
  // Popup button styles (Google InfoWindow)
  // -------------------------
  const btnPopupPrimary = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "none",
    background: "#1976d2",
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

  const connected = !loading && !error;
  const canShowOfficialLightsByZoom = true;
  const showOfficialLights = canShowOfficialLightsByZoom && !mapInteracting;

  useEffect(() => {
    mapZoomRef.current = mapZoom;
  }, [mapZoom]);

  useEffect(() => {
    if (canShowOfficialLightsByZoom) return;
    if (selectedOfficialId) setSelectedOfficialId(null);
  }, [canShowOfficialLightsByZoom, selectedOfficialId]);

  const beginMapInteraction = useCallback(() => {
    if (mapInteractIdleTimerRef.current) {
      clearTimeout(mapInteractIdleTimerRef.current);
      mapInteractIdleTimerRef.current = null;
    }
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

  if (loadError) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        Google Maps failed to load. Check your API key + referrer restrictions.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        Loading map…
      </div>
    );
  }

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

        :root {
          --sl-ui-surface-bg: rgba(255,255,255,0.96);
          --sl-ui-surface-border: rgba(0,0,0,0.10);
          --sl-ui-surface-shadow: 0 10px 22px rgba(0,0,0,0.18);
          --sl-ui-surface-shadow-bottom: 0 -10px 22px rgba(0,0,0,0.18);
          --sl-ui-text: #111;
          --sl-ui-zoom-bg: rgba(255,255,255,0.96);
          --sl-ui-zoom-border: rgba(0,0,0,0.28);
          --sl-ui-zoom-shadow: inset 0 1px 0 rgba(255,255,255,0.75), 0 8px 18px rgba(0,0,0,0.22);
          --sl-ui-zoom-shadow-mobile: inset 0 1px 0 rgba(255,255,255,0.75), 0 6px 14px rgba(0,0,0,0.22);
          --sl-ui-tool-btn-bg: rgba(255,255,255,0.96);
          --sl-ui-tool-btn-border: rgba(0,0,0,0.34);
          --sl-ui-tool-btn-shadow: inset 0 1px 0 rgba(255,255,255,0.78), inset 0 -2px 0 rgba(0,0,0,0.10), 0 4px 10px rgba(0,0,0,0.22), 0 10px 18px rgba(0,0,0,0.14);
          --sl-ui-modal-bg: rgba(255,255,255,0.98);
          --sl-ui-modal-border: rgba(0,0,0,0.12);
          --sl-ui-modal-shadow: 0 10px 30px rgba(0,0,0,0.25);
          --sl-ui-modal-input-bg: #fff;
          --sl-ui-modal-input-border: #ddd;
          --sl-ui-modal-btn-secondary-bg: #fff;
          --sl-ui-modal-btn-secondary-border: rgba(0,0,0,0.18);
          --sl-ui-modal-btn-secondary-text: #111;
          --sl-ui-modal-btn-dark-bg: #111;
          --sl-ui-modal-btn-dark-text: #fff;
          --sl-ui-modal-subtle-bg: rgba(0,0,0,0.02);
          --sl-ui-alert-danger-bg: rgba(183,28,28,0.08);
          --sl-ui-alert-danger-border: rgba(183,28,28,0.35);
          --sl-ui-alert-danger-text: #b71c1c;
          --sl-ui-open-reports-item-border: rgba(0,0,0,0.10);
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --sl-ui-surface-bg: rgba(28,31,35,0.94);
            --sl-ui-surface-border: rgba(255,255,255,0.12);
            --sl-ui-surface-shadow: 0 12px 28px rgba(0,0,0,0.45);
            --sl-ui-surface-shadow-bottom: 0 -12px 26px rgba(0,0,0,0.42);
            --sl-ui-text: #f3f5f7;
            --sl-ui-zoom-bg: rgba(28,31,35,0.94);
            --sl-ui-zoom-border: rgba(255,255,255,0.24);
            --sl-ui-zoom-shadow: inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.24), 0 10px 22px rgba(0,0,0,0.50), 0 2px 6px rgba(0,0,0,0.26);
            --sl-ui-zoom-shadow-mobile: inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.24), 0 8px 18px rgba(0,0,0,0.50), 0 2px 5px rgba(0,0,0,0.24);
            --sl-ui-tool-btn-bg: rgba(28,31,35,0.94);
            --sl-ui-tool-btn-border: rgba(255,255,255,0.22);
            --sl-ui-tool-btn-shadow: inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.24), 0 4px 10px rgba(0,0,0,0.42), 0 10px 18px rgba(0,0,0,0.34), 0 1px 3px rgba(0,0,0,0.22);
            --sl-ui-modal-bg: rgba(28,31,35,0.96);
            --sl-ui-modal-border: rgba(255,255,255,0.14);
            --sl-ui-modal-shadow: 0 14px 34px rgba(0,0,0,0.45);
            --sl-ui-modal-input-bg: rgba(44,49,55,0.98);
            --sl-ui-modal-input-border: rgba(255,255,255,0.14);
            --sl-ui-modal-btn-secondary-bg: rgba(44,49,55,0.98);
            --sl-ui-modal-btn-secondary-border: rgba(255,255,255,0.16);
            --sl-ui-modal-btn-secondary-text: #f3f5f7;
            --sl-ui-modal-btn-dark-bg: rgba(68,74,82,0.98);
            --sl-ui-modal-btn-dark-text: #f3f5f7;
            --sl-ui-modal-subtle-bg: rgba(255,255,255,0.03);
            --sl-ui-alert-danger-bg: rgba(183,28,28,1);
            --sl-ui-alert-danger-border: rgba(183,28,28,0.455);
            --sl-ui-alert-danger-text: #fff;
            --sl-ui-open-reports-item-border: #ffffff;
          }

          .sl-map-tool .sl-map-tool-btn.is-on,
          .sl-map-tool .sl-bulk-tool-btn.is-on {
            background: rgba(57, 211, 83, 0.96);
            color: #111;
            border: 1px solid rgba(255,255,255,0.18) !important;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.34),
              inset 0 -2px 0 rgba(0,0,0,0.14),
              0 6px 14px rgba(0,0,0,0.34),
              0 12px 20px rgba(0,0,0,0.24) !important;
            background: rgba(57, 211, 83, 0.96) !important;
            color: #111 !important;
          }

          .sl-map-tool .sl-map-tool-mini.is-on {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.16),
              inset 0 -2px 0 rgba(0,0,0,0.28),
              0 4px 10px rgba(0,0,0,0.44),
              0 10px 18px rgba(0,0,0,0.34) !important;
          }
        }

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
          top: 50%;
          right: 14px;
          transform: translateY(-50%);
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
          border: 1px solid var(--sl-ui-tool-btn-border);
          background: var(--sl-ui-tool-btn-bg);
          box-shadow: var(--sl-ui-tool-btn-shadow);
          display: grid;
          place-items: center;
          font-size: 18px;
          font-weight: 900;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          touch-action: manipulation;
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
          border: 1px solid var(--sl-ui-tool-btn-border);
          background: var(--sl-ui-tool-btn-bg);
          box-shadow: var(--sl-ui-tool-btn-shadow);
          display: grid;
          place-items: center;
          font-size: 16px;
          font-weight: 950;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          touch-action: manipulation;
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
          animation: sl-tool-hint-fade 1100ms ease forwards;
        }

        @keyframes sl-tool-hint-fade {
          0% { opacity: 0; transform: translateY(-2px); }
          12% { opacity: 1; transform: translateY(0); }
          72% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-3px); }
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
        onCreateAccount={handleCreateAccount}
      />

      <ForgotPasswordModal
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
      />

      <GuestInfoModal
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
          setContactChoiceOpen(false);
          setGuestInfoDraft({
            name: "",
            phone: "",
            email: "",
          });
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
                border: "none",
                background: "#d32f2f",
                color: "white",
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
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
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

      <ModalShell open={clearQueuedConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Clear queued lights?</div>

          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            Remove <b>{mappingQueue.length}</b> queued light{mappingQueue.length === 1 ? "" : "s"} that have not been saved yet?
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={confirmClearQueuedLights}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "#d32f2f",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Clear Queued Lights
            </button>

            <button
              type="button"
              onClick={() => setClearQueuedConfirmOpen(false)}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
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

      <ModalShell open={isWorkingConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Is Working</div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
            Submit this light as working?
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              onClick={async () => {
                const lid = (pendingWorkingLightId || "").trim();
                setIsWorkingConfirmOpen(false);
                setPendingWorkingLightId(null);
                if (!lid) return;
                await submitIsWorking(lid);
              }}
              style={btnPopupPrimary}
            >
              Confirm
            </button>
            <button
              onClick={() => {
                setIsWorkingConfirmOpen(false);
                setPendingWorkingLightId(null);
              }}
              style={btnPopupSecondary}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={markFixedConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Mark Fixed</div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
            Mark this light as fixed?
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              onClick={async () => {
                const lid = (pendingMarkFixedLightId || "").trim();
                setMarkFixedConfirmOpen(false);
                setPendingMarkFixedLightId(null);
                if (!lid) return;
                await toggleFixed(lid);
              }}
              style={btnPopupPrimary}
            >
              Confirm
            </button>
            <button
              onClick={() => {
                setMarkFixedConfirmOpen(false);
                setPendingMarkFixedLightId(null);
              }}
              style={btnPopupSecondary}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={deleteOfficialConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Delete Light</div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
            Delete this saved light?
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              onClick={async () => {
                const lid = (pendingDeleteOfficialLightId || "").trim();
                setDeleteOfficialConfirmOpen(false);
                setPendingDeleteOfficialLightId(null);
                if (!lid) return;
                await deleteOfficialLight(lid);
                closeAnyPopup();
              }}
              style={btnPopupPrimary}
            >
              Confirm
            </button>
            <button
              onClick={() => {
                setDeleteOfficialConfirmOpen(false);
                setPendingDeleteOfficialLightId(null);
              }}
              style={btnPopupSecondary}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

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
        onFlyTo={(pos, zoom, lightId) => {
          closeMyReports();
          flyToLightAndOpen(pos, zoom, lightId);
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
        onFlyTo={(pos, zoom, lightId) => {
          closeOpenReports();
          flyToLightAndOpen(pos, zoom, lightId);
        }}
        onOpenAllReports={(lightId) => {
          openOfficialLightAllReports(lightId);
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
          Map (Google Maps)
         ========================= */}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={mapZoom}
        onLoad={(map) => {
          setGmapsRef(map);
          mapRef.current = map; // keep your existing ref name working
        }}
        onDragStart={() => {
          beginMapInteraction();
          if (followCamera) setFollowCamera(false);
        }}
        onZoomChanged={() => {
          beginMapInteraction();
          const z = Number(mapRef.current?.getZoom?.());
          if (!Number.isFinite(z)) return;
          mapZoomRef.current = z;
          const rounded = Math.round(z);
          setMapZoom((prev) => (prev === rounded ? prev : rounded));
        }}
        onIdle={() => {
          endMapInteractionSoon(750);
          const map = mapRef.current;
          if (!map) return;

          const z = Number(map.getZoom?.());
          if (Number.isFinite(z)) {
            const rounded = Math.round(z);
            setMapZoom((prev) => (prev === rounded ? prev : rounded));
          }

          const c = map.getCenter?.();
          const lat = Number(c?.lat?.());
          const lng = Number(c?.lng?.());
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setMapCenter((prev) => {
              if (!prev) return { lat, lng };
              if (Math.abs(prev.lat - lat) < 0.000001 && Math.abs(prev.lng - lng) < 0.000001) return prev;
              return { lat, lng };
            });
          }
        }}
        options={{
          mapTypeId: mapType,
          mapId: GMAPS_MAP_ID || undefined,
          gestureHandling: "greedy",
          disableDoubleClickZoom: isTouchDevice,
          isFractionalZoomEnabled: false,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          clickableIcons: false,
          rotateControl: true,
          headingInteractionEnabled: true,
          tiltInteractionEnabled: false,
        }}
        onClick={(e) => {
          if (Date.now() < (suppressMapClickRef.current?.until || 0)) return;
          const lat = Number(e?.latLng?.lat?.());
          const lng = Number(e?.latLng?.lng?.());
          if (showOfficialLights && Number.isFinite(lat) && Number.isFinite(lng)) {
            const hitOfficialId = officialCanvasOverlayRef.current?.hitTestByLatLng?.(lat, lng);
            if (hitOfficialId) {
              handleOfficialMarkerClick(hitOfficialId);
              return;
            }
          }

          // Clicking map background should close any open info windows.
          if (selectedOfficialId || selectedQueuedTempId) {
            setSelectedOfficialId(null);
            setSelectedQueuedTempId(null);
          }

          if (!mappingMode) return;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          queueOfficialLight(lat, lng);
        }}
      >
        {userLoc && (
          <SmoothUserMarker position={{ lat: userLoc[0], lng: userLoc[1] }} />
        )}
        {/* Canvas overlay replaces thousands of MarkerF nodes for smoother pan/zoom */}
        <OfficialLightsCanvasOverlay
          ref={officialCanvasOverlayRef}
          map={gmapsRef}
          show={showOfficialLights}
          lights={renderedOfficialLights}
          bulkMode={bulkMode}
          bulkSelectedSet={bulkSelectedSet}
          getMarkerColor={officialMarkerColorForViewer}
        />


        {/* Queued markers (mapping mode preview) */}
        {mappingMode && isAdmin && (mappingQueue || []).map((q) => (
          <MarkerF
            key={q.tempId}
            position={{ lat: q.lat, lng: q.lng }}
            icon={gmapsDotIcon("#2ecc71")}
            onClick={() => {
              setSelectedOfficialId(null);
              setSelectedQueuedTempId(q.tempId);
            }}
          />
        ))}

      </GoogleMap>

      {!bulkMode && selectedOfficialLightForPopup && selectedOfficialPopupPixel && (
        <div
          style={{
            position: "absolute",
            left: selectedOfficialPopupPixel.x,
            top: selectedOfficialPopupPixel.y,
            transform: "translate(-50%, calc(-100% - 14px))",
            zIndex: 2600,
            pointerEvents: "auto",
            maxWidth: "min(280px, calc(100vw - 20px))",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div
            style={{
              background: "var(--sl-ui-modal-bg)",
              border: "1px solid var(--sl-ui-modal-border)",
              borderRadius: 12,
              boxShadow: "var(--sl-ui-modal-shadow)",
              padding: 10,
              minWidth: 210,
              display: "grid",
              gap: 10,
              color: "var(--sl-ui-text)",
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedOfficialId(null)}
              aria-label="Close"
              style={{
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
              }}
            >
              ×
            </button>

            <div style={{ fontWeight: 900, paddingRight: 26 }}>Streetlight</div>

            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
              Light ID:{" "}
              <span
                style={{
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              >
                {(selectedOfficialLightForPopup.sl_id || "").trim() || displayLightId(selectedOfficialLightForPopup.id, slIdByUuid)}
              </span>
            </div>

            <div style={{ fontSize: 13 }}>
              Status: <b>{officialStatusLabelForViewer(selectedOfficialLightForPopup.id)}</b>
            </div>

            {(() => {
              const canReportIssueHere = Number(mapZoom) >= 17;
              return (
            <button
              style={{ ...btnPopupPrimary, opacity: canReportIssueHere ? 1 : 0.6, cursor: canReportIssueHere ? "pointer" : "not-allowed" }}
              disabled={!canReportIssueHere}
              onClick={() => {
                openConfirmForLight({
                  lat: selectedOfficialLightForPopup.lat,
                  lng: selectedOfficialLightForPopup.lng,
                  lightId: selectedOfficialLightForPopup.id,
                  isOfficial: true,
                });
              }}
              title={canReportIssueHere ? "Report issue" : "Zoom to level 17+ to report"}
            >
              Report issue
            </button>
              );
            })()}

            {Number(mapZoom) < 17 && (
              <div style={{ fontSize: 11.5, opacity: 0.78, lineHeight: 1.25 }}>
                Zoom in closer (17+) to report this light.
              </div>
            )}

            {!isAdmin && officialMarkerColorForViewer(selectedOfficialLightForPopup.id) !== "#111" && (
              <button
                style={btnPopupSecondary}
                onClick={() => {
                  setPendingWorkingLightId(selectedOfficialLightForPopup.id);
                  setIsWorkingConfirmOpen(true);
                }}
              >
                Is working
              </button>
            )}

            {isAdmin && (
              <button
                style={btnPopupSecondary}
                onClick={() => {
                  if (isLightFixed(selectedOfficialLightForPopup.id)) {
                    toggleFixed(selectedOfficialLightForPopup.id);
                    return;
                  }
                  setPendingMarkFixedLightId(selectedOfficialLightForPopup.id);
                  setMarkFixedConfirmOpen(true);
                }}
              >
                {isLightFixed(selectedOfficialLightForPopup.id) ? "Re-open" : "Mark fixed"}
              </button>
            )}

            {isAdmin && (
              <div style={{ height: 1, background: "rgba(0,0,0,0.2)", margin: "2px 0" }} />
            )}

            {isAdmin && (
              <button
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
                onClick={() => {
                  openOfficialLightAllReports(selectedOfficialLightForPopup.id);
                }}
              >
                All Reports
              </button>
            )}

            {mappingMode && isAdmin && (
              <button
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "none",
                  background: "#d32f2f",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
                onClick={() => {
                  setPendingDeleteOfficialLightId(selectedOfficialLightForPopup.id);
                  setDeleteOfficialConfirmOpen(true);
                }}
              >
                Delete Light
              </button>
            )}
          </div>

          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -7,
              width: 12,
              height: 12,
              background: "var(--sl-ui-modal-bg)",
              borderRight: "1px solid var(--sl-ui-modal-border)",
              borderBottom: "1px solid var(--sl-ui-modal-border)",
              transform: "translateX(-50%) rotate(45deg)",
            }}
          />
        </div>
      )}

      {!bulkMode && selectedQueuedLightForPopup && selectedQueuedPopupPixel && (
        <div
          style={{
            position: "absolute",
            left: selectedQueuedPopupPixel.x,
            top: selectedQueuedPopupPixel.y,
            transform: "translate(-50%, calc(-100% - 14px))",
            zIndex: 2600,
            pointerEvents: "auto",
            maxWidth: "min(280px, calc(100vw - 20px))",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div
            style={{
              background: "var(--sl-ui-modal-bg)",
              border: "1px solid var(--sl-ui-modal-border)",
              borderRadius: 12,
              boxShadow: "var(--sl-ui-modal-shadow)",
              padding: 10,
              minWidth: 210,
              display: "grid",
              gap: 10,
              color: "var(--sl-ui-text)",
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedQueuedTempId(null)}
              aria-label="Close"
              style={{
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
              }}
            >
              ×
            </button>

            <div style={{ fontWeight: 900, paddingRight: 26 }}>Queued light</div>
            <div style={{ fontSize: 12.5, opacity: 0.8 }}>Not saved yet</div>

            <button
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "none",
                background: "#d32f2f",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
              onClick={() => {
                removeFromMappingQueue(selectedQueuedLightForPopup.tempId);
                setSelectedQueuedTempId(null);
                openNotice("✅", "", "", { autoCloseMs: 500, compact: true });
              }}
            >
              Delete Light
            </button>

            <button style={btnPopupSecondary} onClick={() => setSelectedQueuedTempId(null)}>
              Close
            </button>
          </div>

          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -7,
              width: 12,
              height: 12,
              background: "var(--sl-ui-modal-bg)",
              borderRight: "1px solid var(--sl-ui-modal-border)",
              borderBottom: "1px solid var(--sl-ui-modal-border)",
              transform: "translateX(-50%) rotate(45deg)",
            }}
          />
        </div>
      )}



      {/* =========================
          Floating tool buttons (mobile + desktop)
         ========================= */}
      <div className="sl-map-tool">
        {!!toolHintText && (
          <div
            style={{
              position: "absolute",
              right: "calc(100% + 10px)",
              top: `${(Number.isFinite(toolHintIndex) ? toolHintIndex : 0) * 52 + 22}px`,
              transform: "translateY(-50%)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <div className="sl-map-tool-hint">{toolHintText}</div>
          </div>
        )}
        <button
          type="button"
          className={`sl-map-tool-mini ${accountMenuOpen ? "is-on" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setAccountMenuOpen((p) => !p);
          }}
          aria-label="Account menu"
          title={session ? "Account" : "Login / Account"}
          style={session?.user ? { borderColor: "#39d353", boxShadow: "inset 0 0 0 2px rgba(57, 211, 83, 0.24), inset 0 0 10px rgba(57, 211, 83, 0.38)" } : undefined}
        >
          👤
        </button>

        {/* Satellite toggle */}
        <button
          type="button"
          className="sl-map-tool-mini"
                    onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMapType((t) => {
              const next = t === "roadmap" ? "satellite" : "roadmap";
              showToolHint(next === "satellite" ? "Satellite view" : "Map view", 1100, 1);
              return next;
            });
          }}
          title={mapType === "satellite" ? "Satellite" : "Street map"}
          aria-label="Toggle satellite map"
        >
          {mapType === "satellite" ? "🗺️" : "🛰️"}
        </button>

        <button
          type="button"
          className="sl-map-tool-mini"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Freeze heading orientation until the user explicitly taps location again.
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
            showToolHint("Realigned to north", 1100, 2);
          }}
          title="Reset heading"
          aria-label="Reset heading"
        >
          🧭
        </button>

        <button
          type="button"
          className={`sl-map-tool-mini ${locating ? "is-on" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();

            // If denied previously → show prompt modal (which calls forced retry)
            if (geoDenied) {
              setShowLocationPrompt(true);
              return;
            }

            // Normal locate
            showToolHint("Location", 1100, 3);
            followHeadingEnabledRef.current = true;
            findMyLocation(false);
          }}
          title="Find my location"
          aria-label="Find my location"
        >
          📍
        </button>


        <button
          type="button"
          className={`sl-map-tool-mini sl-bulk-tool-btn ${bulkMode ? "is-on" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();

            setBulkConfirmOpen(false);

            setBulkMode((on) => {
              const next = !on;
              showToolHint(next ? "Report multiple lights" : "Report one light", 1100, 4);

              if (next) {
                setSelectedOfficialId(null);
                // ✅ turning BULK ON → force mapping OFF
                setMappingMode(false);
                setMappingQueue([]);

                closeAnyPopup();
                suppressPopupsSafe(1600);
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
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0,
              transform: "translateY(0.5px)",
            }}
          >
            {["#111", "#111"].map((fill, i) => (
              <span
                key={i}
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 999,
                  background: fill,
                  border: "1.5px solid #fff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 7,
                  lineHeight: 1,
                  marginLeft: i === 0 ? 0 : -2,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
                }}
              >
                <span style={{ transform: "translateY(0.1px)" }}>💡</span>
              </span>
            ))}
          </span>
        </button>

        {/* =========================
          Bulk/Open Reports (admin)
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

        {showAdminTools && (
          <button
            type="button"
            className={`sl-map-tool-btn ${mappingMode ? "is-on" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMappingMode((on) => {
                const next = !on;
                showToolHint(next ? "Mapping mode on" : "Mapping mode off", 1100, 6);

                if (next) {
                  // ✅ turning MAPPING ON → force bulk OFF
                  setBulkMode(false);
                  setBulkConfirmOpen(false);
                  clearBulkSelection();

                  suppressPopupsSafe(1600);
                  closeAnyPopup();
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
                position: "relative",
                width: "min(720px, calc(100vw - 32px))",
                marginLeft: 0,
              }}
            >
	            <div
	              style={{
	                position: "fixed",
	                right: 14,
	                top: 22,
	                transform: "none",
	                display: "grid",
	                gap: 8,
	                pointerEvents: "auto",
                  zIndex: 2201,
	              }}
	            >
              <button
                type="button"
                onClick={() => nudgeMapZoom(1)}
                aria-label="Zoom in"
                title="Zoom in"
	                style={{
	                  width: 40,
	                  height: 40,
	                  borderRadius: 10,
	                  border: "1px solid var(--sl-ui-zoom-border)",
	                  background: "var(--sl-ui-zoom-bg)",
	                  boxShadow: "var(--sl-ui-zoom-shadow)",
                    color: "var(--sl-ui-text)",
	                  fontSize: 22,
                  fontWeight: 900,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => nudgeMapZoom(-1)}
                aria-label="Zoom out"
                title="Zoom out"
	                style={{
	                  width: 40,
	                  height: 40,
	                  borderRadius: 10,
	                  border: "1px solid var(--sl-ui-zoom-border)",
	                  background: "var(--sl-ui-zoom-bg)",
	                  boxShadow: "var(--sl-ui-zoom-shadow)",
                    color: "var(--sl-ui-text)",
	                  fontSize: 22,
                  fontWeight: 900,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                –
              </button>
            </div>

            <div
	              style={{
	                background: "var(--sl-ui-surface-bg)",
	                border: "1px solid var(--sl-ui-surface-border)",
	                borderRadius: 14,
	                boxShadow: "var(--sl-ui-surface-shadow)",
	                padding: "12px 14px",
	                display: "grid",
	                gap: 6,
	                position: "relative",
                  color: "var(--sl-ui-text)",
	              }}
            >
              <div style={{ fontSize: 22, fontWeight: 950, textAlign: "center", lineHeight: 1.1 }}>
                L.I.S.T. Report
              </div>

              <div style={{ fontSize: 14, opacity: 0.75, textAlign: "center", lineHeight: 1.2 }}>
                Local Infrastructure Status Tracker
              </div>

              <div style={{ fontSize: 14, opacity: 0.92, textAlign: "center", lineHeight: 1.25, fontWeight: 800 }}>
                Select a light to submit a report.
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

                    if (Number(mapZoomRef.current || mapZoom) < 17) {
                      openNotice("🔎", "Zoom in to report", "Zoom in closer (level 17+) before submitting bulk reports.");
                      return;
                    }

                    closeAnyPopup();
                    suppressPopupsSafe(1600);

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
                  onClick={requestClearQueuedLights}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: "var(--sl-ui-modal-btn-secondary-bg)",
                    color: "var(--sl-ui-modal-btn-secondary-text)",
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
	              background: "var(--sl-ui-surface-bg)",
	              border: "1px solid var(--sl-ui-surface-border)",
	              borderRadius: 14,
	              boxShadow: "var(--sl-ui-surface-shadow-bottom)",
	              padding: 12,
	              display: "grid",
	              gap: 8,
                color: "var(--sl-ui-text)",
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
                position: "relative",
                width: "min(466px, calc(100vw - 94px))",
                marginLeft: -38,
              }}
            >
	            <div
	              style={{
	                position: "fixed",
	                right: 14,
	                top: "calc(10px + env(safe-area-inset-top))",
	                transform: "none",
	                display: "grid",
	                gap: 6,
	                pointerEvents: "auto",
                  zIndex: 2201,
	              }}
	            >
              <button
                type="button"
                onClick={() => nudgeMapZoom(1)}
                aria-label="Zoom in"
                title="Zoom in"
	                style={{
	                  width: 34,
	                  height: 34,
	                  borderRadius: 9,
	                  border: "1px solid var(--sl-ui-zoom-border)",
	                  background: "var(--sl-ui-zoom-bg)",
	                  boxShadow: "var(--sl-ui-zoom-shadow-mobile)",
                    color: "var(--sl-ui-text)",
	                  fontSize: 20,
                  fontWeight: 900,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => nudgeMapZoom(-1)}
                aria-label="Zoom out"
                title="Zoom out"
	                style={{
	                  width: 34,
	                  height: 34,
	                  borderRadius: 9,
	                  border: "1px solid var(--sl-ui-zoom-border)",
	                  background: "var(--sl-ui-zoom-bg)",
	                  boxShadow: "var(--sl-ui-zoom-shadow-mobile)",
                    color: "var(--sl-ui-text)",
	                  fontSize: 20,
                  fontWeight: 900,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                –
              </button>
            </div>

            <div
	              style={{
	                background: "var(--sl-ui-surface-bg)",
	                border: "1px solid var(--sl-ui-surface-border)",
	                borderRadius: 12,
	                boxShadow: "var(--sl-ui-surface-shadow)",
	                padding: "10px 12px",
	                display: "grid",
	                gap: 5,
	                position: "relative",
                  color: "var(--sl-ui-text)",
	              }}
            >
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
              L.I.S.T. Report
            </div>

            <div style={{ fontSize: 12, opacity: 0.75, textAlign: "center", lineHeight: 1.2 }}>
              Local Infrastructure Status Tracker
            </div>

            <div style={{ fontSize: 12.5, opacity: 0.92, textAlign: "center", lineHeight: 1.25, fontWeight: 800 }}>
              Select a light to submit a report.
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

                    if (Number(mapZoomRef.current || mapZoom) < 17) {
                      openNotice("🔎", "Zoom in to report", "Zoom in closer (level 17+) before submitting bulk reports.");
                      return;
                    }

                    closeAnyPopup();
                    suppressPopupsSafe(1600);

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
              >
                <button
                  onClick={requestClearQueuedLights}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: "var(--sl-ui-modal-btn-secondary-bg)",
                    color: "var(--sl-ui-modal-btn-secondary-text)",
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

        {/* ✅ Mapping queue markers (clickable) */}
        {mappingMode && isAdmin && (mappingQueue || []).map((q) => (
          <MarkerF
            key={q.tempId}
            position={{ lat: q.lat, lng: q.lng }}
            icon={gmapsDotIcon("#2ecc71")} // queued preview
            onClick={() => {
              // clicking queued light opens its popup
              setSelectedQueuedTempId(q.tempId);
            }}
          />
        ))}


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
	              background: "var(--sl-ui-surface-bg)",
	              border: "1px solid var(--sl-ui-surface-border)",
	              borderRadius: 14,
	              boxShadow: "var(--sl-ui-surface-shadow-bottom)",
	              padding: 10,
	              display: "grid",
	              gap: 8,
                color: "var(--sl-ui-text)",
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
