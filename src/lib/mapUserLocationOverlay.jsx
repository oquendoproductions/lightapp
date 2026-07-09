import React, { useCallback, useEffect, useRef } from "react";
import { useGoogleMap } from "@react-google-maps/api";
import { createRuntimeAppIconElement } from "../mapUiIconComponentsSupport.jsx";
import { RUNTIME_UI_ICON_SRC as uiIconSrc } from "../mapUiIconRuntimeSupport.js";

export function SmoothUserMarker({
  position,
  heading = null,
  travelFollowMode = false,
}) {
  const map = useGoogleMap();
  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  const baseIconRef = useRef(null);
  const headingIconRef = useRef(null);
  const lastRef = useRef(null);
  const livePosRef = useRef(null);
  const rafRef = useRef(null);
  const headingRafRef = useRef(null);
  const lastHeadingRef = useRef(null);
  const targetHeadingRef = useRef(null);
  const lastTravelFollowModeRef = useRef(travelFollowMode);
  const OVERLAY_SIZE = 42;
  const OVERLAY_HALF = OVERLAY_SIZE / 2;
  const USER_MARKER_Z_INDEX = 2400;

  const applyMarkerModeVisual = useCallback((mode = lastTravelFollowModeRef.current) => {
    const baseIcon = baseIconRef.current;
    const headingIcon = headingIconRef.current;
    if (baseIcon) {
      baseIcon.style.opacity = mode ? "0" : "1";
    }
    if (headingIcon) {
      headingIcon.style.top = mode ? "14px" : "0";
      headingIcon.style.filter = mode
        ? "drop-shadow(0 2px 6px rgba(5, 16, 30, 0.28))"
        : "drop-shadow(0 2px 6px rgba(5, 16, 30, 0.2))";
    }
  }, []);

  const applyHeadingVisual = useCallback((nextHeading, mode = lastTravelFollowModeRef.current) => {
    const headingIcon = headingIconRef.current;
    if (!headingIcon) return;

    if (!mode || !Number.isFinite(nextHeading)) {
      headingIcon.style.opacity = mode ? "1" : "0";
      headingIcon.style.transform = "translateX(-50%) rotate(0deg)";
      return;
    }

    const rotation = mode ? 0 : ((Number(nextHeading) % 360) + 360) % 360;
    headingIcon.style.opacity = "1";
    headingIcon.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
  }, []);

  const redrawOverlay = useCallback(() => {
    overlayRef.current?.draw?.();
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (headingRafRef.current) cancelAnimationFrame(headingRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!map || !window.google?.maps || overlayRef.current) return;
    if (typeof createRuntimeAppIconElement !== "function") return;

    const overlay = new window.google.maps.OverlayView();

    overlay.onAdd = () => {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.width = `${OVERLAY_SIZE}px`;
      container.style.height = `${OVERLAY_SIZE}px`;
      container.style.pointerEvents = "none";
      container.style.userSelect = "none";
      container.style.willChange = "transform";
      container.style.transform = "translate(-9999px, -9999px)";
      container.style.zIndex = String(USER_MARKER_Z_INDEX);

      const baseIcon = createRuntimeAppIconElement({
        src: uiIconSrc.currentLocationMarker,
        iconKey: "currentLocationMarker",
        size: 28,
        style: {
          position: "absolute",
          left: "50%",
          top: "12px",
          transform: "translateX(-50%)",
          filter: "drop-shadow(0 2px 6px rgba(5, 16, 30, 0.28))",
        },
      });

      const headingIcon = createRuntimeAppIconElement({
        src: uiIconSrc.navigationLocationMarker,
        iconKey: "navigationLocationMarker",
        size: 24,
        style: {
          position: "absolute",
          left: "50%",
          top: "0",
          transform: "translateX(-50%) rotate(0deg)",
          transformOrigin: "50% 50%",
          opacity: "0",
          willChange: "transform, opacity",
          filter: "drop-shadow(0 2px 6px rgba(5, 16, 30, 0.2))",
        },
      });

      if (baseIcon) container.appendChild(baseIcon);
      if (headingIcon) container.appendChild(headingIcon);

      containerRef.current = container;
      baseIconRef.current = baseIcon;
      headingIconRef.current = headingIcon;
      applyMarkerModeVisual(lastTravelFollowModeRef.current);
      applyHeadingVisual(lastHeadingRef.current, lastTravelFollowModeRef.current);

      const panes = overlay.getPanes?.();
      (panes?.overlayMouseTarget || panes?.overlayLayer || panes?.floatPane)?.appendChild(container);
    };

    overlay.draw = () => {
      const projection = overlay.getProjection?.();
      const container = containerRef.current;
      const livePos = livePosRef.current;
      if (!projection || !container || !livePos) return;
      const point = projection.fromLatLngToDivPixel(
        new window.google.maps.LatLng(Number(livePos.lat), Number(livePos.lng)),
      );
      if (!point) return;
      const x = Number(point.x);
      const y = Number(point.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      container.style.transform = `translate(${x - OVERLAY_HALF}px, ${y - OVERLAY_HALF}px)`;
    };

    overlay.onRemove = () => {
      try {
        containerRef.current?.remove();
      } catch {
        // ignore removal cleanup failures
      }
      containerRef.current = null;
      baseIconRef.current = null;
      headingIconRef.current = null;
    };

    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      try {
        overlay.setMap(null);
      } catch {
        // ignore Google Maps overlay cleanup failures
      }
      overlayRef.current = null;
      containerRef.current = null;
      baseIconRef.current = null;
      headingIconRef.current = null;
    };
  }, [applyHeadingVisual, applyMarkerModeVisual, map, OVERLAY_HALF, OVERLAY_SIZE, uiIconSrc.currentLocationMarker, uiIconSrc.navigationLocationMarker]);

  useEffect(() => {
    if (!position) return;

    const next = { lat: Number(position.lat), lng: Number(position.lng) };
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;

    const overlay = overlayRef.current;
    if (!overlay) {
      lastRef.current = next;
      livePosRef.current = next;
      return;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastRef.current = next;
    livePosRef.current = next;
    redrawOverlay();
  }, [position?.lat, position?.lng, redrawOverlay]);

  useEffect(() => {
    applyMarkerModeVisual(travelFollowMode);
  }, [applyMarkerModeVisual, travelFollowMode]);

  useEffect(() => {
    if (!overlayRef.current) return;

    const nextHeading = Number(heading);
    const modeChanged = lastTravelFollowModeRef.current !== travelFollowMode;
    lastTravelFollowModeRef.current = travelFollowMode;

    if (!Number.isFinite(nextHeading)) {
      targetHeadingRef.current = null;
      lastHeadingRef.current = null;
      if (headingRafRef.current) {
        cancelAnimationFrame(headingRafRef.current);
        headingRafRef.current = null;
      }
      applyHeadingVisual(null, travelFollowMode);
      return;
    }

    targetHeadingRef.current = nextHeading;

    if (!Number.isFinite(lastHeadingRef.current) || modeChanged) {
      lastHeadingRef.current = nextHeading;
      applyHeadingVisual(nextHeading, travelFollowMode);
      return;
    }

    if (headingRafRef.current) return;

    const step = () => {
      const target = Number(targetHeadingRef.current);
      const current = Number(lastHeadingRef.current);
      if (!headingIconRef.current || !Number.isFinite(target) || !Number.isFinite(current)) {
        headingRafRef.current = null;
        return;
      }

      const delta = ((target - current + 540) % 360) - 180;
      if (Math.abs(delta) <= 0.8) {
        lastHeadingRef.current = target;
        applyHeadingVisual(target, lastTravelFollowModeRef.current);
        headingRafRef.current = null;
        return;
      }

      const alpha = lastTravelFollowModeRef.current ? 0.12 : 0.14;
      const next = (current + delta * alpha + 360) % 360;
      lastHeadingRef.current = next;
      applyHeadingVisual(next, lastTravelFollowModeRef.current);
      headingRafRef.current = requestAnimationFrame(step);
    };

    headingRafRef.current = requestAnimationFrame(step);
  }, [applyHeadingVisual, heading, travelFollowMode]);

  useEffect(() => {
    if (!position) return;
    const next = { lat: Number(position.lat), lng: Number(position.lng) };
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;
    livePosRef.current = next;
    if (!lastRef.current) lastRef.current = next;
    redrawOverlay();
  }, [position?.lat, position?.lng, redrawOverlay]);

  useEffect(() => {
    const initialHeading = Number(heading);
    if (!Number.isFinite(lastHeadingRef.current) && Number.isFinite(initialHeading)) {
      lastHeadingRef.current = initialHeading;
      targetHeadingRef.current = initialHeading;
      applyHeadingVisual(initialHeading, travelFollowMode);
    }
  }, [applyHeadingVisual, heading, travelFollowMode]);

  return null;
}
