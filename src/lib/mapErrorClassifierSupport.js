export function isExpectedPermissionErrorShared(error) {
  if (!error) return false;
  const statusNum = Number(error?.status);
  const rawCode = String(error?.code || "").toUpperCase();
  const combined = `${String(error?.message || "").toLowerCase()} ${String(error?.details || "").toLowerCase()} ${String(error?.hint || "").toLowerCase()}`;
  if (statusNum === 401 || statusNum === 403) return true;
  if (rawCode === "42501" || rawCode === "PGRST301") return true;
  return (
    combined.includes("permission denied")
    || combined.includes("row-level security")
    || combined.includes("forbidden")
    || combined.includes("not authorized")
  );
}

export function isMissingFunctionErrorShared(error) {
  if (!error) return false;
  const rawCode = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return rawCode === "42883"
    || rawCode === "PGRST202"
    || (message.includes("function") && message.includes("exist"));
}
