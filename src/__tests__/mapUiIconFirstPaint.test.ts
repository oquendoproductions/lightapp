import { afterEach, describe, expect, it, vi } from "vitest";

import * as runtimeIcons from "../mapUiIconRuntimeCoreSupport.js";

afterEach(() => {
  vi.unstubAllGlobals();
  runtimeIcons.setResolvedRuntimeUiIconMetaState({});
});

describe("critical map tool icon loading", () => {
  it("upgrades legacy built-in icon paths without changing custom tenant icons", () => {
    runtimeIcons.setResolvedRuntimeUiIconMetaState({
      satellite: {
        src: "/satellite_icon.png",
        render_mode: "raster",
      },
      headingReset: {
        src: "https://cdn.example.com/custom-heading.png",
        render_mode: "raster",
      },
    });

    expect(runtimeIcons.RUNTIME_UI_ICON_SRC.satellite).toBe(
      "/Icons/Map Tools/first-paint/satellite_icon.webp"
    );
    expect(runtimeIcons.RUNTIME_UI_ICON_SRC.headingReset).toBe(
      "https://cdn.example.com/custom-heading.png"
    );
  });

  it("starts high-priority eager requests for the critical rail icons", () => {
    const created: Array<Record<string, string>> = [];
    class FakeImage {
      loading = "";
      decoding = "";
      fetchPriority = "";
      src = "";

      constructor() {
        created.push(this as unknown as Record<string, string>);
      }
    }
    vi.stubGlobal("Image", FakeImage);

    const iconSrcByKey = Object.fromEntries(
      runtimeIcons.CRITICAL_MAP_TOOL_ICON_KEYS.map((key) => [key, `/test/${key}.webp`])
    );
    const started = runtimeIcons.preloadCriticalMapToolIcons(iconSrcByKey);

    expect(started).toHaveLength(runtimeIcons.CRITICAL_MAP_TOOL_ICON_KEYS.length);
    expect(created).toHaveLength(runtimeIcons.CRITICAL_MAP_TOOL_ICON_KEYS.length);
    expect(created.every((image) => image.loading === "eager")).toBe(true);
    expect(created.every((image) => image.decoding === "async")).toBe(true);
    expect(created.every((image) => image.fetchPriority === "high")).toBe(true);
  });
});
