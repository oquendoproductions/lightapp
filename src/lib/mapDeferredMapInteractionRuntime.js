export function handleMapDragStartRuntimeShared(state = {}, deps = {}) {
  const beginMapInteraction =
    typeof deps?.beginMapInteraction === "function"
      ? deps.beginMapInteraction
      : () => {};
  const stopFollowCameraAnimation =
    typeof deps?.stopFollowCameraAnimation === "function"
      ? deps.stopFollowCameraAnimation
      : () => {};
  const setFollowCamera =
    typeof deps?.setFollowCamera === "function"
      ? deps.setFollowCamera
      : () => {};
  const setTravelFollowMode =
    typeof deps?.setTravelFollowMode === "function"
      ? deps.setTravelFollowMode
      : () => {};
  const closeAnyPopup =
    typeof deps?.closeAnyPopup === "function"
      ? deps.closeAnyPopup
      : () => {};

  beginMapInteraction();
  closeAnyPopup();
  if (state?.userDragPanRef) {
    state.userDragPanRef.current = true;
  }
  if (state?.followCamera !== true) return;

  stopFollowCameraAnimation();
  if (state?.travelFollowMode !== true) {
    setFollowCamera(false);
    setTravelFollowMode(false);
  }
}

export function handleMapZoomChangedRuntimeShared(state = {}, deps = {}) {
  const beginMapInteraction =
    typeof deps?.beginMapInteraction === "function"
      ? deps.beginMapInteraction
      : () => {};
  const setMapZoom =
    typeof deps?.setMapZoom === "function"
      ? deps.setMapZoom
      : () => {};

  beginMapInteraction();
  if (state?.lastZoomGestureAtRef) {
    state.lastZoomGestureAtRef.current = Date.now();
  }
  const z = Number(state?.mapRef?.current?.getZoom?.());
  if (!Number.isFinite(z)) return;
  if (state?.mapZoomRef) {
    state.mapZoomRef.current = z;
  }
  const rounded = Math.round(z);
  setMapZoom((prev) => (prev === rounded ? prev : rounded));
}

export function handleMapIdleRuntimeShared(state = {}, deps = {}) {
  const endMapInteractionSoon =
    typeof deps?.endMapInteractionSoon === "function"
      ? deps.endMapInteractionSoon
      : () => {};
  const setMapZoom =
    typeof deps?.setMapZoom === "function"
      ? deps.setMapZoom
      : () => {};
  const setMapCenter =
    typeof deps?.setMapCenter === "function"
      ? deps.setMapCenter
      : () => {};
  const setMapBounds =
    typeof deps?.setMapBounds === "function"
      ? deps.setMapBounds
      : () => {};
  const resumeFollowCameraFromLiveMotion =
    typeof deps?.resumeFollowCameraFromLiveMotion === "function"
      ? deps.resumeFollowCameraFromLiveMotion
      : () => {};

  endMapInteractionSoon(750);

  const shouldResumeTravelFollow =
    state?.userDragPanRef?.current &&
    state?.travelFollowMode === true &&
    state?.followCamera === true;

  if (state?.userDragPanRef) {
    state.userDragPanRef.current = false;
  }

  const map = state?.mapRef?.current;
  if (!map) return;

  const z = Number(map.getZoom?.());
  if (Number.isFinite(z)) {
    const rounded = Math.round(z);
    setMapZoom((prev) => (prev === rounded ? prev : rounded));
  }

  const c = map.getCenter?.();
  const lat = Number(c?.lat?.());
  const lng = Number(c?.lng?.());
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    setMapCenter((prev) => {
      if (!prev) return { lat, lng };
      if (Math.abs(prev.lat - lat) < 0.000001 && Math.abs(prev.lng - lng) < 0.000001) return prev;
      return { lat, lng };
    });
  }

  const b = map.getBounds?.();
  const ne = b?.getNorthEast?.();
  const sw = b?.getSouthWest?.();
  const north = Number(ne?.lat?.());
  const east = Number(ne?.lng?.());
  const south = Number(sw?.lat?.());
  const west = Number(sw?.lng?.());
  if ([north, east, south, west].every(Number.isFinite)) {
    setMapBounds((prev) => {
      if (
        prev &&
        Math.abs(prev.north - north) < 0.000001 &&
        Math.abs(prev.east - east) < 0.000001 &&
        Math.abs(prev.south - south) < 0.000001 &&
        Math.abs(prev.west - west) < 0.000001
      ) {
        return prev;
      }
      return { north, east, south, west };
    });
  }

  if (shouldResumeTravelFollow) {
    resumeFollowCameraFromLiveMotion({ syncState: true });
  }
}
