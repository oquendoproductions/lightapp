export function createPersistentBoundaryOverlay({ googleMaps, map, renderStateRef }) {
  return new (class PersistentBoundaryOverlay extends googleMaps.OverlayView {
    constructor() {
      super();
      this.container = null;
      this.svg = null;
      this.shadePath = null;
      this.borderPath = null;
      this.mapListeners = [];
      this.drawFrame = null;
    }

    onAdd() {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.inset = "0";
      container.style.width = "100%";
      container.style.height = "100%";
      container.style.pointerEvents = "none";
      container.style.zIndex = "1";
      container.style.overflow = "hidden";
      container.setAttribute("aria-hidden", "true");

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
      map.getDiv?.()?.appendChild(container);

      const requestDraw = () => this.requestDraw();
      this.mapListeners = ["bounds_changed", "drag", "zoom_changed", "idle"]
        .map((eventName) => map.addListener?.(eventName, requestDraw))
        .filter(Boolean);
    }

    requestDraw() {
      if (this.drawFrame !== null) return;
      this.drawFrame = window.requestAnimationFrame(() => {
        this.drawFrame = null;
        this.draw();
      });
    }

    draw() {
      if (!this.container || !this.svg || !this.shadePath || !this.borderPath) return;
      const projection = this.getProjection();
      const mapDiv = map.getDiv?.();
      if (!projection || !mapDiv) return;

      if (this.container.parentNode !== mapDiv) {
        mapDiv.appendChild(this.container);
      }

      const width = Math.max(1, Number(mapDiv.clientWidth || 0));
      const height = Math.max(1, Number(mapDiv.clientHeight || 0));
      const shadePathParts = [`M 0 0 H ${width} V ${height} H 0 Z`];
      const borderPathParts = [];
      const holeRings = (Array.isArray(renderStateRef.current.paths) ? renderStateRef.current.paths : []).slice(1);

      holeRings.forEach((ring) => {
        const projected = (Array.isArray(ring) ? ring : [])
          .map((point) => {
            const lat = Number(point?.lat);
            const lng = Number(point?.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            const pixel = projection.fromLatLngToContainerPixel(new googleMaps.LatLng(lat, lng));
            if (!pixel) return null;
            return { x: pixel.x, y: pixel.y };
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

      this.svg.setAttribute("width", String(width));
      this.svg.setAttribute("height", String(height));
      this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
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
    }

    onRemove() {
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
