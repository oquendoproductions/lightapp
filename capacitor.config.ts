import type { CapacitorConfig } from "@capacitor/cli";
import type { PresentationOption } from "@capacitor/push-notifications";

const APP_TARGET_PRESETS = {
  map: {
    appId: "cityreport.io.map",
    appName: "CityReport.io",
    appScope: "map",
    authRedirectUrl: "cityreport://auth/callback",
  },
  hub: {
    appId: "cityreport.io.hub",
    appName: "CityReport Hub",
    appScope: "hub",
    authRedirectUrl: "cityreporthub://auth/callback",
  },
} as const;

function normalizeTarget(rawTarget: string | undefined) {
  const target = String(rawTarget || "")
    .trim()
    .toLowerCase();
  return target in APP_TARGET_PRESETS ? (target as keyof typeof APP_TARGET_PRESETS) : "map";
}

const appTarget = normalizeTarget(process.env.CITYREPORT_APP_TARGET);
const preset = APP_TARGET_PRESETS[appTarget];
const platform = String(process.env.CITYREPORT_PLATFORM || "").trim().toLowerCase();
const iosVariant = String(process.env.CITYREPORT_IOS_VARIANT || "").trim().toLowerCase();
const isMapIosDevBuild = appTarget === "map" && platform === "ios" && iosVariant === "dev";
const resolvedAppId =
  isMapIosDevBuild ? "cityreport.io.app.dev"
    : appTarget === "map" && platform === "ios" ? "cityreport.io.app"
    : appTarget === "map" && platform === "android" ? "cityreport.io.map"
    : String(process.env.CITYREPORT_APP_ID || preset.appId).trim();
const resolvedAppName = String(
  isMapIosDevBuild ? "CityReport Dev" : (process.env.CITYREPORT_APP_NAME || preset.appName)
).trim();
const resolvedAuthRedirectUrl = String(
  isMapIosDevBuild ? "cityreportdev://auth/callback" : (process.env.VITE_NATIVE_AUTH_REDIRECT_URL || preset.authRedirectUrl)
).trim();

const config: CapacitorConfig = {
  appId: resolvedAppId,
  appName: resolvedAppName,
  webDir: "dist",
  bundledWebRuntime: false,
  packageClassList: [
    "CAPBrowserPlugin",
    "GeolocationPlugin",
    "PushNotificationsPlugin",
    "BadgePlugin",
    "ExternalBrowser",
    "NotificationSettings",
  ],
  server: {
    androidScheme: "https",
  },
  plugins: {
    CityReportRuntime: {
      appTarget,
      appScope: String(process.env.VITE_NATIVE_APP_SCOPE || preset.appScope).trim() || preset.appScope,
      authRedirectUrl: resolvedAuthRedirectUrl,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"] as PresentationOption[],
    },
    Badge: {
      persist: true,
      autoClear: false,
    },
  },
};

export default config;
