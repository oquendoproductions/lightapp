import { createContext } from "react";

export const TenantContext = createContext({
  mode: "marketing_home",
  env: "prod",
  tenantKey: null,
  tenantConfig: null,
  loading: false,
  ready: true,
  error: "",
});
