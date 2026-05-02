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

const config: CapacitorConfig = {
  appId: String(process.env.CITYREPORT_APP_ID || preset.appId).trim(),
  appName: String(process.env.CITYREPORT_APP_NAME || preset.appName).trim(),
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
  plugins: {
    CityReportRuntime: {
      appTarget,
      appScope: String(process.env.VITE_NATIVE_APP_SCOPE || preset.appScope).trim() || preset.appScope,
      authRedirectUrl: String(process.env.VITE_NATIVE_AUTH_REDIRECT_URL || preset.authRedirectUrl).trim(),
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
