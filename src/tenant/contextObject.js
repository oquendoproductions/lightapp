import { createContext } from "react";

export const TenantContext = createContext({
  mode: "marketing_home",
  env: "prod",
  appScope: "map",
  tenantKey: null,
  tenantConfig: null,
  loading: false,
  ready: true,
  error: "",
  availableTenants: [],
  initialTenantSelectionPending: false,
  switchingTenant: "",
  completeInitialTenantChoice: async () => false,
  switchTenant: async () => false,
});
