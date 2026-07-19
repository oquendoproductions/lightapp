import { afterEach, describe, expect, it, vi } from "vitest";

import { createBoundaryFlashDiagnostics } from "../lib/mapBoundaryFlashDiagnostics.js";

describe("tenant boundary flash diagnostics", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    delete (window as any).__CITYREPORT_BOUNDARY_FLASH_DEBUG__;
    delete (window as any).__CITYREPORT_BOUNDARY_FLASH_TRACE__;
    vi.restoreAllMocks();
  });

  it("observes map events without moving or restacking the boundary overlay", () => {
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const mapDiv = document.createElement("div");
    const overlayLayer = document.createElement("div");
    const markerLayer = document.createElement("div");
    const container = document.createElement("div");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const shadePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const borderPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    shadePath.setAttribute("d", "M 0 0 H 320 V 640 H 0 Z M 10 10 L 20 10 L 20 20 Z");
    shadePath.setAttribute("fill-opacity", "0.4");
    borderPath.setAttribute("d", "M 10 10 L 20 10 L 20 20 Z");
    borderPath.setAttribute("stroke", "#2563eb");
    borderPath.setAttribute("stroke-width", "3");
    svg.setAttribute("width", "320");
    svg.setAttribute("height", "640");
    svg.append(shadePath, borderPath);
    container.appendChild(svg);
    overlayLayer.appendChild(container);
    mapDiv.append(overlayLayer, markerLayer);
    document.body.appendChild(mapDiv);
    [mapDiv, overlayLayer, container].forEach((element) => {
      vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
        x: 0,
        y: 0,
        width: 320,
        height: 640,
        top: 0,
        right: 320,
        bottom: 640,
        left: 0,
        toJSON: () => ({}),
      });
    });

    const callbacks = new Map<string, () => void>();
    const removed = vi.fn();
    const map = {
      getDiv: () => mapDiv,
      getZoom: () => 17,
      getCenter: () => ({ toJSON: () => ({ lat: 41.6, lng: -80.8 }) }),
      addListener: vi.fn((eventName: string, callback: () => void) => {
        callbacks.set(eventName, callback);
        return { remove: removed };
      }),
    };
    const diagnostics = createBoundaryFlashDiagnostics({
      enabled: true,
      map,
      getState: () => ({
        container,
        svg,
        shadePath,
        borderPath,
        overlayLayer,
        renderState: {
          paths: [[], [{ lat: 41.6, lng: -80.8 }]],
          showShade: true,
          showBorder: true,
        },
        drawCount: 2,
        requestedDrawCount: 1,
      }),
    });

    expect(container.parentNode).toBe(overlayLayer);
    expect(overlayLayer.nextSibling).toBe(markerLayer);
    expect(container.style.zIndex).toBe("");
    expect(document.querySelector("[data-cityreport-boundary-debug-hud='true']")).toBeTruthy();

    callbacks.get("dragstart")?.();
    callbacks.get("dragend")?.();
    diagnostics.record("test:snapshot");

    const trace = (window as any).__CITYREPORT_BOUNDARY_FLASH_TRACE__;
    expect(trace.map((entry: any) => entry.event)).toEqual(expect.arrayContaining([
      "diagnostics:ready",
      "map:dragstart",
      "map:dragend",
      "test:snapshot",
    ]));
    expect(trace.at(-1).state).toMatchObject({
      connected: true,
      parentMatchesPane: true,
      paneId: trace.at(-1).state.currentParentPaneId,
      anomalies: [],
    });

    diagnostics.destroy();
    expect(document.querySelector("[data-cityreport-boundary-debug-hud='true']")).toBeNull();
    expect(removed).toHaveBeenCalledTimes(7);
    expect(container.parentNode).toBe(overlayLayer);
  });
});
