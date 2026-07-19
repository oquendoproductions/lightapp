import { describe, expect, it, vi } from "vitest";

import { createPersistentBoundaryOverlay } from "../lib/mapBoundaryOverlaySupport.js";

describe("persistent tenant boundary overlay", () => {
  it("stays mounted below markers while viewport coordinates update", () => {
    class OverlayView {}
    class LatLng {
      lat: number;
      lng: number;

      constructor(lat: number, lng: number) {
        this.lat = lat;
        this.lng = lng;
      }
    }

    const mapDiv = document.createElement("div");
    const mapPane = document.createElement("div");
    const overlayLayer = document.createElement("div");
    const markerLayer = document.createElement("div");
    mapPane.style.zIndex = "0";
    overlayLayer.style.zIndex = "1";
    markerLayer.style.zIndex = "2";
    mapDiv.append(mapPane, overlayLayer, markerLayer);
    document.body.appendChild(mapDiv);
    Object.defineProperty(mapDiv, "clientWidth", { value: 320 });
    Object.defineProperty(mapDiv, "clientHeight", { value: 640 });
    const listenerNames: string[] = [];
    const listenerCallbacks = new Map<string, () => void>();
    const map = {
      getDiv: () => mapDiv,
      addListener: vi.fn((eventName: string, callback: () => void) => {
        listenerNames.push(eventName);
        listenerCallbacks.set(eventName, callback);
        return { remove: vi.fn() };
      }),
    };
    const overlay = createPersistentBoundaryOverlay({
      googleMaps: { OverlayView, LatLng },
      map,
      renderStateRef: {
        current: {
          paths: [[], [
            { lat: 10, lng: 20 },
            { lat: 30, lng: 40 },
            { lat: 50, lng: 60 },
          ]],
          showShade: true,
          opacity: 0.4,
          showBorder: true,
          borderColor: "#2563eb",
          borderWidth: 3,
        },
      },
    }) as InstanceType<typeof OverlayView> & {
      container: HTMLDivElement;
      shadePath: SVGPathElement;
      getPanes: () => unknown;
      getProjection: () => unknown;
      onAdd: () => void;
      draw: () => void;
      onRemove: () => void;
    };

    const fromLatLngToDivPixel = vi.fn(() => ({ x: 100000, y: 100000 }));
    overlay.getPanes = () => ({ mapPane, overlayLayer, markerLayer });
    overlay.getProjection = () => ({
      fromLatLngToContainerPixel: ({ lat, lng }: LatLng) => ({ x: lng, y: lat }),
      fromLatLngToDivPixel,
    });
    overlay.onAdd();
    overlay.draw();

    const originalContainer = overlay.container;
    const originalShadePath = overlay.shadePath;
    expect(overlay.container.parentNode).toBe(mapDiv);
    expect(overlay.container.nextSibling).toBe(markerLayer);
    expect(overlay.container.parentNode).not.toBe(markerLayer);
    expect(overlay.container.parentNode).not.toBe(overlayLayer);
    expect(overlay.container.style.zIndex).toBe("1");
    expect(overlay.container.style.transform).toBe("");
    expect(overlay.container.style.left).toBe("-640px");
    expect(overlay.container.style.top).toBe("-640px");
    expect(overlay.container.style.width).toBe("1600px");
    expect(overlay.container.style.height).toBe("1920px");
    expect(listenerNames).toEqual([
      "dragstart",
      "drag",
      "dragend",
      "bounds_changed",
      "idle",
      "zoom_changed",
    ]);
    const paths = overlay.container.querySelectorAll("path");
    expect(paths[0]).toHaveAttribute("d", expect.stringContaining("M 660 650 L 680 670 L 700 690 Z"));
    expect(paths[1]).toHaveAttribute("stroke", "#2563eb");
    expect(fromLatLngToDivPixel).not.toHaveBeenCalled();

    mapPane.style.display = "none";
    overlayLayer.style.display = "none";
    listenerCallbacks.get("dragstart")?.();
    listenerCallbacks.get("drag")?.();
    listenerCallbacks.get("dragend")?.();
    listenerCallbacks.get("idle")?.();
    overlay.draw();
    expect(overlay.container).toBe(originalContainer);
    expect(overlay.shadePath).toBe(originalShadePath);
    expect(overlay.container.parentNode).toBe(mapDiv);
    expect(overlay.container.nextSibling).toBe(markerLayer);
    expect(overlay.container.isConnected).toBe(true);

    overlay.onRemove();
    expect(mapPane.children).toHaveLength(0);
    expect(mapDiv.children).toHaveLength(3);
    mapDiv.remove();
  });
});
