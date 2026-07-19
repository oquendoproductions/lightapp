const TRACE_WINDOW_KEY = "__CITYREPORT_BOUNDARY_FLASH_TRACE__";
const CONTROLLER_WINDOW_KEY = "__CITYREPORT_BOUNDARY_FLASH_DEBUG__";
const SESSION_WINDOW_KEY = "__CITYREPORT_BOUNDARY_FLASH_SESSION__";
const MAX_TRACE_ENTRIES = 2400;
const MAX_ANCESTOR_DEPTH = 12;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rounded(value) {
  return Math.round(finiteNumber(value) * 10) / 10;
}

function opacityNumber(value) {
  const text = String(value ?? "").trim();
  return text ? finiteNumber(text, 1) : 1;
}

function isClippingOverflow(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "hidden" || normalized === "clip";
}

function getBoundaryFlashSession() {
  const existing = window[SESSION_WINDOW_KEY];
  if (existing && Array.isArray(existing.trace)) return existing;
  const session = {
    trace: [],
    sequence: 0,
    anomalyCount: 0,
    nextInstanceId: 1,
    startedAt: performance.now(),
  };
  window[SESSION_WINDOW_KEY] = session;
  return session;
}

function rectSummary(element) {
  if (!element?.getBoundingClientRect) return null;
  const rect = element.getBoundingClientRect();
  return {
    x: rounded(rect.x),
    y: rounded(rect.y),
    width: rounded(rect.width),
    height: rounded(rect.height),
  };
}

function styleSummary(element) {
  if (!element || typeof window === "undefined") return null;
  const style = window.getComputedStyle?.(element);
  if (!style) return null;
  return {
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    transform: style.transform,
    left: style.left,
    top: style.top,
    width: style.width,
    height: style.height,
    zIndex: style.zIndex,
    position: style.position,
    overflow: style.overflow,
    overflowX: style.overflowX,
    overflowY: style.overflowY,
    clipPath: style.clipPath,
    maskImage: style.maskImage,
    filter: style.filter,
    contain: style.contain,
    isolation: style.isolation,
    backfaceVisibility: style.backfaceVisibility,
  };
}

function elementLabel(element) {
  if (!element) return "none";
  const tag = String(element.tagName || "node").toLowerCase();
  const id = String(element.id || "").trim();
  const classes = String(element.className?.baseVal || element.className || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(".");
  const boundaryRole = element.getAttribute?.("data-cityreport-boundary-overlay") === "true"
    ? "[boundary]"
    : "";
  return `${tag}${id ? `#${id}` : ""}${classes ? `.${classes}` : ""}${boundaryRole}`;
}

function ancestorChainSummary(element, stopAt) {
  const chain = [];
  let current = element;
  while (current && chain.length < MAX_ANCESTOR_DEPTH) {
    const rect = rectSummary(current);
    const style = styleSummary(current);
    chain.push({
      label: elementLabel(current),
      connected: Boolean(current.isConnected),
      rect,
      style,
    });
    if (current === stopAt || current === document.body || current === document.documentElement) break;
    current = current.parentElement;
  }
  return chain;
}

function svgBoxSummary(element) {
  if (!element?.getBBox) return null;
  try {
    const box = element.getBBox();
    return {
      x: rounded(box.x),
      y: rounded(box.y),
      width: rounded(box.width),
      height: rounded(box.height),
    };
  } catch {
    return null;
  }
}

function shortHash(value) {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return `${text.length}:${Math.abs(hash)}`;
}

function writeClipboard(text) {
  if (navigator?.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand?.("copy");
  textarea.remove();
  return Promise.resolve();
}

function downloadTrace(trace) {
  const blob = new Blob([JSON.stringify(trace, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cityreport-boundary-trace-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function createHud({ onCopy, onClear, onDownload, onMark }) {
  const hud = document.createElement("div");
  hud.setAttribute("data-cityreport-boundary-debug-hud", "true");
  Object.assign(hud.style, {
    position: "fixed",
    top: "max(8px, env(safe-area-inset-top))",
    right: "8px",
    width: "min(310px, calc(100vw - 16px))",
    padding: "9px",
    border: "2px solid #22c55e",
    borderRadius: "8px",
    background: "rgba(8, 15, 28, 0.94)",
    color: "#f8fafc",
    font: "11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace",
    whiteSpace: "pre-wrap",
    zIndex: "2147483647",
    boxShadow: "0 5px 18px rgba(0, 0, 0, 0.35)",
  });

  const output = document.createElement("div");
  output.setAttribute("data-cityreport-boundary-debug-output", "true");
  output.textContent = "Boundary diagnostics starting...";
  hud.appendChild(output);

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    display: "flex",
    gap: "6px",
    marginTop: "7px",
  });
  [
    ["Mark flash", onMark],
    ["Copy trace", onCopy],
    ["Download", onDownload],
    ["Clear", onClear],
  ].forEach(([label, handler]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    Object.assign(button.style, {
      flex: "1",
      padding: "5px",
      border: "1px solid #64748b",
      borderRadius: "5px",
      background: "#1e293b",
      color: "#f8fafc",
      font: "inherit",
    });
    button.addEventListener("click", handler);
    actions.appendChild(button);
  });
  hud.appendChild(actions);
  document.body.appendChild(hud);
  return { hud, output };
}

export function createBoundaryFlashDiagnostics({ enabled, map, getState }) {
  if (!enabled || typeof window === "undefined" || typeof document === "undefined") {
    return {
      record: () => null,
      sampleFrames: () => {},
      destroy: () => {},
    };
  }

  const instanceStartedAt = performance.now();
  const session = getBoundaryFlashSession();
  const instanceId = session.nextInstanceId++;
  const trace = session.trace;
  const listeners = [];
  const observers = [];
  const cleanupCallbacks = [];
  const sampleFrames = new Set();
  const paneIds = new WeakMap();
  let nextPaneId = 1;
  let latestEntry = null;
  let hudParts = null;
  let gesturePhase = "idle";
  let intersectionRatio = null;
  let resizeSequence = 0;
  let lastHudRenderAt = -Infinity;
  let gestureFrame = null;
  let gestureSamplingUntil = 0;
  let gestureSamplingLabel = "idle";

  const paneId = (pane) => {
    if (!pane) return "none";
    if (!paneIds.has(pane)) paneIds.set(pane, nextPaneId++);
    return String(paneIds.get(pane));
  };

  const snapshot = () => {
    const state = getState?.() || {};
    const container = state.container || null;
    const overlayLayer = state.overlayLayer || null;
    const mapDiv = map?.getDiv?.() || null;
    const renderState = state.renderState || {};
    const shadePathData = state.shadePath?.getAttribute?.("d") || "";
    const borderPathData = state.borderPath?.getAttribute?.("d") || "";
    const containerStyle = styleSummary(container);
    const paneStyle = styleSummary(overlayLayer);
    const containerRect = rectSummary(container);
    const parentMatchesPane = Boolean(container && overlayLayer && container.parentNode === overlayLayer);
    const shadeOpacity = finiteNumber(state.shadePath?.getAttribute?.("fill-opacity"), 0);
    const borderStroke = String(state.borderPath?.getAttribute?.("stroke") || "");
    const ancestorChain = ancestorChainSummary(container, mapDiv);
    const hiddenAncestors = ancestorChain
      .filter((entry) => {
        if (entry.style?.display === "none") return true;
        if (entry.style?.visibility === "hidden") return true;
        if (opacityNumber(entry.style?.opacity) === 0) return true;
        if (!entry.rect) return true;
        const hasZeroDimension = entry.rect.width < 1 || entry.rect.height < 1;
        const clipsChildren = isClippingOverflow(entry.style?.overflow)
          || isClippingOverflow(entry.style?.overflowX)
          || isClippingOverflow(entry.style?.overflowY);
        return hasZeroDimension && clipsChildren;
      })
      .map((entry) => entry.label);
    const anomalies = [];

    if (!container?.isConnected) anomalies.push("container-detached");
    if (!parentMatchesPane) anomalies.push("wrong-or-replaced-pane");
    if (!containerRect || containerRect.width < 1 || containerRect.height < 1) anomalies.push("zero-size-container");
    if (containerStyle?.display === "none" || containerStyle?.visibility === "hidden" || opacityNumber(containerStyle?.opacity) === 0) {
      anomalies.push("container-hidden");
    }
    if (paneStyle?.display === "none" || paneStyle?.visibility === "hidden" || opacityNumber(paneStyle?.opacity) === 0) {
      anomalies.push("pane-hidden");
    }
    if (hiddenAncestors.length) anomalies.push(`hidden-ancestor:${hiddenAncestors.join("|")}`);
    if (renderState.showShade && (shadePathData.length < 10 || shadeOpacity <= 0)) anomalies.push("shade-empty");
    if (renderState.showBorder && (borderPathData.length < 10 || !borderStroke || borderStroke === "none")) {
      anomalies.push("border-empty");
    }

    return {
      connected: Boolean(container?.isConnected),
      parentMatchesPane,
      paneId: paneId(overlayLayer),
      currentParentPaneId: paneId(container?.parentNode),
      mapZoom: finiteNumber(map?.getZoom?.(), null),
      mapCenter: map?.getCenter?.()?.toJSON?.() || null,
      gesturePhase,
      documentVisibility: document.visibilityState,
      devicePixelRatio: finiteNumber(window.devicePixelRatio, 1),
      visualViewport: window.visualViewport ? {
        width: rounded(window.visualViewport.width),
        height: rounded(window.visualViewport.height),
        offsetLeft: rounded(window.visualViewport.offsetLeft),
        offsetTop: rounded(window.visualViewport.offsetTop),
        scale: rounded(window.visualViewport.scale),
      } : null,
      containerRect,
      paneRect: rectSummary(overlayLayer),
      mapRect: rectSummary(mapDiv),
      containerStyle,
      paneStyle,
      ancestorChain,
      hiddenAncestors,
      intersectionRatio,
      resizeSequence,
      svgSize: {
        width: state.svg?.getAttribute?.("width") || "",
        height: state.svg?.getAttribute?.("height") || "",
        rect: rectSummary(state.svg),
      },
      shade: {
        expected: Boolean(renderState.showShade),
        opacity: state.shadePath?.getAttribute?.("fill-opacity") || "",
        path: shortHash(shadePathData),
        box: svgBoxSummary(state.shadePath),
      },
      border: {
        expected: Boolean(renderState.showBorder),
        stroke: borderStroke,
        width: state.borderPath?.getAttribute?.("stroke-width") || "",
        path: shortHash(borderPathData),
        box: svgBoxSummary(state.borderPath),
      },
      pathRingCount: Math.max(0, (Array.isArray(renderState.paths) ? renderState.paths.length : 0) - 1),
      drawCount: finiteNumber(state.drawCount),
      requestedDrawCount: finiteNumber(state.requestedDrawCount),
      anomalies,
    };
  };

  const renderHud = (entry) => {
    if (!hudParts) return;
    const state = entry.state;
    const status = state.anomalies.length ? `ANOMALY: ${state.anomalies.join(", ")}` : "healthy";
    hudParts.hud.style.borderColor = state.anomalies.length ? "#ef4444" : "#22c55e";
    hudParts.output.textContent = [
      `Boundary diagnostics: ${status}`,
      "Reproduce flash, then tap Mark flash and Download.",
      `event: ${entry.event} phase=${state.gesturePhase}`,
      `pane: ${state.currentParentPaneId}/${state.paneId} attached=${state.connected}`,
      `box: ${state.containerRect?.width || 0}x${state.containerRect?.height || 0} at ${state.containerRect?.x || 0},${state.containerRect?.y || 0}`,
      `intersection: ${state.intersectionRatio ?? "n/a"} hidden ancestors=${state.hiddenAncestors.length}`,
      `shade: ${state.shade.path} opacity=${state.shade.opacity || "none"}`,
      `border: ${state.border.path} stroke=${state.border.stroke || "none"}`,
      `instance: ${instanceId} draws=${state.drawCount}/${state.requestedDrawCount}`,
      `trace: ${trace.length} anomalies=${session.anomalyCount}`,
    ].join("\n");
  };

  const record = (event, details = {}) => {
    const state = snapshot();
    const entry = {
      sequence: ++session.sequence,
      instanceId,
      timestamp: new Date().toISOString(),
      elapsedMs: rounded(performance.now() - session.startedAt),
      instanceElapsedMs: rounded(performance.now() - instanceStartedAt),
      event: String(event || "unknown"),
      details,
      state,
    };
    if (state.anomalies.length) session.anomalyCount += 1;
    trace.push(entry);
    if (trace.length > MAX_TRACE_ENTRIES) trace.splice(0, trace.length - MAX_TRACE_ENTRIES);
    latestEntry = entry;
    window[TRACE_WINDOW_KEY] = trace;
    const now = performance.now();
    if (!entry.event.startsWith("frame:") || now - lastHudRenderAt >= 100 || state.anomalies.length) {
      renderHud(entry);
      lastHudRenderAt = now;
    }
    if (state.anomalies.length) console.warn("[boundary flash diagnostic]", entry);
    return entry;
  };

  const startFrameSampling = (label, durationMs = 900, { everyFrame = false } = {}) => {
    const started = performance.now();
    let lastSignature = "";
    let lastRecordedAt = -Infinity;
    let frame = null;
    const tick = (now) => {
      if (frame !== null) sampleFrames.delete(frame);
      const state = snapshot();
      const signature = JSON.stringify({
        connected: state.connected,
        parentMatchesPane: state.parentMatchesPane,
        paneId: state.paneId,
        currentParentPaneId: state.currentParentPaneId,
        containerRect: state.containerRect,
        containerStyle: state.containerStyle,
        paneStyle: state.paneStyle,
        ancestorChain: state.ancestorChain,
        svgSize: state.svgSize,
        shade: state.shade,
        border: state.border,
        anomalies: state.anomalies,
      });
      if (everyFrame || signature !== lastSignature || now - lastRecordedAt >= 120) {
        record(`frame:${label}`, {
          frameElapsedMs: rounded(now - started),
          frameMode: everyFrame ? "every-frame" : "changes",
        });
        lastSignature = signature;
        lastRecordedAt = now;
      }
      if (now - started < durationMs) {
        frame = window.requestAnimationFrame(tick);
        sampleFrames.add(frame);
      }
    };
    frame = window.requestAnimationFrame(tick);
    sampleFrames.add(frame);
  };

  const startGestureSampling = (label, durationMs, { settle = false } = {}) => {
    const now = performance.now();
    gestureSamplingLabel = label;
    gestureSamplingUntil = settle
      ? now + durationMs
      : Math.max(gestureSamplingUntil, now + durationMs);
    if (gestureFrame !== null) return;

    const tick = (frameNow) => {
      if (gestureFrame !== null) sampleFrames.delete(gestureFrame);
      record("frame:gesture", {
        label: gestureSamplingLabel,
        frameMode: "every-frame",
      });
      if (frameNow < gestureSamplingUntil) {
        gestureFrame = window.requestAnimationFrame(tick);
        sampleFrames.add(gestureFrame);
      } else {
        gestureFrame = null;
      }
    };
    gestureFrame = window.requestAnimationFrame(tick);
    sampleFrames.add(gestureFrame);
  };

  const clear = () => {
    trace.length = 0;
    session.anomalyCount = 0;
    session.sequence = 0;
    session.startedAt = performance.now();
    record("trace:cleared");
  };
  const copy = async () => {
    await writeClipboard(JSON.stringify(trace, null, 2));
    record("trace:copied", { entries: trace.length });
  };
  const markFlash = () => {
    record("manual:flash-marked", { traceEntriesBeforeMark: trace.length });
    startFrameSampling("flash-mark", 1800, { everyFrame: true });
  };

  hudParts = createHud({
    onCopy: () => copy().catch((error) => record("trace:copy-failed", { message: String(error?.message || error) })),
    onClear: clear,
    onDownload: () => downloadTrace(trace),
    onMark: markFlash,
  });

  const eventNames = ["dragstart", "drag", "dragend", "bounds_changed", "idle", "zoom_changed", "tilesloaded"];
  eventNames.forEach((eventName) => {
    const listener = map?.addListener?.(eventName, () => {
      if (eventName === "dragstart") {
        gesturePhase = "dragging";
        startGestureSampling("drag", 30000);
      } else if (eventName === "dragend") {
        gesturePhase = "settling";
        startGestureSampling("drag-settle", 1800, { settle: true });
      } else if (eventName === "zoom_changed") {
        if (gesturePhase !== "dragging") gesturePhase = "zooming";
        startGestureSampling("zoom", 2200);
      } else if (eventName === "idle") {
        gesturePhase = "idle";
        startGestureSampling("idle-settle", 1200, { settle: true });
      }
      record(`map:${eventName}`);
    });
    if (listener) listeners.push(listener);
  });

  const initialState = getState?.() || {};
  const initialContainer = initialState.container || null;
  const mapDiv = map?.getDiv?.() || null;
  if (mapDiv && typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver((mutations) => {
      const currentContainer = getState?.()?.container || initialContainer;
      const relevantMutations = mutations.filter((mutation) => {
        const target = mutation.target;
        if (target === currentContainer || target?.contains?.(currentContainer)) return true;
        return [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])]
          .some((node) => node === currentContainer || node?.contains?.(currentContainer));
      });
      if (!relevantMutations.length) return;
      record("dom:boundary-ancestry-mutation", {
        mutations: relevantMutations.slice(0, 20).map((mutation) => ({
          type: mutation.type,
          target: elementLabel(mutation.target),
          attributeName: mutation.attributeName || "",
          added: mutation.addedNodes?.length || 0,
          removed: mutation.removedNodes?.length || 0,
        })),
      });
    });
    observer.observe(mapDiv, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden"],
    });
    observers.push(observer);
  }

  if (initialContainer && typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver((entries) => {
      const entry = entries.at(-1);
      intersectionRatio = entry ? rounded(entry.intersectionRatio) : null;
      record("observer:intersection", {
        isIntersecting: Boolean(entry?.isIntersecting),
        intersectionRatio,
        intersectionRect: entry?.intersectionRect ? {
          x: rounded(entry.intersectionRect.x),
          y: rounded(entry.intersectionRect.y),
          width: rounded(entry.intersectionRect.width),
          height: rounded(entry.intersectionRect.height),
        } : null,
      });
    });
    observer.observe(initialContainer);
    observers.push(observer);
  }

  if (typeof ResizeObserver !== "undefined") {
    const targets = [mapDiv, initialState.overlayLayer, initialContainer].filter(Boolean);
    const observer = new ResizeObserver((entries) => {
      resizeSequence += 1;
      record("observer:resize", {
        targets: entries.map((entry) => ({
          target: elementLabel(entry.target),
          width: rounded(entry.contentRect?.width),
          height: rounded(entry.contentRect?.height),
        })),
      });
    });
    targets.forEach((target) => observer.observe(target));
    observers.push(observer);
  }

  const recordViewportEvent = (event) => record(`viewport:${event.type}`);
  window.visualViewport?.addEventListener?.("resize", recordViewportEvent);
  window.visualViewport?.addEventListener?.("scroll", recordViewportEvent);
  document.addEventListener("visibilitychange", recordViewportEvent);
  cleanupCallbacks.push(() => {
    window.visualViewport?.removeEventListener?.("resize", recordViewportEvent);
    window.visualViewport?.removeEventListener?.("scroll", recordViewportEvent);
    document.removeEventListener("visibilitychange", recordViewportEvent);
  });

  const controller = {
    clear,
    copy,
    download: () => downloadTrace(trace),
    markFlash,
    snapshot: () => record("manual:snapshot"),
    getLatest: () => latestEntry,
    getTrace: () => [...trace],
  };
  window[CONTROLLER_WINDOW_KEY] = controller;
  window[TRACE_WINDOW_KEY] = trace;
  record("diagnostics:ready");
  startFrameSampling("startup", 500);

  return {
    record,
    sampleFrames: startFrameSampling,
    destroy: () => {
      record("diagnostics:destroy");
      listeners.forEach((listener) => listener?.remove?.());
      observers.forEach((observer) => observer.disconnect());
      cleanupCallbacks.forEach((cleanup) => cleanup());
      sampleFrames.forEach((frame) => window.cancelAnimationFrame(frame));
      hudParts?.hud?.remove();
      if (window[CONTROLLER_WINDOW_KEY] === controller) delete window[CONTROLLER_WINDOW_KEY];
    },
  };
}
