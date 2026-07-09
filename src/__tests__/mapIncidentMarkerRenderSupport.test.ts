import { describe, expect, it } from "vitest";

import {
  buildIncidentMarkerRenderItemShared,
  dedupeIncidentMarkerRenderSourceShared,
} from "../lib/mapIncidentMarkerRenderSupport";

const helperDeps = {
  normalizeDomainKeyOrSlug: (value: string) => String(value || "").trim().toLowerCase(),
  getIncidentDomainHelper: () => ({}),
};

const renderItemDeps = {
  adminDomainMetaIcon: "icon",
  adminDomainMetaIconSrc: "icon-src",
  adminReportDomain: "potholes",
  defaultMarkerColorForDomain: (value: string) => `${value}-color`,
  defaultMarkerGlyphForDomain: (value: string) => `${value}-glyph`,
  defaultMarkerGlyphSrcForDomain: (value: string, fallback?: string) => `${value}-glyph-src-${fallback || ""}`,
  domainMarkerColor: "default-domain-color",
  fallbackIconSrc: "fallback-icon-src",
  gmapsCountBadgeIcon: (count: number, options: Record<string, unknown>) => ({ kind: "badge", count, options }),
  gmapsDotIcon: (
    color: string,
    ring: string,
    glyph: string,
    glyphSrc: string,
    presentation: Record<string, unknown> | null
  ) => ({
    kind: "dot",
    color,
    ring,
    glyph,
    glyphSrc,
    presentation,
  }),
  normalizeDomainKeyOrSlug: (value: string) => String(value || "").trim().toLowerCase(),
  resolveDomainMarkerIconPresentation: (
    domainKey: string,
    color: string,
    glyphSrc: string,
    options: Record<string, unknown>
  ) => ({
    domainKey,
    color,
    glyphSrc,
    options,
  }),
  resolveVisibleDomainIconSrc: (_domain: string, value: string) => value,
};

describe("dedupeIncidentMarkerRenderSourceShared", () => {
  it("returns unique markers unchanged when no dedupe merge is needed", () => {
    const markerA = {
      domain: "potholes",
      incident_id: "pothole:one",
      id: "a",
      rows: [{ id: "r1", ts: 20 }],
    };
    const markerB = {
      domain: "potholes",
      incident_id: "pothole:two",
      id: "b",
      rows: [{ id: "r2", ts: 10 }],
    };
    const markers = [markerA, markerB];

    const result = dedupeIncidentMarkerRenderSourceShared(markers, helperDeps);

    expect(result).toBe(markers);
    expect(result[0]).toBe(markerA);
    expect(result[1]).toBe(markerB);
  });

  it("merges duplicate markers and normalizes merged rows", () => {
    const older = {
      domain: "potholes",
      incident_id: "pothole:one",
      id: "older",
      count: 1,
      lastTs: 10,
      rows: [
        { id: "r1", ts: 10 },
        { id: "r1", ts: 10 },
      ],
    };
    const newer = {
      domain: "potholes",
      incident_id: "pothole:one",
      id: "newer",
      count: 1,
      lastTs: 20,
      rows: [
        { id: "r2", ts: 20 },
        { id: "r1", ts: 10 },
      ],
    };

    const result = dedupeIncidentMarkerRenderSourceShared([older, newer], helperDeps);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "newer",
      incident_id: "pothole:one",
      count: 2,
      lastTs: 20,
    });
    expect(result[0].rows).toEqual([
      { id: "r2", ts: 20 },
      { id: "r1", ts: 10 },
    ]);
  });

  it("reuses cached render items for the same marker object and signature", () => {
    const marker = {
      id: "marker-1",
      domain: "potholes",
      color: "#123456",
      glyph: "!",
      glyphSrc: "glyph-src",
      ringColor: "#ffffff",
      count: 3,
      lastTs: 20,
      lat: 41.1,
      lng: -80.8,
    };

    const first = buildIncidentMarkerRenderItemShared(marker, renderItemDeps);
    const second = buildIncidentMarkerRenderItemShared(marker, renderItemDeps);

    expect(first).toBe(second);
    expect(first).toMatchObject({
      id: "marker-1",
      markerIcon: {
        kind: "dot",
        color: "#123456",
        ring: "#ffffff",
        glyph: "!",
        glyphSrc: "glyph-src",
      },
    });
  });
});
