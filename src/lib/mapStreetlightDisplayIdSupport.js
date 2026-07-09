export function displayLightId(lightUuid, slIdByUuid) {
  const key = String(lightUuid || "").trim();
  return (slIdByUuid?.get?.(key) || "").trim() || key || "—";
}
