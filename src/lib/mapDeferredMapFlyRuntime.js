export function cancelFlyAnimationRuntimeShared(state = {}) {
  const flyAnimRef = state?.flyAnimRef || { current: null };
  if (flyAnimRef.current) {
    cancelAnimationFrame(flyAnimRef.current);
    flyAnimRef.current = null;
  }
}

export function clearFlyInfoTimerRuntimeShared(state = {}) {
  const flyInfoTimerRef = state?.flyInfoTimerRef || { current: null };
  if (flyInfoTimerRef.current) {
    clearTimeout(flyInfoTimerRef.current);
    flyInfoTimerRef.current = null;
  }
}

export function flyToTargetRuntimeShared(pos, zoom, state = {}, deps = {}) {
  const setMapInteracting =
    typeof deps?.setMapInteracting === "function"
      ? deps.setMapInteracting
      : () => {};
  const setMapCenter =
    typeof deps?.setMapCenter === "function"
      ? deps.setMapCenter
      : () => {};
  const setMapZoom =
    typeof deps?.setMapZoom === "function"
      ? deps.setMapZoom
      : () => {};
  const setMapTarget =
    typeof deps?.setMapTarget === "function"
      ? deps.setMapTarget
      : () => {};

  const lat = Number(pos?.[0]);
  const lng = Number(pos?.[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const map = state?.mapRef?.current;
  const targetZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : Number(state?.mapZoom);

  if (state?.mapInteractIdleTimerRef?.current) {
    clearTimeout(state.mapInteractIdleTimerRef.current);
    state.mapInteractIdleTimerRef.current = null;
  }
  setMapInteracting(true);

  if (!map) {
    setMapCenter({ lat, lng });
    if (Number.isFinite(targetZoom)) setMapZoom(targetZoom);
    if (state?.mapInteractIdleTimerRef) {
      state.mapInteractIdleTimerRef.current = setTimeout(() => {
        setMapInteracting(false);
        state.mapInteractIdleTimerRef.current = null;
      }, 750);
    }
  } else {
    cancelFlyAnimationRuntimeShared({ flyAnimRef: state?.flyAnimRef });

    const curCenter = map.getCenter?.();
    const startLat = Number(curCenter?.lat?.() ?? state?.mapCenter?.lat);
    const startLng = Number(curCenter?.lng?.() ?? state?.mapCenter?.lng);
    const startZoom = Number(map.getZoom?.() ?? state?.mapZoom);
    const endZoom = Number.isFinite(targetZoom) ? targetZoom : startZoom;
    const t0 = performance.now();
    const duration = 650;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const frame = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = easeOutCubic(p);

      const clat = startLat + (lat - startLat) * e;
      const clng = startLng + (lng - startLng) * e;
      const cz = startZoom + (endZoom - startZoom) * e;

      try {
        if (map.moveCamera) {
          map.moveCamera({ center: { lat: clat, lng: clng }, zoom: cz });
        } else {
          map.panTo?.({ lat: clat, lng: clng });
          map.setZoom?.(cz);
        }
      } catch {
        // ignore
      }

      setMapCenter({ lat: clat, lng: clng });
      setMapZoom(cz);

      if (p < 1) {
        state.flyAnimRef.current = requestAnimationFrame(frame);
      } else {
        state.flyAnimRef.current = null;
        if (state?.mapInteractIdleTimerRef?.current) {
          clearTimeout(state.mapInteractIdleTimerRef.current);
          state.mapInteractIdleTimerRef.current = null;
        }
        if (state?.mapInteractIdleTimerRef) {
          state.mapInteractIdleTimerRef.current = setTimeout(() => {
            setMapInteracting(false);
            state.mapInteractIdleTimerRef.current = null;
          }, 750);
        }
      }
    };

    state.flyAnimRef.current = requestAnimationFrame(frame);
  }

  setMapTarget((prev) => ({
    pos: [lat, lng],
    zoom: targetZoom,
    nonce: (prev?.nonce || 0) + 1,
  }));
}

export function flyToLightAndOpenRuntimeShared(pos, zoom, lightId, state = {}, deps = {}) {
  const officialIdSet = state?.officialIdSet;
  const flyInfoTimerRef = state?.flyInfoTimerRef || { current: null };
  const primeMapSelectionPopupsWorkspace =
    typeof deps?.primeMapSelectionPopupsWorkspace === "function"
      ? deps.primeMapSelectionPopupsWorkspace
      : () => {};
  const setSelectedQueuedTempId =
    typeof deps?.setSelectedQueuedTempId === "function"
      ? deps.setSelectedQueuedTempId
      : () => {};
  const setSelectedDomainMarker =
    typeof deps?.setSelectedDomainMarker === "function"
      ? deps.setSelectedDomainMarker
      : () => {};
  const setSelectedOfficialId =
    typeof deps?.setSelectedOfficialId === "function"
      ? deps.setSelectedOfficialId
      : () => {};

  flyToTargetRuntimeShared(pos, zoom, state, deps);
  clearFlyInfoTimerRuntimeShared({ flyInfoTimerRef });

  const lid = String(lightId || "").trim();
  if (!lid || !officialIdSet?.has?.(lid)) return;

  flyInfoTimerRef.current = setTimeout(() => {
    primeMapSelectionPopupsWorkspace();
    setSelectedQueuedTempId(null);
    setSelectedDomainMarker(null);
    setSelectedOfficialId(lid);
    flyInfoTimerRef.current = null;
  }, 700);
}
