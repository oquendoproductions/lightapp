import { describe, expect, it, vi } from "vitest";

import { createPersistentBoundaryOverlay } from "../lib/mapBoundaryOverlaySupport.js";

describe("persistent tenant boundary overlay", () => {
  it("mounts on the stable map root and uses container-relative projection", () => {
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
    Object.defineProperty(mapDiv, "clientWidth", { value: 320 });
    Object.defineProperty(mapDiv, "clientHeight", { value: 640 });
    const listenerNames: string[] = [];
    const map = {
      getDiv: () => mapDiv,
      addListener: vi.fn((eventName: string) => {
        listenerNames.push(eventName);
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
      getProjection: () => unknown;
      onAdd: () => void;
      draw: () => void;
      onRemove: () => void;
    };

    overlay.getProjection = () => ({
      fromLatLngToContainerPixel: ({ lat, lng }: LatLng) => ({ x: lng, y: lat }),
    });
    overlay.onAdd();
    overlay.draw();

    expect(overlay.container.parentNode).toBe(mapDiv);
    expect(overlay.container.style.inset).toBe("0");
    expect(listenerNames).toEqual(["bounds_changed", "drag", "zoom_changed", "idle"]);
    const paths = overlay.container.querySelectorAll("path");
    expect(paths[0]).toHaveAttribute("d", expect.stringContaining("M 20 10 L 40 30 L 60 50 Z"));
    expect(paths[1]).toHaveAttribute("stroke", "#2563eb");

    overlay.onRemove();
    expect(mapDiv.children).toHaveLength(0);
  });
});
