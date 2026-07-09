import React from "react";

import {
  MAP_UI_ICON_RENDER_MODE,
  resolveRuntimeUiIconRenderMode,
  resolveRuntimeUiIconThemeMeta,
} from "./mapUiIconRuntimeSupport.js";

const ACTION_BUTTON_ICON_SRC = {
  add: {
    light: "/Icons/Buttons/add_button/add_button_blue_icon.png",
    dark: "/Icons/Buttons/add_button/add_button_white_icon.png",
  },
  edit: {
    light: "/Icons/Buttons/edit_button/edit_button_blue_icon.png",
    dark: "/Icons/Buttons/edit_button/edit_button_white_icon.png",
  },
  delete: {
    light: "/Icons/Buttons/delete_button/delete_button_red_icon.png",
    dark: "/Icons/Buttons/delete_button/delete_button_white_icon.png",
  },
};

export function AppIcon({ src, alt = "", size = 18, style = {}, renderMode = "", iconKey = "", darkMode = null, active = false }) {
  const iconSrc = String(src || "").trim();
  const resolvedRenderMode = resolveRuntimeUiIconRenderMode(iconSrc, renderMode);
  const themedMeta = resolveRuntimeUiIconThemeMeta(iconKey, iconSrc);
  const resolvedDarkMode = darkMode == null
    ? typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
    : Boolean(darkMode);
  if (iconSrc && resolvedRenderMode === MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG) {
    const {
      color,
      backgroundColor,
      WebkitMaskImage,
      maskImage,
      WebkitMaskRepeat,
      maskRepeat,
      WebkitMaskPosition,
      maskPosition,
      WebkitMaskSize,
      maskSize,
      ...restStyle
    } = style || {};
    const modeTint = resolvedDarkMode
      ? String(themedMeta?.dark_tint_color || "").trim()
      : String(themedMeta?.light_tint_color || "").trim();
    const tintColor = String(active ? (color || backgroundColor || "currentColor") : (modeTint || color || backgroundColor || "currentColor")).trim() || "currentColor";
    return (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        style={{
          width: size,
          height: size,
          display: "block",
          verticalAlign: "middle",
          flexShrink: 0,
          backgroundColor: tintColor,
          WebkitMaskImage: `url("${iconSrc}")`,
          maskImage: `url("${iconSrc}")`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          ...restStyle,
        }}
      />
    );
  }

  return (
    <img
      src={iconSrc}
      alt={alt}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        objectPosition: "center center",
        display: "block",
        verticalAlign: "middle",
        ...style,
      }}
    />
  );
}

function resolveImperativeAppIconDarkMode(darkMode = null) {
  if (darkMode != null) return Boolean(darkMode);
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function createRuntimeAppIconElement({ src, size = 18, iconKey = "", darkMode = null, active = false, style = {} } = {}) {
  const iconSrc = String(src || "").trim();
  if (!iconSrc) return null;

  const resolvedRenderMode = resolveRuntimeUiIconRenderMode(iconSrc, "");
  const themedMeta = resolveRuntimeUiIconThemeMeta(iconKey, iconSrc);
  const resolvedDarkMode = resolveImperativeAppIconDarkMode(darkMode);
  const nextStyle = style && typeof style === "object" ? style : {};

  if (resolvedRenderMode === MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG) {
    const tintColor = String(
      active
        ? (nextStyle.color || nextStyle.backgroundColor || "currentColor")
        : ((resolvedDarkMode ? themedMeta?.dark_tint_color : themedMeta?.light_tint_color)
          || nextStyle.color
          || nextStyle.backgroundColor
          || "currentColor")
    ).trim() || "currentColor";

    const span = document.createElement("span");
    Object.assign(span.style, {
      width: `${size}px`,
      height: `${size}px`,
      display: "block",
      verticalAlign: "middle",
      flexShrink: "0",
      backgroundColor: tintColor,
      WebkitMaskImage: `url("${iconSrc}")`,
      maskImage: `url("${iconSrc}")`,
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center",
      WebkitMaskSize: "contain",
      maskSize: "contain",
      ...nextStyle,
    });
    return span;
  }

  const img = document.createElement("img");
  img.src = iconSrc;
  img.alt = "";
  Object.assign(img.style, {
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "contain",
    objectPosition: "center center",
    display: "block",
    verticalAlign: "middle",
    ...nextStyle,
  });
  return img;
}

export function actionButtonIconSrc(action, { darkMode = false, emphasis = "secondary" } = {}) {
  const key = String(action || "").trim().toLowerCase();
  const iconSet = ACTION_BUTTON_ICON_SRC[key] || ACTION_BUTTON_ICON_SRC.edit;
  if (emphasis === "filled" || emphasis === "danger") return iconSet.dark;
  return darkMode ? iconSet.dark : iconSet.light;
}

export function ActionButtonIcon({ action, darkMode = false, emphasis = "secondary", size = 18 }) {
  return (
    <AppIcon
      src={actionButtonIconSrc(action, { darkMode, emphasis })}
      alt=""
      size={size}
    />
  );
}
