import React, { Fragment, memo, useEffect, useMemo, useRef } from "react";
import { MarkerF, PolygonF, PolylineF, useGoogleMap } from "@react-google-maps/api";
import {
  buildIncidentMarkerRenderItemsShared,
} from "./lib/mapIncidentMarkerRenderSupport.js";
import {
  gmapsCountBadgeIcon,
  gmapsDotIcon,
} from "./lib/mapMarkerIconSupport.js";
import { createPersistentBoundaryOverlay } from "./lib/mapBoundaryOverlaySupport.js";

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
  boundaryDiagnosticsEnabled,
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
      diagnosticsEnabled: boundaryDiagnosticsEnabled,
    });
    overlayRef.current = overlay;
    overlay.setMap(map);
    return () => {
      overlay.setMap(null);
      if (overlayRef.current === overlay) overlayRef.current = null;
    };
  }, [boundaryDiagnosticsEnabled, map]);

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
  boundaryDiagnosticsEnabled,
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
          boundaryDiagnosticsEnabled={boundaryDiagnosticsEnabled}
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
