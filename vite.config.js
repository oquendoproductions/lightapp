import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/src/tenant/nativeTenantSupport") ||
            id.includes("/src/tenant/nativeTenantSupportHelpers")
          ) {
            return "tenant-native-support";
          }
          if (
            id.includes("/src/auth/crossTenantAuth") ||
            id.includes("/src/auth/loginFieldStandards") ||
            id.includes("/src/platform/auth") ||
            id.includes("/src/platform/external")
          ) {
            return "map-auth-runtime-support";
          }
          if (id.includes("/src/streetlightConfidence")) {
            return "map-streetlight-runtime-support";
          }
          if (id.includes("/src/mapUiIconCatalog")) {
            return "map-ui-icon-catalog";
          }
          if (id.includes("/src/lib/mapResidentFeedRuntimeSupport")) {
            return "map-resident-feed-runtime-support";
          }
          if (
            id.includes("/src/tenant/TenantContext") ||
            id.includes("/src/tenant/contextObject") ||
            id.includes("/src/tenant/runtimeTenant") ||
            id.includes("/src/tenant/tenantConfigCache") ||
            id.includes("/src/tenant/tenantResolver") ||
            id.includes("/src/supabaseClient") ||
            id.includes("/src/lib/tenantScopedSupabase") ||
            id.includes("/src/mapUiThemeRuntimeCoreSupport") ||
            id.includes("/src/mapUiIconRuntimeCoreSupport") ||
            id.includes("/src/domainIconRendering") ||
            id.includes("/src/lib/incidentLifecycle") ||
            id.includes("/src/lib/headerDisplayName") ||
            id.includes("/src/lib/useHeaderOrganizationProfile") ||
            id.includes("/src/platform/runtime") ||
            id.includes("/src/appMeta") ||
            id.includes("/src/AppLaunchScreen")
          ) {
            return "chunk-app-support";
          }
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@react-google-maps/api")) return "vendor-google-maps";
          if (id.includes("@supabase/")) return "vendor-supabase";
          if (id.includes("@capacitor/") || id.includes("@capawesome/")) return "vendor-capacitor";
          if (id.includes("react-leaflet") || id.includes("/leaflet/")) return "vendor-leaflet";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("scheduler")
          ) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: [
      ".ngrok-free.dev",
      ".ngrok-free.app",
      ".cityreport.io",
    ],
  },
});
