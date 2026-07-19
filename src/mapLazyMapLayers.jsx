import React, { Fragment, memo, useEffect, useMemo, useRef } from "react";
import { MarkerF, PolygonF, PolylineF, useGoogleMap } from "@react-google-maps/api";
import {
  buildIncidentMarkerRenderItemsShared,
} from "./lib/mapIncidentMarkerRenderSupport.js";
import {
  gmapsCountBadgeIcon,
  gmapsDotIcon,
} from "./lib/mapMarkerIconSupport.js";

function createPersistentBoundaryOverlay({ googleMaps, map, renderStateRef }) {
  return new (class PersistentBoundaryOverlay extends googleMaps.OverlayView {
    constructor() {
      super();
      this.container = null;
      this.svg = null;
      this.shadePath = null;
      this.borderPath = null;
    }

    onAdd() {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.pointerEvents = "none";
      container.style.zIndex = "2200";
      container.style.overflow = "visible";

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.style.display = "block";
      svg.style.overflow = "visible";
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
      this.getPanes()?.overlayLayer?.appendChild(container);
    }

    draw() {
      if (!this.container || !this.svg || !this.shadePath || !this.borderPath) return;
      const projection = this.getProjection();
      const mapDiv = map.getDiv?.();
      if (!projection || !mapDiv) return;

      const overlayLayer = this.getPanes()?.overlayLayer;
      if (overlayLayer && this.container.parentNode !== overlayLayer) {
        overlayLayer.appendChild(this.container);
      }

      const buffer = 2048;
      const width = Math.max(1, Number(mapDiv.clientWidth || 0) + (buffer * 2));
      const height = Math.max(1, Number(mapDiv.clientHeight || 0) + (buffer * 2));
      const shadePathParts = [`M 0 0 H ${width} V ${height} H 0 Z`];
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
            return { x: pixel.x + buffer, y: pixel.y + buffer };
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

      this.container.style.left = `${-buffer}px`;
      this.container.style.top = `${-buffer}px`;
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
      this.container?.remove();
      this.container = null;
      this.svg = null;
      this.shadePath = null;
      this.borderPath = null;
    }
  })();
}

export const IncidentDomainMarkersLayer = memo(function IncidentDomainMarkersLayer({
  activeMapLayerKey,
  adminReportDomain,
  markers,
  mappingMode,
  isAdmin,
  queuedMarkers,
  adminDomainMetaIcon,
  adminDomainMetaIconSrc,
  defaultMarkerColorForDomain,
  defaultMarkerGlyphForDomain,
  defaultMarkerGlyphSrcForDomain,
  domainMarkerColor,
  fallbackIconSrc,
  normalizeDomainKeyOrSlug,
  resolveDomainMarkerIconPresentation,
  resolveVisibleDomainIconSrc,
  onIncidentMarkerClick,
  onQueuedMarkerClick,
}) {
  const markerItems = useMemo(() => buildIncidentMarkerRenderItemsShared(markers, {
    adminDomainMetaIcon,
    adminDomainMetaIconSrc,
    adminReportDomain,
    defaultMarkerColorForDomain,
    defaultMarkerGlyphForDomain,
    defaultMarkerGlyphSrcForDomain,
    domainMarkerColor,
    fallbackIconSrc,
    gmapsCountBadgeIcon,
    gmapsDotIcon,
    normalizeDomainKeyOrSlug,
    resolveDomainMarkerIconPresentation,
    resolveVisibleDomainIconSrc,
  }), [
    markers,
    adminDomainMetaIcon,
    adminDomainMetaIconSrc,
    adminReportDomain,
    defaultMarkerColorForDomain,
    defaultMarkerGlyphForDomain,
    defaultMarkerGlyphSrcForDomain,
    domainMarkerColor,
    fallbackIconSrc,
    normalizeDomainKeyOrSlug,
    resolveDomainMarkerIconPresentation,
    resolveVisibleDomainIconSrc,
  ]);
  const queuedMarkerItems = useMemo(() => (
    (Array.isArray(queuedMarkers) ? queuedMarkers : []).map((queuedMarker) => ({
      ...queuedMarker,
      markerIcon: gmapsDotIcon(
        "#2ecc71",
        "#fff",
        defaultMarkerGlyphForDomain?.(queuedMarker?.domain || "streetlights", { fallback: "💡" }),
        resolveVisibleDomainIconSrc?.(
          queuedMarker?.domain || "streetlights",
          defaultMarkerGlyphSrcForDomain?.(queuedMarker?.domain || "streetlights", fallbackIconSrc)
        ),
      ),
    }))
  ), [
    queuedMarkers,
    defaultMarkerGlyphForDomain,
    defaultMarkerGlyphSrcForDomain,
    fallbackIconSrc,
    resolveVisibleDomainIconSrc,
  ]);
  return (
    <>
      {activeMapLayerKey !== "streetlights" && (markerItems || []).map((marker) => (
        <MarkerF
          key={`domain-${String(marker?.domain || adminReportDomain)}-${marker?.id}`}
          position={{ lat: marker.lat, lng: marker.lng }}
          icon={marker?.markerIcon}
          onClick={() => onIncidentMarkerClick?.(marker)}
        />
      ))}

      {mappingMode && isAdmin && (queuedMarkerItems || []).map((queuedMarker) => (
        <MarkerF
          key={queuedMarker.tempId}
          position={{ lat: queuedMarker.lat, lng: queuedMarker.lng }}
          icon={queuedMarker?.markerIcon}
          onClick={() => onQueuedMarkerClick?.(queuedMarker)}
        />
      ))}
    </>
  );
});

const PersistentBoundaryLayer = memo(function PersistentBoundaryLayer({
  paths,
  opacity,
  showShade,
  showBorder,
  borderColor,
  borderWidth,
}) {
  const map = useGoogleMap();
  const overlayRef = useRef(null);
  const renderStateRef = useRef({
    paths,
    opacity,
    showShade,
    showBorder,
    borderColor,
    borderWidth,
  });

  useEffect(() => {
    if (!map || !window?.google?.maps?.OverlayView) return undefined;
    const overlay = createPersistentBoundaryOverlay({
      googleMaps: window.google.maps,
      map,
      renderStateRef,
    });
    overlayRef.current = overlay;
    overlay.setMap(map);
    return () => {
      overlay.setMap(null);
      if (overlayRef.current === overlay) overlayRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    renderStateRef.current = {
      paths,
      opacity,
      showShade,
      showBorder,
      borderColor,
      borderWidth,
    };
    overlayRef.current?.draw?.();
  }, [borderColor, borderWidth, opacity, paths, showBorder, showShade]);

  return null;
});

export const BoundaryAndParksLayer = memo(function BoundaryAndParksLayer({
  showCityOutsideShade,
  cityOutsideMaskPaths,
  cityOutsideShadeOpacity,
  showCityBoundaryBorder,
  cityBoundaryBorderColor,
  cityBoundaryBorderWidth,
  tenantParksLoaded,
  tenantParkVisuals,
}) {
  return (
    <>
      {(showCityOutsideShade || showCityBoundaryBorder) && cityOutsideMaskPaths.length > 1 && (
        <PersistentBoundaryLayer
          paths={cityOutsideMaskPaths}
          opacity={cityOutsideShadeOpacity}
          showShade={showCityOutsideShade}
          showBorder={showCityBoundaryBorder}
          borderColor={cityBoundaryBorderColor}
          borderWidth={cityBoundaryBorderWidth}
        />
      )}
      {tenantParksLoaded && tenantParkVisuals.map((park) => (
        <Fragment key={`tenant-park-${park.id || park.parkKey}`}>
          {park.polygons.map((polygon, polygonIndex) => (
            <PolygonF
              key={`tenant-park-poly-${park.id || park.parkKey}-${polygonIndex}`}
              paths={polygon}
              options={{
                clickable: false,
                strokeOpacity: 0,
                strokeWeight: 0,
                fillColor: park.fillColor,
                fillOpacity: park.fillOpacity,
                zIndex: 2050,
              }}
            />
          ))}
          {(park.borderSegments || []).map((segment, segmentIndex) => (
            <PolylineF
              key={`tenant-park-border-${park.id || park.parkKey}-${segmentIndex}`}
              path={segment}
              options={{
                clickable: false,
                strokeColor: park.borderColor,
                strokeOpacity: 1,
                strokeWeight: park.borderWidth,
                zIndex: 2055,
              }}
            />
          ))}
          {park.showLabel !== false && park.labelPosition ? (
            <MarkerF
              key={`tenant-park-label-${park.id || park.parkKey}`}
              position={park.labelPosition}
              options={{
                clickable: false,
                draggable: false,
                optimized: false,
                zIndex: 2060,
                icon: window?.google?.maps?.SymbolPath
                  ? {
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: 0.001,
                      fillOpacity: 0,
                      strokeOpacity: 0,
                    }
                  : undefined,
                label: {
                  text: String(park.parkName || "Park"),
                  color: String(park.labelColor || "#17314f"),
                  fontWeight: "700",
                  fontSize: `${Math.max(9, Number(park.labelFontSizePx) || 10)}px`,
                  className: "cityreport-park-label",
                },
              }}
            />
          ) : null}
        </Fragment>
      ))}
    </>
  );
});
