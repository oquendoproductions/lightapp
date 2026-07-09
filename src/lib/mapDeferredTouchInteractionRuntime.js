export function attachGoogleMapTouchGestureRuntimeShared(state = {}, deps = {}) {
  const gmapsRef = state?.gmapsRef || null;
  const clickDelayRef = state?.clickDelayRef || null;
  const suppressMapClickRef = state?.suppressMapClickRef || null;
  const clamp =
    typeof deps?.clamp === "function"
      ? deps.clamp
      : (value) => value;

  const div = gmapsRef?.getDiv?.();
  if (!div) return () => {};

  const gestureState = {
    lastEligibleTapTs: 0,
    secondTapActive: false,
    secondTapMoved: false,
    secondTapDragZoomed: false,
    secondTapStartY: 0,
    secondTapStartZoom: null,
    secondTapLastAppliedZoom: null,
    activeTouchStartedSingle: false,
    activeTouchMoved: false,
  };
  const captureTouchOptions = { passive: false, capture: true };
  const passiveCaptureTouchOptions = { passive: true, capture: true };

  const resetSecondTapGesture = () => {
    gestureState.secondTapActive = false;
    gestureState.secondTapMoved = false;
    gestureState.secondTapDragZoomed = false;
    gestureState.secondTapStartY = 0;
    gestureState.secondTapStartZoom = null;
    gestureState.secondTapLastAppliedZoom = null;
    gestureState.activeTouchStartedSingle = false;
    gestureState.activeTouchMoved = false;
  };

  const isUiTarget = (target) => {
    if (!target?.closest) return false;
    return Boolean(
      target.closest(".gm-style-iw")
        || target.closest(".gm-style-iw-c")
        || target.closest(".gm-style-iw-d")
        || target.closest(".gm-control-active")
        || target.closest("button")
        || target.closest("a")
        || target.closest("input")
        || target.closest("textarea")
        || target.closest("select")
    );
  };

  const cancelPendingMapTap = (suppressMs = 1100) => {
    const ref = clickDelayRef?.current;
    if (ref?.timer) {
      clearTimeout(ref.timer);
      ref.timer = null;
    }
    if (ref) ref.lastLatLng = null;
    if (suppressMapClickRef?.current) {
      suppressMapClickRef.current.until = Date.now() + suppressMs;
    }
  };

  const onTouchStart = (event) => {
    if ((event.touches?.length || 0) !== 1) {
      gestureState.lastEligibleTapTs = 0;
      resetSecondTapGesture();
      return;
    }
    if (isUiTarget(event.target)) {
      gestureState.lastEligibleTapTs = 0;
      resetSecondTapGesture();
      return;
    }
    const now = Date.now();
    const dt = now - Number(gestureState.lastEligibleTapTs || 0);
    gestureState.activeTouchStartedSingle = true;
    gestureState.activeTouchMoved = false;
    gestureState.secondTapActive = dt > 0 && dt < 420;
    gestureState.secondTapMoved = false;
    gestureState.secondTapDragZoomed = false;
    if (gestureState.secondTapActive) {
      const touch = event.touches?.[0];
      const zoom = Number(gmapsRef?.getZoom?.());
      gestureState.secondTapStartY = Number(touch?.clientY || 0);
      gestureState.secondTapStartZoom = Number.isFinite(zoom) ? zoom : 0;
      gestureState.secondTapLastAppliedZoom = gestureState.secondTapStartZoom;
      cancelPendingMapTap(1400);
      if (event.cancelable) event.preventDefault();
    }
  };

  const onTouchMove = (event) => {
    if (!gestureState.activeTouchStartedSingle) return;
    if (isUiTarget(event.target)) return;
    gestureState.activeTouchMoved = true;
    if (!gestureState.secondTapActive) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    gestureState.secondTapMoved = true;
    cancelPendingMapTap(1400);
    const startZoom = Number(gestureState.secondTapStartZoom);
    const startY = Number(gestureState.secondTapStartY);
    if (!Number.isFinite(startZoom) || !Number.isFinite(startY)) {
      if (event.cancelable) event.preventDefault();
      return;
    }
    const deltaY = startY - Number(touch.clientY || 0);
    const zoomSteps = deltaY >= 0
      ? Math.floor(deltaY / 80)
      : Math.ceil(deltaY / 80);
    const minZoom = Number(gmapsRef?.get?.("minZoom"));
    const maxZoom = Number(gmapsRef?.get?.("maxZoom"));
    const nextZoom = clamp(
      startZoom + zoomSteps,
      Number.isFinite(minZoom) ? minZoom : 3,
      Number.isFinite(maxZoom) ? maxZoom : 22,
    );
    if (Number.isFinite(nextZoom) && nextZoom !== gestureState.secondTapLastAppliedZoom) {
      gmapsRef?.setZoom?.(nextZoom);
      gestureState.secondTapLastAppliedZoom = nextZoom;
      gestureState.secondTapDragZoomed = true;
    }
    if (event.cancelable) event.preventDefault();
  };

  const onTouchEnd = () => {
    const endedSecondTap = gestureState.secondTapActive;
    const shouldKeepTapEligible =
      gestureState.activeTouchStartedSingle &&
      !gestureState.activeTouchMoved &&
      !gestureState.secondTapMoved &&
      !gestureState.secondTapDragZoomed;
    if (gestureState.secondTapActive) {
      cancelPendingMapTap(gestureState.secondTapDragZoomed || gestureState.secondTapMoved ? 1100 : 700);
    }
    gestureState.lastEligibleTapTs =
      endedSecondTap || !shouldKeepTapEligible
        ? 0
        : Date.now();
    resetSecondTapGesture();
  };

  div.addEventListener("touchstart", onTouchStart, captureTouchOptions);
  div.addEventListener("touchmove", onTouchMove, captureTouchOptions);
  div.addEventListener("touchend", onTouchEnd, passiveCaptureTouchOptions);
  div.addEventListener("touchcancel", onTouchEnd, passiveCaptureTouchOptions);

  return () => {
    div.removeEventListener("touchstart", onTouchStart, captureTouchOptions);
    div.removeEventListener("touchmove", onTouchMove, captureTouchOptions);
    div.removeEventListener("touchend", onTouchEnd, passiveCaptureTouchOptions);
    div.removeEventListener("touchcancel", onTouchEnd, passiveCaptureTouchOptions);
  };
}
