export function stopFollowCameraAnimationRuntimeShared(state = {}) {
  const followRafRef = state?.followRafRef || { current: null };
  const followLastFrameAtRef = state?.followLastFrameAtRef || { current: 0 };
  const followTargetRef = state?.followTargetRef || { current: null };
  const followAnimatedCameraRef =
    state?.followAnimatedCameraRef || { current: { lat: null, lng: null, heading: null } };

  if (followRafRef.current) {
    cancelAnimationFrame(followRafRef.current);
    followRafRef.current = null;
  }
  followLastFrameAtRef.current = 0;
  followTargetRef.current = null;
  followAnimatedCameraRef.current = { lat: null, lng: null, heading: null };
}

export function moveFollowCameraRuntimeShared(params = {}, state = {}, deps = {}) {
  const map = state?.mapRef?.current;
  if (!map) return;

  const resolveFollowCameraCenter =
    typeof deps?.resolveFollowCameraCenter === "function"
      ? deps.resolveFollowCameraCenter
      : () => null;
  const setMapCenter =
    typeof deps?.setMapCenter === "function"
      ? deps.setMapCenter
      : () => {};
  const setMapZoom =
    typeof deps?.setMapZoom === "function"
      ? deps.setMapZoom
      : () => {};
  const locateZoom = Number.isFinite(Number(deps?.locateZoom))
    ? Number(deps.locateZoom)
    : 0;

  const lat = Number(params?.lat);
  const lng = Number(params?.lng);
  const headingNum = Number(params?.heading);
  const hasHeading = Number.isFinite(headingNum);
  const syncState = params?.syncState === true;

  const targetCenter = resolveFollowCameraCenter({
    lat,
    lng,
    heading: hasHeading ? headingNum : null,
    travelFollowMode: state?.travelFollowMode === true,
  });
  if (!targetCenter) return;

  const currentZoom = Number(map.getZoom?.() ?? state?.mapZoomRef?.current ?? locateZoom);
  const targetZoom = Number.isFinite(currentZoom) ? currentZoom : locateZoom;

  try {
    if (map.moveCamera) {
      const camera = {
        center: targetCenter,
        zoom: targetZoom,
        tilt: 0,
      };
      if (hasHeading) camera.heading = headingNum;
      map.moveCamera(camera);
    } else {
      map.setCenter?.(targetCenter);
      map.setZoom?.(targetZoom);
      if (hasHeading) map.setHeading?.(headingNum);
    }
  } catch {
    // ignore
  }

  if (syncState) {
    setMapCenter(targetCenter);
    if (Number.isFinite(targetZoom)) setMapZoom(Math.round(targetZoom));
  }
}

export function resumeFollowCameraFromLiveMotionRuntimeShared(options = {}, state = {}, deps = {}) {
  const moveFollowCamera =
    typeof deps?.moveFollowCamera === "function"
      ? deps.moveFollowCamera
      : () => {};
  const queueFollowCameraTarget =
    typeof deps?.queueFollowCameraTarget === "function"
      ? deps.queueFollowCameraTarget
      : () => {};

  const liveLat = Number(state?.liveMotionRef?.current?.lat);
  const liveLng = Number(state?.liveMotionRef?.current?.lng);
  let liveHeading = Number(state?.liveMotionRef?.current?.heading);
  if (!Number.isFinite(liveLat) || !Number.isFinite(liveLng)) return false;
  if (!state?.followHeadingEnabledRef?.current) liveHeading = Number.NaN;
  const queuedHeading = Number.isFinite(liveHeading) ? liveHeading : null;

  if (state?.lastFollowCameraRef) {
    state.lastFollowCameraRef.current = {
      lat: liveLat,
      lng: liveLng,
      heading: queuedHeading,
    };
  }
  if (state?.followAnimatedCameraRef) {
    state.followAnimatedCameraRef.current = {
      lat: liveLat,
      lng: liveLng,
      heading: queuedHeading,
    };
  }

  if (options?.syncState === true) {
    moveFollowCamera({
      lat: liveLat,
      lng: liveLng,
      heading: queuedHeading,
      syncState: true,
    });
  }

  queueFollowCameraTarget({
    lat: liveLat,
    lng: liveLng,
    heading: queuedHeading,
  });
  return true;
}

export function queueFollowCameraTargetRuntimeShared(params = {}, state = {}, deps = {}) {
  const metersBetween =
    typeof deps?.metersBetween === "function"
      ? deps.metersBetween
      : () => 0;
  const resolveFollowCameraCenter =
    typeof deps?.resolveFollowCameraCenter === "function"
      ? deps.resolveFollowCameraCenter
      : () => null;
  const moveFollowCamera =
    typeof deps?.moveFollowCamera === "function"
      ? deps.moveFollowCamera
      : () => {};
  const setMapCenter =
    typeof deps?.setMapCenter === "function"
      ? deps.setMapCenter
      : () => {};
  const setMapZoom =
    typeof deps?.setMapZoom === "function"
      ? deps.setMapZoom
      : () => {};

  const followTargetRef = state?.followTargetRef || { current: null };
  const followRafRef = state?.followRafRef || { current: null };
  const mapRef = state?.mapRef || { current: null };
  const followHeadingEnabledRef = state?.followHeadingEnabledRef || { current: false };
  const followAnimatedCameraRef =
    state?.followAnimatedCameraRef || { current: { lat: null, lng: null, heading: null } };
  const lastFollowStateSyncRef = state?.lastFollowStateSyncRef || { current: 0 };

  followTargetRef.current = {
    lat: params?.lat,
    lng: params?.lng,
    heading: params?.heading,
  };
  if (followRafRef.current) return;

  const step = () => {
    const map = mapRef.current;
    const target = followTargetRef.current;
    if (!map || !target || state?.followCamera !== true) {
      followRafRef.current = null;
      return;
    }

    const targetLat = Number(target.lat);
    const targetLng = Number(target.lng);
    let targetHeading = Number(target.heading);
    if (!followHeadingEnabledRef.current) targetHeading = Number.NaN;

    const animated = followAnimatedCameraRef.current;
    const currentLat = Number.isFinite(animated?.lat) ? animated.lat : targetLat;
    const currentLng = Number.isFinite(animated?.lng) ? animated.lng : targetLng;
    const currentHeading = Number.isFinite(animated?.heading) ? animated.heading : targetHeading;
    const remainingMeters = metersBetween(
      { lat: currentLat, lng: currentLng },
      { lat: targetLat, lng: targetLng },
    );
    const positionAlpha =
      state?.travelFollowMode === true
        ? (
          remainingMeters >= 35 ? 0.48 :
          remainingMeters >= 18 ? 0.38 :
          remainingMeters >= 8 ? 0.30 :
          remainingMeters >= 3 ? 0.22 :
          1
        )
        : (
          remainingMeters >= 35 ? 0.34 :
          remainingMeters >= 18 ? 0.28 :
          remainingMeters >= 8 ? 0.22 :
          remainingMeters >= 3 ? 0.16 :
          1
        );
    const nextLat = remainingMeters <= 0.8 ? targetLat : currentLat + (targetLat - currentLat) * positionAlpha;
    const nextLng = remainingMeters <= 0.8 ? targetLng : currentLng + (targetLng - currentLng) * positionAlpha;

    let nextHeading = null;
    let headingRemaining = 0;
    if (Number.isFinite(targetHeading) && Number.isFinite(currentHeading)) {
      const delta = ((targetHeading - currentHeading + 540) % 360) - 180;
      headingRemaining = Math.abs(delta);
      const headingAlpha =
        state?.travelFollowMode === true
          ? headingRemaining >= 45 ? 0.88
            : headingRemaining >= 24 ? 0.74
              : headingRemaining >= 10 ? 0.56
                : 0.34
          : headingRemaining >= 40 ? 0.30
            : headingRemaining >= 18 ? 0.22
              : headingRemaining >= 8 ? 0.16
                : 1;
      const snapDegrees = state?.travelFollowMode === true ? 0.45 : 2;
      nextHeading =
        headingRemaining <= snapDegrees
          ? targetHeading
          : (currentHeading + delta * headingAlpha + 360) % 360;
    } else if (Number.isFinite(targetHeading)) {
      nextHeading = targetHeading;
    }

    followAnimatedCameraRef.current = {
      lat: nextLat,
      lng: nextLng,
      heading: Number.isFinite(nextHeading) ? nextHeading : null,
    };

    moveFollowCamera({
      lat: nextLat,
      lng: nextLng,
      heading: Number.isFinite(nextHeading) ? nextHeading : null,
      syncState: false,
    });

    const now = Date.now();
    if (now - lastFollowStateSyncRef.current >= 120) {
      const syncedCenter = resolveFollowCameraCenter({
        lat: nextLat,
        lng: nextLng,
        heading: Number.isFinite(nextHeading) ? nextHeading : null,
        travelFollowMode: state?.travelFollowMode === true,
      });
      if (syncedCenter) {
        setMapCenter(syncedCenter);
      }
      const z = Number(map.getZoom?.() ?? state?.mapZoomRef?.current);
      if (Number.isFinite(z)) setMapZoom(Math.round(z));
      lastFollowStateSyncRef.current = now;
    }

    if (remainingMeters > 0.8 || headingRemaining > (state?.travelFollowMode === true ? 0.7 : 2)) {
      followRafRef.current = requestAnimationFrame(step);
      return;
    }

    followRafRef.current = null;
  };

  followRafRef.current = requestAnimationFrame(step);
}
