export const MARKER_SELECTION_MIN_ZOOM = 17;
export const MARKER_SELECTION_VERTICAL_FRACTION = 2 / 3;

function latitudeToWorldY(latitude) {
  const sin = Math.sin((Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI) / 180);
  return 0.5 - (Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI));
}

function worldYToLatitude(worldY) {
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * worldY)))) * 180) / Math.PI;
}

export function markerSelectionCameraCenterShared(marker = null, zoom = MARKER_SELECTION_MIN_ZOOM, viewportHeight = 0) {
  const lat = Number(marker?.lat);
  const lng = Number(marker?.lng);
  const resolvedZoom = Number(zoom);
  const height = Number(viewportHeight);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!Number.isFinite(resolvedZoom) || !(height > 0)) return { lat, lng };

  const markerOffsetPx = height * (MARKER_SELECTION_VERTICAL_FRACTION - 0.5);
  const worldSize = 256 * (2 ** resolvedZoom);
  const centerWorldY = latitudeToWorldY(lat) - (markerOffsetPx / worldSize);
  return {
    lat: worldYToLatitude(centerWorldY),
    lng,
  };
}

export function focusMapMarkerSelectionShared(marker = null, state = {}, deps = {}) {
  const lat = Number(marker?.lat);
  const lng = Number(marker?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  const map = state?.mapRef?.current || state?.map || null;
  const currentZoom = Number(
    map?.getZoom?.()
      ?? state?.mapZoomRef?.current
      ?? state?.mapZoom
  );
  const shouldRaiseZoom = !Number.isFinite(currentZoom) || currentZoom < MARKER_SELECTION_MIN_ZOOM;
  const targetZoom = shouldRaiseZoom ? MARKER_SELECTION_MIN_ZOOM : currentZoom;
  const viewportHeight = Number(
    map?.getDiv?.()?.clientHeight
      ?? state?.mapViewportHeight
      ?? 0
  );
  const center = markerSelectionCameraCenterShared({ lat, lng }, targetZoom, viewportHeight) || { lat, lng };

  deps?.setMapCenter?.(center);
  if (state?.suppressMapClickRef?.current) {
    state.suppressMapClickRef.current.until = Date.now() + 700;
  }

  try {
    map?.panTo?.(center);
    if (shouldRaiseZoom) map?.setZoom?.(MARKER_SELECTION_MIN_ZOOM);
  } catch {
    // Controlled map state still applies the requested camera position.
  }

  if (shouldRaiseZoom) {
    if (state?.mapZoomRef) state.mapZoomRef.current = MARKER_SELECTION_MIN_ZOOM;
    deps?.setMapZoom?.(MARKER_SELECTION_MIN_ZOOM);
  }

  return true;
}
