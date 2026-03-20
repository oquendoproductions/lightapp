import { useContext } from "react";
import { TenantContext } from "./contextObject";

export function useTenant() {
  return useContext(TenantContext);
}
