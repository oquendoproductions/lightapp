import {
  MAP_UI_ICON_RENDER_MODE,
  normalizeMapUiIconRenderMode,
} from "./mapUiIconRuntimeCoreSupport.js";

export const DOMAIN_ICON_TINT_MODE = Object.freeze({
  DEFAULT: "default",
  AUTO_CONTRAST: "auto_contrast",
  CUSTOM: "custom",
});

export const DOMAIN_ICON_TINT_MODE_OPTIONS = Object.freeze([
  {
    key: DOMAIN_ICON_TINT_MODE.AUTO_CONTRAST,
    label: "Auto Contrast",
    description: "Automatically uses a light or dark icon tint based on the marker color.",
  },
  {
    key: DOMAIN_ICON_TINT_MODE.CUSTOM,
    label: "Custom Tint",
    description: "Use a custom marker icon tint color for this tenant and domain.",
  },
  {
    key: DOMAIN_ICON_TINT_MODE.DEFAULT,
    label: "Default Monochrome",
    description: "Keep the legacy dark monochrome icon treatment inside the marker.",
  },
]);

export function sanitizeHexColor(value, fallback = "#111111") {
  const candidate = String(value || "").trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(candidate)) {
    return candidate.length === 4
      ? `#${candidate[1]}${candidate[1]}${candidate[2]}${candidate[2]}${candidate[3]}${candidate[3]}`.toLowerCase()
      : candidate.toLowerCase();
  }
  const normalizedFallback = String(fallback || "").trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizedFallback)) {
    return normalizedFallback.length === 4
      ? `#${normalizedFallback[1]}${normalizedFallback[1]}${normalizedFallback[2]}${normalizedFallback[2]}${normalizedFallback[3]}${normalizedFallback[3]}`.toLowerCase()
      : normalizedFallback.toLowerCase();
  }
  return "#111111";
}

export function normalizeDomainIconRenderMode(value, fallbackSrc = "") {
  return normalizeMapUiIconRenderMode(value, fallbackSrc);
}

export function normalizeDomainIconTintMode(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === DOMAIN_ICON_TINT_MODE.AUTO_CONTRAST) return DOMAIN_ICON_TINT_MODE.AUTO_CONTRAST;
  if (key === DOMAIN_ICON_TINT_MODE.CUSTOM) return DOMAIN_ICON_TINT_MODE.CUSTOM;
  return DOMAIN_ICON_TINT_MODE.DEFAULT;
}

export function normalizeDomainIconTintColor(value, fallback = "") {
  const trimmedFallback = String(fallback || "").trim();
  if (!String(value || "").trim()) {
    return trimmedFallback ? sanitizeHexColor(trimmedFallback, "#111111") : "";
  }
  return sanitizeHexColor(value, trimmedFallback || "#111111");
}

export function isTintableDomainRenderMode(renderMode) {
  return normalizeDomainIconRenderMode(renderMode) === MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG;
}

function hexToRgb(hex) {
  const normalized = sanitizeHexColor(hex, "#111111");
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function srgbToLinear(channel) {
  const value = Number(channel || 0) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function inferAutoContrastDomainIconTint(markerColor) {
  const { r, g, b } = hexToRgb(markerColor);
  const luminance =
    (0.2126 * srgbToLinear(r)) +
    (0.7152 * srgbToLinear(g)) +
    (0.0722 * srgbToLinear(b));
  return luminance < 0.42 ? "#ffffff" : "#10243d";
}

export function resolveDomainMarkerIconTintColor({
  renderMode,
  tintMode,
  tintColor,
  markerColor,
}) {
  if (!isTintableDomainRenderMode(renderMode)) return "";
  const normalizedTintMode = normalizeDomainIconTintMode(tintMode);
  if (normalizedTintMode === DOMAIN_ICON_TINT_MODE.CUSTOM) {
    return normalizeDomainIconTintColor(tintColor, inferAutoContrastDomainIconTint(markerColor));
  }
  if (normalizedTintMode === DOMAIN_ICON_TINT_MODE.AUTO_CONTRAST) {
    return inferAutoContrastDomainIconTint(markerColor);
  }
  return "#111111";
}
