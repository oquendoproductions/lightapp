export function makeCoordsHashedDisplayIdFromIncidentId(prefixRaw, incidentId, fallbackDisplayId = "") {
  const s = String(incidentId || "").trim();
  const prefix = String(prefixRaw || "").trim().toUpperCase();
  if (!s) return String(fallbackDisplayId || `${prefix}0000000000`).trim();

  const m = s.match(/^[^:]+:([-]?\d+(?:\.\d+)?):([-]?\d+(?:\.\d+)?)$/);
  if (m) {
    const lat5 = String(Math.abs(Number(m[1])).toFixed(5).split(".")[1] || "00000").slice(0, 5).padEnd(5, "0");
    const lng5 = String(Math.abs(Number(m[2])).toFixed(5).split(".")[1] || "00000").slice(0, 5).padEnd(5, "0");
    if (/^\d{5}$/.test(lat5) && /^\d{5}$/.test(lng5)) return `${prefix}${lng5}${lat5}`;
  }

  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `${prefix}${String(h >>> 0).padStart(10, "0").slice(-10)}`;
}
