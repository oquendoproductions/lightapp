export const REPORTING_MIN_ZOOM = 17;
export const MARKER_POPUP_CARD_Y_OFFSET = 40;
export const MARKER_POPUP_ANCHOR_GAP = 44;

export const STREETLIGHT_UTILITY_REPORT_URL =
  String(import.meta.env.VITE_STREETLIGHT_UTILITY_REPORT_URL || "").trim()
  || "https://www.firstenergycorp.com/outages_help/Report_Power_Outages.html?_gl=1*te1hi8*_up*MQ..*_ga*MTEyODI2NTQ5OS4xNzcyMjU3MDQ4*_ga_TVQJK7Z44E*czE3NzI0Mzc3NzEkbzIkZzEkdDE3NzI0Mzc3ODQkajQ3JGwwJGgw";

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function resolveMarkerPopupPlacementShared(pixel, options = {}) {
  const x = Number(pixel?.x);
  const y = Number(pixel?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return {
      frameStyle: { display: "none" },
      arrowStyle: { display: "none" },
    };
  }

  const viewportW = Number(
    options?.viewportWidth
      ?? (typeof window !== "undefined" ? window.innerWidth : 0)
      ?? 0
  );
  const viewportH = Number(
    options?.viewportHeight
      ?? (typeof window !== "undefined" ? window.innerHeight : 0)
      ?? 0
  );
  const estimatedHeight = Number(options?.estimatedHeight || 320);
  const maxWidth = Number(options?.maxWidth || 280);
  const useAppShellLayout = options?.useAppShellLayout === true;
  const width = Math.min(maxWidth, Math.max(210, (viewportW || 360) - 20));
  const topSafe = useAppShellLayout ? 150 : 102;
  const bottomSafe = useAppShellLayout ? 92 : 20;
  // Start from the currently deployed card position and move it exactly 40px
  // up. Keep that translation independent from the restored pointer geometry.
  const anchorGap = MARKER_POPUP_ANCHOR_GAP;
  const usableBottom = Math.max(topSafe + 120, (viewportH || 720) - bottomSafe);
  const clampedX = clamp(x, 10 + width / 2, Math.max(10 + width / 2, (viewportW || 360) - 10 - width / 2));
  const frameLeft = clampedX - (width / 2);
  const arrowLeft = clamp(x - frameLeft, 18, width - 18);
  const fitsAbove = y - estimatedHeight - anchorGap - MARKER_POPUP_CARD_Y_OFFSET >= topSafe;
  const fitsBelow = y + estimatedHeight + anchorGap - MARKER_POPUP_CARD_Y_OFFSET <= usableBottom;
  const placeBelow = !fitsAbove && (fitsBelow || y < (viewportH || 720) / 2);
  const top = placeBelow
    ? clamp(y + anchorGap - MARKER_POPUP_CARD_Y_OFFSET, topSafe + 8, Math.max(topSafe + 8, usableBottom - estimatedHeight))
    : clamp(y - anchorGap - MARKER_POPUP_CARD_Y_OFFSET, topSafe + estimatedHeight, usableBottom);

  return {
    frameStyle: {
      position: "absolute",
      left: clampedX,
      top,
      transform: placeBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
      zIndex: 2600,
      pointerEvents: "auto",
      width,
      maxWidth: "calc(100vw - 20px)",
      maxHeight: `min(430px, ${Math.max(160, Math.round(usableBottom - topSafe - 18))}px)`,
    },
    arrowStyle: placeBelow
      ? {
          position: "absolute",
          left: arrowLeft,
          top: -7,
          width: 12,
          height: 12,
          background: "var(--sl-ui-modal-bg)",
          borderLeft: "1px solid var(--sl-ui-modal-border)",
          borderTop: "1px solid var(--sl-ui-modal-border)",
          transform: "translateX(-50%) rotate(45deg)",
        }
      : {
          position: "absolute",
          left: arrowLeft,
          bottom: -7,
          width: 12,
          height: 12,
          background: "var(--sl-ui-modal-bg)",
          borderRight: "1px solid var(--sl-ui-modal-border)",
          borderBottom: "1px solid var(--sl-ui-modal-border)",
          transform: "translateX(-50%) rotate(45deg)",
        },
  };
}
