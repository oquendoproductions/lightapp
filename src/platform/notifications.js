import { isNativeAppRuntime } from "./runtime.js";

let notificationSettingsPluginPromise;

function readWindowCapacitor() {
  if (typeof window === "undefined" || !window?.Capacitor) return null;
  return window.Capacitor;
}

function readDirectNotificationSettingsPlugin() {
  return readWindowCapacitor()?.Plugins?.NotificationSettings || null;
}

function enableNativeBridgeLogging() {
  const capacitor = readWindowCapacitor();
  if (!capacitor) return false;
  capacitor.isLoggingEnabled = true;
  return true;
}

async function loadNotificationSettingsPlugin() {
  if (!isNativeAppRuntime()) return null;
  const directPlugin = readDirectNotificationSettingsPlugin();
  if (directPlugin?.getSettings || directPlugin?.requestFullAuthorization || directPlugin?.openAppNotificationSettings) {
    return directPlugin;
  }
  if (!notificationSettingsPluginPromise) {
    notificationSettingsPluginPromise = import("@capacitor/core")
      .then(({ registerPlugin }) => registerPlugin("NotificationSettings"))
      .catch(() => null);
  }
  return notificationSettingsPluginPromise;
}

async function callNotificationSettingsMethod(methodName, options = {}) {
  enableNativeBridgeLogging();
  const plugin = await loadNotificationSettingsPlugin();
  const pluginMethod = plugin?.[methodName];
  if (typeof pluginMethod === "function") {
    return await pluginMethod.call(plugin, options);
  }
  const capacitor = readWindowCapacitor();
  if (typeof capacitor?.nativePromise === "function") {
    return await capacitor.nativePromise("NotificationSettings", methodName, options);
  }
  return null;
}

export function getNativeNotificationBridgeDebug() {
  const capacitor = readWindowCapacitor();
  const pluginHeaders = Array.isArray(capacitor?.PluginHeaders) ? capacitor.PluginHeaders : [];
  const notificationHeader = pluginHeaders.find((header) => String(header?.name || "") === "NotificationSettings") || null;
  const directPlugin = readDirectNotificationSettingsPlugin();
  return {
    hasCapacitor: Boolean(capacitor),
    nativeBridgeLoggingEnabled: Boolean(capacitor?.isLoggingEnabled),
    hasNativePromise: typeof capacitor?.nativePromise === "function",
    hasDirectPluginObject: Boolean(directPlugin),
    directPluginKeys: directPlugin ? Object.keys(directPlugin).sort() : [],
    hasNotificationHeader: Boolean(notificationHeader),
    notificationHeaderMethods: Array.isArray(notificationHeader?.methods)
      ? notificationHeader.methods.map((method) => String(method?.name || "")).filter(Boolean)
      : [],
  };
}

export async function getNativeNotificationSettings() {
  try {
    return await callNotificationSettingsMethod("getSettings");
  } catch {
    return null;
  }
}

export async function requestNativeFullNotificationAuthorization() {
  try {
    return await callNotificationSettingsMethod("requestFullAuthorization");
  } catch {
    return null;
  }
}

export async function openNativeNotificationSettings() {
  try {
    await callNotificationSettingsMethod("openAppNotificationSettings");
    return true;
  } catch {
    return false;
  }
}
