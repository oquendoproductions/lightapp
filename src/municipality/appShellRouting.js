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

function stripHubPathPrefix(pathname) {
  const path = cleanPath(pathname);
  if (path === "/hub" || path === "/hub/") return "/";
  if (path.startsWith("/hub/")) return path.slice(4) || "/";
  return path;
}

export function normalizeMunicipalityAppPath(pathname, tenantKey) {
  const stripped = stripHubPathPrefix(stripTenantPathPrefix(pathname, tenantKey));
  if (
    stripped === "/" ||
    stripped === "/home" ||
    stripped.startsWith("/home/")
  ) {
    return "/";
  }
  if (stripped === "/reports" || stripped.startsWith("/reports/")) return "/reports";
  if (
    stripped === "/report" ||
    stripped.startsWith("/report/") ||
    stripped === "/gmaps" ||
    stripped.startsWith("/gmaps/")
  ) {
    return "/report";
  }
  if (
    stripped === "/alerts/create" ||
    stripped.startsWith("/alerts/create/") ||
    stripped === "/alerts/schedule" ||
    stripped.startsWith("/alerts/schedule/")
  ) {
    return "/alerts/create";
  }
  if (stripped === "/alerts" || stripped.startsWith("/alerts/")) return "/alerts";
  if (
    stripped === "/events/create" ||
    stripped.startsWith("/events/create/") ||
    stripped === "/events/schedule" ||
    stripped.startsWith("/events/schedule/")
  ) {
    return "/events/create";
  }
  if (stripped === "/events" || stripped.startsWith("/events/")) return "/events";
  if (
    stripped === "/preferences" ||
    stripped.startsWith("/preferences/") ||
    stripped === "/notifications" ||
    stripped.startsWith("/notifications/")
  ) {
    return "/settings/account-notifications";
  }
  if (
    stripped === "/account" ||
    stripped.startsWith("/account/")
  ) {
    return "/settings/account-info";
  }
  if (
    stripped === "/settings" ||
    stripped.startsWith("/settings/")
  ) {
    return stripped;
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
  const hubBase = `${prefix}/hub`;
  if (target === "/") return hubBase;
  return `${hubBase}${target}`;
}
