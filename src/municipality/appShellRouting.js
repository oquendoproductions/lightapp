function cleanPath(rawPath) {
  const path = String(rawPath || "/")
    .trim()
    .split(/[?#]/)[0];
  if (!path.startsWith("/")) return `/${path}`;
  return path || "/";
}

export function stripTenantPathPrefix(pathname, tenantKey) {
  const path = cleanPath(pathname);
  const key = String(tenantKey || "").trim().toLowerCase();
  if (!key) return path;
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) return "/";
  if (String(parts[0] || "").trim().toLowerCase() !== key) return path;
  const remainder = parts.slice(1).join("/");
  return remainder ? `/${remainder}` : "/";
}

export function normalizeMunicipalityAppPath(pathname, tenantKey) {
  const stripped = stripTenantPathPrefix(pathname, tenantKey);
  if (
    stripped === "/" ||
    stripped === "/home" ||
    stripped.startsWith("/home/")
  ) {
    return "/";
  }
  if (
    stripped === "/report" ||
    stripped.startsWith("/report/") ||
    stripped === "/reports" ||
    stripped.startsWith("/reports/") ||
    stripped === "/gmaps" ||
    stripped.startsWith("/gmaps/")
  ) {
    return "/report";
  }
  if (stripped === "/alerts" || stripped.startsWith("/alerts/")) return "/alerts";
  if (stripped === "/events" || stripped.startsWith("/events/")) return "/events";
  if (
    stripped === "/preferences" ||
    stripped.startsWith("/preferences/") ||
    stripped === "/account" ||
    stripped.startsWith("/account/") ||
    stripped === "/notifications" ||
    stripped.startsWith("/notifications/")
  ) {
    return "/account";
  }
  return "/";
}

export function buildMunicipalityAppHref(currentPathname, tenantKey, targetPath) {
  const current = cleanPath(currentPathname);
  const target = normalizeMunicipalityAppPath(targetPath, tenantKey);
  const key = String(tenantKey || "").trim().toLowerCase();
  const parts = current.split("/").filter(Boolean);
  const needsTenantPrefix = key && String(parts[0] || "").trim().toLowerCase() === key;
  const prefix = needsTenantPrefix ? `/${key}` : "";
  if (target === "/") return prefix || "/";
  return `${prefix}${target}`;
}
