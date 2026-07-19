const TRACE_WINDOW_KEY = "__CITYREPORT_BOUNDARY_FLASH_TRACE__";
const CONTROLLER_WINDOW_KEY = "__CITYREPORT_BOUNDARY_FLASH_DEBUG__";
const MAX_TRACE_ENTRIES = 600;

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
  };
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

function createHud({ onCopy, onClear, onDownload }) {
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

  const startedAt = performance.now();
  const trace = [];
  const listeners = [];
  const observers = [];
  const sampleFrames = new Set();
  const paneIds = new WeakMap();
  let nextPaneId = 1;
  let sequence = 0;
  let anomalyCount = 0;
  let latestEntry = null;
  let hudParts = null;

  const paneId = (pane) => {
    if (!pane) return "none";
    if (!paneIds.has(pane)) paneIds.set(pane, nextPaneId++);
    return String(paneIds.get(pane));
  };

  const snapshot = () => {
    const state = getState?.() || {};
    const container = state.container || null;
    const overlayLayer = state.overlayLayer || null;
    const renderState = state.renderState || {};
    const shadePathData = state.shadePath?.getAttribute?.("d") || "";
    const borderPathData = state.borderPath?.getAttribute?.("d") || "";
    const containerStyle = styleSummary(container);
    const paneStyle = styleSummary(overlayLayer);
    const containerRect = rectSummary(container);
    const parentMatchesPane = Boolean(container && overlayLayer && container.parentNode === overlayLayer);
    const shadeOpacity = finiteNumber(state.shadePath?.getAttribute?.("fill-opacity"), 0);
    const borderStroke = String(state.borderPath?.getAttribute?.("stroke") || "");
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
      containerRect,
      paneRect: rectSummary(overlayLayer),
      containerStyle,
      paneStyle,
      svgSize: {
        width: state.svg?.getAttribute?.("width") || "",
        height: state.svg?.getAttribute?.("height") || "",
      },
      shade: {
        expected: Boolean(renderState.showShade),
        opacity: state.shadePath?.getAttribute?.("fill-opacity") || "",
        path: shortHash(shadePathData),
      },
      border: {
        expected: Boolean(renderState.showBorder),
        stroke: borderStroke,
        width: state.borderPath?.getAttribute?.("stroke-width") || "",
        path: shortHash(borderPathData),
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
      `event: ${entry.event}`,
      `pane: ${state.currentParentPaneId}/${state.paneId} attached=${state.connected}`,
      `box: ${state.containerRect?.width || 0}x${state.containerRect?.height || 0} at ${state.containerRect?.x || 0},${state.containerRect?.y || 0}`,
      `shade: ${state.shade.path} opacity=${state.shade.opacity || "none"}`,
      `border: ${state.border.path} stroke=${state.border.stroke || "none"}`,
      `draws: ${state.drawCount}/${state.requestedDrawCount} trace=${trace.length} anomalies=${anomalyCount}`,
    ].join("\n");
  };

  const record = (event, details = {}) => {
    const state = snapshot();
    const entry = {
      sequence: ++sequence,
      timestamp: new Date().toISOString(),
      elapsedMs: rounded(performance.now() - startedAt),
      event: String(event || "unknown"),
      details,
      state,
    };
    if (state.anomalies.length) anomalyCount += 1;
    trace.push(entry);
    if (trace.length > MAX_TRACE_ENTRIES) trace.splice(0, trace.length - MAX_TRACE_ENTRIES);
    latestEntry = entry;
    window[TRACE_WINDOW_KEY] = trace;
    renderHud(entry);
    if (state.anomalies.length) console.warn("[boundary flash diagnostic]", entry);
    return entry;
  };

  const startFrameSampling = (label, durationMs = 900) => {
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
        svgSize: state.svgSize,
        shade: state.shade,
        border: state.border,
        anomalies: state.anomalies,
      });
      if (signature !== lastSignature || now - lastRecordedAt >= 120) {
        record(`frame:${label}`, { frameElapsedMs: rounded(now - started) });
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

  const clear = () => {
    trace.length = 0;
    anomalyCount = 0;
    sequence = 0;
    record("trace:cleared");
  };
  const copy = async () => {
    await writeClipboard(JSON.stringify(trace, null, 2));
    record("trace:copied", { entries: trace.length });
  };

  hudParts = createHud({
    onCopy: () => copy().catch((error) => record("trace:copy-failed", { message: String(error?.message || error) })),
    onClear: clear,
    onDownload: () => downloadTrace(trace),
  });

  const eventNames = ["dragstart", "drag", "dragend", "bounds_changed", "idle", "zoom_changed", "tilesloaded"];
  eventNames.forEach((eventName) => {
    const listener = map?.addListener?.(eventName, () => {
      record(`map:${eventName}`);
      if (eventName === "dragstart" || eventName === "dragend" || eventName === "idle") {
        startFrameSampling(eventName);
      }
    });
    if (listener) listeners.push(listener);
  });

  const initialState = getState?.() || {};
  if (initialState.overlayLayer && typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver((mutations) => {
      record("dom:pane-mutation", {
        mutations: mutations.map((mutation) => ({
          type: mutation.type,
          added: mutation.addedNodes?.length || 0,
          removed: mutation.removedNodes?.length || 0,
        })),
      });
      startFrameSampling("pane-mutation", 300);
    });
    observer.observe(initialState.overlayLayer, { childList: true });
    observers.push(observer);
  }

  const controller = {
    clear,
    copy,
    download: () => downloadTrace(trace),
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
      sampleFrames.forEach((frame) => window.cancelAnimationFrame(frame));
      hudParts?.hud?.remove();
      if (window[CONTROLLER_WINDOW_KEY] === controller) delete window[CONTROLLER_WINDOW_KEY];
    },
  };
}
