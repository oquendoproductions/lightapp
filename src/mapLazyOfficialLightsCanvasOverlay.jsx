import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import {
  MAP_MARKER_CENTER,
  MAP_MARKER_GLYPH_SIZE,
  MAP_MARKER_RADIUS,
  MAP_MARKER_SIZE,
  MAP_MARKER_STROKE,
  drawTintedMarkerGlyphOnCanvas,
} from "./lib/mapMarkerIconSupport";

const MapLazyOfficialLightsCanvasOverlay = memo(forwardRef(function MapLazyOfficialLightsCanvasOverlay({
  map,
  show,
  lights,
  bulkMode,
  bulkSelectedSet,
  getMarkerColor,
  getMarkerRingColor,
  getMarkerPresentation,
  glyphSrc = "",
}, ref) {
  const overlayObjRef = useRef(null);
  const canvasRef = useRef(null);
  const hitPointsRef = useRef([]);
  const glyphImgRef = useRef(null);
  const markerSpriteCacheRef = useRef(new Map());
  const latestRef = useRef({
    show,
    lights,
    bulkMode,
    bulkSelectedSet,
    getMarkerColor,
    getMarkerRingColor,
    getMarkerPresentation,
    glyphSrc,
  });

  useLayoutEffect(() => {
    latestRef.current = {
      show,
      lights,
      bulkMode,
      bulkSelectedSet,
      getMarkerColor,
      getMarkerRingColor,
      getMarkerPresentation,
      glyphSrc,
    };
  }, [bulkMode, bulkSelectedSet, getMarkerColor, getMarkerPresentation, getMarkerRingColor, glyphSrc, lights, show]);

  const getMarkerSpriteCanvas = useCallback((fillColor, ringColor, glyphColor) => {
    const glyphImg = glyphImgRef.current;
    const glyphReady = Boolean(glyphImg && glyphImg.complete && glyphImg.naturalWidth > 0);
    const cacheKey = [
      String(fillColor || "#1976d2"),
      String(ringColor || "#fff"),
      String(glyphColor || "#111111"),
      glyphReady ? "glyph" : "emoji",
    ].join("|");
    const cached = markerSpriteCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = MAP_MARKER_SIZE;
    spriteCanvas.height = MAP_MARKER_SIZE;
    const spriteCtx = spriteCanvas.getContext("2d");
    if (!spriteCtx) return null;

    spriteCtx.setTransform(1, 0, 0, 1, 0, 0);
    spriteCtx.clearRect(0, 0, MAP_MARKER_SIZE, MAP_MARKER_SIZE);
    spriteCtx.textAlign = "center";
    spriteCtx.textBaseline = "middle";

    spriteCtx.beginPath();
    spriteCtx.arc(MAP_MARKER_CENTER, MAP_MARKER_CENTER, MAP_MARKER_RADIUS, 0, Math.PI * 2);
    spriteCtx.fillStyle = String(fillColor || "#1976d2");
    spriteCtx.fill();
    spriteCtx.lineWidth = MAP_MARKER_STROKE;
    spriteCtx.strokeStyle = String(ringColor || "#fff");
    spriteCtx.stroke();

    if (glyphReady) {
      drawTintedMarkerGlyphOnCanvas(
        spriteCtx,
        glyphImg,
        MAP_MARKER_CENTER,
        MAP_MARKER_CENTER,
        MAP_MARKER_GLYPH_SIZE,
        String(glyphColor || "#111111")
      );
    } else {
      spriteCtx.fillStyle = String(glyphColor || "#111111");
      spriteCtx.font = "12px system-ui, -apple-system, sans-serif";
      spriteCtx.fillText("💡", MAP_MARKER_CENTER, MAP_MARKER_CENTER + 0.5);
    }

    markerSpriteCacheRef.current.set(cacheKey, spriteCanvas);
    return spriteCanvas;
  }, []);

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
      const presentation = typeof state.getMarkerPresentation === "function"
        ? state.getMarkerPresentation(ol.id, color, state.glyphSrc)
        : null;
      const glyphColor = String(presentation?.glyphColor || "#111111").trim() || "#111111";
      const ringColor = state.getMarkerRingColor?.(ol.id) || "#fff";
      const spriteCanvas = getMarkerSpriteCanvas(color, ringColor, glyphColor);
      if (spriteCanvas) {
        ctx.drawImage(
          spriteCanvas,
          Math.round(x - MAP_MARKER_CENTER),
          Math.round(y - MAP_MARKER_CENTER)
        );
      }

      hit.push({ id: ol.id, x, y });
    }

    hitPointsRef.current = hit;
  }, [getMarkerSpriteCanvas, map]);

  useEffect(() => {
    markerSpriteCacheRef.current.clear();
    const img = new Image();
    img.src = String(glyphSrc || "").trim();
    glyphImgRef.current = img;
    const onLoad = () => drawOverlayCanvas();
    if (img.complete && img.naturalWidth > 0) {
      onLoad();
    } else {
      img.onload = onLoad;
    }
    return () => {
      if (glyphImgRef.current === img) glyphImgRef.current = null;
      img.onload = null;
    };
  }, [drawOverlayCanvas, glyphSrc]);

  useImperativeHandle(ref, () => ({
    redraw() {
      drawOverlayCanvas();
    },
    hitTestByLatLng(lat, lng, radiusPx = 17) {
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
    if (!map || !window.google?.maps) return undefined;

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
      try { canvasRef.current?.remove(); } catch (error) { void error; }
      canvasRef.current = null;
      hitPointsRef.current = [];
    };

    overlay.setMap(map);
    overlayObjRef.current = overlay;

    return () => {
      try { overlay.setMap(null); } catch (error) { void error; }
      overlayObjRef.current = null;
      canvasRef.current = null;
      hitPointsRef.current = [];
    };
  }, [drawOverlayCanvas, map]);

  useEffect(() => {
    drawOverlayCanvas();
  }, [bulkMode, bulkSelectedSet, drawOverlayCanvas, getMarkerColor, getMarkerPresentation, getMarkerRingColor, lights, show]);

  return null;
}));

export default MapLazyOfficialLightsCanvasOverlay;
