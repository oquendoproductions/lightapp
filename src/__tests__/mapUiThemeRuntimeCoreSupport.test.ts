import { describe, expect, it } from "vitest";

import {
  listMapUiThemeBoundaryTimestamps,
  mergeMapUiNoticeConfig as mergeMapUiNoticeConfigCore,
  mergeMapUiTheme as mergeMapUiThemeCore,
} from "../mapUiThemeRuntimeCoreSupport";
import {
  mergeMapUiNoticeConfig as mergeMapUiNoticeConfigFull,
  mergeMapUiTheme as mergeMapUiThemeFull,
  sanitizeMapUiThemeSchedules,
} from "../mapUiThemeRuntimeSupport";

describe("mapUiThemeRuntimeCoreSupport", () => {
  it("matches runtime theme merging for legacy scheduled themes", () => {
    const raw = {
      theme: {
        light: {
          tool_button_bg: "#112233",
        },
      },
      scheduled_themes: [
        {
          id: "fourth-of-july",
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

    expect(mergeMapUiThemeCore(raw, "2026-07-04T12:00:00.000Z")).toEqual(
      mergeMapUiThemeFull(raw, "2026-07-04T12:00:00.000Z")
    );
    expect(mergeMapUiThemeCore(raw, "2026-07-06T12:00:00.000Z")).toEqual(
      mergeMapUiThemeFull(raw, "2026-07-06T12:00:00.000Z")
    );
  });

  it("matches runtime theme merging for published theme-library payloads", () => {
    const raw = {
      themes: [
        {
          id: "default-theme",
          is_default: true,
          name: "Default Theme",
          deployment_state: "published",
          theme: {
            light: {
              surface_bg: "#f0f0f0",
              tool_button_bg: "#112233",
            },
          },
        },
        {
          id: "holiday-theme",
          name: "Holiday Theme",
          deployment_state: "published",
          start_at: "2026-12-24T00:00:00.000Z",
          end_at: "2026-12-26T00:00:00.000Z",
          theme: {
            light: {
              header_bg_primary: "#cc0000",
              header_bg_secondary: "#ffffff",
            },
          },
        },
        {
          id: "draft-theme",
          name: "Draft Theme",
          deployment_state: "draft",
          start_at: "2026-11-01T00:00:00.000Z",
          end_at: "2026-11-02T00:00:00.000Z",
          theme: {
            light: {
              tool_button_bg: "#00aa00",
            },
          },
        },
      ],
    };

    expect(mergeMapUiThemeCore(raw, "2026-12-20T12:00:00.000Z")).toEqual(
      mergeMapUiThemeFull(raw, "2026-12-20T12:00:00.000Z")
    );
    expect(mergeMapUiThemeCore(raw, "2026-12-25T12:00:00.000Z")).toEqual(
      mergeMapUiThemeFull(raw, "2026-12-25T12:00:00.000Z")
    );
  });

  it("matches runtime notice merging", () => {
    const raw = {
      notices: {
        clipboard_copy_success: {
          icon_key: "noticeInfo",
          title: "Done",
          message: "Copied now.",
        },
      },
    };

    expect(mergeMapUiNoticeConfigCore(raw)).toEqual(mergeMapUiNoticeConfigFull(raw));
  });

  it("exposes the same sorted schedule boundary timestamps used by runtime scheduling", () => {
    const raw = {
      themes: [
        {
          id: "default-theme",
          is_default: true,
          deployment_state: "published",
          theme: {
            light: {
              tool_button_bg: "#112233",
            },
          },
        },
        {
          id: "a",
          deployment_state: "published",
          start_at: "2026-12-24T00:00:00.000Z",
          end_at: "2026-12-26T00:00:00.000Z",
          theme: {
            light: {
              header_bg_primary: "#cc0000",
            },
          },
        },
        {
          id: "b",
          deployment_state: "published",
          start_at: "2026-12-31T00:00:00.000Z",
          end_at: "2027-01-02T00:00:00.000Z",
          theme: {
            light: {
              header_bg_primary: "#00aa00",
            },
          },
        },
      ],
    };

    const expected = sanitizeMapUiThemeSchedules(raw)
      .flatMap((entry) => [Date.parse(String(entry?.start_at || "")), Date.parse(String(entry?.end_at || ""))])
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);

    expect(listMapUiThemeBoundaryTimestamps(raw)).toEqual(expected);
  });
});
