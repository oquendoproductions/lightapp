export const MARKER_SELECTION_MIN_ZOOM = 17;

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
  const center = { lat, lng };

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
