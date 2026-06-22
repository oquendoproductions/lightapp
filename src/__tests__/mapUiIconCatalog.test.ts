import { describe, expect, it } from "vitest";

import {
  MAP_UI_ICON_THEME_DEFAULTS,
  isMapUiBaseThemeEnabled,
  mergeMapUiTheme,
  resolveActiveMapUiThemeSchedule,
  resolveMapUiThemeOverride,
  sanitizeMapUiThemeSchedules,
} from "../mapUiIconCatalog";

describe("mapUiIconCatalog theme scheduling", () => {
  it("uses the scheduled theme while its window is active", () => {
    const raw = {
      theme: {
        light: {
          tool_button_bg: "#112233",
        },
      },
      theme_enabled: true,
      scheduled_themes: [
        {
          id: "fourth-of-july",
          label: "Fourth of July",
          start_at: "2026-07-04T00:00:00.000Z",
          end_at: "2026-07-05T00:00:00.000Z",
          theme: {
            light: {
              tool_button_bg: "#ff0000",
            },
          },
        },
      ],
    };

    expect(resolveActiveMapUiThemeSchedule(raw, "2026-07-04T12:00:00.000Z")?.id).toBe("fourth-of-july");
    expect(resolveMapUiThemeOverride(raw, "2026-07-04T12:00:00.000Z")).toEqual({
      light: {
        tool_button_bg: "#ff0000",
      },
    });
    expect(mergeMapUiTheme(raw, "2026-07-04T12:00:00.000Z").light.tool_button_bg).toBe("#ff0000");
  });

  it("falls back to the indefinite theme when no schedule is active", () => {
    const raw = {
      theme: {
        light: {
          tool_button_bg: "#112233",
        },
      },
      theme_enabled: true,
      scheduled_themes: [
        {
          id: "fourth-of-july",
          label: "Fourth of July",
          start_at: "2026-07-04T00:00:00.000Z",
          end_at: "2026-07-05T00:00:00.000Z",
          theme: {
            light: {
              tool_button_bg: "#ff0000",
            },
          },
        },
      ],
    };

    expect(resolveActiveMapUiThemeSchedule(raw, "2026-07-06T12:00:00.000Z")).toBeNull();
    expect(resolveMapUiThemeOverride(raw, "2026-07-06T12:00:00.000Z")).toEqual({
      light: {
        tool_button_bg: "#112233",
      },
    });
    expect(mergeMapUiTheme(raw, "2026-07-06T12:00:00.000Z").light.tool_button_bg).toBe("#112233");
  });

  it("falls back to defaults when the indefinite theme is disabled", () => {
    const raw = {
      theme: {
        light: {
          tool_button_bg: "#112233",
        },
      },
      theme_enabled: false,
    };

    expect(isMapUiBaseThemeEnabled(raw)).toBe(false);
    expect(resolveMapUiThemeOverride(raw, "2026-07-06T12:00:00.000Z")).toEqual({});
    expect(mergeMapUiTheme(raw, "2026-07-06T12:00:00.000Z").light.tool_button_bg).toBe(
      MAP_UI_ICON_THEME_DEFAULTS.light.tool_button_bg
    );
  });

  it("keeps only valid schedules and prioritizes the most recent overlapping start", () => {
    const schedules = sanitizeMapUiThemeSchedules([
      {
        id: "invalid-window",
        start_at: "2026-07-05T00:00:00.000Z",
        end_at: "2026-07-04T00:00:00.000Z",
        theme: {
          light: {
            tool_button_bg: "#000000",
          },
        },
      },
      {
        id: "older",
        start_at: "2026-07-04T00:00:00.000Z",
        end_at: "2026-07-06T00:00:00.000Z",
        theme: {
          light: {
            tool_button_bg: "#111111",
          },
        },
      },
      {
        id: "newer",
        start_at: "2026-07-05T00:00:00.000Z",
        end_at: "2026-07-06T00:00:00.000Z",
        theme: {
          light: {
            tool_button_bg: "#222222",
          },
        },
      },
    ]);

    expect(schedules.map((entry) => entry.id)).toEqual(["newer", "older"]);
    expect(resolveActiveMapUiThemeSchedule({ scheduled_themes: schedules }, "2026-07-05T12:00:00.000Z")?.id).toBe("newer");
  });
});
