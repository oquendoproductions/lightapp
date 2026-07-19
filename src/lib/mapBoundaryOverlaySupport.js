import { createBoundaryFlashDiagnostics } from "./mapBoundaryFlashDiagnostics.js";

export function createPersistentBoundaryOverlay({
  googleMaps,
  map,
  renderStateRef,
  diagnosticsEnabled = false,
}) {
  return new (class PersistentBoundaryOverlay extends googleMaps.OverlayView {
    constructor() {
      super();
      this.container = null;
      this.svg = null;
      this.shadePath = null;
      this.borderPath = null;
      this.mapListeners = [];
      this.drawFrame = null;
      this.drawCount = 0;
      this.requestedDrawCount = 0;
      this.diagnostics = null;
    }

    getBoundaryHost() {
      const panes = this.getPanes?.();
      const markerLayer = panes?.markerLayer || null;
      const overlayLayer = panes?.overlayLayer || null;
      const mapPane = panes?.mapPane || null;
      const host = markerLayer?.parentNode || overlayLayer?.parentNode || mapPane?.parentNode || null;
      return {
        host,
        markerLayer: markerLayer?.parentNode === host ? markerLayer : null,
      };
    }

    attachToBoundaryHost() {
      if (!this.container) return null;
      const { host, markerLayer } = this.getBoundaryHost();
      if (!host) return null;

      // Google can hide or replace its lower map panes while Safari composites a
      // gesture. Keep this node in their shared host, immediately below markers.
      if (markerLayer) {
        if (this.container.parentNode !== host || this.container.nextSibling !== markerLayer) {
          host.insertBefore(this.container, markerLayer);
        }
      } else if (this.container.parentNode !== host) {
        host.appendChild(this.container);
      }
      return host;
    }

    onAdd() {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.pointerEvents = "none";
      container.style.overflow = "hidden";
      container.style.transform = "translate3d(0, 0, 0)";
      container.style.willChange = "transform";
      container.setAttribute("aria-hidden", "true");
      container.setAttribute("data-cityreport-boundary-overlay", "true");

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.style.display = "block";
      svg.style.overflow = "hidden";
      svg.setAttribute("aria-hidden", "true");

      const shadePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      shadePath.setAttribute("fill", "#0b0f17");
      shadePath.setAttribute("fill-rule", "evenodd");
      shadePath.setAttribute("clip-rule", "evenodd");
      shadePath.setAttribute("stroke", "none");
      svg.appendChild(shadePath);

      const borderPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      borderPath.setAttribute("fill", "none");
      borderPath.setAttribute("stroke-linejoin", "round");
      borderPath.setAttribute("stroke-linecap", "round");
      svg.appendChild(borderPath);
      container.appendChild(svg);

      this.container = container;
      this.svg = svg;
      this.shadePath = shadePath;
      this.borderPath = borderPath;
      this.attachToBoundaryHost();

      this.diagnostics = createBoundaryFlashDiagnostics({
        enabled: diagnosticsEnabled,
        map,
        getState: () => ({
          container: this.container,
          svg: this.svg,
          shadePath: this.shadePath,
          borderPath: this.borderPath,
          overlayLayer: this.getBoundaryHost().host,
          renderState: renderStateRef.current,
          drawCount: this.drawCount,
          requestedDrawCount: this.requestedDrawCount,
        }),
      });
      this.diagnostics.record("overlay:on-add");

      this.mapListeners = ["dragstart", "drag", "dragend", "bounds_changed", "idle", "zoom_changed"]
        .map((eventName) => map.addListener?.(
          eventName,
          () => this.requestDraw(`map:${eventName}`),
        ))
        .filter(Boolean);
    }

    requestDraw(reason = "unspecified") {
      this.requestedDrawCount += 1;
      if (this.drawFrame !== null) return;
      this.drawFrame = window.requestAnimationFrame(() => {
        this.drawFrame = null;
        this.diagnostics?.record?.("overlay:draw-frame", { reason });
        this.draw();
      });
    }

    draw() {
      this.drawCount += 1;
      if (!this.container || !this.svg || !this.shadePath || !this.borderPath) return;
      const projection = this.getProjection();
      const mapDiv = map.getDiv?.();
      if (!projection || !mapDiv) return;

      const boundaryHost = this.attachToBoundaryHost();
      if (!boundaryHost) return;

      const width = Math.max(1, Number(mapDiv.clientWidth || 0));
      const height = Math.max(1, Number(mapDiv.clientHeight || 0));
      const overscan = Math.max(512, width, height);
      const canvasWidth = width + (overscan * 2);
      const canvasHeight = height + (overscan * 2);
      const topLeftLatLng = projection.fromContainerPixelToLatLng?.(
        new googleMaps.Point(0, 0),
        true,
      );
      const topLeftPixel = topLeftLatLng
        ? projection.fromLatLngToDivPixel(topLeftLatLng)
        : null;
      const originX = Number.isFinite(Number(topLeftPixel?.x)) ? Number(topLeftPixel.x) : 0;
      const originY = Number.isFinite(Number(topLeftPixel?.y)) ? Number(topLeftPixel.y) : 0;
      const canvasOriginX = originX - overscan;
      const canvasOriginY = originY - overscan;
      const shadePathParts = [`M 0 0 H ${canvasWidth} V ${canvasHeight} H 0 Z`];
      const borderPathParts = [];
      const holeRings = (Array.isArray(renderStateRef.current.paths) ? renderStateRef.current.paths : []).slice(1);

      holeRings.forEach((ring) => {
        const projected = (Array.isArray(ring) ? ring : [])
          .map((point) => {
            const lat = Number(point?.lat);
            const lng = Number(point?.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            const pixel = projection.fromLatLngToDivPixel(new googleMaps.LatLng(lat, lng));
            if (!pixel) return null;
            return { x: pixel.x - canvasOriginX, y: pixel.y - canvasOriginY };
          })
          .filter(Boolean);
        if (projected.length < 3) return;
        const ringPathParts = [`M ${projected[0].x} ${projected[0].y}`];
        for (let index = 1; index < projected.length; index += 1) {
          ringPathParts.push(`L ${projected[index].x} ${projected[index].y}`);
        }
        ringPathParts.push("Z");
        shadePathParts.push(...ringPathParts);
        borderPathParts.push(...ringPathParts);
      });

      this.svg.setAttribute("width", String(canvasWidth));
      this.svg.setAttribute("height", String(canvasHeight));
      this.svg.setAttribute("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`);
      this.container.style.width = `${canvasWidth}px`;
      this.container.style.height = `${canvasHeight}px`;
      this.container.style.transform = `translate3d(${canvasOriginX}px, ${canvasOriginY}px, 0)`;
      this.shadePath.setAttribute("d", shadePathParts.join(" "));
      this.shadePath.setAttribute(
        "fill-opacity",
        renderStateRef.current.showShade ? String(renderStateRef.current.opacity) : "0",
      );
      this.borderPath.setAttribute("d", borderPathParts.join(" "));
      this.borderPath.setAttribute(
        "stroke",
        renderStateRef.current.showBorder ? renderStateRef.current.borderColor : "none",
      );
      this.borderPath.setAttribute("stroke-width", String(renderStateRef.current.borderWidth));
      this.diagnostics?.record?.("overlay:draw-complete", {
        originX,
        originY,
        width,
        height,
        overscan,
        holeRings: holeRings.length,
      });
    }

    onRemove() {
      this.diagnostics?.record?.("overlay:on-remove");
      this.diagnostics?.destroy?.();
      this.diagnostics = null;
      this.mapListeners.forEach((listener) => listener?.remove?.());
      this.mapListeners = [];
      if (this.drawFrame !== null) {
        window.cancelAnimationFrame(this.drawFrame);
        this.drawFrame = null;
      }
      this.container?.remove();
      this.container = null;
      this.svg = null;
      this.shadePath = null;
      this.borderPath = null;
    }
  })();
}
