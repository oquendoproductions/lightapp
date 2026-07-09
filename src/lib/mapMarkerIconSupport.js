import { MAP_UI_ICON_RENDER_MODE } from "../mapUiIconRuntimeCoreSupport.js";
import { normalizeDomainIconRenderMode } from "../domainIconRendering";
export {
  INCIDENT_CLUSTER_MAX_ZOOM,
  INCIDENT_DOMAIN_ICON_SIZE,
  INCIDENT_STACK_LOCATION_DECIMALS,
  MAP_MARKER_CENTER,
  MAP_MARKER_GLYPH_HALO_BLUR,
  MAP_MARKER_GLYPH_SIZE,
  MAP_MARKER_HALO_COLOR,
  MAP_MARKER_RADIUS,
  MAP_MARKER_SIZE,
  MAP_MARKER_STROKE,
  MAP_MARKER_SVG_GLYPH_INSET,
  STREET_SIGN_MARKER_SIZE,
} from "./mapMarkerSharedConfig.js";
import {
  MAP_MARKER_CENTER,
  MAP_MARKER_GLYPH_HALO_BLUR,
  MAP_MARKER_GLYPH_SIZE,
  MAP_MARKER_HALO_COLOR,
  MAP_MARKER_RADIUS,
  MAP_MARKER_SIZE,
  MAP_MARKER_STROKE,
  MAP_MARKER_SVG_GLYPH_INSET,
  STREET_SIGN_MARKER_SIZE,
} from "./mapMarkerSharedConfig.js";

export function svgDotDataUrl(fill = "#111", radius = 7) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
      <circle cx="10" cy="10" r="${radius}" fill="${fill}" stroke="${radius}" stroke-width="2"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function isInlineSvgDataUrl(src = "") {
  const value = String(src || "").trim().toLowerCase();
  return value.startsWith("data:image/svg+xml");
}

export function isSvgGlyphSource(src = "") {
  const value = String(src || "").trim().toLowerCase();
  if (!value) return false;
  if (isInlineSvgDataUrl(value)) return true;
  return /\.svg(?:[?#].*)?$/i.test(value);
}

export function containRect(srcWidth, srcHeight, destWidth, destHeight) {
  const sw = Number(srcWidth);
  const sh = Number(srcHeight);
  const dw = Number(destWidth);
  const dh = Number(destHeight);
  if (!(sw > 0) || !(sh > 0) || !(dw > 0) || !(dh > 0)) {
    return { x: 0, y: 0, width: Math.max(0, dw), height: Math.max(0, dh) };
  }
  const scale = Math.min(dw / sw, dh / sh);
  const width = sw * scale;
  const height = sh * scale;
  return {
    x: (dw - width) / 2,
    y: (dh - height) / 2,
    width,
    height,
  };
}

export function gmapsDotIcon(color = "#1976d2", ringColor = "white", glyph = "💡", glyphSrc = "", options = {}) {
  const fill = color || "#1976d2";
  const ring = ringColor || "white";
  const glyphText = String(glyph || "💡");
  const glyphSource = String(glyphSrc || "").trim();
  const renderMode = normalizeDomainIconRenderMode(options?.renderMode, glyphSource);
  const glyphColor = String(options?.glyphColor || "#111").trim() || "#111";
  const resolvedGlyphSource = (() => {
    if (!glyphSource) return "";
    if (/^(https?:|data:)/i.test(glyphSource)) return glyphSource;
    if (glyphSource.startsWith("/") && typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${glyphSource}`;
    }
    return glyphSource;
  })();
  const textY = Number.isFinite(Number(options?.glyphTextY)) ? Number(options.glyphTextY) : 16;
  const textSize = Number.isFinite(Number(options?.glyphTextSize)) ? Number(options.glyphTextSize) : 15;
  const hideFallbackGlyphWhenSourcePresent = options?.hideFallbackGlyphWhenSourcePresent === true;
  const googleMaps = window.google?.maps;
  const renderScale =
    typeof window !== "undefined"
      ? Math.max(1, Math.min(4, Number(window.devicePixelRatio || 1) || 1))
      : 1;

  let glyphImage = null;
  if (resolvedGlyphSource && typeof window !== "undefined") {
    gmapsDotIcon._imgCache ||= new Map();
    let image = gmapsDotIcon._imgCache.get(resolvedGlyphSource);
    if (!image) {
      image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.src = resolvedGlyphSource;
      gmapsDotIcon._imgCache.set(resolvedGlyphSource, image);
    }
    if (image.complete && image.naturalWidth > 0) glyphImage = image;
  }

  const usingImageGlyph = Boolean(glyphImage);
  const cacheKey = `${fill}|${ring}|${glyphText}|${resolvedGlyphSource}|${renderMode}|${glyphColor}|${MAP_MARKER_SIZE}|${MAP_MARKER_RADIUS}|${MAP_MARKER_STROKE}|${MAP_MARKER_GLYPH_SIZE}|${textY}|${textSize}|${usingImageGlyph ? "img" : "txt"}|scale:${renderScale}|${googleMaps ? "g" : "nog"}`;
  gmapsDotIcon._cache ||= new Map();
  if (gmapsDotIcon._cache.has(cacheKey)) return gmapsDotIcon._cache.get(cacheKey);

  let url = "";
  if (usingImageGlyph && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(MAP_MARKER_SIZE * renderScale);
    canvas.height = Math.round(MAP_MARKER_SIZE * renderScale);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      try {
        ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.beginPath();
        ctx.arc(MAP_MARKER_CENTER, MAP_MARKER_CENTER, MAP_MARKER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = MAP_MARKER_STROKE;
        ctx.strokeStyle = ring;
        ctx.stroke();
        const glyphInset = isSvgGlyphSource(resolvedGlyphSource) ? MAP_MARKER_SVG_GLYPH_INSET : 6;
        const destBoxSize = MAP_MARKER_SIZE - glyphInset * 2;
        const destFit = containRect(glyphImage.naturalWidth, glyphImage.naturalHeight, destBoxSize, destBoxSize);
        const imgX = glyphInset + destFit.x;
        const imgY = glyphInset + destFit.y;
        const imgW = destFit.width;
        const imgH = destFit.height;
        let glyphCanvas = null;
        let glyphCtx = null;
        if (renderMode === MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG) {
          glyphCanvas = document.createElement("canvas");
          glyphCanvas.width = Math.max(1, Math.round(destBoxSize * renderScale));
          glyphCanvas.height = Math.max(1, Math.round(destBoxSize * renderScale));
          glyphCtx = glyphCanvas.getContext("2d");
        }
        ctx.save();
        ctx.shadowColor = MAP_MARKER_HALO_COLOR;
        ctx.shadowBlur = MAP_MARKER_GLYPH_HALO_BLUR;
        if (glyphCtx && glyphCanvas) {
          glyphCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
          glyphCtx.imageSmoothingEnabled = true;
          glyphCtx.imageSmoothingQuality = "high";
          glyphCtx.clearRect(0, 0, destBoxSize, destBoxSize);
          glyphCtx.drawImage(glyphImage, 0, 0, glyphImage.naturalWidth, glyphImage.naturalHeight, destFit.x, destFit.y, imgW, imgH);
          glyphCtx.globalCompositeOperation = "source-in";
          glyphCtx.fillStyle = glyphColor;
          glyphCtx.fillRect(0, 0, destBoxSize, destBoxSize);
          glyphCtx.globalCompositeOperation = "source-over";
          ctx.drawImage(glyphCanvas, glyphInset, glyphInset, destBoxSize, destBoxSize);
        } else {
          ctx.drawImage(glyphImage, 0, 0, glyphImage.naturalWidth, glyphImage.naturalHeight, imgX, imgY, imgW, imgH);
        }
        ctx.restore();
        if (glyphCanvas) {
          ctx.drawImage(glyphCanvas, glyphInset, glyphInset, destBoxSize, destBoxSize);
        } else {
          ctx.drawImage(glyphImage, 0, 0, glyphImage.naturalWidth, glyphImage.naturalHeight, imgX, imgY, imgW, imgH);
        }
        url = canvas.toDataURL("image/png");
      } catch {
        url = "";
      }
    }
  }

  const fallbackGlyph = hideFallbackGlyphWhenSourcePresent && resolvedGlyphSource ? "" : glyphText;
  if (!url) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${MAP_MARKER_SIZE}" height="${MAP_MARKER_SIZE}" viewBox="0 0 ${MAP_MARKER_SIZE} ${MAP_MARKER_SIZE}">
        <circle cx="${MAP_MARKER_CENTER}" cy="${MAP_MARKER_CENTER}" r="${MAP_MARKER_RADIUS}" fill="${fill}" stroke="${ring}" stroke-width="${MAP_MARKER_STROKE}" />
        ${fallbackGlyph && fallbackGlyph !== "📍" ? `<text x="${MAP_MARKER_CENTER}" y="${textY}" text-anchor="middle" dominant-baseline="central" font-size="${textSize}" fill="${glyphColor}" stroke="${MAP_MARKER_HALO_COLOR}" stroke-width="2.2" paint-order="stroke fill" stroke-linejoin="round">${fallbackGlyph}</text>` : ""}
      </svg>
    `.trim();
    url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  if (!googleMaps) return { url };
  const icon = {
    url,
    scaledSize: new googleMaps.Size(MAP_MARKER_SIZE, MAP_MARKER_SIZE),
    anchor: new googleMaps.Point(MAP_MARKER_CENTER, MAP_MARKER_CENTER),
  };
  gmapsDotIcon._cache.set(cacheKey, icon);
  return icon;
}

export function gmapsImageIcon(src = "", size = STREET_SIGN_MARKER_SIZE, opts = {}) {
  const raw = String(src || "").trim();
  if (!raw) return gmapsDotIcon();
  const border = Boolean(opts?.border);
  const borderColor = String(opts?.borderColor || "#39ff14");
  const borderWidth = Number(opts?.borderWidth || 3);
  const halo = opts?.halo !== false;
  const haloColor = String(opts?.haloColor || MAP_MARKER_HALO_COLOR);
  const haloBlur = Number(opts?.haloBlur || MAP_MARKER_GLYPH_HALO_BLUR);
  const resolved = (() => {
    if (/^(https?:|data:)/i.test(raw)) return raw;
    if (raw.startsWith("/") && typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${raw}`;
    }
    return raw;
  })();
  const googleMaps = window.google?.maps;
  const px = Number(size) > 0 ? Number(size) : STREET_SIGN_MARKER_SIZE;
  const renderScale =
    typeof window !== "undefined"
      ? Math.max(1, Math.min(3, Number(window.devicePixelRatio || 1) || 1))
      : 1;
  let composedUrl = "";
  let finalSize = px;
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    gmapsImageIcon._imgCache ||= new Map();
    let image = gmapsImageIcon._imgCache.get(resolved);
    if (!image) {
      image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.src = resolved;
      gmapsImageIcon._imgCache.set(resolved, image);
    }
    if (image.complete && image.naturalWidth > 0) {
      const cacheKey = `${resolved}|${px}|border:${border ? 1 : 0}|${borderColor}|${borderWidth}|halo:${halo ? 1 : 0}|${haloColor}|${haloBlur}|scale:${renderScale}`;
      gmapsImageIcon._compositeCache ||= new Map();
      if (gmapsImageIcon._compositeCache.has(cacheKey)) {
        const cached = gmapsImageIcon._compositeCache.get(cacheKey);
        composedUrl = cached?.url || "";
        finalSize = Number(cached?.size || px) || px;
      } else {
        const pad = Math.max(4, halo ? Math.ceil(haloBlur) + 3 : 0, border ? Math.ceil(borderWidth) + 3 : 0);
        const canvasSize = px + pad * 2;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(canvasSize * renderScale);
        canvas.height = Math.round(canvasSize * renderScale);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          try {
            ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            const x = pad;
            const y = pad;
            if (halo) {
              ctx.save();
              ctx.shadowColor = haloColor;
              ctx.shadowBlur = haloBlur;
              ctx.drawImage(image, x, y, px, px);
              ctx.restore();
            }
            ctx.drawImage(image, x, y, px, px);
            if (border) {
              const cx = canvasSize / 2;
              const cy = canvasSize / 2;
              const radius = (px / 2) + 1;
              ctx.beginPath();
              ctx.arc(cx, cy, radius, 0, Math.PI * 2);
              ctx.strokeStyle = borderColor;
              ctx.lineWidth = Math.max(2, borderWidth);
              ctx.stroke();
            }
            composedUrl = canvas.toDataURL("image/png");
            finalSize = canvasSize;
            gmapsImageIcon._compositeCache.set(cacheKey, { url: composedUrl, size: finalSize });
          } catch {
            composedUrl = "";
            finalSize = px;
          }
        }
      }
    }
  }

  const finalUrl = composedUrl || resolved;
  const anchor = finalSize / 2;
  if (!googleMaps) return { url: finalUrl };
  return {
    url: finalUrl,
    scaledSize: new googleMaps.Size(finalSize, finalSize),
    anchor: new googleMaps.Point(anchor, anchor),
  };
}

export function gmapsCountBadgeIcon(count = 0, opts = {}) {
  const value = Math.max(0, Number(count || 0));
  const label = value > 99 ? "99+" : String(value || 0);
  const fill = String(opts?.fill || "#17314f");
  const ring = String(opts?.ring || "#ffffff");
  const size = Number(opts?.size || Math.max(MAP_MARKER_SIZE + 4, 34));
  const radius = Number(opts?.radius || Math.max(12.5, size * 0.36));
  const center = size / 2;
  const fontSize = label.length >= 3 ? 11 : 12.5;
  const googleMaps = window.google?.maps;
  const cacheKey = `${label}|${fill}|${ring}|${size}|${radius}`;
  gmapsCountBadgeIcon._cache ||= new Map();
  if (gmapsCountBadgeIcon._cache.has(cacheKey)) return gmapsCountBadgeIcon._cache.get(cacheKey);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="${fill}" stroke="${ring}" stroke-width="2.8" />
      <text x="${center}" y="${center + 0.8}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="800" fill="#ffffff" stroke="rgba(0,0,0,0.28)" stroke-width="0.7" paint-order="stroke fill">${label}</text>
    </svg>
  `.trim();
  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  if (!googleMaps) return { url };
  const icon = {
    url,
    scaledSize: new googleMaps.Size(size, size),
    anchor: new googleMaps.Point(center, center),
  };
  gmapsCountBadgeIcon._cache.set(cacheKey, icon);
  return icon;
}

export function drawTintedMarkerGlyphOnCanvas(ctx, glyphImg, x, y, glyphSize, glyphColor = "#111111") {
  if (!ctx || !glyphImg || !(glyphImg.complete && glyphImg.naturalWidth > 0)) return false;
  const destBoxSize = Math.max(1, Math.round(glyphSize));
  const glyphCanvas = document.createElement("canvas");
  glyphCanvas.width = destBoxSize;
  glyphCanvas.height = destBoxSize;
  const glyphCtx = glyphCanvas.getContext("2d");
  if (!glyphCtx) return false;

  const srcW = Math.max(1, Number(glyphImg.naturalWidth || glyphImg.width || 0));
  const srcH = Math.max(1, Number(glyphImg.naturalHeight || glyphImg.height || 0));
  const scale = Math.min(destBoxSize / srcW, destBoxSize / srcH);
  const imgW = Math.max(1, Math.round(srcW * scale));
  const imgH = Math.max(1, Math.round(srcH * scale));
  const destX = Math.round((destBoxSize - imgW) / 2);
  const destY = Math.round((destBoxSize - imgH) / 2);

  glyphCtx.clearRect(0, 0, destBoxSize, destBoxSize);
  glyphCtx.drawImage(glyphImg, 0, 0, srcW, srcH, destX, destY, imgW, imgH);
  glyphCtx.globalCompositeOperation = "source-in";
  glyphCtx.fillStyle = String(glyphColor || "#111111").trim() || "#111111";
  glyphCtx.fillRect(0, 0, destBoxSize, destBoxSize);
  glyphCtx.globalCompositeOperation = "source-over";

  const glyphHalf = destBoxSize / 2;
  ctx.drawImage(glyphCanvas, x - glyphHalf, y - glyphHalf, destBoxSize, destBoxSize);
  return true;
}
